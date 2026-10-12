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
foreach ($claims as &$claim) {
    foreach(['claim_id','item_id','claimant_user_id']as $key)$claim[$key]=(string)$claim[$key];
    $claim['related_lost_item_id']=$claim['related_lost_item_id']!==null?(string)$claim['related_lost_item_id']:null;
    $photos=rows('SELECT claim_photo_id FROM claim_photos WHERE claim_id=? ORDER BY claim_photo_id',[(int)$claim['claim_id']]);
    $claim['ownership_photo_count']=count($photos);$claim['ownership_photo_ids']=array_column($photos,'claim_photo_id');
    if ($user['role']==='BUILDING_MANAGEMENT') $claim['ownership_photos']=array_map(fn($p)=>app_config()['base_path'].'api/photos.php?kind=claim&id='.$p['claim_photo_id'],$photos);
    foreach (['created_at','updated_at','reviewed_at'] as $key) $claim[$key]=utc_iso($claim[$key]);
    $item=find_item((int)$claim['item_id']);$open=in_array($item['status_code'],ACTIVE_ITEM_CODES,true)&&!confirmed_match((int)$item['item_id']);
    $claim['can_resubmit']=in_array($claim['claim_status'],RESUBMITTABLE_CLAIM_CODES,true)&&$open;
    $claim['can_withdraw']=$user['role']==='STUDENT'&&in_array($claim['claim_status'],['PENDING','NEED_MORE_INFO'],true);
}unset($claim);
json_response(['claims'=>$claims,'total'=>$total,'page'=>$page,'pages'=>max(1,(int)ceil($total/$limit))]);
