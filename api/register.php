<?php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../app/registration.php';
require_once __DIR__ . '/../app/routes.php';
method('POST');
if (!app_config()['registration_enabled']) fail('Account creation is currently unavailable. Please log in with an existing account.', 403, 'registration_disabled');
if (auth_user()) fail('You are already logged in.', 409, 'already_authenticated');
verify_csrf();
registration_attempt();
allowed_fields($_GET, []);
allowed_fields($_FILES, []);
allowed_fields($_POST, ['name', 'email', 'password', 'confirm_password', '_csrf']);
$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if (!in_array($contentType, ['multipart/form-data', 'application/x-www-form-urlencoded'], true)) fail('Use the account creation form.', 400, 'invalid_request');
$user = register_student($_POST);
json_response(['authenticated' => true, 'user' => public_identity($user), 'csrf' => $_SESSION['csrf'], 'redirect' => landing_url($user)], 201);
