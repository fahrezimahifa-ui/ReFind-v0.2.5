<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

// MariaDB DDL commits implicitly. Recognize the source receipt before any DDL;
// repeating after an interrupted column addition completes the same upgrade.
function migrate_avatar_schema(array $receipt, array $manifest): void
{
    $previous = json_decode((string) file_get_contents(app_root() . '/database/migrations/avatars-previous-files.json'), true, 32, JSON_THROW_ON_ERROR);
    if (($receipt['database'] ?? '') !== app_config()['db_name'] || !in_array($receipt['sql_hashes'] ?? [], [$previous, $manifest['files']], true)) throw new RuntimeException('Unrecognized migration receipt.');
    $columns = rows("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' ORDER BY ORDINAL_POSITION");
    $contract = json_decode((string) file_get_contents(app_root() . '/docs/schema-contract.json'), true, 128, JSON_THROW_ON_ERROR)['tables']['users']['columns'];
    $hasAvatar = (bool) array_filter($columns, fn($c) => $c['COLUMN_NAME'] === 'avatar_path');
    if (!$hasAvatar) $contract = array_values(array_filter($contract, fn($c) => $c['name'] !== 'avatar_path'));
    if (count($columns) !== count($contract)) throw new RuntimeException('Users schema differs; upgrade refused.');
    foreach ($contract as $i => $expected) {
        $type = strtolower((string) preg_replace('/ (NOT NULL|DEFAULT|AUTO_INCREMENT).*$/i', '', $expected['definition']));
        if ($columns[$i]['COLUMN_NAME'] !== $expected['name'] || strtolower($columns[$i]['COLUMN_TYPE']) !== $type || ($columns[$i]['IS_NULLABLE'] === 'YES') !== $expected['nullable']) throw new RuntimeException('Users schema differs; upgrade refused.');
    }
    if (!$hasAvatar) db()->query('ALTER TABLE users ADD COLUMN avatar_path varchar(80) DEFAULT NULL');
    if (!is_dir(storage_dir('avatars')) && !mkdir(storage_dir('avatars'), 0700, true)) throw new RuntimeException('Avatar storage unavailable.');
}
