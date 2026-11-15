<?php
declare(strict_types=1);
// Derive a new deployment's private app/config.local.php from an existing deployment's, changing only the
// URL base and session name. Validated by the target's own app/config.php; refuses to overwrite; prints no secrets.
//   php tools/derive-config.php <from-deployment> <to-deployment> <base_path> <session_name>
// From Git Bash, prefix MSYS_NO_PATHCONV=1 so "/refind/" is not rewritten into a Windows path.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
if ($argc !== 5) { fwrite(STDERR, "Usage: php tools/derive-config.php FROM TO BASE_PATH SESSION_NAME\n"); exit(2); }
[, $from, $to, $base, $session] = $argv;
require $to . '/app/config.php';
$config = require $from . '/app/config.local.php';
if (!is_array($config)) throw new RuntimeException('Source config is not an array.');
$target = $to . '/app/config.local.php';
if (is_file($target)) throw new RuntimeException('Target config already exists; refusing to overwrite.');
$config['base_path'] = $base;
$config['session_name'] = $session;
validate_app_config(array_replace(app_defaults(), $config));
file_put_contents($target, "<?php\nreturn " . var_export($config, true) . ";\n", LOCK_EX);
$check = load_app_config($target);
echo json_encode(['db_name' => $check['db_name'], 'base_path' => $check['base_path'], 'session_name' => $check['session_name'],
    'registration_enabled' => $check['registration_enabled'], 'visual_search_enabled' => $check['visual_search_enabled']]), PHP_EOL;
