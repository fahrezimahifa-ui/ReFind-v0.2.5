<?php
declare(strict_types=1);
require_once __DIR__ . '/reports.php';

function item_structured_filters(array $filters): array
{
    $where = [];
    $values = [];
    if (isset($filters['type']) && $filters['type'] !== '') {
        $type = strtoupper(text($filters, 'type', 10));
        if (!in_array($type, ['LOST','FOUND'], true)) fail('Invalid report type.', 400);
        $where[] = 'v.item_type=?';
        $values[] = $type;
    }
    foreach (['category_id','location_id'] as $key) {
        if (isset($filters[$key]) && $filters[$key] !== '') {
            $where[] = 'v.' . $key . '=?';
            $values[] = record_id($filters[$key]);
        }
    }
    if (isset($filters['status']) && $filters['status'] !== '') {
        $status = strtoupper(text($filters, 'status', 40));
        if (!row('SELECT status_id FROM item_statuses WHERE status_code=?', [$status])) fail('Invalid status filter.', 400);
        $where[] = 'v.status_code=?';
        $values[] = $status;
    }
    if (isset($filters['date']) && $filters['date'] !== '') {
        $where[] = 'v.event_date=?';
        $values[] = valid_event_date(text($filters, 'date', 10));
    }
    return [$where, $values];
}
