<?php
declare(strict_types=1);
// Private CLI control for owned synthetic QA only; never an application endpoint.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../app/config.php';
require __DIR__ . '/qa-guard.php';
try {
    assert_qa_installation(app_root());
    $action = $argv[1] ?? '';
    $run = $argv[2] ?? '';
    if (!preg_match('/^registration-[a-f0-9]{16}$/D', $run)) throw new RuntimeException('Invalid QA run.');
    $local = app_root() . '/app/config.local.php';
    $limiter = storage_dir('auth') . '/registration-attempts.json';
    $statePath = storage_dir('setup') . '/registration-qa-state.json';
    foreach ([$local, $limiter, $statePath] as $path) {
        if (file_exists($path) && !qa_same_path((string) realpath($path), $path)) throw new RuntimeException('QA file redirection refused.');
    }
    if ($action === 'begin') {
        if (file_exists($statePath)) throw new RuntimeException('A registration QA run already owns this environment.');
        $state = ['run' => $run, 'config' => file_get_contents($local), 'limiter' => is_file($limiter) ? file_get_contents($limiter) : null, 'trigger' => false];
        if (!is_string($state['config'])) throw new RuntimeException('Missing QA configuration.');
        $handle = fopen($statePath, 'x');
        if (!$handle) throw new RuntimeException('Cannot reserve QA state.');
        try { if (fwrite($handle, json_encode($state, JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('Cannot save QA state.'); }
        finally { fclose($handle); }
    } else {
        $state = json_decode((string) file_get_contents($statePath), true, 32, JSON_THROW_ON_ERROR);
        if (($state['run'] ?? '') !== $run) throw new RuntimeException('QA run ownership mismatch.');
    }
    if (in_array($action, ['begin', 'enable', 'disable'], true)) {
        $config = require $local;
        $config['registration_enabled'] = $action !== 'disable';
        $config['registration_ip_limit'] = 10;
        $config['registration_window_seconds'] = 900;
        validate_app_config(array_replace(app_defaults(), $config));
        if (file_put_contents($local, "<?php\nreturn " . var_export($config, true) . ";\n", LOCK_EX) === false) throw new RuntimeException('Cannot configure QA registration.');
    } elseif (in_array($action, ['reset', 'expire'], true)) {
        $file = fopen($limiter, 'c+');
        if (!$file) throw new RuntimeException('Cannot open QA limiter.');
        try {
            if (!flock($file, LOCK_EX)) throw new RuntimeException('Cannot lock QA limiter.');
            $buckets = $action === 'reset' ? [] : json_decode((string) stream_get_contents($file), true, 64, JSON_THROW_ON_ERROR);
            foreach ($buckets as &$bucket) $bucket['start'] = time() - 901;
            unset($bucket);
            $bytes = json_encode($buckets, JSON_THROW_ON_ERROR);
            if (!rewind($file) || !ftruncate($file, 0) || fwrite($file, $bytes) !== strlen($bytes) || !fflush($file)) throw new RuntimeException('Cannot save QA limiter.');
        } finally { flock($file, LOCK_UN); fclose($file); }
    } elseif (in_array($action, ['fail-on', 'fail-off', 'end'], true)) {
        require __DIR__ . '/../app/db.php';
        if ($action === 'fail-on') {
            if ($state['trigger'] || row("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='registration_qa_failpoint'")) throw new RuntimeException('QA trigger already exists.');
            db()->query("CREATE TRIGGER registration_qa_failpoint BEFORE INSERT ON users FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic registration rollback'");
            $state['trigger'] = true;
        } elseif ($state['trigger']) {
            db()->query('DROP TRIGGER registration_qa_failpoint');
            $state['trigger'] = false;
        }
        if ($action === 'end') {
            if (file_put_contents($local, $state['config'], LOCK_EX) === false) throw new RuntimeException('Cannot restore QA configuration.');
            if ($state['limiter'] === null) { if (is_file($limiter) && !unlink($limiter)) throw new RuntimeException('Cannot restore QA limiter.'); }
            elseif (file_put_contents($limiter, $state['limiter'], LOCK_EX) === false) throw new RuntimeException('Cannot restore QA limiter.');
            if (!unlink($statePath)) throw new RuntimeException('Cannot release QA state.');
        } elseif (file_put_contents($statePath, json_encode($state, JSON_THROW_ON_ERROR), LOCK_EX) === false) throw new RuntimeException('Cannot save QA state.');
    } else throw new RuntimeException('Unknown QA action.');
    echo "{\"configured\":true}\n";
} catch (Throwable $error) { fwrite(STDERR, "Registration QA control refused or failed; inspect owned QA state.\n"); exit(1); }
