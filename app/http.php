<?php
declare(strict_types=1);

class HttpError extends RuntimeException
{
    public function __construct(string $message, public int $status = 422, public string $errorCode = 'validation_error', public array $fields = [])
    { parent::__construct($message); }
}
function fail(string $message, int $status = 422, string $code = 'validation_error'): never { throw new HttpError($message, $status, $code); }
function field_fail(string $field, string $message, string $code = 'validation_error'): never
{
    throw new HttpError($message, 422, $code, [$field => $message]);
}
function security_headers(bool $json = false): void
{
    header('Cache-Control: no-store, private');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Frame-Options: DENY');
    if ($json) header('Content-Type: application/json; charset=utf-8');
    else header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}
function method(string ...$allowed): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        fail('Method not allowed.', 405, 'method_not_allowed');
    }
}
function allowed_fields(array $data, array $allowed): void
{
    if (array_diff(array_keys($data), $allowed)) fail('Unsupported request field.', 400, 'invalid_request');
}
function text(array $data, string $key, int $max, bool $required = true): string
{
    $value = $data[$key] ?? '';
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) fail('Invalid field: ' . $key . '.', 422);
    $value = trim($value);
    if (($required && $value === '') || mb_strlen($value) > $max) fail('Check the ' . $key . ' field.', 422);
    return $value;
}
function record_id(mixed $value): int
{
    if ((!is_string($value) && !is_int($value)) || !preg_match('/^[1-9][0-9]*$/D', (string) $value) || (float) $value > 4294967295) {
        fail('Invalid record ID.', 400, 'invalid_id');
    }
    return (int) $value;
}
function json_response(array $data = [], int $status = 200): never
{
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    http_response_code($status);
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function install_api_error_handler(): void
{
    ini_set('display_errors', '0');
    set_exception_handler(function (Throwable $error): void {
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        $status = $error instanceof HttpError ? $error->status : 500;
        if ($status === 500) error_log('ReFind 0.2.5: ' . get_class($error) . ' at ' . basename($error->getFile()) . ':' . $error->getLine());
        http_response_code($status);
        $data = ['ok' => false, 'code' => $error instanceof HttpError ? $error->errorCode : 'server_error',
            'message' => $status === 500 ? 'The request could not be completed. Please try again.' : $error->getMessage()];
        if ($error instanceof HttpError && $error->fields) $data['fields'] = $error->fields;
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    });
}
