<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/uploads.php';
require_once __DIR__ . '/visual-provider.php';

function visual_enqueue(int $photo, string $hash, string $authorization): bool
{
    return sql("INSERT INTO item_photo_embeddings (photo_id,model,dimensions,preprocessing,source_sha256,authorization)
        VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE photo_id=item_photo_embeddings.photo_id",
        [$photo,VISUAL_MODEL,VISUAL_DIMENSIONS,VISUAL_PREPROCESSING,$hash,$authorization])->affected_rows === 1;
}

function visual_photo_source(string $relative): string
{
    $file = media_path($relative);
    $root = realpath(storage_dir('items'));
    $resolved = $file === null ? false : realpath($file);
    if (!str_starts_with($relative, 'items/') || !$root || !$resolved || dirname($resolved) !== $root ||
        basename($resolved) !== basename($relative) || !is_file($resolved) || is_link($file)) {
        throw new InvalidArgumentException('Item photo is unavailable.');
    }
    $bytes = @file_get_contents($resolved, false, null, 0, 250001);
    if ($bytes === false || strlen($bytes) > 250000) throw new InvalidArgumentException('Item photo is unavailable.');
    return $bytes;
}

function visual_index_lock(): string
{
    return 'refind-visual-index-' . app_config()['db_name'];
}

function visual_source_is_authorized(array $job): bool
{
    return $job['authorization'] === 'QA_ALLOWLIST' ||
        in_array((int) $job['reporter_user_id'], app_config()['visual_search_students'], true);
}

function visual_drain(?callable $embed = null): array
{
    $embed ??= 'visual_embed';
    $lock = visual_index_lock();
    $outcome = ['ready' => 0, 'failed' => 0, 'retry' => 0, 'paused' => null];
    if ((int) (row('SELECT GET_LOCK(?,0) AS acquired', [$lock])['acquired'] ?? 0) !== 1) {
        $outcome['paused'] = 'overlap';
        return $outcome;
    }
    try {
        $jobs = rows("SELECT e.photo_id,e.source_sha256,e.attempts,e.authorization,p.file_path,i.reporter_user_id
            FROM item_photo_embeddings e JOIN item_photos p ON p.photo_id=e.photo_id AND p.photo_kind='ITEM'
            JOIN items i ON i.item_id=p.item_id
            WHERE e.status='PENDING' AND e.next_attempt_at<=UTC_TIMESTAMP()
              AND e.model=? AND e.dimensions=? AND e.preprocessing=?
            ORDER BY e.next_attempt_at,e.photo_id LIMIT 5", [VISUAL_MODEL,VISUAL_DIMENSIONS,VISUAL_PREPROCESSING]);
        $deadline = microtime(true) + 44;
        foreach ($jobs as $job) {
            if (microtime(true) >= $deadline) break;
            $id = (int) $job['photo_id'];
            $hash = $job['source_sha256'];
            try {
                if (!visual_source_is_authorized($job)) throw new VisualProviderError('authorization');
                try {
                    $bytes = visual_photo_source($job['file_path']);
                    if (!hash_equals($hash, hash('sha256', $bytes))) throw new InvalidArgumentException('Photo changed.');
                    $prepared = visual_prepare_image($bytes, true);
                } catch (InvalidArgumentException) {
                    throw new VisualProviderError('media');
                }
                $vector = pack('g*', ...$embed($prepared));
                // The FK and conditional update prevent re-inserting a removed job after a slow provider call.
                $affected = sql("UPDATE item_photo_embeddings e JOIN item_photos p ON p.photo_id=e.photo_id
                    SET e.status='READY',e.vector=?,e.failure_code=NULL
                    WHERE e.photo_id=? AND e.status='PENDING' AND e.source_sha256=? AND p.file_path=? AND p.photo_kind='ITEM'",
                    [$vector,$id,$hash,$job['file_path']])->affected_rows;
                $outcome['ready'] += $affected;
            } catch (VisualProviderError $error) {
                $reason = $error->reason;
                if (in_array($reason, ['project','quota','rate_limited'], true)) {
                    sql("UPDATE item_photo_embeddings SET next_attempt_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP()),failure_code=?
                        WHERE photo_id=? AND status='PENDING' AND source_sha256=?", [max(1, $error->retryAfter),$reason,$id,$hash]);
                    $outcome['paused'] = $reason;
                    break;
                }
                $attempts = (int) $job['attempts'] + 1;
                $retry = $attempts < 3 && in_array($reason, ['timeout','unavailable','bad_response'], true);
                $affected = sql("UPDATE item_photo_embeddings SET status=?,attempts=?,failure_code=?,
                    next_attempt_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP())
                    WHERE photo_id=? AND status='PENDING' AND source_sha256=?",
                    [$retry ? 'PENDING' : 'FAILED',$attempts,$reason,$retry ? [1=>60,2=>300][$attempts] : 0,$id,$hash])->affected_rows;
                $outcome[$retry ? 'retry' : 'failed'] += $affected;
            }
        }
        return $outcome;
    } finally {
        row('SELECT RELEASE_LOCK(?) AS released', [$lock]);
    }
}

function visual_owner_counts(array $itemIds): array
{
    if (!$itemIds) return [];
    $placeholders = implode(',', array_fill(0, count($itemIds), '?'));
    $counts = rows("SELECT p.item_id,e.status,COUNT(*) AS total FROM item_photo_embeddings e
        JOIN item_photos p ON p.photo_id=e.photo_id AND p.photo_kind='ITEM'
        WHERE e.model=? AND e.dimensions=? AND e.preprocessing=? AND p.item_id IN ($placeholders)
        GROUP BY p.item_id,e.status", [VISUAL_MODEL,VISUAL_DIMENSIONS,VISUAL_PREPROCESSING,...$itemIds]);
    $byItem = [];
    foreach ($counts as $count) $byItem[$count['item_id']][strtolower($count['status'])] = (int) $count['total'];
    return $byItem;
}
