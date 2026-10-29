<?php
declare(strict_types=1);
ini_set('display_errors', '0');
require_once __DIR__ . '/app/http.php';
security_headers();
header('Content-Type: text/html; charset=utf-8');

function render_page(string $file, array $values = [], int $status = 200): never
{
    http_response_code($status);
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    $html = file_get_contents(__DIR__ . '/app/pages/' . $file);
    $html = str_replace('{{APP_NAVBAR}}', file_get_contents(__DIR__ . '/app/pages/partials/navbar.html'), $html);
    $values['BASE_PATH'] = app_config()['base_path'];
    foreach ($values as $key => $value) $html = str_replace('{{' . $key . '}}', htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), $html);
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'HEAD') echo $html;
    exit;
}
$base = null;
try {
    require __DIR__ . '/app/routes.php';
    method('GET', 'HEAD');
    $base = app_config()['base_path'];
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (!is_string($path) || strcasecmp(substr($path, 0, strlen($base)), $base) !== 0) fail('Page not found.', 404, 'not_found');
    $route = strtolower(substr($path, strlen($base)));
    if ($route === '') $route = 'index.html';
    $definition = page_routes()[$route] ?? null;
    if (!$definition) fail('Page not found.', 404, 'not_found');
    $user = auth_user();
    if ($definition['roles'] && !$user) {
        $return = safe_return($base . $route . (($_SERVER['QUERY_STRING'] ?? '') ? '?' . $_SERVER['QUERY_STRING'] : ''));
        session_write_close(); header('Location: ' . $base . 'login.html?return=' . rawurlencode($return), true, 302); exit;
    }
    if ($definition['roles'] && !in_array($user['role'], $definition['roles'], true)) {
        render_page('message.html', ['TITLE' => 'Access not available', 'MESSAGE' => 'This page belongs to another role.', 'BACK_URL' => landing_url($user)], 403);
    }
    if ($user && ($route === 'login.html' || ($route === 'index.html' && $user['role'] === 'BUILDING_MANAGEMENT'))) {
        $url = $route === 'login.html' ? safe_return($_GET['return'] ?? '', $user) : landing_url($user);
        session_write_close(); header('Location: ' . $url, true, 302); exit;
    }
    if (!$definition['page']) render_page('message.html', ['TITLE' => 'Coming in ' . $definition['batch'], 'MESSAGE' => 'Your access is authorized. This workflow is scheduled for a later batch.', 'BACK_URL' => landing_url($user)], 501);
    render_page($definition['page']);
} catch (Throwable $error) {
    $status = $error instanceof HttpError ? $error->status : 500;
    if ($status === 500) error_log('ReFind page error: ' . get_class($error) . ' at ' . basename($error->getFile()) . ':' . $error->getLine());
    // A broken configuration/template must not fail again inside the error renderer.
    try {
        if ($base === null) throw new RuntimeException('Configuration unavailable.');
        render_page('message.html', ['TITLE' => 'Unable to open page', 'MESSAGE' => $status === 500 ? 'The page could not be opened. Please try again.' : $error->getMessage(), 'BACK_URL' => $base . 'index.html'], $status);
    } catch (Throwable $renderError) {
        http_response_code(500);
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'HEAD') echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Unable to open page</title><h1>Unable to open page</h1><p>The page could not be opened. Please try again.</p></html>';
    }
}
