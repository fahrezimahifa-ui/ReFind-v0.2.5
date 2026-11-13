<?php
declare(strict_types=1);
require_once __DIR__ . '/item-filters.php';

function visual_candidate_filter(array $filters): array
{
    [$where, $values] = item_structured_filters($filters);
    if (($filters['status'] ?? '') === '') $where[] = "v.status_code NOT IN ('RESOLVED','UNCLAIMED_CLOSED')";
    $students = app_config()['visual_search_students'];
    if ($students) {
        $markers = implode(',', array_fill(0, count($students), '?'));
        $where[] = "(e.authorization='QA_ALLOWLIST' OR v.reporter_user_id IN ($markers))";
        $values = [...$values, ...$students];
    } else {
        $where[] = "e.authorization='QA_ALLOWLIST'";
    }
    $where[] = "e.status='READY' AND e.model=? AND e.dimensions=? AND e.preprocessing=?";
    return [' FROM item_photo_embeddings e JOIN item_photos p ON p.photo_id=e.photo_id AND p.photo_kind=\'ITEM\'
        JOIN v_items_overview v ON v.item_id=p.item_id WHERE ' . implode(' AND ', $where),
        [...$values,VISUAL_MODEL,VISUAL_DIMENSIONS,VISUAL_PREPROCESSING]];
}

function visual_candidates(string $clause, array $params): Generator
{
    $after = 0;
    do {
        $page = rows('SELECT p.item_id,p.photo_id,e.vector,e.source_sha256,p.file_path' . $clause . ' AND e.photo_id>? ORDER BY e.photo_id LIMIT 128',
            [...$params,$after]);
        foreach ($page as $entry) {
            $after = (int) $entry['photo_id'];
            yield $entry;
        }
    } while (count($page) === 128);
}

function visual_card_results(array $ranked, array $user, ?float $strongThreshold = null): array
{
    if (!$ranked) return [];
    $ids = array_column($ranked, 'item_id');
    $markers = implode(',', array_fill(0, count($ids), '?'));
    $cards = rows('SELECT ' . public_columns() . ' FROM v_items_overview v WHERE v.item_id IN (' . $markers . ')', $ids);
    $byId = array_column(safe_items($cards, $user), null, 'item_id');
    $allowed = array_flip(['item_id','title','item_type','status_code','status_name','category_name',
        'location_name','location_detail','floor_name','event_date','event_time','photos']);
    $result = [];
    foreach ($ranked as $match) {
        $item = $byId[$match['item_id']] ?? null;
        if (!$item) continue;
        $photo = app_config()['base_path'] . 'api/photos.php?kind=item&id=' . $match['photo_id'];
        if (!in_array($photo, $item['photos'], true)) continue;
        $item['photos'] = [$photo, ...array_values(array_diff($item['photos'], [$photo]))];
        $result[] = array_intersect_key($item, $allowed) + ['match_label' => visual_match_label((float) $match['score'], $strongThreshold)];
    }
    return $result;
}

function visual_search_request(?callable $embed = null): never
{
    method('POST');
    $user = request_user('STUDENT', true);
    if (!visual_student_allowed($user)) fail('Photo search is unavailable.', 403, 'visual_disabled');
    allowed_fields($_GET, []);
    allowed_fields($_POST, ['type','category_id','location_id','status','date','_csrf']);
    allowed_fields($_FILES, ['photo']);
    $photos = uploaded_images('photo', 1);
    if (count($photos) !== 1 || $photos[0]['extension'] === 'webp') field_fail('photo', 'Choose one JPEG or PNG photo.');
    try {
        $image = visual_prepare_image((string) file_get_contents($photos[0]['temporary']));
    } catch (InvalidArgumentException $error) {
        field_fail('photo', $error->getMessage());
    }
    $threshold = visual_threshold();
    if ($threshold === null) fail('Photo search is unavailable. You can still search by keyword.', 503, 'visual_uncalibrated');
    [$clause, $params] = visual_candidate_filter($_POST);
    if (!row('SELECT e.photo_id' . $clause . ' LIMIT 1', $params)) json_response(['state'=>'empty_index','items'=>[]]);
    $embed ??= 'visual_embed';
    try {
        $query = $embed($image, (int) $user['user_id']);
    } catch (VisualProviderError $error) {
        if ($error->retryAfter > 0) header('Retry-After: ' . $error->retryAfter);
        if (in_array($error->reason, ['quota','rate_limited'], true)) {
            fail('Photo search has reached a temporary limit. Try again later or search by keyword.', 429, 'visual_rate_limited');
        }
        if ($error->reason === 'timeout') {
            fail('Photo search timed out. Try again or search by keyword.', 503, 'visual_timeout');
        }
        fail('Photo search is unavailable. You can still search by keyword.', 503, 'visual_unavailable');
    }
    db()->begin_transaction(MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
    try {
        $ranked = visual_rank(visual_candidates($clause, $params), $query);
        $cards = visual_card_results(visual_above_threshold($ranked, $threshold), $user, visual_strong_cutoff($threshold));
        db()->commit();
    } catch (Throwable $error) {
        db()->rollback();
        throw $error;
    }
    json_response(['state'=>$cards ? 'matches' : ($ranked ? 'no_match' : 'empty_index'),'items'=>$cards]);
}
