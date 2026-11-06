<?php
require __DIR__ . '/bootstrap.php';
method('GET');
allowed_fields($_GET, []);
$user = auth_user();
json_response(['authenticated' => $user !== null, 'user' => $user ? public_identity($user) : null, 'csrf' => $_SESSION['csrf'],
    'registration_enabled' => registration_available(),
    'expires' => ['idle_seconds' => app_config()['idle_seconds'], 'absolute_seconds' => app_config()['absolute_seconds']]]);
