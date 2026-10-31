<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

function uploaded_images(string $key, int $limit): array
{
    if (!isset($_FILES[$key])) return [];
    $files = $_FILES[$key];
    foreach (['name', 'error', 'tmp_name', 'size'] as $part) {
        if (!isset($files[$part]) || !is_array($files[$part]) || count($files[$part]) !== count($files['name'] ?? [])) field_fail($key, 'Invalid photo collection.');
    }
    if (count($files['name']) > $limit) field_fail($key, 'Use at most ' . $limit . ' photos.');
    $result = [];
    foreach ($files['name'] as $i => $name) {
        $error = $files['error'][$i];
        if ($error === UPLOAD_ERR_NO_FILE) continue;
        if ($error !== UPLOAD_ERR_OK) field_fail($key, 'Upload incomplete. Please choose the image again.');
        $path = $files['tmp_name'][$i];
        if (!is_string($path) || !is_uploaded_file($path) || filesize($path) > 250000) field_fail($key, 'Prepared photos must be at most 250 KB.');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $dimensions = @getimagesize($path);
        if (!isset($extensions[$mime]) || !$dimensions || min($dimensions[0], $dimensions[1]) < 1 ||
            max($dimensions[0], $dimensions[1]) > 1200 || $dimensions['mime'] !== $mime) field_fail($key, 'Use a valid JPEG, PNG or WebP image with a maximum side of 1200px.');
        $result[] = ['temporary' => $path, 'extension' => $extensions[$mime]];
    }
    return $result;
}
function retained_photos(array $data, string $key, array $default, int $limit): array
{
    if (!isset($data[$key])) return array_map('intval', $default);
    if (!is_string($data[$key])) field_fail($key, 'Invalid retained-photo selection.');
    try { $ids = json_decode($data[$key], true, 16, JSON_THROW_ON_ERROR); }
    catch (JsonException $error) { field_fail($key, 'Invalid retained-photo selection.'); }
    if (!is_array($ids) || !array_is_list($ids) || count($ids) > $limit) field_fail($key, 'Invalid retained-photo selection.');
    $ids = array_map('record_id', $ids);
    if (count(array_unique($ids)) !== count($ids)) field_fail($key, 'Do not select the same photo twice.');
    return $ids;
}
function save_upload(array $image, string $collection, array &$created): string
{
    if (!in_array($collection, ['items', 'evidence', 'claims'], true) || !is_dir(storage_dir($collection))) throw new RuntimeException('Media storage unavailable.');
    $relative = $collection . '/' . bin2hex(random_bytes(16)) . '.' . $image['extension'];
    if (!move_uploaded_file($image['temporary'], storage_dir() . '/' . $relative)) throw new RuntimeException('Cannot save prepared image.');
    $created[] = $relative;
    return $relative;
}
function media_path(string $relative): ?string
{
    return preg_match('~^(items|evidence|claims|avatars)/[a-f0-9]{32}\.(jpg|png|webp)$~D', $relative) ? storage_dir() . '/' . $relative : null;
}
function cleanup_media(array $files, bool $checkReferences = false): void
{
    foreach (array_unique($files) as $relative) {
        if ($checkReferences && (row('SELECT user_id FROM users WHERE avatar_path = ? LIMIT 1', [$relative]) || row('SELECT photo_id FROM item_photos WHERE file_path = ? LIMIT 1', [$relative]) || row('SELECT claim_photo_id FROM claim_photos WHERE file_path = ? LIMIT 1', [$relative]))) continue;
        $path = media_path($relative);
        if ($path && is_file($path) && !@unlink($path)) error_log('ReFind unused media cleanup failed.');
    }
}
