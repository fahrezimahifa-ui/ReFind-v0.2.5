<?php
declare(strict_types=1);
require_once __DIR__ . '/visual-config.php';

final class VisualProviderError extends RuntimeException
{
    public function __construct(public readonly string $reason, public readonly int $retryAfter = 0)
    {
        parent::__construct($reason);
    }
}

// A single private, locked budget applies to both web requests and CLI indexing.
function visual_budget(?int $studentId = null, int $deferSeconds = 0, string $reason = 'quota'): void
{
    $directory = storage_dir('auth');
    $path = $directory . '/visual-budget.json';
    $lock = @fopen($directory . '/visual-budget.lock', 'c+');
    if (!$lock) throw new VisualProviderError('unavailable');
    try {
        if (!flock($lock, LOCK_EX)) throw new VisualProviderError('unavailable');
        $state = is_file($path) ? json_decode((string) @file_get_contents($path), true) : [];
        if (!is_array($state)) throw new VisualProviderError('unavailable');
        $now = time();
        $calls = array_values(array_filter($state['calls'] ?? [], fn($call) => $call[0] > $now - 60));
        $until = (int) ($state['until'] ?? 0);
        $deferredReason = ($state['reason'] ?? null) === 'project' ? 'project' : 'quota';
        if ($deferSeconds > 0) {
            if ($now + $deferSeconds >= $until) {
                $until = $now + $deferSeconds;
                $deferredReason = $reason;
            }
        } else {
            if ($until > $now) throw new VisualProviderError($deferredReason, $until - $now);
            $config = app_config();
            $own = $studentId === null ? [] : array_values(array_filter($calls, fn($call) => $call[1] === $studentId));
            if (count($own) >= $config['visual_search_student_per_minute']) {
                throw new VisualProviderError('rate_limited', max(1, $own[0][0] + 60 - $now));
            }
            if (count($calls) >= $config['visual_search_calls_per_minute']) {
                throw new VisualProviderError('rate_limited', max(1, $calls[0][0] + 60 - $now));
            }
            $calls[] = [$now, $studentId];
        }
        $json = json_encode(['until' => $until, 'reason' => $deferredReason, 'calls' => $calls], JSON_THROW_ON_ERROR);
        $temporary = @tempnam($directory, 'visual-budget-');
        if ($temporary === false) throw new VisualProviderError('unavailable');
        try {
            if (@file_put_contents($temporary, $json) !== strlen($json) || !@rename($temporary, $path)) {
                throw new VisualProviderError('unavailable');
            }
        } finally {
            if (is_file($temporary)) @unlink($temporary);
        }
    } finally {
        fclose($lock);
    }
}

function visual_retry_after(string $value): int
{
    if ($value === '') return 0;
    $when = ctype_digit($value) ? (int) $value : strtotime($value) - time();
    return $when > 0 ? min(86400, $when) : 0;
}

function visual_gemini_request(string $image, string $key): array
{
    if (!function_exists('curl_init')) throw new VisualProviderError('unavailable');
    $handle = curl_init('https://generativelanguage.googleapis.com/v1beta/models/' . VISUAL_MODEL . ':embedContent');
    if ($handle === false) throw new VisualProviderError('unavailable');
    $retry = 0;
    $body = '';
    curl_setopt_array($handle, [
        CURLOPT_POST => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => app_config()['visual_search_timeout_seconds'],
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $key],
        CURLOPT_POSTFIELDS => json_encode([
            'content' => ['parts' => [['inline_data' => ['mime_type' => 'image/jpeg', 'data' => base64_encode($image)]]]],
            'output_dimensionality' => VISUAL_DIMENSIONS,
        ], JSON_THROW_ON_ERROR),
        CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$retry): int {
            if (stripos($line, 'Retry-After:') === 0) $retry = visual_retry_after(trim(substr($line, 12)));
            return strlen($line);
        },
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 131072) return 0;
            $body .= $chunk;
            return strlen($chunk);
        },
    ]);
    try {
        $ok = curl_exec($handle);
        $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        // Operator-only transport evidence. Never retain headers, keys, images,
        // response bodies, query hashes, local addresses or user identities.
        if (visual_enabled()) {
            $info = curl_getinfo($handle);
            $timing = ['utc'=>gmdate('c'),'http_status'=>$status,'transport_errno'=>curl_errno($handle),
                'dns_s'=>$info['namelookup_time'],'tcp_s'=>$info['connect_time'],
                'tls_s'=>curl_getinfo($handle,CURLINFO_APPCONNECT_TIME),
                'first_byte_s'=>$info['starttransfer_time'],'total_s'=>$info['total_time']];
            @file_put_contents(storage_dir('setup') . '/visual-provider-last.json', json_encode($timing), LOCK_EX);
        }
        if ($ok === false) throw new VisualProviderError(curl_errno($handle) === CURLE_OPERATION_TIMEDOUT ? 'timeout' : 'unavailable');
        return [$status, $body, $retry];
    } finally {
        curl_close($handle);
    }
}

function visual_provider_vector(int $status, string $body, int $retry = 0): array
{
    $data = json_decode($body, true);
    if ($status === 429) throw new VisualProviderError('quota', $retry ?: 900);
    $details = $data['error']['details'] ?? null;
    if (in_array($status, [401,403,404], true) ||
        ($status === 400 && is_array($details) && in_array('API_KEY_INVALID', array_column($details, 'reason'), true))) {
        throw new VisualProviderError('project', 900);
    }
    if ($status === 408 || $status === 504) throw new VisualProviderError('timeout');
    if ($status >= 500 || $status < 400 && $status !== 200) throw new VisualProviderError('unavailable');
    if ($status !== 200) throw new VisualProviderError('rejected');
    $values = $data['embedding']['values'] ?? null;
    if (!is_array($values)) throw new VisualProviderError('bad_response');
    try { return visual_normalize($values); }
    catch (InvalidArgumentException) { throw new VisualProviderError('bad_response'); }
}

function visual_embed(string $image, ?int $studentId = null): array
{
    $key = visual_api_key();
    if ($key === null) throw new VisualProviderError('project', 900);
    visual_budget($studentId);
    try {
        return visual_provider_vector(...visual_gemini_request($image, $key));
    } catch (VisualProviderError $error) {
        if ($error->retryAfter > 0) visual_budget(null, $error->retryAfter, $error->reason);
        throw $error;
    }
}
