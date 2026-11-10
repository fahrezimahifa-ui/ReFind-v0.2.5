<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

function visual_previous_schema_files(): array
{
    return json_decode((string) file_get_contents(app_root() . '/database/migrations/visual-search-previous-files.json'), true, 16, JSON_THROW_ON_ERROR);
}

function verify_visual_schema(): void
{
    $table = 'item_photo_embeddings';
    $contract = json_decode((string) file_get_contents(app_root() . '/docs/schema-contract.json'), true, 128, JSON_THROW_ON_ERROR)['tables'][$table];
    $actual = rows('SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_KEY FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION', [$table]);
    if (count($actual) !== count($contract['columns'])) throw new RuntimeException('Visual index columns differ.');
    foreach ($contract['columns'] as $i => $expected) {
        $type = preg_split('/\s+(?:NOT|DEFAULT|AUTO|ON)\b/', $expected['definition'])[0];
        $column = $actual[$i];
        if ($column['COLUMN_NAME'] !== $expected['name'] || $column['COLUMN_TYPE'] !== $type ||
            ($column['IS_NULLABLE'] === 'YES') !== $expected['nullable'] ||
            ($column['COLUMN_KEY'] === 'PRI') !== ($expected['name'] === 'photo_id')) {
            throw new RuntimeException('Visual index column differs: ' . $expected['name']);
        }
    }
    $foreign = rows("SELECT k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.DELETE_RULE
        FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
        ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
        WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=?", [$table]);
    $index = array_column(rows("SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME=? AND INDEX_NAME='idx_visual_pending' ORDER BY SEQ_IN_INDEX", [$table]), 'COLUMN_NAME');
    $check = row("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME=? AND CONSTRAINT_TYPE='CHECK' AND CONSTRAINT_NAME='chk_embedding_vector'", [$table]);
    $engine = row('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [$table]);
    if (array_map('array_values', $foreign) !== [['photo_id','item_photos','photo_id','CASCADE']] ||
        $index !== ['status','next_attempt_at','photo_id'] || !$check || $engine['ENGINE'] !== 'InnoDB') {
        throw new RuntimeException('Visual index constraints differ.');
    }
}
