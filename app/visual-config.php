<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/visual-core.php';

function visual_enabled(): bool
{
    $config = app_config();
    return $config['visual_search_enabled'] && $config['db_name'] === 'refind_db_0_2_0_test' &&
        $config['base_path'] === '/ReFind_0.2.0_Test/' && $config['session_name'] === 'refind_020_test' &&
        basename(app_root()) === 'ReFind_0.2.0_Test' && is_file(app_root() . '/.refind-b02-test.json');
}

function visual_student_allowed(?array $user): bool
{
    return visual_enabled() && ($user['role'] ?? null) === 'STUDENT' &&
        in_array((int) ($user['user_id'] ?? 0), app_config()['visual_search_students'], true);
}

function visual_api_key(): ?string
{
    $key = getenv('GEMINI_API_KEY', true);
    if ($key === false || $key === '') {
        $file = app_config()['visual_search_key_file'];
        $path = $file === '' ? false : realpath($file);
        if (!$path || !is_file($path) || is_link($file)) return null;
        $normalize = static fn(string $value): string => strtolower(str_replace('\\', '/', $value));
        foreach ([dirname(app_root()), $_SERVER['DOCUMENT_ROOT'] ?? ''] as $root) {
            $resolved = $root === '' ? false : realpath($root);
            if ($resolved && str_starts_with($normalize($path), rtrim($normalize($resolved), '/') . '/')) return null;
        }
        $key = trim((string) @file_get_contents($path, false, null, 0, 513));
    }
    return preg_match('/^[A-Za-z0-9_.-]{20,512}$/D', $key) ? $key : null;
}

function visual_threshold(): ?float
{
    $raw = @file_get_contents(storage_dir('setup') . '/visual-calibration.json', false, null, 0, 16384);
    $data = $raw === false ? null : json_decode($raw, true);
    $threshold = $data['threshold'] ?? null;
    if (($data['model'] ?? null) !== VISUAL_MODEL || ($data['dimensions'] ?? null) !== VISUAL_DIMENSIONS ||
        ($data['preprocessing'] ?? null) !== VISUAL_PREPROCESSING ||
        !is_string($data['validation_sha256'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $data['validation_sha256']) ||
        (!is_int($threshold) && !is_float($threshold)) || !is_finite((float) $threshold) ||
        $threshold < -1 || $threshold > 1) return null;
    return (float) $threshold;
}

// Optional "Very similar" cutoff. A new calibration stores it in the receipt; an older receipt may get a
// side file derived from its own retained validation scores. Either must match the active calibration.
function visual_strong_cutoff(float $threshold): ?float
{
    $read = static function (string $name): ?array {
        $raw = @file_get_contents(storage_dir('setup') . '/' . $name, false, null, 0, 16384);
        $data = $raw === false ? null : json_decode($raw, true);
        return is_array($data) ? $data : null;
    };
    $receipt = $read('visual-calibration.json');
    if (!$receipt) return null;
    $value = $receipt['strong_threshold'] ?? null;
    if ($value === null) {
        $side = $read('visual-calibration-strong.json');
        if (!$side || ($side['validation_scores_sha256'] ?? null) !== ($receipt['validation_scores_sha256'] ?? false) ||
            ($side['model'] ?? null) !== VISUAL_MODEL || ($side['dimensions'] ?? null) !== VISUAL_DIMENSIONS ||
            ($side['preprocessing'] ?? null) !== VISUAL_PREPROCESSING) return null;
        $value = $side['strong_threshold'] ?? null;
    }
    if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) || $value < $threshold || $value > 1) return null;
    return (float) $value;
}
