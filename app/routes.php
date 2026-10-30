<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

function page_routes(): array
{
    return [
        'index.html' => ['roles' => [], 'page' => 'home.html', 'batch' => 'B02'],
        'login.html' => ['roles' => [], 'page' => 'login.html', 'batch' => 'B02'],
        'browse.html' => ['roles' => ['STUDENT', 'BUILDING_MANAGEMENT'], 'page' => 'browse.html', 'batch' => 'B04'],
        'item.html' => ['roles' => ['STUDENT', 'BUILDING_MANAGEMENT'], 'page' => 'item.html', 'batch' => 'B04'],
        'report.html' => ['roles' => ['STUDENT'], 'page' => 'report.html', 'batch' => 'B04'],
        'claim.html' => ['roles' => ['STUDENT'], 'page' => 'claim.html', 'batch' => 'B04'],
        'my-reports.html' => ['roles' => ['STUDENT'], 'page' => 'my-reports.html', 'batch' => 'B04'],
        'admin.html' => ['roles' => ['BUILDING_MANAGEMENT'], 'page' => 'bm.html', 'batch' => 'B05'],
        'history.html' => ['roles' => ['STUDENT', 'BUILDING_MANAGEMENT'], 'page' => 'history.html', 'batch' => 'B04'],
        'notifications.html' => ['roles' => ['STUDENT', 'BUILDING_MANAGEMENT'], 'page' => 'notifications.html', 'batch' => 'B04'],
        'profile.html' => ['roles' => ['STUDENT', 'BUILDING_MANAGEMENT'], 'page' => 'profile.html', 'batch' => 'B03'],
        'settings.html' => ['roles' => ['STUDENT', 'BUILDING_MANAGEMENT'], 'page' => 'settings.html', 'batch' => 'B03'],
    ];
}
function landing_url(array $user): string
{
    return app_config()['base_path'] . ($user['role'] === 'BUILDING_MANAGEMENT' ? 'admin.html' : 'index.html');
}
function safe_return(mixed $value, ?array $user = null): string
{
    $fallback = $user ? landing_url($user) : app_config()['base_path'] . 'index.html';
    if (!is_string($value) || strlen($value) > 800 || preg_match('/[\\\\\x00-\x1f\x7f]/', $value)) return $fallback;
    $parts = parse_url($value);
    if (!$parts || isset($parts['scheme']) || isset($parts['host']) || isset($parts['fragment']) || isset($parts['user'])) return $fallback;
    $path = $parts['path'] ?? '';
    $base = app_config()['base_path'];
    if (str_starts_with($path, $base)) $path = substr($path, strlen($base));
    $path = strtolower($path);
    $route = page_routes()[$path] ?? null;
    if (!$route || in_array($path, ['login.html'], true) || ($user && $route['roles'] && !in_array($user['role'], $route['roles'], true))) return $fallback;
    parse_str($parts['query'] ?? '', $query);
    $clean = [];
    foreach ($query as $key => $v) {
        if (!is_string($v) || preg_match('/[\x00-\x1f\x7f]/', $v)) return $fallback;
        if (in_array($key, ['id', 'edit', 'claim','report','handover','category_id','location_id','page','from','notification_page','notification'], true) && preg_match('/^[1-9][0-9]{0,9}$/D', $v) && (float) $v <= 4294967295) $clean[$key] = $v;
        elseif ($key === 'origin' && $v === 'notifications') $clean[$key] = $v;
        elseif ($key === 'tab' && in_array($v, ['reports', 'claims', 'handover','closed'], true)) $clean[$key] = $v;
        elseif ($key === 'view' && in_array($v, ['all', 'returned', 'unclaimed', 'lost', 'found'], true)) $clean[$key] = $v;
        elseif ($key === 'type' && in_array(strtolower($v), ['lost', 'found'], true)) $clean[$key] = strtolower($v);
        elseif (in_array($key, ['q', 'category', 'location', 'status', 'date'], true) && mb_check_encoding($v, 'UTF-8') && mb_strlen($v) <= 200) $clean[$key] = $v;
        else return $fallback;
    }
    return $base . $path . ($clean ? '?' . http_build_query($clean, '', '&', PHP_QUERY_RFC3986) : '');
}
