<?php
declare(strict_types=1);
require_once __DIR__ . '/policies.php';

const ACTIVE_ITEM_CODES = ['OPEN', 'UNDER_REVIEW', 'POTENTIAL_MATCH', 'VERIFICATION'];
const MATCH_THRESHOLD = 55;
function ui_status_name(string $code): string
{
    return ['OPEN' => 'Reported', 'UNDER_REVIEW' => 'Under review', 'POTENTIAL_MATCH' => 'Possible match', 'VERIFICATION' => 'Claim review',
        'HANDOVER' => 'Ready for pickup', 'RESOLVED' => 'Returned', 'UNCLAIMED_CLOSED' => 'Never retrieved'][$code] ?? $code;
}
function campus_today(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('Asia/Jakarta')))->format('Y-m-d');
}
function utc_iso(?string $value): ?string
{
    return $value === null ? null : (new DateTimeImmutable($value, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z');
}
function notification(int $userId, string $type, string $title, string $message, ?int $itemId = null, ?int $claimId = null): void
{
    sql('INSERT INTO notifications(user_id,notification_type,title,message,item_id,claim_id) VALUES (?,?,?,?,?,?)', [$userId, $type, $title, mb_substr($message, 0, 500), $itemId, $claimId]);
}
function lock_items(array $ids): array
{
    $ids = array_values(array_unique(array_map('intval', $ids))); sort($ids, SORT_NUMERIC);
    if (!$ids) return [];
    $records = rows('SELECT i.*, s.status_code FROM items i JOIN item_statuses s ON s.status_id=i.status_id WHERE i.item_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY i.item_id FOR UPDATE', $ids);
    if (count($records) !== count($ids)) fail('A report changed or was removed. Reload and try again.', 409, 'state_conflict');
    return array_column($records, null, 'item_id');
}
function confirmed_match(int $id): ?array
{
    return row("SELECT * FROM item_matches WHERE match_status='CONFIRMED' AND (lost_item_id=? OR found_item_id=?) LIMIT 1", [$id, $id]);
}
function history_event(array $item, int $actorId, string $note): void
{
    sql('INSERT INTO item_status_history(item_id,status_id,changed_by_user_id,note) VALUES (?,?,?,?)', [(int) $item['item_id'], (int) $item['status_id'], $actorId, mb_substr($note, 0, 500)]);
}
function status_change(array &$item, string $code, int $actorId, string $note, bool $notify = true): void
{
    if ($item['status_code'] === $code) return;
    $status = row('SELECT status_id FROM item_statuses WHERE status_code=?', [$code]);
    if (!$status) throw new RuntimeException('Unknown status.');
    $resolved = in_array($code, ['RESOLVED', 'UNCLAIMED_CLOSED'], true) ? gmdate('Y-m-d H:i:s') : null;
    sql('UPDATE items SET status_id=?,resolved_at=? WHERE item_id=?', [(int) $status['status_id'], $resolved, (int) $item['item_id']]);
    $item['status_id'] = $status['status_id']; $item['status_code'] = $code;
    history_event($item, $actorId, $note);
    if (!$notify) return;
    if ($code === 'POTENTIAL_MATCH') notification((int) $item['reporter_user_id'], 'STATUS_CHANGED', 'Possible match found', 'A report that may match yours was added. Open it to compare the details; ownership is not verified yet.', (int) $item['item_id']);
    else notification((int) $item['reporter_user_id'], 'STATUS_CHANGED', ui_status_name($code), 'Your report is now: ' . ui_status_name($code) . '.', (int) $item['item_id']);
}
function has_suggestion(int $id): bool
{
    return (bool) row("SELECT match_id FROM item_matches WHERE match_status='SUGGESTED' AND (lost_item_id=? OR found_item_id=?) LIMIT 1", [$id, $id]);
}
// Moves an active report back to its idle state once no claim is reviewing it.
function settle_idle_status(array &$item, int $actorId, string $note, bool $notify = false): void
{
    status_change($item, has_suggestion((int) $item['item_id']) ? 'POTENTIAL_MATCH' : 'OPEN', $actorId, $note, $notify);
}
function matching_words(string $text): array
{
    preg_match_all('/[\p{L}\p{N}]+/u', mb_strtolower($text), $matches);
    return array_values(array_unique(array_filter($matches[0], fn($word) => mb_strlen($word) > 2 && !in_array($word, ['the','and','with','this','that','from','item','found','lost','floor','barang','yang','dan','dari','hilang','ditemukan'], true))));
}
function match_score(array $first, array $second): int
{
    $score = (int) $first['category_id'] === (int) $second['category_id'] ? 25 : 0;
    if ($first['location_id'] && (int) $first['location_id'] === (int) $second['location_id']) $score += 25;
    $score += min(35, count(array_intersect(matching_words($first['title'] . ' ' . $first['description']), matching_words($second['title'] . ' ' . $second['description']))) * 7);
    $days = (new DateTimeImmutable($first['event_date']))->diff(new DateTimeImmutable($second['event_date']))->days;
    $score += $days <= 2 ? 15 : ($days <= 7 ? 10 : ($days <= 14 ? 5 : 0));
    return min(100, $score);
}
// A suggestion needs two different reporters, the same category, and a Found date no earlier than the day before the loss.
function suggestion_score(array $lost, array $found): ?int
{
    if ((int) $lost['reporter_user_id'] === (int) $found['reporter_user_id'] || (int) $lost['category_id'] !== (int) $found['category_id']) return null;
    if ((new DateTimeImmutable($found['event_date'])) < (new DateTimeImmutable($lost['event_date']))->modify('-1 day')) return null;
    $score = match_score($lost, $found);
    return $score >= MATCH_THRESHOLD ? $score : null;
}
function refresh_suggestions(array $item, array &$locked, int $actor): void
{
    $id = (int) $item['item_id'];
    sql("DELETE FROM item_matches WHERE match_status='SUGGESTED' AND (lost_item_id=? OR found_item_id=?)", [$id, $id]);
    $paired = [];
    if (in_array($item['status_code'], ACTIVE_ITEM_CODES, true) && !confirmed_match($id)) {
        foreach ($locked as $candidate) {
            if ((int) $candidate['item_id'] === $id || $candidate['item_type'] === $item['item_type'] || !in_array($candidate['status_code'], ACTIVE_ITEM_CODES, true) || confirmed_match((int) $candidate['item_id'])) continue;
            $lost = $item['item_type'] === 'LOST' ? $item : $candidate;
            $found = $item['item_type'] === 'FOUND' ? $item : $candidate;
            $score = suggestion_score($lost, $found);
            if ($score === null) continue;
            sql("INSERT INTO item_matches(lost_item_id,found_item_id,match_score) VALUES (?,?,?) ON DUPLICATE KEY UPDATE match_score=IF(match_status='SUGGESTED',VALUES(match_score),match_score)", [(int) $lost['item_id'], (int) $found['item_id'], $score]);
            $paired[(int) $candidate['item_id']] = true;
        }
    }
    foreach ($locked as &$report) {
        if (!in_array($report['status_code'], ['OPEN','POTENTIAL_MATCH'], true) || confirmed_match((int) $report['item_id'])) continue;
        $has = has_suggestion((int) $report['item_id']);
        // Only a new pairing involving this save is worth a notification; losing a suggestion is silent.
        $notify = $has && ((int) $report['item_id'] === $id || isset($paired[(int) $report['item_id']]));
        status_change($report, $has ? 'POTENTIAL_MATCH' : 'OPEN', $actor, $has ? 'Rule-based possible matches are available. Ownership is not verified.' : 'No current matching suggestions.', $notify);
    }
    unset($report);
}
// Request-local batch context: private clues/evidence bytes never enter this projection.
function item_projection_context(array $records, array $user): array
{
    $context = [];
    foreach ($records as $record) $context[(int) $record['item_id']] = ['photos' => [], 'match' => null, 'active_claim' => false, 'own_claim' => null, 'ownership_count' => 0];
    if (!$context) return [];
    $ids = array_keys($context); $marks = implode(',', array_fill(0, count($ids), '?'));
    foreach (rows("SELECT item_id,photo_id,photo_kind FROM item_photos WHERE item_id IN ($marks) ORDER BY is_primary DESC,photo_id", $ids) as $photo) {
        if ($photo['photo_kind'] === 'ITEM') $context[(int) $photo['item_id']]['photos'][] = ['photo_id' => $photo['photo_id']];
        else $context[(int) $photo['item_id']]['ownership_count']++;
    }
    foreach (rows("SELECT lost_item_id,found_item_id FROM item_matches WHERE match_status='CONFIRMED' AND (lost_item_id IN ($marks) OR found_item_id IN ($marks)) ORDER BY match_id", array_merge($ids, $ids)) as $match) {
        foreach (['lost_item_id', 'found_item_id'] as $key) {
            $id = (int) $match[$key];
            if (isset($context[$id]) && $context[$id]['match'] === null) $context[$id]['match'] = $match;
        }
    }
    foreach (rows("SELECT item_id,related_lost_item_id FROM claims WHERE claim_status IN ('PENDING','NEED_MORE_INFO','APPROVED') AND (item_id IN ($marks) OR related_lost_item_id IN ($marks))", array_merge($ids, $ids)) as $claim) {
        foreach (['item_id', 'related_lost_item_id'] as $key) {
            $id = (int) $claim[$key];
            if (isset($context[$id])) $context[$id]['active_claim'] = true;
        }
    }
    if ($user['role'] === 'STUDENT') {
        foreach (rows("SELECT claim_id,item_id,claim_status,review_note FROM claims WHERE claimant_user_id=? AND item_id IN ($marks)", array_merge([(int) $user['user_id']], $ids)) as $claim) {
            $id = (int) $claim['item_id']; unset($claim['item_id']);
            $context[$id]['own_claim'] = $claim;
        }
    }
    return $context;
}
function safe_items(array $records, array $user): array
{
    $context = item_projection_context($records, $user);
    return array_map(fn($record) => safe_item($record, $user, $context), $records);
}
function safe_item(array $record, array $user, ?array $context = null): array
{
    $id = (int) $record['item_id'];
    $record['item_id'] = (string) $id;
    $record['reporter_user_id'] = (string) $record['reporter_user_id'];
    $photos = $context !== null ? $context[$id]['photos'] : rows("SELECT photo_id FROM item_photos WHERE item_id=? AND photo_kind='ITEM' ORDER BY is_primary DESC,photo_id", [$id]);
    $record['photos'] = array_map(fn($p) => app_config()['base_path'] . 'api/photos.php?kind=item&id=' . $p['photo_id'], $photos);
    $record['photo_ids'] = array_column($photos, 'photo_id');
    $match = $context !== null ? $context[$id]['match'] : confirmed_match($id);
    $record['matched_item_id'] = $match ? (string) ((int) $match['lost_item_id'] === $id ? $match['found_item_id'] : $match['lost_item_id']) : null;
    $own = $record['reporter_user_id'] === $user['user_id'];
    $related = $context !== null ? $context[$id]['active_claim'] : active_claim_for_report($id);
    $active = in_array($record['status_code'], ACTIVE_ITEM_CODES, true);
    $record['can_edit'] = $user['role'] === 'STUDENT' && $own && !$related && !$match && in_array($record['status_code'], ['OPEN','POTENTIAL_MATCH'], true);
    if ($user['role'] === 'STUDENT' && $own && !$record['can_edit'] && in_array($record['status_code'], ['OPEN','POTENTIAL_MATCH','VERIFICATION','UNDER_REVIEW'], true))
        $record['edit_locked_reason'] = $related ? 'Editing is paused while a claim that uses this report is being reviewed.' : 'Building Management is reviewing this report, so it cannot be edited right now.';
    $claim = $context !== null ? $context[$id]['own_claim'] : ($user['role'] === 'STUDENT' ? row('SELECT claim_id,claim_status,review_note FROM claims WHERE item_id=? AND claimant_user_id=?', [$id, (int) $user['user_id']]) : null);
    $record['own_claim'] = $claim;
    $record['can_claim'] = $user['role'] === 'STUDENT' && !$own && !$match && $record['item_type'] === 'FOUND' && $active && (!$claim || in_array($claim['claim_status'], RESUBMITTABLE_CLAIM_CODES, true));
    $record['can_report_found'] = $user['role'] === 'STUDENT' && !$own && !$match && $record['item_type'] === 'LOST' && $active;
    if ($own) $record['ownership_photo_count'] = $context !== null ? $context[$id]['ownership_count'] : (int) row("SELECT COUNT(*) AS n FROM item_photos WHERE item_id=? AND photo_kind='OWNERSHIP'", [$id])['n'];
    if (isset($record['created_at'])) $record['created_at'] = utc_iso($record['created_at']);
    if (isset($record['resolved_at'])) $record['resolved_at'] = utc_iso($record['resolved_at']);
    return $record;
}
function public_columns(): string
{
    return 'v.item_id,v.reporter_user_id,v.reporter_name,v.item_type,v.title,v.description,v.category_id,v.category_name,v.location_id,v.location_name,v.location_detail,v.floor_name,v.event_date,v.event_time,v.status_code,v.status_name,v.created_at,v.resolved_at';
}
function possible_matches(int $id, array $user): array
{
    // Pairs stored before v0.2.5 may still name the same reporter or another category; never show them.
    $records = rows("SELECT " . public_columns() . ",m.match_score FROM item_matches m JOIN items self ON self.item_id=? JOIN v_items_overview v ON v.item_id=IF(m.lost_item_id=?,m.found_item_id,m.lost_item_id) WHERE (m.lost_item_id=? OR m.found_item_id=?) AND m.match_status='SUGGESTED' AND v.reporter_user_id<>self.reporter_user_id AND v.category_id=self.category_id AND v.status_code IN ('OPEN','UNDER_REVIEW','POTENTIAL_MATCH','VERIFICATION') AND NOT EXISTS(SELECT 1 FROM item_matches c WHERE c.match_status='CONFIRMED' AND (c.lost_item_id=v.item_id OR c.found_item_id=v.item_id)) ORDER BY m.match_score DESC,v.item_id LIMIT 6", [$id,$id,$id,$id]);
    return safe_items($records, $user);
}
function pagination(array $query, int $default = 12): array
{
    $page = isset($query['page']) ? record_id($query['page']) : 1;
    $limit = isset($query['limit']) ? record_id($query['limit']) : $default;
    if ($page > 100000 || $limit > 48) fail('Invalid pagination.', 400);
    return [$page, $limit, ($page - 1) * $limit];
}
