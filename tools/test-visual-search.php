<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

function visual_check(bool $condition, string $label): void
{
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    echo 'PASS: ' . $label . PHP_EOL;
}

function visual_axis(int $index): array
{
    $values = array_fill(0, VISUAL_DIMENSIONS, 0);
    $values[$index] = 1;
    return visual_normalize($values);
}

if (($argv[1] ?? null) === '--drain-fixture') {
    require __DIR__ . '/qa-guard.php';
    $target = $argv[2] ?? '';
    require $target . '/app/visual-index.php';
    assert_qa_installation($target);
    $port = (int) getenv('REFIND_VISUAL_DISPOSABLE_DB_PORT');
    if ($port < 1024 || $port === 3306 || app_config()['db_port'] !== $port || !visual_enabled()) {
        throw new RuntimeException('Fixture requires enabled Visual Search on a disposable test port.');
    }
    $item = record_id($argv[3] ?? null);
    $other = row("SELECT p.photo_id FROM item_photo_embeddings e JOIN item_photos p ON p.photo_id=e.photo_id
        WHERE e.status='PENDING' AND p.item_id<>? LIMIT 1", [$item]);
    if ($other) throw new RuntimeException('Other jobs are pending. Use an empty disposable index.');
    $reason = $argv[4] ?? 'ready';
    $result = visual_drain(static function (string $jpeg) use ($reason): array {
        if ($reason !== 'ready') throw new VisualProviderError($reason, $reason === 'quota' ? 60 : 0);
        return visual_axis(0);
    });
    echo json_encode($result, JSON_THROW_ON_ERROR) . PHP_EOL;
    exit;
}

require __DIR__ . '/../app/visual-evaluation.php';
require __DIR__ . '/../app/visual-provider.php';

$first = visual_axis(0);
$second = visual_axis(1);
visual_check(visual_cosine($first, $first) === 1.0 && visual_cosine($first, $second) === 0.0, 'unit cosine');
visual_check(visual_unpack(str_repeat("\x00", 3072)) === null && visual_unpack('x') === null, 'zero and malformed vectors');
$ranked = visual_rank([
    ['item_id'=>9,'photo_id'=>1,'vector'=>pack('g*', ...$second)],
    ['item_id'=>9,'photo_id'=>2,'vector'=>pack('g*', ...$first)],
    ['item_id'=>3,'photo_id'=>6,'vector'=>pack('g*', ...$first)],
    ['item_id'=>3,'photo_id'=>5,'vector'=>pack('g*', ...$first)],
    ['item_id'=>10,'photo_id'=>9,'vector'=>'invalid'],
    ['item_id'=>11,'photo_id'=>10,'vector'=>pack('g*', ...$second)],
], $first);
visual_check(array_column($ranked, 'item_id') === [3,9,11] &&
    array_column($ranked, 'photo_id') === [5,2,10] &&
    array_column(visual_above_threshold($ranked, 1.0), 'item_id') === [3,9], 'deduplication, deterministic ties and inclusive cutoff');

$vector = visual_provider_vector(200, json_encode(['embedding'=>['values'=>$first]], JSON_THROW_ON_ERROR));
visual_check($vector === $first, 'single-image Gemini REST response shape');
foreach ([[429,'quota',60], [503,'unavailable',0], [504,'timeout',0], [403,'project',900], [200,'bad_response',0]] as [$code,$reason,$retry]) {
    try {
        visual_provider_vector($code, '{}', $code === 429 ? 60 : 0);
        throw new RuntimeException('Provider fault did not throw.');
    } catch (VisualProviderError $error) {
        visual_check($error->reason === $reason && $error->retryAfter === $retry, 'provider ' . $reason);
    }
}
$cases = [
    ['group'=>'same_object','expected_ids'=>[1],'ranked'=>[['item_id'=>1,'score'=>0.7]]],
    ['group'=>'same_object','expected_ids'=>[1],'ranked'=>[['item_id'=>1,'score'=>0.9]]],
    ['group'=>'lookalike','expected_ids'=>[1],'ranked'=>[['item_id'=>1,'score'=>0.95]]],
    ['group'=>'irrelevant','expected_ids'=>[],'ranked'=>[['item_id'=>1,'score'=>0.85]]],
];
for ($i = 0; $i < 9; $i++) $cases[] = ['group'=>'irrelevant','expected_ids'=>[],'ranked'=>[['item_id'=>1,'score'=>0.4]]];
$selected = visual_calibrate($cases);
visual_check($selected !== null && $selected['threshold'] < 0.7 &&
    $selected['metrics']['same_object']['hit5'] === 2 &&
    $selected['metrics']['irrelevant']['returns'] === 1 &&
    $selected['metrics']['lookalike']['returns'] === 1, 'calibration maximizes recall within irrelevant cap and allows look-alikes');
visual_check(visual_calibrate(array_slice($cases, 2)) === null, 'calibration needs a retrieved validation target');

$image = imagecreatetruecolor(16, 16);
ob_start();
imagepng($image);
$png = (string) ob_get_clean();
visual_check(str_starts_with(visual_prepare_image($png), "\xFF\xD8"), 'PNG re-encoding');
try {
    visual_prepare_image('this is not a photograph');
    throw new RuntimeException('Invalid image did not throw.');
} catch (InvalidArgumentException) { visual_check(true, 'spoofed image rejected'); }
