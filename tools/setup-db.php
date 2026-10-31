<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../app/db.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function run_statements(string $file, bool $views = false): void
{
    $sql = preg_replace('/^--.*$/m', '', (string) file_get_contents($file));
    foreach (explode(';', $sql) as $statement) {
        $statement = trim($statement);
        if ($statement === '') continue;
        if ($views && preg_match('/VIEW `([^`]+)`/', $statement, $match) && row('SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [$match[1]])) continue;
        db()->query($statement);
    }
}

try {
    $config = app_config();
    if ($config['db_name'] === 'refind_db_ui_ux_dev') { require_once __DIR__ . '/qa-guard.php'; assert_dev_installation(app_root()); }
    if (basename(app_root()) === 'refind-xampp-stage' || $config['db_port'] === 3311) { require_once __DIR__ . '/qa-guard.php'; assert_xampp_stage_installation(app_root()); }
    $manifest = json_decode(file_get_contents(app_root() . '/database/manifest.json'), true, 64, JSON_THROW_ON_ERROR);
    foreach ($manifest['files'] as $file => $hash) {
        if (hash_file('sha256', app_root() . '/database/' . $file) !== $hash) throw new RuntimeException('SQL manifest mismatch; inspect before setup.');
    }
    foreach (['', 'setup', 'auth', 'sessions', 'items', 'evidence', 'claims', 'avatars'] as $dir) {
        $path = storage_dir($dir);
        if (!is_dir($path) && !mkdir($path, 0700, true)) throw new RuntimeException('Cannot create private storage.');
    }
    $lock = fopen(storage_dir('setup') . '/setup.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Cannot lock setup.');
    $receiptPath = storage_dir('setup') . '/database-receipt.json';
    $receipt = is_file($receiptPath) ? json_decode(file_get_contents($receiptPath), true, 64, JSON_THROW_ON_ERROR) : null;
    $previous = json_decode((string) file_get_contents(app_root() . '/database/migrations/avatars-previous-files.json'), true, 32, JSON_THROW_ON_ERROR);
    if ($receipt && ($receipt['database'] !== $config['db_name'] || !in_array($receipt['sql_hashes'], [$manifest['files'], $previous], true))) throw new RuntimeException('Setup receipt/configuration mismatch.');
    $admin = new mysqli($config['db_host'], $config['db_user'], $config['db_password'], '', $config['db_port']);
    $stmt = $admin->prepare('SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?');
    $stmt->bind_param('s', $config['db_name']); $stmt->execute();
    if ((int) $stmt->get_result()->fetch_assoc()['n'] > 0 && !$receipt) throw new RuntimeException('Existing nonempty database has no project receipt; inspect it before setup.');
    // Name is allowlisted by app_config(), never taken from HTTP input.
    $admin->query('CREATE DATABASE IF NOT EXISTS `' . $config['db_name'] . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $admin->close();
    if ($receipt) { require_once __DIR__ . '/../app/avatar-migration.php'; migrate_avatar_schema($receipt, $manifest); }
    file_put_contents($receiptPath, json_encode(['database' => $config['db_name'], 'sql_hashes' => $manifest['files'], 'status' => 'initializing'], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), LOCK_EX);
    run_statements(app_root() . '/database/schema.sql');
    run_statements(app_root() . '/database/views.sql', true);
    $counts = [];
    foreach ($manifest['reference_counts'] as $table => $expected) $counts[$table] = (int) row('SELECT COUNT(*) AS n FROM `' . $table . '`')['n'];
    if (array_sum($counts) === 0) {
        db()->begin_transaction();
        try { run_statements(app_root() . '/database/seed-reference.sql'); db()->commit(); }
        catch (Throwable $error) { db()->rollback(); throw $error; }
    } elseif ($counts !== $manifest['reference_counts']) {
        throw new RuntimeException('Reference counts differ; current records were not overwritten.');
    }
    $tables = array_column(rows("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"), 'TABLE_NAME');
    sort($tables); // MariaDB collation ordering differs from PHP binary underscore ordering.
    $expectedTables = $manifest['tables']; sort($expectedTables);
    if ($tables !== $expectedTables) throw new RuntimeException('Schema table names differ.');
    $constraints = array_column(rows('SELECT CONSTRAINT_TYPE, COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() GROUP BY CONSTRAINT_TYPE'), 'n', 'CONSTRAINT_TYPE');
    foreach (['PRIMARY KEY' => 14, 'UNIQUE' => 13, 'FOREIGN KEY' => 25, 'CHECK' => 9] as $kind => $expected) {
        if ((int) ($constraints[$kind] ?? 0) !== $expected) throw new RuntimeException('Schema constraint count differs.');
    }
    $views = array_column(rows('SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME'), 'TABLE_NAME');
    if ($views !== $manifest['views']) throw new RuntimeException('Schema views differ.');
    if (row("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handovers' AND COLUMN_NAME = 'handover_status'")['COLUMN_TYPE'] !== "enum('PENDING','SCHEDULED','COMPLETED')") throw new RuntimeException('Handover enum differs.');
    $secretPath = storage_dir('auth') . '/secret.json';
    if (!is_file($secretPath)) {
        $secret = ['key' => bin2hex(random_bytes(32)), 'dummy_hash' => password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT)];
        $file = fopen($secretPath, 'x');
        if (!$file) throw new RuntimeException('Cannot initialize auth key.');
        fwrite($file, json_encode($secret, JSON_THROW_ON_ERROR)); fclose($file); @chmod($secretPath, 0600);
    }
    file_put_contents($receiptPath, json_encode(['database' => $config['db_name'], 'sql_hashes' => $manifest['files'], 'status' => 'ready', 'tables' => count($tables), 'views' => count($views)], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), LOCK_EX);
    flock($lock, LOCK_UN); fclose($lock);
    echo json_encode(['database' => $config['db_name'], 'tables' => count($tables), 'views' => count($views), 'constraints' => $constraints, 'status' => 'ready', 'existing_data_preserved' => true], JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $error) { fwrite(STDERR, 'Setup stopped: ' . $error->getMessage() . PHP_EOL); exit(1); }
