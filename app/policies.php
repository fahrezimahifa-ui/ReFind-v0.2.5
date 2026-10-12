<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

// Claims in these states still own the workflow of the reports they reference.
const ACTIVE_CLAIM_CODES = ['PENDING', 'NEED_MORE_INFO', 'APPROVED'];
// A rejected claim is final for its item; a withdrawn or more-info claim can be sent again.
const RESUBMITTABLE_CLAIM_CODES = ['NEED_MORE_INFO', 'WITHDRAWN'];
function active_claim_for_report(int $id): ?array
{
    return row("SELECT claim_id FROM claims WHERE (item_id = ? OR related_lost_item_id = ?) AND claim_status IN ('PENDING','NEED_MORE_INFO','APPROVED') LIMIT 1", [$id, $id]);
}
function find_item(int $id): array
{
    $item = row('SELECT i.*, s.status_code FROM items i JOIN item_statuses s ON s.status_id = i.status_id WHERE i.item_id = ?', [$id]);
    if (!$item) fail('Report not found.', 404, 'not_found');
    return $item;
}
function require_editable_item(array $user, array $item): void
{
    require_role($user, 'STUDENT');
    if ((string) $item['reporter_user_id'] !== $user['user_id']) fail('Only the reporter can change this report.', 403, 'forbidden');
    if (!in_array($item['status_code'], ['OPEN', 'POTENTIAL_MATCH'], true) ||
        active_claim_for_report((int) $item['item_id']) ||
        row("SELECT match_id FROM item_matches WHERE match_status = 'CONFIRMED' AND (lost_item_id = ? OR found_item_id = ?) LIMIT 1", [(int) $item['item_id'], (int) $item['item_id']])) {
        fail('This report is locked by its workflow.', 409, 'state_conflict');
    }
}
function planned_feature(string $batch): never
{
    fail('This operation is scheduled for ' . $batch . ' and is not yet implemented.', 501, 'feature_pending');
}
