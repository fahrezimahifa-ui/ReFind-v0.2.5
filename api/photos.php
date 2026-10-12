<?php
require __DIR__ . '/bootstrap.php';
method('GET'); allowed_fields($_GET, ['kind', 'id']);
$id = record_id($_GET['id'] ?? null);
if (($_GET['kind'] ?? '') === 'item') {
    // Report pages are for signed-in users only, so their public photos are too.
    request_user();
    $photo = row('SELECT file_path, photo_kind FROM item_photos WHERE photo_id = ?', [$id]);
    if ($photo && $photo['photo_kind'] === 'OWNERSHIP') request_user('BUILDING_MANAGEMENT');
    $collection = ($photo['photo_kind'] ?? '') === 'OWNERSHIP' ? 'evidence' : 'items';
} elseif (($_GET['kind'] ?? '') === 'claim') {
    request_user('BUILDING_MANAGEMENT');
    $photo = row('SELECT file_path FROM claim_photos WHERE claim_photo_id = ?', [$id]);
    $collection = 'claims';
} else fail('Invalid photo collection.', 400);
if (!$photo || !preg_match('~^' . $collection . '/[a-f0-9]{32}\.(jpg|png|webp)$~D', $photo['file_path'])) fail('Photo not found.', 404, 'not_found');
$path = storage_dir() . '/' . $photo['file_path'];
if (!is_file($path)) fail('Photo not found.', 404, 'not_found');
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) fail('Photo not found.', 404, 'not_found');
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
header('Content-Type: ' . $mime); header('Content-Length: ' . filesize($path));
readfile($path);
