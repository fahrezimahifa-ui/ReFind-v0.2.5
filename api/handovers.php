<?php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../app/workflow.php';
require __DIR__ . '/../app/pickup-read.php';
method('GET', 'POST');
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$user = request_user($post ? 'BUILDING_MANAGEMENT' : null, $post);
allowed_fields($_GET, ['id','status','q','page','limit']);
if ($post) json_response(mutate_handover($user,$_POST));
$where = []; $values = [];
if ($user['role'] === 'STUDENT') { $where[] = 'c.claimant_user_id = ?'; $values[] = (int) $user['user_id']; }
if (isset($_GET['id'])) { $where[] = 'h.handover_id = ?'; $values[] = record_id($_GET['id']); }
if(isset($_GET['status'])&&$_GET['status']!==''&&$_GET['status']!=='all'){$state=text($_GET,'status',20);
    if($state==='active')$where[]="h.handover_status IN ('PENDING','SCHEDULED')";
    else{if(!in_array($state,['PENDING','SCHEDULED','COMPLETED'],true))fail('Invalid pickup state.',400);$where[]='h.handover_status=?';$values[]=$state;}}
$search=text($_GET,'q',200,false);if($search!==''){$where[]="LOCATE(?,CONCAT_WS(' ',i.title,u.full_name,l.location_name))>0";$values[]=$search;}
$from=' FROM handovers h JOIN claims c ON c.claim_id=h.claim_id JOIN items i ON i.item_id=c.item_id JOIN users u ON u.user_id=c.claimant_user_id LEFT JOIN campus_locations l ON l.location_id=h.pickup_location_id';
$clause=$where?' WHERE '.implode(' AND ',$where):'';[$page,$limit,$offset]=pagination($_GET,24);
$total=(int)row('SELECT COUNT(*) AS n'.$from.$clause,$values)['n'];
$records=rows('SELECT h.*,c.item_id,c.related_lost_item_id,c.claim_status,c.claimant_user_id,u.full_name AS claimant_name,u.email AS claimant_email,u.student_id AS claimant_student_id,i.title,l.location_name AS pickup_location'.$from.$clause.' ORDER BY h.updated_at DESC,h.handover_id DESC LIMIT ? OFFSET ?',array_merge($values,[$limit,$offset]));
if (isset($_GET['id']) && !$records) fail('Pickup record not found.', 404, 'not_found');
foreach ($records as &$record) {
    foreach(['handover_id','claim_id','item_id']as $key)$record[$key]=(string)$record[$key];
    foreach(['pickup_location_id','related_lost_item_id','handled_by_user_id']as $key)$record[$key]=$record[$key]!==null?(string)$record[$key]:null;
    if($user['role']==='BUILDING_MANAGEMENT'){
        $record['revision']=handover_revision($record);
        $record['operations']=$record['claim_status']==='APPROVED'?($record['handover_status']==='PENDING'?['schedule','complete','release']:($record['handover_status']==='SCHEDULED'?['reschedule','cancel_schedule','complete','release']:[])):[];
        // Every pickup change is copied to the claimant, so their copy is the complete private audit for any BM viewer.
        if(isset($_GET['id']))$record['audit']=array_map(fn($e)=>['at'=>utc_iso($e['created_at']),'title'=>$e['title'],'message'=>$e['message'],'pickup_event'=>pickup_event($e['message'])],rows("SELECT created_at,title,message FROM notifications WHERE user_id=? AND claim_id=? AND LEFT(notification_type,9)='HANDOVER_' ORDER BY notification_id",[(int)$record['claimant_user_id'],(int)$record['claim_id']]));
    }else unset($record['claimant_email'],$record['claimant_student_id']);
    unset($record['claimant_user_id']);
    $record['scheduled_at']=utc_iso($record['scheduled_at']);$record['completed_at']=utc_iso($record['completed_at']);$record['created_at']=utc_iso($record['created_at']);$record['updated_at']=utc_iso($record['updated_at']);
    unset($record['claim_status']); // Pickup state drives queue colour/actions; claim approval is invariant.
}unset($record);
json_response(['handovers'=>$records,'total'=>$total,'page'=>$page,'pages'=>max(1,(int)ceil($total/$limit))]);
