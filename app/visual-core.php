<?php
declare(strict_types=1);

const VISUAL_MODEL = 'gemini-embedding-2';
const VISUAL_DIMENSIONS = 768;
const VISUAL_PREPROCESSING = 'jpeg-white-v1';
const VISUAL_RESULT_LIMIT = 10;

function visual_normalize(array $values): array
{
    if (!array_is_list($values) || count($values) !== VISUAL_DIMENSIONS) throw new InvalidArgumentException('Invalid vector size.');
    $squares = 0.0;
    foreach ($values as $value) {
        if ((!is_float($value) && !is_int($value)) || !is_finite((float) $value)) throw new InvalidArgumentException('Invalid vector value.');
        $squares += $value * $value;
    }
    if ($squares <= 0.0 || !is_finite($squares)) throw new InvalidArgumentException('Invalid vector norm.');
    $norm = sqrt($squares);
    return array_map(fn($value) => $value / $norm, $values);
}

function visual_unpack(string $packed): ?array
{
    if (strlen($packed) !== 4 * VISUAL_DIMENSIONS) return null;
    try { return visual_normalize(array_values(unpack('g*', $packed))); }
    catch (InvalidArgumentException) { return null; }
}

function visual_cosine(array $query, array $reference): float
{
    $dot = 0.0;
    foreach ($query as $index => $value) $dot += $value * $reference[$index];
    return min(1.0, max(-1.0, $dot));
}

function visual_rank(iterable $rows, array $query): array
{
    $best = [];
    foreach ($rows as $row) {
        $reference = visual_unpack($row['vector']);
        if ($reference === null) continue;
        $item = (int) $row['item_id'];
        $photo = (int) $row['photo_id'];
        $score = visual_cosine($query, $reference);
        $old = $best[$item] ?? null;
        if (!$old || $score > $old['score'] || ($score === $old['score'] && $photo < $old['photo_id'])) {
            $best[$item] = ['item_id' => $item, 'photo_id' => $photo, 'score' => $score];
        }
    }
    $ranked = array_values($best);
    usort($ranked, fn($a, $b) => ($b['score'] <=> $a['score']) ?: ($a['item_id'] <=> $b['item_id']));
    return $ranked;
}

function visual_above_threshold(array $ranked, float $threshold): array
{
    return array_slice(array_filter($ranked, fn($match) => $match['score'] >= $threshold), 0, VISUAL_RESULT_LIMIT);
}

function visual_prepare_image(string $source, bool $allowWebp = false): string
{
    if (strlen($source) > 250000) throw new InvalidArgumentException('Prepared image exceeds 250 KB.');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($source);
    $types = $allowWebp ? ['image/jpeg','image/png','image/webp'] : ['image/jpeg','image/png'];
    $size = @getimagesizefromstring($source);
    if (!$size || !in_array($mime, $types, true) || $size['mime'] !== $mime ||
        min($size[0], $size[1]) < 1 || max($size[0], $size[1]) > 1200) {
        throw new InvalidArgumentException('Use a valid JPEG or PNG no larger than 1200 pixels per side.');
    }
    $image = @imagecreatefromstring($source);
    if (!$image) throw new InvalidArgumentException('The image could not be decoded.');
    $canvas = imagecreatetruecolor($size[0], $size[1]);
    if (!$canvas) throw new RuntimeException('Image preparation unavailable.');
    imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
    imagecopy($canvas, $image, 0, 0, 0, 0, $size[0], $size[1]);
    ob_start();
    try {
        if (!imagejpeg($canvas, null, 85)) throw new RuntimeException('Image preparation unavailable.');
        return (string) ob_get_contents();
    } finally {
        ob_end_clean();
    }
}
