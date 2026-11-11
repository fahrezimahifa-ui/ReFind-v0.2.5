<?php
declare(strict_types=1);
require __DIR__ . '/qa-guard.php';
require __DIR__ . '/../app/visual-schema.php';

try {
    $config = app_config();
    $main = ($argv[1] ?? '') === '--main-disabled';
    $dryRun = end($argv) === '--dry-run';
    if ($main) {
        if (!in_array(count($argv), [4,5], true) || ($argv[2] ?? '') !== '--backup-receipt' ||
            (count($argv) === 5 && !$dryRun) ||
            !qa_same_path(app_root(), 'C:/xampp/htdocs/ReFind_0.2.3') ||
            $config['db_name'] !== 'refind_db_0_2_0' || $config['db_host'] !== '127.0.0.1' || $config['db_port'] !== 3306 ||
            $config['base_path'] !== '/ReFind_0.2.3/' || $config['session_name'] !== 'refind_020' ||
            $config['visual_search_enabled'] !== false || $config['visual_search_students'] !== []) {
            throw new RuntimeException('Main migration requires the explicit disabled local installation.');
        }
        foreach (['app','storage','storage/setup','storage/items','storage/evidence','storage/claims'] as $relative) {
            $path = app_root() . '/' . $relative;
            if (!realpath($path) || !qa_same_path((string)realpath($path), $path)) throw new RuntimeException('Redirected main path refused.');
        }
        $backupRoot = realpath(storage_dir('setup') . '/backups');
        $backupReceipt = realpath($argv[3]);
        if (!$backupRoot || !$backupReceipt || basename($backupReceipt) !== 'receipt.json' || is_link($argv[3]) ||
            !qa_same_path(dirname(dirname($backupReceipt)), $backupRoot) ||
            !preg_match('/^release-before-[0-9-]+$/D', basename(dirname($backupReceipt)))) {
            throw new RuntimeException('Expected the verified private backup receipt.');
        }
        $backup = json_decode((string)file_get_contents($backupReceipt), true, 16, JSON_THROW_ON_ERROR);
        if (($backup['database'] ?? '') !== $config['db_name']) throw new RuntimeException('Backup database differs.');
        foreach (['database.sql','storage.zip'] as $name) {
            $hash = $backup['files'][$name] ?? '';
            $file = dirname($backupReceipt) . '/' . $name;
            if (!is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash) || is_link($file) ||
                !is_file($file) || !hash_equals($hash, (string)hash_file('sha256', $file))) {
                throw new RuntimeException('Backup contents differ from their receipt.');
            }
        }
    } else {
        if (count($argv) > 2 || (count($argv) === 2 && !$dryRun)) throw new RuntimeException('Invalid migration arguments.');
        assert_qa_installation(app_root());
        if ($config['db_name'] !== 'refind_db_0_2_0_test') throw new RuntimeException('Expected the isolated test database.');
    }
    $lock = fopen(storage_dir('setup') . '/setup.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Setup lock unavailable.');
    try {
        $receiptPath = storage_dir('setup') . '/database-receipt.json';
        $receipt = json_decode((string) @file_get_contents($receiptPath), true, 32, JSON_THROW_ON_ERROR);
        $manifest = json_decode((string) file_get_contents(app_root() . '/database/manifest.json'), true, 32, JSON_THROW_ON_ERROR);
        if (($receipt['database'] ?? null) !== app_config()['db_name'] || ($receipt['status'] ?? null) !== 'ready' ||
            !in_array($receipt['sql_hashes'] ?? [], [visual_previous_schema_files(), $manifest['files']], true)) {
            throw new RuntimeException('Unexpected database receipt.');
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
        if ($dryRun) {
            if (in_array('item_photo_embeddings', $current, true)) verify_visual_schema();
            echo json_encode(['visual_schema'=>'eligible','target'=>$main ? 'main-disabled' : 'qa','dry_run'=>true], JSON_THROW_ON_ERROR) . PHP_EOL;
            exit;
        }
        db()->query($ddl[0]);
        verify_visual_schema();
        $receipt['tables'] = count($manifest['tables']);
        $receipt['sql_hashes'] = $manifest['files'];
        $temporary = tempnam(storage_dir('setup'), 'visual-receipt-');
        if ($temporary === false) throw new RuntimeException('Receipt staging unavailable.');
        try {
            if (file_put_contents($temporary, json_encode($receipt, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)) === false ||
                !rename($temporary, $receiptPath)) throw new RuntimeException('Could not update database receipt.');
        } finally {
            if (is_file($temporary)) unlink($temporary);
        }
        echo "{\"visual_schema\":\"ready\"}\n";
    } finally {
        fclose($lock);
    }
} catch (Throwable $error) {
    fwrite(STDERR, "Visual migration stopped. Verify the target guard, main backup if applicable, baseline receipt and schema.\n");
    exit(1);
}
