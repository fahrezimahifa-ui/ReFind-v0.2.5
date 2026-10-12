<?php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../app/pickup-read.php';
method('GET', 'POST');
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$user = request_user(null, $post);
allowed_fields($_GET, ['page','limit','count']);
$unread = fn() => (int) row('SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND is_read=0', [(int) $user['user_id']])['n'];
if ($post) {
    allowed_fields($_POST, ['id', 'action', '_csrf']);
    if (($_POST['action'] ?? '') === 'read_all') {
        sql('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [(int) $user['user_id']]);
        json_response(['unread_count' => $unread()]);
    }
    if (isset($_POST['action'])) fail('Invalid notification action.', 400);
    $id = record_id($_POST['id'] ?? null);
    if (!row('SELECT notification_id FROM notifications WHERE notification_id = ? AND user_id = ?', [$id, (int) $user['user_id']])) fail('Notification not found.', 404, 'not_found');
    sql('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?', [$id, (int) $user['user_id']]);
    json_response(['unread_count'=>$unread()]);
}
if (isset($_GET['count'])) {
    if ($_GET['count'] !== '1' || isset($_GET['page']) || isset($_GET['limit'])) fail('Invalid count request.', 400);
    json_response(['unread_count' => $unread()]);
}
[$page,$limit,$offset]=pagination($_GET,24);
$records=rows('SELECT n.notification_id,n.notification_type,n.title,n.message,n.item_id,n.claim_id,n.is_read,n.created_at,h.handover_id,c.claimant_user_id,i.title AS item_title FROM notifications n LEFT JOIN claims c ON c.claim_id=n.claim_id LEFT JOIN handovers h ON h.claim_id=c.claim_id LEFT JOIN items i ON i.item_id=n.item_id WHERE n.user_id=? ORDER BY n.created_at DESC,n.notification_id DESC LIMIT ? OFFSET ?',[(int)$user['user_id'],$limit,$offset]);
foreach ($records as &$record) {
    $record['created_at']=utc_iso($record['created_at']);
    $authorized=$user['role']==='BUILDING_MANAGEMENT'||(string)($record['claimant_user_id']??'')===$user['user_id'];
    $record['handover_id']=$authorized&&$record['handover_id']!==null?(string)$record['handover_id']:null;
    $record['pickup_event']=str_starts_with($record['notification_type'],'HANDOVER_')?pickup_event($record['message']):null;
    unset($record['claimant_user_id']);
}unset($record);
$total=(int)row('SELECT COUNT(*) AS n FROM notifications WHERE user_id=?',[(int)$user['user_id']])['n'];
json_response(['notifications'=>$records,'unread_count'=>$unread(),'total'=>$total,'page'=>$page,'pages'=>max(1,(int)ceil($total/$limit))]);
