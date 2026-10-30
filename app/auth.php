<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $c = app_config();
    if (!is_dir(storage_dir('sessions'))) throw new RuntimeException('Private session storage is unavailable.');
    session_name($c['session_name']);
    session_save_path(storage_dir('sessions'));
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.gc_maxlifetime', (string) $c['absolute_seconds']);
    session_set_cookie_params(['lifetime' => 0, 'path' => $c['base_path'], 'httponly' => true, 'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
    session_start();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}
function credential_fingerprint(string $hash): string { return hash_hmac('sha256', $hash, site_secret()['key']); }
function invalidate_identity(): void
{
    $_SESSION = ['csrf' => bin2hex(random_bytes(32))];
    session_regenerate_id(true);
}
function auth_user(): ?array
{
    start_app_session();
    if (!isset($_SESSION['auth'])) return null;
    $auth = $_SESSION['auth']; $c = app_config(); $now = time();
    if (!is_array($auth) || !is_int($auth['user_id'] ?? null) || !is_int($auth['issued_at'] ?? null) ||
        !is_int($auth['last_seen'] ?? null) || !is_string($auth['fingerprint'] ?? null) ||
        $now - $auth['last_seen'] >= $c['idle_seconds'] || $now - $auth['issued_at'] >= $c['absolute_seconds']) {
        invalidate_identity(); return null;
    }
    $record = row('SELECT user_id, student_id, full_name, email, role, is_active, password_hash, avatar_path FROM users WHERE user_id = ?', [$auth['user_id']]);
    if (!$record || !(int) $record['is_active'] || !hash_equals($auth['fingerprint'], credential_fingerprint($record['password_hash']))) {
        invalidate_identity(); return null;
    }
    $_SESSION['auth']['last_seen'] = $now;
    unset($record['password_hash'], $record['is_active']);
    $record['user_id'] = (string) $record['user_id'];
    return $record;
}
function public_identity(array $user): array
{
    return ['id' => $user['user_id'], 'name' => $user['full_name'], 'role' => $user['role'], 'avatar_url' => avatar_url($user['avatar_path'] ?? null)];
}
function require_user(): array
{
    $user = auth_user();
    if (!$user) fail('Please log in to continue.', 401, 'authentication_required');
    return $user;
}
function require_role(array $user, string $role): void
{
    if ($user['role'] !== $role) fail('This action is not available to your role.', 403, 'forbidden');
}
function verify_csrf(): void
{
    start_app_session();
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
    $body = $_POST['_csrf'] ?? null;
    $token = $header ?? $body;
    if (!is_string($token) || !hash_equals($_SESSION['csrf'], $token) || ($header !== null && $body !== null && $header !== $body)) {
        fail('Your session changed. Reload the page and try again.', 403, 'csrf_invalid');
    }
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $origin = parse_url($_SERVER['HTTP_ORIGIN']);
        $scheme = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http';
        $local = parse_url($scheme . '://' . ($_SERVER['HTTP_HOST'] ?? ''));
        if (!$origin || !$local || ($origin['scheme'] ?? '') !== $scheme ||
            strtolower($origin['host'] ?? '') !== strtolower($local['host'] ?? '') ||
            ($origin['port'] ?? ($scheme === 'https' ? 443 : 80)) !== ($local['port'] ?? ($scheme === 'https' ? 443 : 80))) {
            fail('The request origin is not allowed.', 403, 'csrf_invalid');
        }
    }
}
function request_user(?string $role = null, bool $mutation = false): array
{
    $user = require_user();
    if ($role !== null) require_role($user, $role);
    if ($mutation) verify_csrf();
    session_write_close();
    return $user;
}

function password_input(array $data): string
{
    $password = $data['password'] ?? '';
    if (!is_string($password) || !mb_check_encoding($password, 'UTF-8') || strlen($password) > 72 || str_contains($password, "\0")) return '';
    return $password; // Passwords are never trimmed.
}

function login_account(string $email, string $password): array
{
    $c = app_config(); $secret = site_secret();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'local'; // Never trust client X-Forwarded-For.
    $keys = [hash_hmac('sha256', 'pair|' . $email . '|' . $ip, $secret['key']) => $c['login_pair_limit'],
        hash_hmac('sha256', 'ip|' . $ip, $secret['key']) => $c['login_ip_limit']];
    $file = fopen(storage_dir('auth') . '/attempts.json', 'c+');
    if (!$file || !flock($file, LOCK_EX)) throw new RuntimeException('Authentication limiter unavailable.');
    try {
        $raw = stream_get_contents($file);
        $buckets = $raw === '' ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($buckets)) throw new RuntimeException('Invalid limiter state.');
        $now = time();
        foreach ($buckets as $key => $bucket) {
            if (($bucket['start'] ?? 0) + $c['login_window_seconds'] <= $now) unset($buckets[$key]);
        }
        $wait = 0;
        foreach ($keys as $key => $limit) {
            if (($buckets[$key]['count'] ?? 0) >= $limit) $wait = max($wait, $buckets[$key]['start'] + $c['login_window_seconds'] - $now);
        }
        if ($wait > 0) {
            header('Retry-After: ' . $wait);
            fail('Too many login attempts. Please wait and try again.', 429, 'login_rate_limited');
        }
        $record = filter_var($email, FILTER_VALIDATE_EMAIL) && strlen($email) <= 150
            ? row('SELECT user_id, email, full_name, student_id, role, is_active, password_hash, avatar_path FROM users WHERE email = ?', [$email]) : null;
        $validPassword = password_verify($password, $record['password_hash'] ?? $secret['dummy_hash']);
        $accepted = $record && (int) $record['is_active'] === 1 && $password !== '' && $validPassword;
        if (!$accepted) {
            foreach ($keys as $key => $limit) {
                $buckets[$key] ??= ['start' => $now, 'count' => 0];
                $buckets[$key]['count']++;
            }
        } else {
            unset($buckets[array_key_first($keys)]); // Success clears pair only, not aggregate IP failures.
        }
        rewind($file); ftruncate($file, 0);
        if (fwrite($file, json_encode($buckets, JSON_THROW_ON_ERROR)) === false || !fflush($file)) throw new RuntimeException('Cannot persist limiter state.');
        if (!$accepted) fail('Email or password could not be verified.', 401, 'invalid_credentials');
        $_SESSION = ['csrf' => bin2hex(random_bytes(32)), 'auth' => ['user_id' => (int) $record['user_id'],
            'issued_at' => $now, 'last_seen' => $now, 'fingerprint' => credential_fingerprint($record['password_hash'])]];
        session_regenerate_id(true);
        unset($record['password_hash'], $record['is_active']);
        $record['user_id'] = (string) $record['user_id'];
        return $record;
    } finally { flock($file, LOCK_UN); fclose($file); }
}
function logout_account(): void
{
    $_SESSION = [];
    $p = session_get_cookie_params();
    session_destroy();
    setcookie(app_config()['session_name'], '', ['expires' => time() - 3600, 'path' => $p['path'],
        'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Lax']);
}

function avatar_url(?string $path): ?string
{
    return $path && preg_match('~^avatars/([a-f0-9]{32})\.jpg$~D', $path, $match) ? app_config()['base_path'] . 'api/avatar.php?token=' . $match[1] : null;
}
