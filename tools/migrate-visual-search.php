<?php
declare(strict_types=1);
require __DIR__ . '/qa-guard.php';
require __DIR__ . '/../app/visual-schema.php';

try {
    assert_qa_installation(app_root());
    if (app_config()['db_name'] !== 'refind_db_0_2_0_test') throw new RuntimeException('Expected the isolated test database.');
    $lock = fopen(storage_dir('setup') . '/setup.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Setup lock unavailable.');
    try {
        $receiptPath = storage_dir('setup') . '/database-receipt.json';
        $receipt = json_decode((string) @file_get_contents($receiptPath), true, 32, JSON_THROW_ON_ERROR);
        $manifest = json_decode((string) file_get_contents(app_root() . '/database/manifest.json'), true, 32, JSON_THROW_ON_ERROR);
        if (($receipt['database'] ?? null) !== app_config()['db_name'] || ($receipt['status'] ?? null) !== 'ready' ||
            !in_array($receipt['sql_hashes'] ?? [], [visual_previous_schema_files(), $manifest['files']], true)) {
            throw new RuntimeException('Unexpected QA database receipt.');
        }
        $schema = (string) file_get_contents(app_root() . '/database/schema.sql');
        if (hash('sha256', $schema) !== $manifest['files']['schema.sql'] ||
            !preg_match('/^CREATE TABLE IF NOT EXISTS `item_photo_embeddings` \([\s\S]+?^\) ENGINE=[^;]+;/m', $schema, $ddl)) {
            throw new RuntimeException('Schema manifest mismatch.');
        }
        $current = array_column(rows("SELECT TABLE_NAME FROM information_schema.TABLES
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'"), 'TABLE_NAME');
        $required = array_diff($manifest['tables'], ['item_photo_embeddings']);
        if (array_diff($required, $current) || array_diff($current, $manifest['tables']) ||
            !row("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
                AND TABLE_NAME='users' AND COLUMN_NAME='avatar_path'")) {
            throw new RuntimeException('Unexpected pre-migration schema.');
        }
        db()->query($ddl[0]);
        verify_visual_schema();
        $receipt['tables'] = count($manifest['tables']);
        $receipt['sql_hashes'] = $manifest['files'];
        $temporary = tempnam(storage_dir('setup'), 'visual-receipt-');
        if ($temporary === false) throw new RuntimeException('Receipt staging unavailable.');
        try {
            if (file_put_contents($temporary, json_encode($receipt, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)) === false ||
                !rename($temporary, $receiptPath)) throw new RuntimeException('Could not update QA receipt.');
        } finally {
            if (is_file($temporary)) unlink($temporary);
        }
        echo "{\"visual_schema\":\"ready\"}\n";
    } finally {
        fclose($lock);
    }
} catch (Throwable $error) {
    fwrite(STDERR, "Visual migration stopped. Verify the QA guard, baseline receipt and schema.\n");
    exit(1);
}
