<?php
declare(strict_types=1);
require_once __DIR__ . '/visual-core.php';

function visual_metrics(array $cases, float $threshold): array
{
    $positive = $hit1 = $hit5 = $irrelevant = $falsePositives = $lookalikes = $lookalikeReturns = $lookalikeHit5 = 0;
    $reciprocal = 0.0;
    foreach ($cases as $case) {
        $results = array_column(visual_above_threshold($case['ranked'], $threshold), 'item_id');
        if ($case['group'] === 'irrelevant') {
            $irrelevant++;
            $falsePositives += (int) (bool) $results;
            continue;
        }
        $rank = 0;
        foreach ($results as $index => $report) {
            if (in_array($report, $case['expected_ids'], true)) {
                $rank = $index + 1;
                break;
            }
        }
        if ($case['group'] === 'lookalike') {
            $lookalikes++;
            $lookalikeReturns += (int) (bool) $results;
            $lookalikeHit5 += (int) ($rank > 0 && $rank <= 5);
            continue;
        }
        $positive++;
        $hit1 += (int) ($rank === 1);
        $hit5 += (int) ($rank > 0 && $rank <= 5);
        $reciprocal += $rank > 0 ? 1 / $rank : 0;
    }
    return ['same_object'=>['total'=>$positive,'hit1'=>$hit1,'hit5'=>$hit5,'mrr'=>$positive ? $reciprocal / $positive : null],
        'irrelevant'=>['total'=>$irrelevant,'returns'=>$falsePositives,'rate'=>$irrelevant ? $falsePositives / $irrelevant : null],
        'lookalike'=>['total'=>$lookalikes,'returns'=>$lookalikeReturns,'hit5'=>$lookalikeHit5]];
}

function visual_calibrate(array $cases): ?array
{
    $scores = [-1.0, 1.0];
    foreach ($cases as $case) {
        if ($case['group'] === 'lookalike') continue;
        foreach (array_slice($case['ranked'], 0, VISUAL_RESULT_LIMIT) as $match) $scores[] = $match['score'];
    }
    sort($scores, SORT_NUMERIC);
    $points = [-1.0, 1.0];
    for ($i = 1; $i < count($scores); $i++) {
        if ($scores[$i - 1] !== $scores[$i]) $points[] = ($scores[$i - 1] + $scores[$i]) / 2;
    }
    $best = null;
    $bestKey = null;
    foreach ($points as $point) {
        $metrics = visual_metrics($cases, $point);
        $p = $metrics['same_object'];
        $n = $metrics['irrelevant'];
        if (!$p['hit5'] || !$n['total'] || $n['returns'] * 10 > $n['total']) continue;
        $key = [$p['hit5'],$p['mrr'],-$n['returns'],-$point];
        if ($bestKey === null || $key > $bestKey) {
            $best = ['threshold'=>$point,'metrics'=>$metrics];
            $bestKey = $key;
        }
    }
    return $best;
}
