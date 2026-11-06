<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

function registration_loopback_peer(mixed $address): bool
{
    if (!is_string($address) || str_contains($address, "\0")) return false;
    $packed = @inet_pton($address);
    if ($packed === false) return false;
    if (strlen($packed) === 4) return ord($packed[0]) === 127;
    if ($packed === inet_pton('::1')) return true;
    return substr($packed, 0, 12) === str_repeat("\0", 10) . "\xff\xff" && ord($packed[12]) === 127;
}

function registration_available(): bool
{
    $config = app_config();
    // This identifies the socket peer, not a person. Forwarding clearance is an activation prerequisite.
    return $config['registration_enabled'] && (!$config['registration_local_only'] ||
        registration_loopback_peer($_SERVER['REMOTE_ADDR'] ?? null));
}
