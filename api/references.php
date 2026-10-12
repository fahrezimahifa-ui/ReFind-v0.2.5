<?php
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../app/repository.php';
method('GET'); allowed_fields($_GET, []);
$config = app_config();
// Filters offer only values a report can actually have: active categories and the campus areas used by the report form.
$categories = rows('SELECT category_id AS id, category_name AS name FROM categories WHERE is_active = 1 ORDER BY display_order');
$areas = rows("SELECT location_id AS id, location_code AS code, location_name AS name FROM campus_locations WHERE location_kind = 'AREA' AND is_active = 1 ORDER BY display_order");
json_response(['categories' => $categories,
    'locations' => $areas,
    'statuses' => array_map(fn($s) => ['code' => $s['code'], 'name' => ui_status_name($s['code'])], rows('SELECT status_code AS code FROM item_statuses ORDER BY display_order')),
    'filter_categories' => $categories,
    'filter_locations' => array_map(fn($l) => ['id' => $l['id'], 'name' => $l['name']], $areas),
    'pickup_desk' => ['name' => $config['pickup_desk_name'], 'location' => $config['pickup_desk_location'], 'hours' => $config['pickup_desk_hours'], 'contact' => $config['pickup_desk_contact']],
    'campus_today' => campus_today(), 'timezone' => 'Asia/Jakarta']);
