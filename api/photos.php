<?php
require __DIR__ . '/bootstrap.php';
method('GET'); allowed_fields($_GET, ['kind', 'id', 'w']);
$id = record_id($_GET['id'] ?? null);
// Optional card-sized copy for item photos only; any other width is rejected.
$width = null;
if (isset($_GET['w'])) {
    if ($_GET['w'] !== '480' || ($_GET['kind'] ?? '') !== 'item') fail('Invalid photo size.', 400);
    $width = 480;
}
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

if ($width !== null && ($thumb = photo_thumbnail($path, $photo['file_path'], $width)) !== null) {
    [$path, $mime] = [$thumb, 'image/jpeg'];
}

// Private revalidation: the browser keeps a copy but must ask again every time, so the access checks
// above still run on every view. Unchanged photos are answered with 304 instead of being re-sent.
$etag = '"' . hash('sha256', $photo['file_path'] . '|' . filesize($path) . '|' . filemtime($path) . '|' . ($width ?? 0)) . '"';
header('Cache-Control: private, no-cache');
header_remove('Pragma');
header('ETag: ' . $etag);
$sent = array_map('trim', explode(',', $_SERVER['HTTP_IF_NONE_MATCH'] ?? ''));
if (in_array($etag, $sent, true)) {
    http_response_code(304);
    exit;
}
header('Content-Type: ' . $mime); header('Content-Length: ' . filesize($path));
readfile($path);

// Returns a cached JPEG no wider than $width, creating it on first use; null keeps the original.
function photo_thumbnail(string $source, string $relative, int $width): ?string
{
    $directory = storage_dir() . '/thumbs';
    $target = $directory . '/' . hash('sha256', $relative) . '-' . $width . '.jpg';
    if (is_file($target) && filemtime($target) >= filemtime($source)) return $target;
    if (!function_exists('imagecreatefromstring') || (!is_dir($directory) && !@mkdir($directory, 0700, true))) return null;
    $size = @getimagesize($source);
    if (!$size || $size[0] < 1 || $size[1] < 1) return null;
    if ($size[0] <= $width) return null;
    $image = @imagecreatefromstring((string) file_get_contents($source));
    if (!$image) return null;
    $height = max(1, (int) round($size[1] * $width / $size[0]));
    $canvas = imagecreatetruecolor($width, $height);
    if (!$canvas) return null;
    imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
    imagecopyresampled($canvas, $image, 0, 0, 0, 0, $width, $height, $size[0], $size[1]);
    $temporary = @tempnam($directory, 'thumb-');
    if ($temporary === false) return null;
    if (!imagejpeg($canvas, $temporary, 80) || !@rename($temporary, $target)) {
        @unlink($temporary);
        return null;
    }
    return $target;
}
