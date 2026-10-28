<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../app/db.php';
try {
    $contract = json_decode((string) file_get_contents(app_root() . '/docs/schema-contract.json'), true, 64, JSON_THROW_ON_ERROR);
    $tables = []; $schema = [];
    db()->begin_transaction(MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
    foreach ($contract['tables'] as $name => $table) {
        if (!preg_match('/^[a-z_]+$/D', $name)) throw new RuntimeException('Invalid contract.');
        $records = rows('SELECT * FROM `' . $name . '` ORDER BY `' . $table['primary'][0] . '`');
        $tables[$name] = hash('sha256', json_encode($records, JSON_THROW_ON_ERROR));
        $schema[$name] = row('SHOW CREATE TABLE `' . $name . '`');
    }
    db()->rollback();
    $files = [];
    foreach (['items', 'evidence', 'claims'] as $collection) {
        foreach (glob(app_root() . '/storage/' . $collection . '/*') ?: [] as $path) {
            if (is_file($path)) $files[$collection . '/' . basename($path)] = hash_file('sha256', $path);
        }
    }
    foreach (['app/config.local.php', 'storage/auth/secret.json'] as $relative) {
        $path = app_root() . '/' . $relative;
        $files[$relative] = is_file($path) ? hash_file('sha256', $path) : null;
    }
    ksort($files);
    echo json_encode(['database' => app_config()['db_name'], 'tables' => $tables, 'schema_sha256' => hash('sha256', json_encode($schema, JSON_THROW_ON_ERROR)), 'private_files_sha256' => hash('sha256', json_encode($files, JSON_THROW_ON_ERROR))], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, "Fingerprint unavailable; check service/configuration access.\n"); exit(1);
}
