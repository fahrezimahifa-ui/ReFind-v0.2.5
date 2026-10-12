<?php
declare(strict_types=1);

function app_config(): array
{
    static $config;
    if ($config !== null) return $config;
    $config = [
        'db_host' => '127.0.0.1', 'db_port' => 3306,
        'db_name' => 'refind_db_0_2_0', 'db_user' => 'root', 'db_password' => '',
        'base_path' => '/ReFind_0.2.0/', 'session_name' => 'refind_020',
        'idle_seconds' => 1800, 'absolute_seconds' => 28800,
        'login_window_seconds' => 900, 'login_pair_limit' => 5, 'login_ip_limit' => 30,
        // Shown to students after approval. Demo values; override them in config.local.php for a real desk.
        'pickup_desk_name' => 'Building Management service desk', 'pickup_desk_location' => 'Gedung A lobby, ground floor',
        'pickup_desk_hours' => 'Monday–Friday, 08:00–16:00 WIB', 'pickup_desk_contact' => 'bm@refind.test',
    ];
    $local = __DIR__ . '/config.local.php';
    if (is_file($local)) {
        $override = require $local;
        if (!is_array($override) || array_diff(array_keys($override), array_keys($config))) {
            throw new RuntimeException('Invalid local configuration.');
        }
        $config = array_replace($config, $override);
    }
    if (!in_array($config['db_name'], ['refind_db_0_2_0', 'refind_db_0_2_0_test'], true)) {
        throw new RuntimeException('This version only uses its own 0.2.0 databases.');
    }
    if (!preg_match('~^/[A-Za-z0-9_.-]+/$~D', $config['base_path']) ||
        !preg_match('/^[A-Za-z0-9_]+$/D', $config['session_name'])) {
        throw new RuntimeException('Invalid application path/session configuration.');
    }
    foreach (['idle_seconds', 'absolute_seconds', 'login_window_seconds', 'login_pair_limit', 'login_ip_limit'] as $key) {
        if (!is_int($config[$key]) || $config[$key] < 1) throw new RuntimeException('Invalid timeout/limit.');
    }
    foreach (['pickup_desk_name', 'pickup_desk_location', 'pickup_desk_hours', 'pickup_desk_contact'] as $key) {
        if (!is_string($config[$key]) || trim($config[$key]) === '' || mb_strlen($config[$key]) > 160) throw new RuntimeException('Invalid pickup desk configuration.');
    }
    return $config;
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
        $secret = json_decode((string) @file_get_contents(storage_dir('auth') . '/secret.json'), true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($secret) || !preg_match('/^[a-f0-9]{64}$/D', $secret['key'] ?? '') ||
            !is_string($secret['dummy_hash'] ?? null) || !password_get_info($secret['dummy_hash'])['algo']) {
            throw new RuntimeException('Run the local setup before authentication.');
        }
    }
    return $secret;
}
