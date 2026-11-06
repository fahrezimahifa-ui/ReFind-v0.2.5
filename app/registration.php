<?php
declare(strict_types=1);
require_once __DIR__ . '/accounts.php';

function registration_attempt(): void
{
    $c = app_config();
    $key = hash_hmac('sha256', 'registration-ip|' . ($_SERVER['REMOTE_ADDR'] ?? 'local'), site_secret()['key']);
    $file = fopen(storage_dir('auth') . '/registration-attempts.json', 'c+');
    if (!$file) throw new RuntimeException('Registration limiter unavailable.');
    try {
        if (!flock($file, LOCK_EX)) throw new RuntimeException('Registration limiter unavailable.');
        $raw = stream_get_contents($file);
        $buckets = $raw === '' ? [] : json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($buckets)) throw new RuntimeException('Invalid registration limiter state.');
        $now = time();
        foreach ($buckets as $id => $bucket) {
            if (!is_array($bucket) || !is_int($bucket['start'] ?? null) || !is_int($bucket['count'] ?? null) ||
                $bucket['start'] > $now || $bucket['count'] < 1) throw new RuntimeException('Invalid registration limiter bucket.');
            if ($bucket['start'] + $c['registration_window_seconds'] <= $now) unset($buckets[$id]);
        }
        $bucket = $buckets[$key] ?? ['start' => $now, 'count' => 0];
        if ($bucket['count'] >= $c['registration_ip_limit']) {
            header('Retry-After: ' . max(1, $bucket['start'] + $c['registration_window_seconds'] - $now));
            fail('Too many account creation attempts. Please wait and try again.', 429, 'registration_rate_limited');
        }
        $bucket['count']++;
        $buckets[$key] = $bucket;
        $encoded = json_encode($buckets, JSON_THROW_ON_ERROR);
        if (!rewind($file) || !ftruncate($file, 0) || fwrite($file, $encoded) !== strlen($encoded) || !fflush($file)) {
            throw new RuntimeException('Cannot persist registration limiter.');
        }
    } finally { flock($file, LOCK_UN); fclose($file); }
}

function registration_values(array $data): array
{
    $name = profile_name($data);
    $email = $data['email'] ?? '';
    if (!is_string($email) || !mb_check_encoding($email, 'UTF-8')) field_fail('email', 'Enter a valid email address.');
    $email = mb_strtolower(trim($email), 'UTF-8');
    if (strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) field_fail('email', 'Enter a valid email address of at most 150 characters.');
    $password = account_password($data, 'password', true);
    $confirm = account_password($data, 'confirm_password');
    if (!hash_equals($password, $confirm)) field_fail('confirm_password', 'The password confirmation does not match.');
    return ['name' => $name, 'email' => $email, 'password' => $password];
}

function register_student(array $data): array
{
    $values = registration_values($data);
    $hash = password_hash($values['password'], PASSWORD_DEFAULT);
    // Validate installation authentication material before committing a new account.
    credential_fingerprint($hash);
    $connection = db();
    $connection->begin_transaction();
    try {
        sql("INSERT INTO users(full_name,email,password_hash,role,is_active,student_id,avatar_path) VALUES (?,?,?,'STUDENT',1,NULL,NULL)",
            [$values['name'], $values['email'], $hash]);
        $record = ['user_id' => $connection->insert_id, 'student_id' => null, 'full_name' => $values['name'],
            'email' => $values['email'], 'password_hash' => $hash, 'role' => 'STUDENT', 'is_active' => 1, 'avatar_path' => null];
        $connection->commit();
    } catch (Throwable $error) {
        $connection->rollback();
        if ($error instanceof mysqli_sql_exception && $error->getCode() === 1062) {
            fail('An account could not be created with these details. Try another email or log in.', 409, 'registration_conflict');
        }
        throw $error;
    }
    return authenticate_account($record);
}
