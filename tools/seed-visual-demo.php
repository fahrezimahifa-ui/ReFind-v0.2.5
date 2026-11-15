<?php
declare(strict_types=1);
// Explicit, reversible fixtures for the owned QA installation. Never seeds main.
require __DIR__ . '/qa-guard.php';
require __DIR__ . '/../app/reports.php';
require __DIR__ . '/../app/claims.php';
require __DIR__ . '/../app/workflow.php';
date_default_timezone_set('Asia/Jakarta');

function corpus_save(string $path, array $data): void
{
    $temporary = $path . '.pending';
    if (file_put_contents($temporary, json_encode($data, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), LOCK_EX) === false ||
        !rename($temporary, $path)) throw new RuntimeException('Cannot save fixture receipt.');
}

function corpus_fingerprint(int $id): string
{
    return hash('sha256', json_encode([
        row('SELECT * FROM items WHERE item_id=?', [$id]),
        rows('SELECT * FROM item_photos WHERE item_id=? ORDER BY photo_id', [$id]),
        rows('SELECT * FROM claims WHERE item_id=? OR related_lost_item_id=? ORDER BY claim_id', [$id,$id]),
        rows('SELECT h.* FROM handovers h JOIN claims c ON c.claim_id=h.claim_id WHERE c.item_id=? ORDER BY h.handover_id', [$id]),
        rows('SELECT * FROM item_status_history WHERE item_id=? ORDER BY history_id', [$id]),
    ], JSON_THROW_ON_ERROR));
}

try {
    assert_qa_installation(app_root());
    if (!visual_enabled()) throw new RuntimeException('Enable the approved isolated QA feature first.');
    $mode = $argv[1] ?? '--status';
    $receiptPath = storage_dir('setup') . '/visual-demo.json';
    $lock = fopen(storage_dir('setup') . '/visual-demo.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('Another fixture operation is active.');
    $receipt = is_file($receiptPath) ? json_decode((string) file_get_contents($receiptPath), true, 64, JSON_THROW_ON_ERROR) : null;
    if ($receipt !== null && ($receipt['database'] !== app_config()['db_name'] || $receipt['root'] !== app_root())) {
        throw new RuntimeException('Fixture receipt belongs to another installation.');
    }
    if ($mode === '--status') {
        echo json_encode(['installed'=>$receipt !== null,'dataset'=>$receipt['dataset'] ?? null,
            'reports'=>count($receipt['items'] ?? []),'claims'=>count($receipt['claims'] ?? []),
            'complete'=>$receipt['complete'] ?? false], JSON_THROW_ON_ERROR) . PHP_EOL;
        exit;
    }
    if ($mode === '--rollback') {
        if (!$receipt || !($receipt['complete'] ?? false)) throw new RuntimeException('Rollback requires a complete, unchanged receipt.');
        $files = [];
        db()->begin_transaction();
        try {
            lock_items(array_column($receipt['items'], 'report_id'));
            foreach ($receipt['items'] as $entry) {
                $id = $entry['report_id'];
                if (!hash_equals($entry['fingerprint'], corpus_fingerprint($id))) throw new RuntimeException('A fixture was edited; automatic rollback refused.');
                foreach (rows('SELECT file_path FROM item_photos WHERE item_id=?', [$id]) as $photo) {
                    if (!hash_equals($entry['sha256'], hash('sha256', visual_photo_source($photo['file_path'])))) {
                        throw new RuntimeException('A fixture photo changed; rollback refused.');
                    }
                    $files[] = $photo['file_path'];
                }
            }
            foreach ($receipt['items'] as $entry) {
                sql('DELETE n FROM notifications n LEFT JOIN claims c ON c.claim_id=n.claim_id WHERE n.item_id=? OR c.item_id=?',
                    [$entry['report_id'],$entry['report_id']]);
                sql('DELETE FROM items WHERE item_id=?', [$entry['report_id']]);
            }
            db()->commit();
        } catch (Throwable $error) { db()->rollback(); throw $error; }
        cleanup_media($files, true);
        $receipt['rolled_back_utc'] = gmdate('c');
        corpus_save($receiptPath . '.rolled-back-' . time(), $receipt);
        unlink($receiptPath);
        echo "Fixture reports and their derived data removed; accounts and other reports preserved.\n";
        exit;
    }
    if ($mode !== '--import' || count($argv) !== 3) throw new RuntimeException('Use --status, --import CORPUS or --rollback.');
    $manifestPath = realpath($argv[2]);
    if (!$manifestPath) throw new RuntimeException('Corpus manifest not found.');
    $raw = (string) file_get_contents($manifestPath);
    $corpus = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    if (!preg_match('/^[a-z0-9-]{1,60}$/D', $corpus['dataset'] ?? '') || !is_array($corpus['assets'] ?? null)) {
        throw new RuntimeException('Invalid corpus identity.');
    }
    $assets = array_values(array_filter($corpus['assets'], fn($entry) => in_array($entry['role'] ?? '', ['reference','gallery','workflow'], true)));
    if (!$assets || count($assets) > 100) throw new RuntimeException('Expected between one and 100 cleared report images.');
    $seen = [];
    foreach ($assets as $asset) {
        $name = $asset['image'] ?? '';
        $source = realpath(dirname($manifestPath) . '/' . $name);
        if (($asset['reviewed'] ?? false) !== true || !preg_match('/^[a-z0-9-]+\.jpg$/D', $name) ||
            !$source || dirname($source) !== dirname($manifestPath) || is_link($source) || filesize($source) > 250000 ||
            !hash_equals($asset['sha256'], hash_file('sha256', $source)) || isset($seen[$asset['sha256']]) ||
            empty($asset['source']['author']) || empty($asset['source']['license_url']) || empty($asset['source']['page'])) {
            throw new RuntimeException('Each report requires a distinct, reviewed, unchanged licensed photograph.');
        }
        visual_prepare_image((string) file_get_contents($source));
        $seen[$asset['sha256']] = true;
    }
    $users = [];
    foreach (['a'=>'student-a@refind.test','b'=>'student-b@refind.test','bm'=>'bm@refind.test'] as $key=>$email) {
        $user = row('SELECT user_id,role,is_active FROM users WHERE email=?', [$email]);
        if (!$user || !(int) $user['is_active'] || $user['role'] !== ($key === 'bm' ? 'BUILDING_MANAGEMENT' : 'STUDENT')) {
            throw new RuntimeException('Expected synthetic QA accounts are unavailable.');
        }
        $users[$key] = $user;
    }
    $receipt ??= ['database'=>app_config()['db_name'],'root'=>app_root(),'dataset'=>$corpus['dataset'],
        'corpus_sha256'=>hash('sha256', $raw),'created_utc'=>gmdate('c'),'date'=>campus_today(),
        'items'=>[],'claims'=>[],'steps'=>[],'complete'=>false];
    if ($receipt['corpus_sha256'] !== hash('sha256', $raw)) throw new RuntimeException('The imported corpus is frozen. Use a new reviewed dataset after rollback.');
    if ($receipt['complete']) {
        foreach ($receipt['items'] as $entry) {
            if (!hash_equals($entry['fingerprint'], corpus_fingerprint($entry['report_id']))) throw new RuntimeException('An installed fixture changed; rerun refused.');
        }
        echo json_encode(['unchanged'=>true,'reports'=>count($receipt['items']),'claims'=>count($receipt['claims'])], JSON_THROW_ON_ERROR) . PHP_EOL;
        exit;
    }
    corpus_save($receiptPath, $receipt);
    foreach ($assets as $index=>$asset) {
        $key = $asset['id'];
        $workflow = $asset['role'] === 'workflow';
        $user = $users[$workflow || $index % 2 ? 'b' : 'a'];
        $type = $workflow || $index % 2 ? 'FOUND' : 'LOST';
        $title = trim('Demo VS · ' . $key . ' · ' . mb_substr($asset['subject'], 0, 60));
        if (!isset($receipt['items'][$key])) {
            // Recover a crash immediately after the report transaction committed.
            $old = row('SELECT item_id FROM items WHERE title=? AND reporter_user_id=? AND item_type=?', [$title,(int)$user['user_id'],$type]);
            $id = $old ? (int) $old['item_id'] : (int) mutate_report($user, ['action'=>'create','type'=>$type,
                'title'=>$title,'description'=>'Synthetic QA classroom report. Photo subject: ' . $asset['subject'] . '. This is not a real campus loss or ownership claim.',
                'category_id'=>(string)$asset['category'],'location_id'=>(string)$asset['location_id'],
                'location_detail'=>'Synthetic visual-search demonstration','date'=>$receipt['date'],'time'=>'',
                'clue'=>'Synthetic QA identifying clue for fixture ' . $key . '.'])['id'];
            $receipt['items'][$key] = ['report_id'=>$id,'reporter'=>(int)$user['user_id'],'title'=>$title,'sha256'=>$asset['sha256']];
            corpus_save($receiptPath, $receipt);
        }
        $id = $receipt['items'][$key]['report_id'];
        $item = find_item($id);
        if ($item['title'] !== $title || (int)$item['reporter_user_id'] !== (int)$user['user_id']) throw new RuntimeException('A bookmarked fixture changed.');
        $receipt['items'][$key]['title'] = $title;
        $photo = row("SELECT photo_id,file_path FROM item_photos WHERE item_id=? AND photo_kind='ITEM'", [$id]);
        if (!$photo) {
            $relative = 'items/' . bin2hex(random_bytes(16)) . '.jpg';
            if (!copy(dirname($manifestPath) . '/' . $asset['image'], storage_dir() . '/' . $relative)) throw new RuntimeException('Cannot import fixture photo.');
            db()->begin_transaction();
            try {
                lock_items([$id]);
                sql("INSERT INTO item_photos(item_id,photo_kind,file_path,is_primary) VALUES (?,'ITEM',?,1)", [$id,$relative]);
                $photo = ['photo_id'=>(int)db()->insert_id,'file_path'=>$relative];
                if (!$workflow) visual_enqueue($photo['photo_id'], $asset['sha256'], 'QA_ALLOWLIST');
                db()->commit();
            } catch (Throwable $error) { db()->rollback(); cleanup_media([$relative]); throw $error; }
        }
        if (!hash_equals($asset['sha256'], hash('sha256', visual_photo_source($photo['file_path'])))) throw new RuntimeException('A bookmarked photo changed.');
        $receipt['items'][$key]['photo_id'] = (int)$photo['photo_id'];
        corpus_save($receiptPath, $receipt);
    }
    $workflow = array_values(array_filter($assets, fn($entry) => $entry['role'] === 'workflow'));
    foreach ($workflow as $index=>$asset) {
        $key = $asset['id'];
        $id = $receipt['items'][$key]['report_id'];
        if (!isset($receipt['claims'][$key])) {
            $claim = row('SELECT claim_id FROM claims WHERE item_id=? AND claimant_user_id=?', [$id,(int)$users['a']['user_id']]);
            $receipt['claims'][$key] = $claim ? (int)$claim['claim_id'] : (int)mutate_claim($users['a'], [
                'itemId'=>(string)$id,'answer'=>'Synthetic classroom ownership answer for ' . $key . '.'])['id'];
            corpus_save($receiptPath, $receipt);
        }
        $claimId = $receipt['claims'][$key];
        if (!isset($receipt['steps'][$key . '-review'])) {
            $claim = row('SELECT * FROM claims WHERE claim_id=?', [$claimId]);
            $decision = $index < 5 ? 'approved' : ($index < 9 ? 'need_more_info' : ($index < 13 ? 'rejected' : ''));
            if ($decision !== '' && $claim['claim_status'] === 'PENDING') review_claim($users['bm'], [
                'action'=>'review','id'=>(string)$claimId,'decision'=>$decision,'note'=>'Synthetic QA review for ' . $key . '.',
                'revision'=>claim_revision($claim),'confirm'=>'1']);
            if ($index >= 13 && $index < 16 && $claim['claim_status'] === 'PENDING') mutate_claim($users['a'], ['action'=>'withdraw','itemId'=>(string)$id]);
            $receipt['steps'][$key . '-review'] = true;
            corpus_save($receiptPath, $receipt);
        }
        if ($index < 5) {
            $actions = match($index) {0=>[],1=>['schedule'],2=>['schedule','cancel_schedule'],3=>['complete'],4=>['schedule','reschedule']};
            foreach ($actions as $number=>$action) {
                $step = $key . '-pickup-' . $number;
                if (isset($receipt['steps'][$step])) continue;
                $handover = row('SELECT * FROM handovers WHERE claim_id=?', [$claimId]);
                $note = 'Synthetic QA ' . $key . ' ' . $action;
                if ($handover['notes'] !== $note) {
                    $data = ['action'=>$action,'id'=>(string)$handover['handover_id'],'revision'=>handover_revision($handover),'note'=>$note,'confirm'=>'1'];
                    if (in_array($action, ['schedule','reschedule'], true)) {
                        $data['pickup_location_id'] = '38';
                        $data['scheduled_at'] = (new DateTimeImmutable('+' . (3 + $number) . ' days'))->setTime(14,30)->format('Y-m-d\TH:i');
                    }
                    mutate_handover($users['bm'], $data);
                }
                $receipt['steps'][$step] = true;
                corpus_save($receiptPath, $receipt);
            }
        }
    }
    foreach ($receipt['items'] as &$entry) $entry['fingerprint'] = corpus_fingerprint($entry['report_id']);
    unset($entry);
    $receipt['complete'] = true;
    corpus_save($receiptPath, $receipt);
    echo json_encode(['dataset'=>$receipt['dataset'],'reports'=>count($receipt['items']),'claims'=>count($receipt['claims']),
        'scope'=>'owned QA only; licensed synthetic fixtures; original records preserved'], JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'Visual fixture operation stopped: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
