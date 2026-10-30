<?php
declare(strict_types=1);
require_once __DIR__ . '/uploads.php';

function prepared_avatar(): string
{
    allowed_fields($_FILES, ['avatar']);
    $file = $_FILES['avatar'] ?? null;
    if (!is_array($file) || !is_int($file['error'] ?? null) || $file['error'] !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) field_fail('avatar', 'Choose a complete photo upload.');
    $path = $file['tmp_name'];
    if (filesize($path) > 250000 || (new finfo(FILEINFO_MIME_TYPE))->file($path) !== 'image/jpeg') field_fail('avatar', 'Prepare a JPEG photo no larger than 250 KB.');
    $size = @getimagesize($path);
    if (!$size || $size[0] !== 512 || $size[1] !== 512 || $size['mime'] !== 'image/jpeg') field_fail('avatar', 'Prepare a square 512px profile picture.');
    if (!extension_loaded('gd')) fail('Profile picture processing is temporarily unavailable.', 503, 'avatar_unavailable');
    $source = @imagecreatefromstring((string) file_get_contents($path));
    if (!$source) field_fail('avatar', 'This photo could not be decoded. Choose another image.');
    try {
        ob_start();
        $ok = imagejpeg($source, null, 85);
        $bytes = ob_get_clean();
        if (!$ok || !is_string($bytes) || strlen($bytes) > 250000) field_fail('avatar', 'This photo could not be prepared. Choose another image.');
        return $bytes;
    } finally { imagedestroy($source); }
}
function store_avatar(string $bytes, array &$created): string
{
    $folder = storage_dir('avatars');
    if (!is_dir($folder)) throw new RuntimeException('Avatar storage unavailable.');
    $relative = 'avatars/' . bin2hex(random_bytes(16)) . '.jpg';
    $file = fopen(storage_dir() . '/' . $relative, 'xb');
    if (!$file) throw new RuntimeException('Avatar storage unavailable.');
    $created[] = $relative;
    try { if (fwrite($file, $bytes) !== strlen($bytes) || !fflush($file)) throw new RuntimeException('Cannot store avatar.'); }
    finally { fclose($file); }
    return $relative;
}
