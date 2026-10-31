<?php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../app/accounts.php';
require_once __DIR__ . '/../app/avatars.php';
method('GET', 'POST');
$user = require_user(); // Retain this session lock through credential commit/rotation.
allowed_fields($_GET, []);
if ($_SERVER['REQUEST_METHOD'] === 'GET') json_response(['profile' => account_profile($user)]);
verify_csrf();
$action = text($_POST, 'action', 30);
$created = []; $obsolete = [];
if ($action !== 'update_avatar') allowed_fields($_FILES, []);
if ($action === 'update_profile') {
    allowed_fields($_POST, ['action', 'name', '_csrf']);
    $name = profile_name($_POST);
} elseif ($action === 'change_password') {
    allowed_fields($_POST, ['action', 'current_password', 'new_password', 'confirm_password', '_csrf']);
    $current = account_password($_POST, 'current_password');
    $new = account_password($_POST, 'new_password', true);
    $confirm = account_password($_POST, 'confirm_password');
    if (!hash_equals($new, $confirm)) field_fail('confirm_password', 'The password confirmation does not match.');
} elseif (in_array($action, ['update_avatar','remove_avatar'], true)) {
    allowed_fields($_POST, ['action', '_csrf']);
    $avatarBytes = $action === 'update_avatar' ? prepared_avatar() : null;
} else fail('Invalid account action.', 400, 'invalid_request');

db()->begin_transaction();
try {
    $record = lock_own_account($user);
    if ($action === 'update_profile') {
        sql('UPDATE users SET full_name = ? WHERE user_id = ?', [$name, (int) $record['user_id']]);
        $record['full_name'] = $name;
    } elseif (in_array($action, ['update_avatar','remove_avatar'], true)) {
        $next = $avatarBytes !== null ? store_avatar($avatarBytes, $created) : null;
        if ($record['avatar_path']) $obsolete[] = $record['avatar_path'];
        sql('UPDATE users SET avatar_path=? WHERE user_id=?', [$next, (int) $record['user_id']]);
        $record['avatar_path'] = $next;
    } else {
        verify_current_password($record, $current);
        if (hash_equals($current, $new)) field_fail('new_password', 'Choose a password different from the current password.');
        $hash = password_hash($new, PASSWORD_DEFAULT);
        sql('UPDATE users SET password_hash = ? WHERE user_id = ?', [$hash, (int) $record['user_id']]);
    }
    db()->commit();
} catch (Throwable $error) { db()->rollback(); cleanup_media($created); throw $error; }
cleanup_media($obsolete, true);

if ($action === 'change_password') {
    $_SESSION['auth']['fingerprint'] = credential_fingerprint($hash);
    $_SESSION['auth']['last_seen'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    session_regenerate_id(true);
}
$record['user_id'] = (string) $record['user_id'];
unset($record['password_hash'], $record['is_active']);
json_response(['profile' => account_profile($record), 'user' => public_identity($record), 'csrf' => $_SESSION['csrf'],
    'message' => in_array($action, ['update_avatar','remove_avatar'], true) ? ($action === 'update_avatar' ? 'Your profile picture has been saved.' : 'Your profile picture has been removed.') : ($action === 'update_profile' ? 'Your display name has been saved.' : 'Password updated. Other sessions will need to log in again.')]);
