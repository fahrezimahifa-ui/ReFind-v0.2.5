<?php
declare(strict_types=1);
// CLI-only test harness boundary. Never called by application HTTP endpoints.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

function qa_same_path(string $a, string $b): bool
{
    $a = str_replace('\\', '/', $a); $b = str_replace('\\', '/', $b);
    return PHP_OS_FAMILY === 'Windows' ? strcasecmp($a, $b) === 0 : $a === $b;
}

function assert_dev_installation(string $target): void
{
    $resolved = realpath($target);
    $markerPath = $target . '/.refind-dev.json';
    $marker = is_file($markerPath) ? json_decode((string) file_get_contents($markerPath), true) : null;
    $c = app_config();
    if (getenv('REFIND_TEST_PROFILE') !== 'ui-ux-dev' || !$resolved || !qa_same_path($resolved, $target) || basename($resolved) !== 'refind-dev' ||
        ($marker['profile'] ?? '') !== 'ui-ux-dev' || ($marker['project'] ?? '') !== 'refind-ui-ux-dev' ||
        !in_array($c['db_host'], ['database','upgrade-database','recovery-database'], true) || $c['db_name'] !== 'refind_db_ui_ux_dev' || $c['db_user'] !== 'refind_dev' ||
        $c['base_path'] !== '/refind-dev/' || $c['session_name'] !== 'refind_ui_ux_dev') {
        throw new RuntimeException('Development isolation check failed.');
    }
    foreach (['app', 'storage', 'storage/auth', 'storage/sessions', 'storage/setup', 'storage/items', 'storage/evidence', 'storage/claims', 'storage/avatars'] as $relative) {
        $path = $target . '/' . $relative;
        if (file_exists($path) && (!realpath($path) || !qa_same_path((string) realpath($path), $path))) throw new RuntimeException('Development paths cannot redirect to another installation.');
    }
}

function assert_xampp_stage_installation(string $target): void
{
    $resolved = realpath($target);
    $markerPath = $target . '/.refind-xampp-stage.json';
    $marker = is_file($markerPath) ? json_decode((string) file_get_contents($markerPath), true) : null;
    $source = is_string($marker['source'] ?? null) ? realpath($marker['source']) : false;
    $c = app_config();
    if (getenv('REFIND_TEST_PROFILE') !== 'xampp-stage' || !$resolved || !qa_same_path($resolved, $target) || basename($resolved) !== 'refind-xampp-stage' ||
        ($marker['profile'] ?? '') !== 'xampp-stage' || ($marker['port'] ?? 0) !== 3311 || !$source || qa_same_path($source, $resolved) ||
        !qa_same_path(dirname($source) . '/refind-xampp-stage', $resolved) ||
        $c['db_host'] !== '127.0.0.1' || $c['db_port'] !== 3311 || $c['db_name'] !== 'refind_db_0_2_0_test' || $c['db_user'] !== 'refind_stage' ||
        $c['base_path'] !== '/refind-xampp-stage/' || $c['session_name'] !== 'refind_xampp_stage') {
        throw new RuntimeException('XAMPP staging isolation check failed.');
    }
    foreach (['app', 'storage', 'storage/auth', 'storage/sessions', 'storage/setup', 'storage/items', 'storage/evidence', 'storage/claims', 'storage/avatars'] as $relative) {
        $path = $target . '/' . $relative;
        if (file_exists($path) && (!realpath($path) || !qa_same_path((string) realpath($path), $path))) throw new RuntimeException('Staging paths cannot redirect to another installation.');
    }
}

function assert_qa_installation(string $target): void
{
    if (getenv('REFIND_TEST_PROFILE') === 'ui-ux-dev') { assert_dev_installation($target); return; }
    if (getenv('REFIND_TEST_PROFILE') === 'xampp-stage') { assert_xampp_stage_installation($target); return; }
    $resolved = realpath($target);
    if (!$resolved || !qa_same_path($resolved, $target) || basename($resolved) !== 'ReFind_0.2.0_Test') {
        throw new RuntimeException('QA target must be the real isolated test directory.');
    }
    $marker = json_decode((string) file_get_contents($resolved . '/.refind-b02-test.json'), true, 32, JSON_THROW_ON_ERROR);
    $source = is_array($marker) && is_string($marker['source'] ?? null) ? realpath($marker['source']) : false;
    if (!$source || qa_same_path($source, $resolved) || !qa_same_path(dirname($source) . '/ReFind_0.2.0_Test', $resolved)) {
        throw new RuntimeException('QA ownership marker does not identify a separate sibling source.');
    }
    foreach (['app', 'storage', 'storage/auth', 'storage/sessions', 'storage/setup', 'storage/items', 'storage/evidence', 'storage/claims', 'storage/avatars'] as $relative) {
        $path = $resolved . '/' . $relative;
        if (file_exists($path) && (!realpath($path) || !qa_same_path((string) realpath($path), $path))) {
            throw new RuntimeException('QA paths must not redirect to another installation.');
        }
    }
    $config = app_config();
    if ($config['db_name'] !== 'refind_db_0_2_0_test' || $config['base_path'] !== '/ReFind_0.2.0_Test/' || $config['session_name'] !== 'refind_020_test') {
        throw new RuntimeException('QA requires its own database, URL and session name.');
    }
}

if (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    try {
        $target = $argv[1] ?? dirname(__DIR__);
        require $target . '/app/config.php';
        assert_qa_installation($target);
        echo "{\"qa_isolated\":true}\n";
    } catch (Throwable $error) {
        fwrite(STDERR, "QA isolation check failed. Inspect the target, ownership marker and configuration.\n");
        exit(1);
    }
}
