<?php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../app/claims.php';
method('GET', 'POST');
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$user = request_user($post ? 'STUDENT' : null, $post);
allowed_fields($_GET, ['id','itemId','page','limit']);
if ($post) {
    $result=mutate_claim($user,$_POST);json_response($result,$result['resubmitted']||isset($result['status'])?200:201);
}
$where = []; $values = [];
if ($user['role'] === 'STUDENT') { $where[] = 'c.claimant_user_id = ?'; $values[] = (int) $user['user_id']; }
if (isset($_GET['id'])) { $where[] = 'c.claim_id = ?'; $values[] = record_id($_GET['id']); }
if (isset($_GET['itemId'])) { $where[]='c.item_id=?';$values[]=record_id($_GET['itemId']); }
$clause=$where?' WHERE '.implode(' AND ',$where):'';[$page,$limit,$offset]=pagination($_GET,24);
$total=(int)row('SELECT COUNT(*) AS n FROM claims c'.$clause,$values)['n'];
$claims=rows('SELECT c.claim_id,c.item_id,c.related_lost_item_id,c.claimant_user_id,c.ownership_answer,c.claim_status,c.review_note,c.created_at,c.updated_at,c.reviewed_at,i.title,i.item_type,s.status_code AS item_status,u.full_name AS claimant_name FROM claims c JOIN items i ON i.item_id=c.item_id JOIN item_statuses s ON s.status_id=i.status_id JOIN users u ON u.user_id=c.claimant_user_id'.$clause.' ORDER BY c.updated_at DESC,c.claim_id DESC LIMIT ? OFFSET ?',array_merge($values,[$limit,$offset]));
if (isset($_GET['id']) && !$claims) fail('Claim not found.', 404, 'not_found');
$claims=claim_list_projection($claims,$user);
json_response(['claims'=>$claims,'total'=>$total,'page'=>$page,'pages'=>max(1,(int)ceil($total/$limit))]);
