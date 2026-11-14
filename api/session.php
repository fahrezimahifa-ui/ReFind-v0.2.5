<?php
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../app/visual-config.php';
method('GET');
allowed_fields($_GET, []);
$user = auth_user();
json_response(['authenticated' => $user !== null, 'user' => $user ? public_identity($user) : null, 'csrf' => $_SESSION['csrf'],
    'visual_search_enabled' => visual_student_allowed($user),
    'registration_enabled' => registration_available(),
    'expires' => ['idle_seconds' => app_config()['idle_seconds'], 'absolute_seconds' => app_config()['absolute_seconds']]]);
