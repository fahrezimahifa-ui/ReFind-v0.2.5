<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit();
}
if (basename(dirname(__DIR__)) === 'refind-dev' && !in_array(getenv('REFIND_TEST_PROFILE'), ['ui-ux-dev', 'xampp-stage'], true)) {
    throw new RuntimeException('Explicit development test profile required; legacy QA discovery refused.');
}
if ((basename(dirname(__DIR__)) === 'refind-v1-rc') !== (getenv('REFIND_TEST_PROFILE') === 'v1-rc')) {
    throw new RuntimeException('The v1-rc test profile runs only from, and is required by, the refind-v1-rc worktree.');
}
$target =
    getenv('REFIND_TEST_PROFILE') === 'xampp-stage'
        ? dirname(dirname(__DIR__)) . '/refind-xampp-stage'
        : (in_array(getenv('REFIND_TEST_PROFILE'), ['ui-ux-dev', 'v1-rc'], true)
            ? dirname(__DIR__)
            : dirname(dirname(__DIR__)) . '/ReFind_0.2.0_Test');
require $target . '/app/claims.php';
require $target . '/app/staff-read.php';
require __DIR__ . '/qa-guard.php';
assert_qa_installation($target);
// Exact prior projection from 8331d90: compatibility oracle for batching/privacy flags.
function baseline_safe_item(array $record, array $user): array
{
    $id = (int) $record['item_id'];
    $record['reporter_avatar_url'] = avatar_url($record['reporter_avatar_path'] ?? null);
    unset($record['reporter_avatar_path']);
    $record['item_id'] = (string) $id;
    $record['reporter_user_id'] = (string) $record['reporter_user_id'];
    $photos = rows(
        "SELECT photo_id FROM item_photos WHERE item_id=? AND photo_kind='ITEM' ORDER BY is_primary DESC,photo_id",
        [$id],
    );
    $record['photos'] = array_map(
        fn($p) => app_config()['base_path'] . 'api/photos.php?kind=item&id=' . $p['photo_id'],
        $photos,
    );
    $record['photo_ids'] = array_column($photos, 'photo_id');
    $match = confirmed_match($id);
    $record['matched_item_id'] = $match
        ? (string) ((int) $match['lost_item_id'] === $id ? $match['found_item_id'] : $match['lost_item_id'])
        : null;
    $own = $record['reporter_user_id'] === $user['user_id'];
    $related = active_claim_for_report($id);
    $active = in_array($record['status_code'], ACTIVE_ITEM_CODES, true);
    $record['can_edit'] =
        $user['role'] === 'STUDENT' &&
        $own &&
        !$related &&
        !$match &&
        in_array($record['status_code'], ['OPEN', 'POTENTIAL_MATCH'], true);
    if (
        $user['role'] === 'STUDENT' &&
        $own &&
        !$record['can_edit'] &&
        in_array($record['status_code'], ['OPEN', 'POTENTIAL_MATCH', 'VERIFICATION', 'UNDER_REVIEW'], true)
    ) {
        $record['edit_locked_reason'] = $related
            ? 'Editing is paused while a claim that uses this report is being reviewed.'
            : 'Building Management is reviewing this report, so it cannot be edited right now.';
    }
    $claim =
        $user['role'] === 'STUDENT'
            ? row(
                'SELECT claim_id,claim_status,review_note FROM claims WHERE item_id=? AND claimant_user_id=?',
                [$id, (int) $user['user_id']],
            )
            : null;
    $record['own_claim'] = $claim;
    $record['can_claim'] =
        $user['role'] === 'STUDENT' &&
        !$own &&
        !$match &&
        $record['item_type'] === 'FOUND' &&
        $active &&
        (!$claim || in_array($claim['claim_status'], RESUBMITTABLE_CLAIM_CODES, true));
    $record['can_report_found'] =
        $user['role'] === 'STUDENT' && !$own && !$match && $record['item_type'] === 'LOST' && $active;
    if ($own) {
        $record['ownership_photo_count'] = (int) row(
            "SELECT COUNT(*) AS n FROM item_photos WHERE item_id=? AND photo_kind='OWNERSHIP'",
            [$id],
        )['n'];
    }
    if (isset($record['created_at'])) {
        $record['created_at'] = utc_iso($record['created_at']);
    }
    if (isset($record['resolved_at'])) {
        $record['resolved_at'] = utc_iso($record['resolved_at']);
    }
    return $record;
}

// Frozen a610b1a list algorithms: independent compatibility oracles, deliberately unbatched.
function baseline_claim_list_projection(array $claims, array $user): array
{
    foreach ($claims as &$claim) {
        foreach (['claim_id', 'item_id', 'claimant_user_id'] as $key) {
            $claim[$key] = (string) $claim[$key];
        }
        $claim['related_lost_item_id'] =
            $claim['related_lost_item_id'] !== null ? (string) $claim['related_lost_item_id'] : null;
        $photos = rows('SELECT claim_photo_id FROM claim_photos WHERE claim_id=? ORDER BY claim_photo_id', [
            (int) $claim['claim_id'],
        ]);
        $claim['ownership_photo_count'] = count($photos);
        $claim['ownership_photo_ids'] = array_column($photos, 'claim_photo_id');
        if ($user['role'] === 'BUILDING_MANAGEMENT') {
            $claim['ownership_photos'] = array_map(
                fn($p) => app_config()['base_path'] . 'api/photos.php?kind=claim&id=' . $p['claim_photo_id'],
                $photos,
            );
        }
        foreach (['created_at', 'updated_at', 'reviewed_at'] as $key) {
            $claim[$key] = utc_iso($claim[$key]);
        }
        $item = find_item((int) $claim['item_id']);
        $open =
            in_array($item['status_code'], ACTIVE_ITEM_CODES, true) &&
            !confirmed_match((int) $item['item_id']);
        $claim['can_resubmit'] = in_array($claim['claim_status'], RESUBMITTABLE_CLAIM_CODES, true) && $open;
        $claim['can_withdraw'] =
            $user['role'] === 'STUDENT' &&
            in_array($claim['claim_status'], ['PENDING', 'NEED_MORE_INFO'], true);
    }
    unset($claim);

    return $claims;
}
function baseline_item_revision(array $item): string
{
    $item['history_id'] = row(
        'SELECT COALESCE(MAX(history_id),0) AS id FROM item_status_history WHERE item_id=?',
        [(int) $item['item_id']],
    )['id'];
    return record_revision($item, [
        'item_id',
        'reporter_user_id',
        'category_id',
        'location_id',
        'item_type',
        'title',
        'description',
        'verification_clue',
        'status_id',
        'updated_at',
        'resolved_at',
        'history_id',
    ]);
}
function baseline_allowed_manual_statuses(array $item): array
{
    $id = (int) $item['item_id'];
    if (
        in_array($item['status_code'], ['RESOLVED', 'UNCLAIMED_CLOSED', 'HANDOVER'], true) ||
        confirmed_match($id) ||
        row(
            "SELECT claim_id FROM claims WHERE (item_id=? OR related_lost_item_id=?) AND claim_status IN ('PENDING','NEED_MORE_INFO','APPROVED') LIMIT 1",
            [$id, $id],
        )
    ) {
        return [];
    }
    $choices = ['OPEN', 'UNDER_REVIEW', 'UNCLAIMED_CLOSED'];
    if (has_suggestion($id)) {
        $choices[] = 'POTENTIAL_MATCH';
    }
    if ($item['item_type'] === 'LOST') {
        $choices[] = 'RESOLVED';
    }
    return array_values(array_diff($choices, [$item['status_code']]));
}

function baseline_staff_report_list(array $records, array $user): array
{
    $reports = safe_items($records, $user);
    foreach ($reports as &$report) {
        $raw = find_item((int) $report['item_id']);
        $report['allowed_statuses'] = baseline_allowed_manual_statuses($raw);
        $report['revision'] = baseline_item_revision($raw);
    }
    unset($report);
    return $reports;
}
$results = [];
$users = rows('SELECT user_id,role FROM users ORDER BY user_id');
foreach ($users as $user) {
    $user['user_id'] = (string) $user['user_id'];
    foreach ([0, 1, 12, 48] as $size) {
        $records = $size
            ? rows('SELECT ' . public_columns() . ' FROM v_items_overview v ORDER BY v.item_id LIMIT ?', [
                $size,
            ])
            : [];
        $before = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()['Value'];
        $baseline = array_map(fn($r) => baseline_safe_item($r, $user), $records);
        $middle = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()['Value'];
        $batched = safe_items($records, $user);
        $after = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()['Value'];
        if ($baseline !== $batched) {
            throw new RuntimeException('Projection compatibility changed.');
        }
        $expected = !$records ? 0 : ($user['role'] === 'STUDENT' ? 4 : 3);
        if ($after - $middle !== $expected) {
            throw new RuntimeException('Projection query bound changed.');
        }
        $results[] = [
            'role' => $user['role'],
            'limit' => $size,
            'records' => count($records),
            'baseline_statements' => $middle - $before,
            'batched_statements' => $after - $middle,
            'identical' => true,
        ];
    }
}

// Fixtures exist only in a rolled-back transaction on the guarded disposable target.
db()->begin_transaction();
try {
    $students = array_values(array_filter($users, fn($u) => $u['role'] === 'STUDENT'));
    if (count($students) < 2) {
        throw new RuntimeException('Two synthetic Students are required.');
    }
    $statusIds = array_column(
        rows('SELECT status_id,status_code FROM item_statuses'),
        'status_id',
        'status_code',
    );
    $itemStates = [
        'OPEN',
        'UNDER_REVIEW',
        'POTENTIAL_MATCH',
        'VERIFICATION',
        'HANDOVER',
        'RESOLVED',
        'UNCLAIMED_CLOSED',
    ];
    $claimStates = ['PENDING', 'NEED_MORE_INFO', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
    $fixtureIds = [];
    for ($i = 0; $i < 96; $i++) {
        $claimant = (int) $students[$i % 2]['user_id'];
        $reporter = (int) $students[1 - ($i % 2)]['user_id'];
        $state = $itemStates[$i % count($itemStates)];
        sql(
            "INSERT INTO items(reporter_user_id,category_id,location_id,status_id,item_type,title,description,event_date,verification_clue) VALUES (?,1,35,?,'FOUND',?,'Synthetic projection fixture','2026-10-10','PRIVATE projection sentinel')",
            [$reporter, (int) $statusIds[$state], 'Projection fixture ' . $i],
        );
        $foundId = (int) db()->insert_id;
        $fixtureIds[] = $foundId;
        if ($i % 4 !== 0) {
            sql("INSERT INTO item_photos(item_id,photo_kind,file_path,is_primary) VALUES (?,'ITEM',?,1)", [
                $foundId,
                'items/' . bin2hex(random_bytes(16)) . '.jpg',
            ]);
        }
        $lostId = null;
        if ($i % 3 === 0) {
            sql(
                "INSERT INTO items(reporter_user_id,category_id,location_id,status_id,item_type,title,description,event_date,verification_clue) VALUES (?,1,35,?,'LOST',?,'Synthetic projection fixture','2026-10-10','PRIVATE linked sentinel')",
                [$claimant, (int) $statusIds[$state], 'Linked projection fixture ' . $i],
            );
            $lostId = (int) db()->insert_id;
            $fixtureIds[] = $lostId;
            sql(
                "INSERT INTO item_photos(item_id,photo_kind,file_path,is_primary) VALUES (?,'OWNERSHIP',?,0)",
                [$lostId, 'evidence/' . bin2hex(random_bytes(16)) . '.jpg'],
            );
            sql(
                'INSERT INTO item_matches(lost_item_id,found_item_id,match_score,match_status) VALUES (?,?,75,?)',
                [$lostId, $foundId, $i % 6 === 0 ? 'CONFIRMED' : 'SUGGESTED'],
            );
        }
        sql(
            'INSERT INTO claims(item_id,related_lost_item_id,claimant_user_id,ownership_answer,claim_status) VALUES (?,?,?,?,?)',
            [
                $foundId,
                $lostId,
                $claimant,
                'PRIVATE identifying answer',
                $claimStates[$i % count($claimStates)],
            ],
        );
        $claimId = (int) db()->insert_id;
        for ($j = 0; $j < $i % 3; $j++) {
            sql('INSERT INTO claim_photos(claim_id,file_path) VALUES (?,?)', [
                $claimId,
                'claims/' . bin2hex(random_bytes(16)) . '.jpg',
            ]);
        }
        if ($i % 2 === 0) {
            sql(
                "INSERT INTO item_status_history(item_id,status_id,changed_by_user_id,note) VALUES (?,?,?,'Synthetic revision sentinel')",
                [$foundId, (int) $statusIds[$state], $reporter],
            );
        }
    }
    $marks = implode(',', array_fill(0, count($fixtureIds), '?'));
    foreach ($users as $user) {
        $user['user_id'] = (string) $user['user_id'];
        foreach ([0, 1, 12, 48] as $size) {
            $claimantFilter = $user['role'] === 'STUDENT' ? ' AND c.claimant_user_id=?' : '';
            $claimValues =
                $user['role'] === 'STUDENT'
                    ? array_merge($fixtureIds, [(int) $user['user_id'], $size])
                    : array_merge($fixtureIds, [$size]);
            $claims = $size
                ? rows(
                    "SELECT c.claim_id,c.item_id,c.related_lost_item_id,c.claimant_user_id,c.ownership_answer,c.claim_status,c.review_note,c.created_at,c.updated_at,c.reviewed_at,i.title,i.item_type,s.status_code AS item_status,u.full_name AS claimant_name FROM claims c JOIN items i ON i.item_id=c.item_id JOIN item_statuses s ON s.status_id=i.status_id JOIN users u ON u.user_id=c.claimant_user_id WHERE c.item_id IN ($marks)" .
                        $claimantFilter .
                        ' ORDER BY c.updated_at DESC,c.claim_id DESC LIMIT ?',
                    $claimValues,
                )
                : [];
            $records = $size
                ? rows(
                    'SELECT ' .
                        public_columns() .
                        ",u.avatar_path AS reporter_avatar_path FROM v_items_overview v JOIN users u ON u.user_id=v.reporter_user_id WHERE v.item_id IN ($marks) ORDER BY v.item_id LIMIT ?",
                    array_merge($fixtureIds, [$size]),
                )
                : [];
            foreach (['public', 'claims', 'staff'] as $domain) {
                $input = $domain === 'claims' ? $claims : $records;
                $before = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()[
                    'Value'
                ];
                $baseline =
                    $domain === 'claims'
                        ? baseline_claim_list_projection($input, $user)
                        : ($domain === 'staff'
                            ? baseline_staff_report_list($input, $user)
                            : array_map(fn($record) => baseline_safe_item($record, $user), $input));
                $middle = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()[
                    'Value'
                ];
                $batched =
                    $domain === 'claims'
                        ? claim_list_projection($input, $user)
                        : ($domain === 'staff'
                            ? staff_report_list($input, $user)
                            : safe_items($input, $user));
                $after = (int) db()->query("SHOW SESSION STATUS LIKE 'Com_stmt_execute'")->fetch_assoc()[
                    'Value'
                ];
                if ($baseline !== $batched) {
                    throw new RuntimeException($domain . ' list projection compatibility changed.');
                }
                $expected = !$input
                    ? 0
                    : ($domain === 'claims'
                        ? 2
                        : ($domain === 'staff'
                            ? ($user['role'] === 'STUDENT'
                                ? 7
                                : 6)
                            : ($user['role'] === 'STUDENT'
                                ? 4
                                : 3)));
                if ($after - $middle !== $expected) {
                    throw new RuntimeException($domain . ' list query bound changed.');
                }
                if ($domain === 'staff') {
                    foreach ($batched as $record) {
                        if (
                            array_intersect(
                                ['verification_clue', 'password_hash', 'avatar_path', 'reporter_avatar_path'],
                                array_keys($record),
                            )
                        ) {
                            throw new RuntimeException('Private report field leaked.');
                        }
                    }
                }
                $results[] = [
                    'domain' => $domain,
                    'role' => $user['role'],
                    'limit' => $size,
                    'records' => count($input),
                    'baseline_statements' => $middle - $before,
                    'batched_statements' => $after - $middle,
                    'identical' => true,
                ];
            }
        }
    }
    $missing = $records[0];
    $missing['item_id'] = '4294967295';
    foreach (['baseline_staff_report_list', 'staff_report_list'] as $readList) {
        try {
            $readList([$missing], $user);
            throw new RuntimeException('Missing report should retain its 404 response.');
        } catch (HttpError $error) {
            if ($error->status !== 404 || $error->errorCode !== 'not_found' || $error->getMessage() !== 'Report not found.') throw $error;
        }
    }
    $results[] = ['domain' => 'staff_missing', 'identical' => true, 'status' => 404];
} finally {
    db()->rollback();
}
$receipt = [
    'scope' => 'Owned synthetic QA; exact baseline data/authorization parity and bounded statement counts',
    'passed' => true,
    'checks' => $results,
];
$directory = getenv('REFIND_EVIDENCE_DIR');
if ($directory) {
    file_put_contents(
        $directory . '/projection-results.json',
        json_encode($receipt, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL,
    );
}
echo json_encode($receipt, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL;
