<?php
declare(strict_types=1);
// CLI-only ownership boundary for the private native runtime rehearsal.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

function runtime_qa_identity(string $target): array
{
    $root = getenv('REFIND_RUNTIME_QA_ROOT') ?: '';
    $source = getenv('REFIND_RUNTIME_QA_SOURCE') ?: '';
    $parent = (getenv('LOCALAPPDATA') ?: '') . '/ReFindRuntimeQA';
    $resolved = realpath($root);
    $marker = $resolved && is_file($resolved . '/.refind-runtime-qa.json')
        ? json_decode((string) file_get_contents($resolved . '/.refind-runtime-qa.json'), true) : null;
    $c = app_config();
    if (getenv('REFIND_TEST_PROFILE') !== 'runtime-upgrade' || !$resolved ||
        !qa_same_path($resolved, $root) || !realpath($parent) ||
        !qa_same_path(dirname($resolved), (string) realpath($parent)) ||
        !preg_match('/^security-modernization-[a-f0-9]{16}$/D', basename($resolved)) ||
        !qa_same_path($target, $resolved . '/www/ReFind_0.2.3') || !realpath($target) ||
        !qa_same_path((string) realpath($target), $target) ||
        ($marker['profile'] ?? '') !== 'runtime-upgrade' || ($marker['phase'] ?? '') !== 'qa-enabled' ||
        ($marker['fixture_mutations_enabled'] ?? false) !== true ||
        ($marker['ports'][0] ?? 0) !== 8086 || ($marker['ports'][1] ?? 0) !== 8446 ||
        !qa_same_path((string) ($marker['root'] ?? ''), $resolved) ||
        !$source || !realpath($source) || !realpath((string) ($marker['source'] ?? '')) ||
        !qa_same_path((string) realpath($source), (string) realpath($marker['source'])) ||
        qa_same_path((string) realpath($source), $target) ||
        $c['db_host'] !== '127.0.0.1' || !in_array($c['db_port'], [3312, 3313], true) ||
        $c['db_name'] !== 'refind_db_0_2_0_test' || $c['db_user'] !== 'refind_runtime_qa' ||
        $c['base_path'] !== '/ReFind_0.2.3/' || $c['session_name'] !== 'refind_runtime_upgrade_qa') {
        throw new RuntimeException('Native QA ownership/configuration check failed.');
    }
    // Check ancestors and all private collection roots before any fixture/SQL mutation.
    foreach ([(string) realpath($parent), $root, $root . '/www', $target,
              $target . '/app', $target . '/storage',
              ...array_map(fn($name) => $target . '/storage/' . $name,
                  ['auth', 'sessions', 'setup', 'items', 'evidence', 'claims', 'avatars'])] as $path) {
        if (file_exists($path) && (!realpath($path) || !qa_same_path((string) realpath($path), $path))) {
            throw new RuntimeException('Native QA paths cannot redirect to another installation.');
        }
    }
    $data = $root . ($c['db_port'] === 3312 ? '/db/data' : '/db-lts/data');
    if (!realpath($data) || !qa_same_path((string) realpath($data), $data)) {
        throw new RuntimeException('Native QA datadir is missing or redirected.');
    }
    return [$root, $c, $data];
}

function assert_runtime_upgrade_installation(string $target): void
{
    [, $c, $expectedData] = runtime_qa_identity($target);
    // No database is selected yet. Read server identity before any DDL/DML.
    $probe = mysqli_init();
    $probe->options(MYSQLI_OPT_CONNECT_TIMEOUT, 2);
    $probe->real_connect($c['db_host'], $c['db_user'], $c['db_password'], '', $c['db_port']);
    $identity = $probe->query('SELECT @@port AS port, @@datadir AS datadir')->fetch_assoc();
    $probe->close();
    if ((int) $identity['port'] !== $c['db_port'] ||
        !realpath($identity['datadir']) ||
        !qa_same_path((string) realpath($identity['datadir']), $expectedData)) {
        throw new RuntimeException('Foreign MariaDB server refused before mutation.');
    }
}
