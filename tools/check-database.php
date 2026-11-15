<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../app/db.php';
try {
    $contract = json_decode(file_get_contents(app_root() . '/docs/schema-contract.json'), true, 128, JSON_THROW_ON_ERROR);
    $checks = [];
    $names = array_column(rows("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"), 'TABLE_NAME'); sort($names);
    $expected = array_keys($contract['tables']); sort($expected);
    $checks['table_names'] = $names === $expected;
    $checks['views'] = array_column(rows('SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME'), 'TABLE_NAME') === $contract['views'];
    $columnsOk = true; $expectedFks = []; $expectedUnique = [];
    foreach ($contract['tables'] as $name => $table) {
        if (!preg_match('/^[a-z_]+$/D', $name)) throw new RuntimeException('Invalid contract table.');
        $actual = rows('SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION', [$name]);
        $columnsOk = $columnsOk && count($actual) === count($table['columns']);
        foreach ($table['columns'] as $i => $column) {
            $type = preg_split('/\s+(?:NOT|DEFAULT|AUTO|ON)\b/', $column['definition'])[0];
            $columnsOk = $columnsOk && ($actual[$i]['COLUMN_NAME'] ?? '') === $column['name'] && ($actual[$i]['COLUMN_TYPE'] ?? '') === $type &&
                (($actual[$i]['IS_NULLABLE'] ?? '') === ($column['nullable'] ? 'YES' : 'NO'));
        }
        foreach ($table['foreign_keys'] as $fk) {
            foreach ($fk['columns'] as $i => $column) $expectedFks[] = [$name, $fk['name'], $column, $fk['parent'], $fk['parent_columns'][$i]];
        }
        foreach ($table['uniques'] as $u) foreach ($u['columns'] as $i => $column) $expectedUnique[] = [$name, $u['name'], $i + 1, $column];
    }
    $actualFks = array_map(fn($r) => array_values($r), rows('SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL'));
    $actualUnique = array_map(fn($r) => [$r['TABLE_NAME'], $r['INDEX_NAME'], (int) $r['SEQ_IN_INDEX'], $r['COLUMN_NAME']], rows("SELECT TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND NON_UNIQUE=0 AND INDEX_NAME<>'PRIMARY'"));
    sort($expectedFks); sort($actualFks); sort($expectedUnique); sort($actualUnique);
    $checks['columns_types_nullability'] = $columnsOk;
    $checks['foreign_key_columns'] = $expectedFks === $actualFks;
    $checks['unique_constraints'] = $expectedUnique === $actualUnique;
    $counts = array_column(rows('SELECT CONSTRAINT_TYPE,COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() GROUP BY CONSTRAINT_TYPE'), 'n', 'CONSTRAINT_TYPE');
    $checks['constraint_counts'] = (int) ($counts['PRIMARY KEY'] ?? 0) === 15 && (int) ($counts['UNIQUE'] ?? 0) === 13 && (int) ($counts['FOREIGN KEY'] ?? 0) === 26 && (int) ($counts['CHECK'] ?? 0) === 10;
    $checks['hashed_accounts'] = !array_filter(rows('SELECT password_hash FROM users'), fn($u) => !password_get_info($u['password_hash'])['algo']);
    $checks['no_implicit_profile_table'] = !in_array('user_profiles', $names, true);
    $checks['schema_fingerprint'] = ($contract['actual_sql_sha256'] ?? '') === hash_file('sha256', app_root() . '/database/schema.sql');
    echo json_encode(['database' => app_config()['db_name'], 'passed' => !in_array(false, $checks, true), 'checks' => $checks,
        'tables' => count($names), 'foreign_keys' => (int) ($counts['FOREIGN KEY'] ?? 0), 'users' => (int) row('SELECT COUNT(*) AS n FROM users')['n']], JSON_PRETTY_PRINT) . PHP_EOL;
    exit(in_array(false, $checks, true) ? 1 : 0);
} catch (Throwable $error) { fwrite(STDERR, 'Schema verification failed: ' . $error->getMessage() . PHP_EOL); exit(1); }
