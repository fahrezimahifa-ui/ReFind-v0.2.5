<?php
declare(strict_types=1);
require __DIR__ . '/qa-guard.php';
require __DIR__ . '/../app/visual-index.php';

function visual_manifest_rows(string $file): array
{
    $manifest = json_decode((string) @file_get_contents($file, false, null, 0, 262145), true, 32, JSON_THROW_ON_ERROR);
    $photos = $manifest['photos'] ?? null;
    if (!is_array($photos) || !array_is_list($photos) || !$photos || count($photos) > 500) {
        throw new InvalidArgumentException('Expected a private photos manifest.');
    }
    $entries = [];
    foreach ($photos as $entry) {
        $photo = record_id($entry['photo_id'] ?? null);
        $report = record_id($entry['report_id'] ?? null);
        if (isset($entries[$photo])) throw new InvalidArgumentException('Duplicate manifest photo ID.');
        $record = row("SELECT p.file_path,e.source_sha256,e.authorization FROM item_photos p
            LEFT JOIN item_photo_embeddings e ON e.photo_id=p.photo_id
            WHERE p.photo_kind='ITEM' AND p.photo_id=? AND p.item_id=?", [$photo,$report]);
        if (!$record) throw new InvalidArgumentException('Manifest must identify an existing public photo and its report.');
        $entries[$photo] = $record + $entry;
    }
    return $entries;
}

function visual_audit_manifest(array $entries): array
{
    $seen = [];
    $audit = [];
    foreach ($entries as $id => $entry) {
        $hash = null;
        $duplicates = [];
        try {
            $source = visual_photo_source($entry['file_path']);
            $hash = hash('sha256', $source);
            $jpeg = visual_prepare_image($source, true);
            $image = imagecreatefromstring($jpeg);
            $small = imagescale($image, 9, 8);
            imagefilter($small, IMG_FILTER_GRAYSCALE);
            $bits = '';
            for ($y = 0; $y < 8; $y++) {
                for ($x = 0; $x < 8; $x++) $bits .= (imagecolorat($small, $x, $y) > imagecolorat($small, $x + 1, $y)) ? '1' : '0';
            }
            foreach ($seen as $previous => $value) {
                $distance = substr_count($bits ^ $value['bits'], "\x01");
                if ($hash === $value['hash'] || $distance <= 5) $duplicates[] = $previous;
            }
            $seen[$id] = ['hash'=>$hash,'bits'=>$bits];
            $finding = $duplicates ? 'review_possible_duplicate' : 'review_subject_and_permission';
        } catch (InvalidArgumentException) {
            $finding = 'missing_or_invalid';
        }
        $audit[] = ['photo_id'=>$id,'report_id'=>$entry['report_id'],'sha256'=>$hash,'finding'=>$finding,'compare_photo_ids'=>$duplicates];
    }
    return $audit;
}

function visual_backfill(array $entries, bool $apply): array
{
    $decisions = [];
    foreach ($entries as $id => $entry) {
        $hash = $entry['sha256'] ?? null;
        $decision = $entry['decision'] ?? null;
        if (!is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash) ||
            !in_array($decision, ['include','exclude'], true) || !is_string($entry['reason'] ?? null) || trim($entry['reason']) === '') {
            throw new InvalidArgumentException('Review and hash each approved manifest decision.');
        }
        if ($decision === 'include') {
            if (($entry['approved'] ?? null) !== true || !is_string($entry['source'] ?? null) ||
                trim($entry['source']) === '' || !hash_equals($hash, hash('sha256', visual_photo_source($entry['file_path'])))) {
                throw new InvalidArgumentException('Backfill requires approval, provenance and an unchanged photo.');
            }
        } elseif ($entry['source_sha256'] !== null && !hash_equals($entry['source_sha256'], $hash)) {
            throw new InvalidArgumentException('Exclusion hash differs from the indexed photo.');
        }
        $decisions[$id] = ['report_id'=>(int) $entry['report_id'],'sha256'=>$hash,'decision'=>$decision];
    }
    $summary = ['include'=>0,'exclude'=>0,'enqueued'=>0,'removed'=>0];
    if ($apply) db()->begin_transaction();
    try {
        foreach ($decisions as $id => $entry) {
            $summary[$entry['decision']]++;
            if (!$apply) continue;
            if ($entry['decision'] === 'include') {
                $summary['enqueued'] += (int) visual_enqueue($id, $entry['sha256'], 'QA_ALLOWLIST');
            } else {
                $summary['removed'] += sql('DELETE e FROM item_photo_embeddings e JOIN item_photos p ON p.photo_id=e.photo_id
                    WHERE e.photo_id=? AND p.item_id=? AND e.source_sha256=?', [$id,$entry['report_id'],$entry['sha256']])->affected_rows;
            }
        }
        if ($apply) db()->commit();
    } catch (Throwable $error) {
        if ($apply) db()->rollback();
        throw $error;
    }
    return $summary;
}

function visual_write_worker_receipt(array $result): void
{
    $setup = storage_dir('setup');
    $temporary = @tempnam($setup, 'visual-worker-');
    if ($temporary === false) throw new RuntimeException('Visual worker receipt unavailable.');
    try {
        $json = json_encode(['tick_utc'=>gmdate('c'),'result'=>$result], JSON_THROW_ON_ERROR);
        if (@file_put_contents($temporary, $json) !== strlen($json) ||
            !@rename($temporary, $setup . '/visual-index-last.json')) {
            throw new RuntimeException('Visual worker receipt unavailable.');
        }
    } finally {
        if (is_file($temporary)) @unlink($temporary);
    }
}

try {
    assert_qa_installation(app_root());
    $mode = $argv[1] ?? '--status';
    $argument = $argv[2] ?? null;
    if (count($argv) > 3 || (in_array($mode, ['--drain','--status'], true) && $argument !== null)) {
        throw new InvalidArgumentException('Invalid worker arguments.');
    }
    if (!visual_enabled()) {
        if ($mode === '--drain') {
            echo '{"paused":"disabled"}' . PHP_EOL;
            exit(0);
        }
        throw new RuntimeException('Visual Search is disabled for this QA installation.');
    }
    if ($mode === '--drain') {
        try {
            $result = visual_api_key() === null ? ['paused'=>'project'] : visual_drain();
        } catch (Throwable $error) {
            visual_write_worker_receipt(['paused'=>'worker_error']);
            throw $error;
        }
        if (($result['paused'] ?? null) !== 'overlap') visual_write_worker_receipt($result);
    } elseif ($mode === '--status') {
        $result = [
            'queue' => rows("SELECT status,COUNT(*) AS photos FROM item_photo_embeddings GROUP BY status"),
            'oldest_pending_seconds' => row("SELECT TIMESTAMPDIFF(SECOND,MIN(authorized_at),UTC_TIMESTAMP()) AS age
                FROM item_photo_embeddings WHERE status='PENDING'")['age'],
            'pending_reasons' => rows("SELECT failure_code,COUNT(*) AS photos,MIN(next_attempt_at) AS next_utc
                FROM item_photo_embeddings WHERE status='PENDING' AND failure_code IS NOT NULL GROUP BY failure_code"),
            'credential_configured' => visual_api_key() !== null,
            'request_timeout_seconds' => app_config()['visual_search_timeout_seconds'],
            'provider_status' => json_decode((string) @file_get_contents(storage_dir('setup') . '/visual-provider-last.json'), true),
            'last_tick' => json_decode((string) @file_get_contents(storage_dir('setup') . '/visual-index-last.json'), true),
        ];
    } elseif ($mode === '--retry') {
        $photo = record_id($argument);
        $result = ['reset' => sql("UPDATE item_photo_embeddings SET status='PENDING',attempts=0,
            next_attempt_at=UTC_TIMESTAMP(),failure_code=NULL WHERE photo_id=? AND status='FAILED'
            AND model=? AND dimensions=? AND preprocessing=?", [$photo,VISUAL_MODEL,VISUAL_DIMENSIONS,VISUAL_PREPROCESSING])->affected_rows];
    } elseif ($mode === '--probe' && $argument !== null) {
        $data = @file_get_contents($argument, false, null, 0, 250001);
        if ($data === false) throw new InvalidArgumentException('Approved probe photo could not be read.');
        $vector = visual_embed(visual_prepare_image($data));
        $result = ['provider'=>'Gemini','model'=>VISUAL_MODEL,'dimensions'=>count($vector)];
    } elseif (in_array($mode, ['--audit','--dry-run','--backfill'], true) && $argument !== null) {
        if ($mode === '--audit') {
            $result = ['photos'=>visual_audit_manifest(visual_manifest_rows($argument))];
        } elseif ($mode === '--dry-run') {
            $result = visual_backfill(visual_manifest_rows($argument), false);
        } else {
            $lock = visual_index_lock();
            if ((int) (row('SELECT GET_LOCK(?,5) AS acquired', [$lock])['acquired'] ?? 0) !== 1) throw new RuntimeException('Indexer busy.');
            try { $result = visual_backfill(visual_manifest_rows($argument), true); }
            finally { row('SELECT RELEASE_LOCK(?) AS released', [$lock]); }
        }
    } else {
        throw new InvalidArgumentException('Expected --status, --drain, --retry ID, --probe IMAGE, --audit MANIFEST, --dry-run MANIFEST or --backfill MANIFEST.');
    }
    echo json_encode($result, JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (VisualProviderError $error) {
    fwrite(STDERR, 'Visual provider unavailable (' . $error->reason . ').' . PHP_EOL);
    exit(1);
} catch (InvalidArgumentException $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
} catch (Throwable $error) {
    fwrite(STDERR, "Visual indexing stopped. Check QA isolation, the feature flag, and database availability.\n");
    exit(1);
}
