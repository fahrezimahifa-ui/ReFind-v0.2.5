<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

function account_profile(array $user): array
{
    return ['id' => (string) $user['user_id'], 'name' => $user['full_name'], 'email' => $user['email'],
        'student_id' => $user['role'] === 'STUDENT' ? $user['student_id'] : null, 'role' => $user['role']];
}
function profile_name(array $data): string
{
    $name = $data['name'] ?? '';
    if (!is_string($name) || !mb_check_encoding($name, 'UTF-8')) field_fail('name', 'Enter a valid display name.');
    $name = trim($name);
    if ($name === '' || mb_strlen($name) > 120 || preg_match('/[\x00-\x1f\x7f]/', $name)) {
        field_fail('name', 'Use a display name between 1 and 120 characters, without control characters.');
    }
    return $name;
}
function account_password(array $data, string $key, bool $new = false): string
{
    $password = $data[$key] ?? '';
    if ($password === '') field_fail($key, str_contains($key, 'current') ? 'Enter your current password.' : (str_contains($key, 'confirm') ? 'Repeat the new password.' : 'Enter a new password.'));
    if (!is_string($password) || !mb_check_encoding($password, 'UTF-8') || str_contains($password, "\0") || strlen($password) > 72) {
        field_fail($key, 'This password is too long. Use at most 72 bytes; emoji and accented letters count as more than one.');
    }
    if ($new && mb_strlen($password) < 10) field_fail($key, 'Use at least 10 characters for the new password.');
    return $password; // Preserve leading/trailing spaces: passwords are never trimmed.
}
function lock_own_account(array $user): array
{
    $record = row('SELECT user_id, full_name, email, student_id, role, is_active, password_hash FROM users WHERE user_id = ? FOR UPDATE', [(int) $user['user_id']]);
    if (!$record || !(int) $record['is_active'] || !isset($_SESSION['auth']['fingerprint']) ||
        !hash_equals($_SESSION['auth']['fingerprint'], credential_fingerprint($record['password_hash']))) {
        invalidate_identity();
        fail('Your account session changed. Please log in again.', 401, 'authentication_required');
    }
    return $record;
}
function verify_current_password(array $record, string $password): void
{
    $c = app_config();
    $key = hash_hmac('sha256', 'password-change|' . $record['user_id'] . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'local'), site_secret()['key']);
    $file = fopen(storage_dir('auth') . '/password-attempts.json', 'c+');
    if (!$file || !flock($file, LOCK_EX)) throw new RuntimeException('Password verification limiter unavailable.');
    try {
        $raw = stream_get_contents($file);
        $buckets = $raw === '' ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($buckets)) throw new RuntimeException('Invalid password verification limiter.');
        $now = time();
        foreach ($buckets as $id => $bucket) if (($bucket['start'] ?? 0) + $c['login_window_seconds'] <= $now) unset($buckets[$id]);
        if (($buckets[$key]['count'] ?? 0) >= $c['login_pair_limit']) {
            $wait = max(1, $buckets[$key]['start'] + $c['login_window_seconds'] - $now);
            header('Retry-After: ' . $wait);
            fail('Too many password verification attempts. Please wait before trying again.', 429, 'password_rate_limited');
        }
        $valid = password_verify($password, $record['password_hash']);
        if ($valid) unset($buckets[$key]);
        else { $buckets[$key] ??= ['start' => $now, 'count' => 0]; $buckets[$key]['count']++; }
        rewind($file); ftruncate($file, 0);
        if (fwrite($file, json_encode($buckets, JSON_THROW_ON_ERROR)) === false || !fflush($file)) throw new RuntimeException('Cannot persist password limiter.');
        if (!$valid) field_fail('current_password', 'The current password could not be verified.', 'current_password_invalid');
    } finally { flock($file, LOCK_UN); fclose($file); }
}
