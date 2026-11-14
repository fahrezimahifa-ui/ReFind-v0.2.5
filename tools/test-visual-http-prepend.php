<?php
declare(strict_types=1);

// Only a disposable Apache rehearsal sets both this prepend file and its explicit private DB port.
$script = $_SERVER['SCRIPT_FILENAME'] ?? '';
$port = (int) getenv('REFIND_VISUAL_DISPOSABLE_DB_PORT', true);
if ($port < 1024 || $port === 3306 || basename($script) !== 'visual-search.php') return;
$fixture = $_SERVER['HTTP_X_REFIND_VISUAL_FIXTURE'] ?? '';
if ($fixture === '') return;
$target = dirname($script, 2);
require_once $target . '/app/visual-config.php';
if (!visual_enabled() || app_config()['db_port'] !== $port) return;
require $target . '/api/bootstrap.php';
require $target . '/app/visual-search.php';
visual_search_request(static function (string $image) use ($fixture): array {
    if (in_array($fixture, ['timeout','unavailable','quota'], true)) {
        throw new VisualProviderError($fixture, $fixture === 'quota' ? 60 : 0);
    }
    $values = array_fill(0, VISUAL_DIMENSIONS, 0);
    $values[$fixture === 'match' ? 0 : 1] = 1;
    return visual_normalize($values);
});
