<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
if (basename(dirname(__DIR__)) === 'refind-dev' && getenv('REFIND_TEST_PROFILE') !== 'ui-ux-dev') throw new RuntimeException('Explicit development test profile required; legacy QA discovery refused.');
$target = $argv[1] ?? (getenv('REFIND_TEST_PROFILE') === 'ui-ux-dev' ? dirname(__DIR__) : dirname(dirname(__DIR__)) . '/ReFind_0.2.0_Test');
require $target . '/app/repository.php';
require __DIR__ . '/qa-guard.php';
assert_qa_installation($target);
$profiles = [];
foreach (['STUDENT', 'BUILDING_MANAGEMENT'] as $role) {
    $user = row('SELECT user_id,role FROM users WHERE role=? ORDER BY user_id LIMIT 1', [$role]);
    if (!$user) throw new RuntimeException('A synthetic role fixture is required.');
    $user['user_id'] = (string) $user['user_id'];
    foreach ([1, 12, 48] as $size) {
        $records = rows('SELECT ' . public_columns() . ' FROM v_items_overview v ORDER BY v.item_id LIMIT ?', [$size]);
        $before = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()['Value'];
        if (function_exists('safe_items')) safe_items($records, $user);
        else array_map(fn($record) => safe_item($record, $user), $records);
        $after = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()['Value'];
        $profiles[] = ['role' => $role, 'limit' => $size, 'records' => count($records), 'projection_statements' => $after - $before];
    }
}
$scope = row("SELECT COUNT(*) AS all_opposite, SUM(s.status_code IN ('OPEN','UNDER_REVIEW','POTENTIAL_MATCH','VERIFICATION')) AS active_opposite FROM items i JOIN item_statuses s ON s.status_id=i.status_id WHERE i.item_type='FOUND'");
echo json_encode(['scope' => 'Owned QA SELECT-only projection counts; matching lock scope inspected, not changed', 'profiles' => $profiles, 'matching_lock_scope' => $scope], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL;
