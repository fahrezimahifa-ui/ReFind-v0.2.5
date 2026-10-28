<?php
declare(strict_types=1);
require_once __DIR__ . '/../app/http.php';
security_headers(true);
install_api_error_handler();
require_once __DIR__ . '/../app/auth.php';
date_default_timezone_set('Asia/Jakarta');
