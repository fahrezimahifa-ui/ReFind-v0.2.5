<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$target = dirname(dirname(__DIR__)) . '/ReFind_0.2.0_Test';
require $target . '/app/repository.php';
require __DIR__ . '/qa-guard.php';
assert_qa_installation($target);
// Exact prior projection from 8331d90: compatibility oracle for batching/privacy flags.
function baseline_safe_item(array $record, array $user): array
{
    $id = (int) $record['item_id'];
    $record['item_id'] = (string) $id;
    $record['reporter_user_id'] = (string) $record['reporter_user_id'];
    $photos = rows("SELECT photo_id FROM item_photos WHERE item_id=? AND photo_kind='ITEM' ORDER BY is_primary DESC,photo_id", [$id]);
    $record['photos'] = array_map(fn($p) => app_config()['base_path'] . 'api/photos.php?kind=item&id=' . $p['photo_id'], $photos);
    $record['photo_ids'] = array_column($photos, 'photo_id');
    $match = confirmed_match($id);
    $record['matched_item_id'] = $match ? (string) ((int) $match['lost_item_id'] === $id ? $match['found_item_id'] : $match['lost_item_id']) : null;
    $own = $record['reporter_user_id'] === $user['user_id'];
    $related = active_claim_for_report($id);
    $active = in_array($record['status_code'], ACTIVE_ITEM_CODES, true);
    $record['can_edit'] = $user['role'] === 'STUDENT' && $own && !$related && !$match && in_array($record['status_code'], ['OPEN','POTENTIAL_MATCH'], true);
    if ($user['role'] === 'STUDENT' && $own && !$record['can_edit'] && in_array($record['status_code'], ['OPEN','POTENTIAL_MATCH','VERIFICATION','UNDER_REVIEW'], true))
        $record['edit_locked_reason'] = $related ? 'Editing is paused while a claim that uses this report is being reviewed.' : 'Building Management is reviewing this report, so it cannot be edited right now.';
    $claim = $user['role'] === 'STUDENT' ? row('SELECT claim_id,claim_status,review_note FROM claims WHERE item_id=? AND claimant_user_id=?', [$id, (int) $user['user_id']]) : null;
    $record['own_claim'] = $claim;
    $record['can_claim'] = $user['role'] === 'STUDENT' && !$own && !$match && $record['item_type'] === 'FOUND' && $active && (!$claim || in_array($claim['claim_status'], RESUBMITTABLE_CLAIM_CODES, true));
    $record['can_report_found'] = $user['role'] === 'STUDENT' && !$own && !$match && $record['item_type'] === 'LOST' && $active;
    if ($own) $record['ownership_photo_count'] = (int) row("SELECT COUNT(*) AS n FROM item_photos WHERE item_id=? AND photo_kind='OWNERSHIP'", [$id])['n'];
    if (isset($record['created_at'])) $record['created_at'] = utc_iso($record['created_at']);
    if (isset($record['resolved_at'])) $record['resolved_at'] = utc_iso($record['resolved_at']);
    return $record;
}
$results = [];
$users = rows("SELECT user_id,role FROM users ORDER BY user_id");
foreach ($users as $user) {
    $user['user_id'] = (string) $user['user_id'];
    foreach ([0, 1, 12, 48] as $size) {
        $records = $size ? rows('SELECT ' . public_columns() . ' FROM v_items_overview v ORDER BY v.item_id LIMIT ?', [$size]) : [];
        $before = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()['Value'];
        $baseline = array_map(fn($r) => baseline_safe_item($r, $user), $records);
        $middle = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()['Value'];
        $batched = safe_items($records, $user);
        $after = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()['Value'];
        if ($baseline !== $batched) throw new RuntimeException('Projection compatibility changed.');
        $expected = !$records ? 0 : ($user['role'] === 'STUDENT' ? 4 : 3);
        if ($after - $middle !== $expected) throw new RuntimeException('Projection query bound changed.');
        $results[] = ['role' => $user['role'], 'limit' => $size, 'records' => count($records), 'baseline_statements' => $middle - $before, 'batched_statements' => $after - $middle, 'identical' => true];
    }
}
$receipt = ['scope' => 'Owned synthetic QA; exact baseline data/authorization parity and bounded statement counts', 'passed' => true, 'checks' => $results];
$directory = getenv('REFIND_EVIDENCE_DIR');
if ($directory) file_put_contents($directory . '/projection-results.json', json_encode($receipt, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL);
echo json_encode($receipt, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL;
