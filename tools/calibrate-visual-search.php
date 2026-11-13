<?php
declare(strict_types=1);
require __DIR__ . '/qa-guard.php';
require __DIR__ . '/../app/visual-search.php';
require __DIR__ . '/../app/visual-evaluation.php';

function visual_evaluation_input(string $manifestPath, string $split): array
{
    $raw = @file_get_contents($manifestPath, false, null, 0, 262145);
    if ($raw === false) throw new InvalidArgumentException('Could not read the private evaluation manifest.');
    $manifest = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    $gallery = $manifest['gallery'] ?? null;
    $queries = $manifest['queries'] ?? null;
    $filters = $manifest['filters'] ?? null;
    if (($manifest['split'] ?? null) !== $split || !is_array($gallery) || !array_is_list($gallery) || !$gallery ||
        !is_array($queries) || !array_is_list($queries) || !$queries || count($queries) > 120 ||
        !is_array($filters) || !isset($filters['location_id'])) {
        throw new InvalidArgumentException('Expected a frozen split with an isolated gallery filter.');
    }
    allowed_fields($filters, ['type','category_id','location_id','status','date']);
    [$sql, $values] = visual_candidate_filter($filters);
    $candidateRows = iterator_to_array(visual_candidates($sql, $values), false);
    $found = [];
    foreach ($candidateRows as $row) {
        if (visual_unpack($row['vector']) === null ||
            !hash_equals($row['source_sha256'], hash('sha256', visual_photo_source($row['file_path'])))) {
            throw new InvalidArgumentException('An indexed gallery vector or source photo is invalid.');
        }
        $found[(int) $row['photo_id']] = [(int) $row['item_id'],$row['source_sha256']];
    }
    $expected = [];
    $hashes = [];
    foreach ($gallery as $reference) {
        $photo = record_id($reference['photo_id'] ?? null);
        $report = record_id($reference['report_id'] ?? null);
        $hash = $reference['sha256'] ?? '';
        if (!is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash) || isset($expected[$photo]) || isset($hashes[$hash])) {
            throw new InvalidArgumentException('Gallery photos require distinct IDs and hashes.');
        }
        $expected[$photo] = [$report,$hash];
        $hashes[$hash] = true;
    }
    if ($expected != $found) throw new InvalidArgumentException('Indexed results differ from the frozen gallery.');
    $root = dirname((string) realpath($manifestPath));
    $cases = [];
    $groups = ['same_object'=>0,'lookalike'=>0,'irrelevant'=>0];
    foreach ($queries as $query) {
        $group = $query['group'] ?? '';
        $ids = $query['expected_ids'] ?? null;
        $image = $query['image'] ?? '';
        $hash = $query['sha256'] ?? '';
        if (!isset($groups[$group]) || !is_array($ids) || !array_is_list($ids) ||
            ($group === 'same_object' && count($ids) !== 1) || ($group === 'lookalike' && !$ids) ||
            ($group === 'irrelevant' && $ids) ||
            !is_string($image) || !preg_match('/^[a-zA-Z0-9_.-]+\.(?:jpe?g|png)$/iD', $image) ||
            !is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash) || isset($hashes[$hash])) {
            throw new InvalidArgumentException('Invalid query label, path or repeated photograph.');
        }
        $ids = array_map('record_id', $ids);
        if (array_diff($ids, array_column($expected, 0))) throw new InvalidArgumentException('A query label is outside the gallery.');
        $file = realpath($root . '/' . $image);
        $bytes = $file && dirname($file) === $root ? @file_get_contents($file, false, null, 0, 250001) : false;
        if ($bytes === false || !hash_equals($hash, hash('sha256', $bytes))) throw new InvalidArgumentException('A query photo differs from the frozen manifest.');
        $prepared = visual_prepare_image($bytes);
        $cases[] = ['group'=>$group,'expected_ids'=>$ids,'prepared'=>$prepared];
        $hashes[$hash] = true;
        $groups[$group]++;
    }
    if (!$groups['same_object'] || !$groups['lookalike'] || $groups['irrelevant'] < 10) {
        throw new InvalidArgumentException('Expected positives, look-alikes and at least ten visually irrelevant queries.');
    }
    return [hash('sha256', $raw),array_keys($hashes),$candidateRows,$cases];
}

try {
    assert_qa_installation(app_root());
    if (visual_enabled() && count($argv) === 2 && $argv[1] === '--derive-strong') {
        // Older receipts lack the "Very similar" cutoff. Derive it from that receipt's own retained validation
        // scores (no provider calls, no held-out data) into a write-once side file.
        $receiptPath = storage_dir('setup') . '/visual-calibration.json';
        $threshold = visual_threshold();
        if ($threshold === null) throw new InvalidArgumentException('Freeze validation before deriving a strong cutoff.');
        $receipt = json_decode((string) file_get_contents($receiptPath), true, 16, JSON_THROW_ON_ERROR);
        if (isset($receipt['strong_threshold'])) throw new InvalidArgumentException('The receipt already has a strong cutoff.');
        $scoresName = (string) ($receipt['validation_scores_file'] ?? '');
        if (!preg_match('/^visual-validation-[0-9]{14}-[a-f0-9]{12}\.json$/D', $scoresName)) throw new InvalidArgumentException('The receipt names no retained validation scores.');
        $scoresJson = (string) file_get_contents(storage_dir('setup') . '/' . $scoresName);
        if (!hash_equals((string) ($receipt['validation_scores_sha256'] ?? ''), hash('sha256', $scoresJson))) throw new InvalidArgumentException('Validation scores do not match the receipt.');
        $scores = json_decode($scoresJson, true, 64, JSON_THROW_ON_ERROR);
        if (($scores['validation_sha256'] ?? null) !== $receipt['validation_sha256']) throw new InvalidArgumentException('Validation scores belong to another manifest.');
        $strong = visual_strong_threshold($scores['queries'], $threshold);
        if ($strong === null) throw new InvalidArgumentException('No same-object validation score clears every other score; all matches stay "Similar".');
        $side = ['model'=>VISUAL_MODEL,'dimensions'=>VISUAL_DIMENSIONS,'preprocessing'=>VISUAL_PREPROCESSING,
            'validation_scores_sha256'=>$receipt['validation_scores_sha256'],'strong_threshold'=>$strong,'derived_utc'=>gmdate('c')];
        $file = @fopen(storage_dir('setup') . '/visual-calibration-strong.json', 'x');
        if (!$file) throw new RuntimeException('A strong cutoff side file already exists or could not be created.');
        try { $json = json_encode($side, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR); if (fwrite($file, $json) !== strlen($json)) throw new RuntimeException('Could not write the strong cutoff.'); }
        finally { fclose($file); }
        echo json_encode(['strong_threshold'=>$strong], JSON_THROW_ON_ERROR) . PHP_EOL;
        exit;
    }
    if (!visual_enabled() || count($argv) !== 3) throw new InvalidArgumentException('Use --calibrate MANIFEST, --verify-held-out MANIFEST or --derive-strong in enabled QA.');
    $output = storage_dir('setup') . '/visual-calibration.json';
    if ($argv[1] === '--verify-held-out') {
        if (visual_threshold() === null) throw new InvalidArgumentException('Freeze validation before accessing held-out data.');
        $receipt = json_decode((string) file_get_contents($output), true, 16, JSON_THROW_ON_ERROR);
        [$hash,$hashes] = visual_evaluation_input($argv[2], 'held_out');
        if (!is_array($receipt['validation_photo_hashes'] ?? null) || $hash === $receipt['validation_sha256'] ||
            array_intersect($hashes, $receipt['validation_photo_hashes'])) {
            throw new InvalidArgumentException('Held-out photos overlap validation.');
        }
        echo json_encode(['verified_held_out_sha256'=>$hash], JSON_THROW_ON_ERROR) . PHP_EOL;
        exit;
    }
    if ($argv[1] !== '--calibrate' || is_file($output)) throw new InvalidArgumentException('Calibration requires a new, frozen validation manifest and no previous threshold receipt.');
    [$hash,$hashes,$gallery,$cases] = visual_evaluation_input($argv[2], 'validation');
    $scored = [];
    foreach ($cases as $case) {
        $scored[] = ['group'=>$case['group'],'expected_ids'=>$case['expected_ids'],
            'ranked'=>visual_rank($gallery, visual_embed($case['prepared']))];
        // Keep validation within the installation's rolling shared call budget.
        if (count($scored) < count($cases)) usleep((int) ceil(62000000 / min(6, app_config()['visual_search_calls_per_minute'])));
    }
    $selection = visual_calibrate($scored);
    $scoreJson = json_encode(['validation_sha256'=>$hash,'model'=>VISUAL_MODEL,'dimensions'=>VISUAL_DIMENSIONS,
        'preprocessing'=>VISUAL_PREPROCESSING,'scored_utc'=>gmdate('c'),'queries'=>$scored,'selection'=>$selection], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
    $scorePath = storage_dir('setup') . '/visual-validation-' . gmdate('YmdHis') . '-' . substr($hash,0,12) . '.json';
    $scoreFile = fopen($scorePath, 'x');
    if (!$scoreFile) throw new RuntimeException('Cannot retain validation evidence.');
    try { if (fwrite($scoreFile, $scoreJson) !== strlen($scoreJson)) throw new RuntimeException('Cannot retain validation evidence.'); }
    finally { fclose($scoreFile); }
    if ($selection === null) throw new InvalidArgumentException('No validation cutoff met the irrelevant-query cap and retrieved a target.');
    $receipt = ['model'=>VISUAL_MODEL,'dimensions'=>VISUAL_DIMENSIONS,'preprocessing'=>VISUAL_PREPROCESSING,
        'validation_sha256'=>$hash,'validation_photo_hashes'=>$hashes,'irrelevant_return_cap'=>0.1,
        'validation_scores_file'=>basename($scorePath),'validation_scores_sha256'=>hash('sha256',$scoreJson)] + $selection;
    $file = @fopen($output, 'x');
    if (!$file) throw new RuntimeException('A calibration receipt already exists or could not be created.');
    try {
        $json = json_encode($receipt, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
        if (fwrite($file, $json) !== strlen($json)) throw new RuntimeException('Could not write calibration receipt.');
    } finally { fclose($file); }
    echo json_encode(['validation_sha256'=>$hash] + $selection, JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (VisualProviderError $error) {
    fwrite(STDERR, 'Calibration stopped on provider status ' . $error->reason . '.' . PHP_EOL);
    exit(1);
} catch (InvalidArgumentException $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
} catch (Throwable $error) {
    fwrite(STDERR, "Calibration stopped. Check the QA guard, frozen manifest and index.\n");
    exit(1);
}
