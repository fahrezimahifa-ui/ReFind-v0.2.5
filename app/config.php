<?php
declare(strict_types=1);

function app_defaults(): array
{
    return [
        'db_host' => '127.0.0.1', 'db_port' => 3306,
        'db_name' => 'refind_db_0_2_0', 'db_user' => 'root', 'db_password' => '',
        'base_path' => '/ReFind_0.2.0/', 'session_name' => 'refind_020',
        'idle_seconds' => 1800, 'absolute_seconds' => 28800,
        'login_window_seconds' => 900, 'login_pair_limit' => 5, 'login_ip_limit' => 30,
        // Shown to students after approval. Demo values; override them in config.local.php for a real desk.
        'pickup_desk_name' => 'Building Management service desk', 'pickup_desk_location' => 'Gedung A lobby, ground floor',
        'pickup_desk_hours' => 'Monday–Friday, 08:00–16:00 WIB', 'pickup_desk_contact' => 'bm@refind.test',
    ];
}

function validate_app_config(array $config): array
{
    if (array_diff(array_keys($config), array_keys(app_defaults())) || array_diff(array_keys(app_defaults()), array_keys($config))) {
        throw new RuntimeException('Invalid configuration keys.');
    }
    foreach (['db_host', 'db_user'] as $key) {
        if (!is_string($config[$key]) || trim($config[$key]) === '' || preg_match('/[\x00-\x1f\x7f]/', $config[$key])) {
            throw new RuntimeException('Invalid database configuration.');
        }
    }
    if (!is_int($config['db_port']) || $config['db_port'] < 1 || $config['db_port'] > 65535 ||
        !is_string($config['db_password']) || str_contains($config['db_password'], "\0")) {
        throw new RuntimeException('Invalid database configuration.');
    }
    if (!in_array($config['db_name'], ['refind_db_0_2_0', 'refind_db_0_2_0_test'], true)) {
        throw new RuntimeException('This version only uses its own 0.2.0 databases.');
    }
    if (!is_string($config['base_path']) || !preg_match('~^/(?!\.{1,2}/)[A-Za-z0-9_.-]+/$~D', $config['base_path']) ||
        !is_string($config['session_name']) || !preg_match('/^[A-Za-z0-9_]+$/D', $config['session_name'])) {
        throw new RuntimeException('Invalid application path/session configuration.');
    }
    foreach (['idle_seconds', 'absolute_seconds', 'login_window_seconds', 'login_pair_limit', 'login_ip_limit'] as $key) {
        if (!is_int($config[$key]) || $config[$key] < 1) throw new RuntimeException('Invalid timeout/limit.');
    }
    foreach (['pickup_desk_name', 'pickup_desk_location', 'pickup_desk_hours', 'pickup_desk_contact'] as $key) {
        if (!is_string($config[$key]) || !mb_check_encoding($config[$key], 'UTF-8') || trim($config[$key]) === '' || mb_strlen($config[$key], 'UTF-8') > 160) {
            throw new RuntimeException('Invalid pickup desk configuration.');
        }
    }
    return $config;
}

function load_app_config(string $local): array
{
    $config = app_defaults();
    if (is_file($local)) {
        $override = require $local;
        if (!is_array($override) || array_diff(array_keys($override), array_keys($config))) {
            throw new RuntimeException('Invalid local configuration.');
        }
        $config = array_replace($config, $override);
    }
    return validate_app_config($config);
}

function app_config(): array
{
    static $config;
    // Publish only a fully validated configuration, including after a failed load.
    return $config ??= load_app_config(__DIR__ . '/config.local.php');
}

function app_root(): string { return dirname(__DIR__); }
function storage_dir(string $collection = ''): string
{
    if ($collection !== '' && !in_array($collection, ['auth', 'sessions', 'setup', 'items', 'evidence', 'claims'], true)) {
        throw new RuntimeException('Invalid storage collection.');
    }
    return app_root() . '/storage' . ($collection === '' ? '' : '/' . $collection);
}
function site_secret(): array
{
    static $secret;
    if ($secret === null) {
        $candidate = json_decode((string) @file_get_contents(storage_dir('auth') . '/secret.json'), true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($candidate) || !is_string($candidate['key'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $candidate['key']) ||
            !is_string($candidate['dummy_hash'] ?? null) || !password_get_info($candidate['dummy_hash'])['algo']) {
            throw new RuntimeException('Run the local setup before authentication.');
        }
        $secret = $candidate;
    }
    return $secret;
}
