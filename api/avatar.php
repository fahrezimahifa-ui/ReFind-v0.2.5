<?php
require __DIR__ . '/bootstrap.php';
method('GET'); allowed_fields($_GET, ['token']); request_user();
$token = $_GET['token'] ?? '';
if (!is_string($token) || !preg_match('/^[a-f0-9]{32}$/D', $token)) fail('Picture not found.', 404, 'not_found');
$relative = 'avatars/' . $token . '.jpg';
if (!row('SELECT user_id FROM users WHERE avatar_path=? AND is_active=1', [$relative])) fail('Picture not found.', 404, 'not_found');
$path = storage_dir() . '/' . $relative;
if (!is_file($path)) fail('Picture not found.', 404, 'not_found');
header('Content-Type: image/jpeg'); header('Content-Length: ' . filesize($path)); readfile($path);
