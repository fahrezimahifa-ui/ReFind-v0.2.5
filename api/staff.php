<?php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../app/staff-read.php';
method('GET', 'POST');
$user = request_user('BUILDING_MANAGEMENT', $_SERVER['REQUEST_METHOD'] === 'POST');
allowed_fields($_GET,['resource','id','q','status','type','page','limit']);
if($_SERVER['REQUEST_METHOD']==='POST'){
    $action=text($_POST,'action',20);
    if($action==='review')json_response(review_claim($user,$_POST));
    if($action==='status')json_response(staff_status($user,$_POST));
    fail('Invalid staff operation.',400,'invalid_request');
}
$resource=$_GET['resource']??'reports';if(!in_array($resource,['reports','claims'],true))fail('Invalid staff resource.',400);
if(isset($_GET['id'])){
    $id=record_id($_GET['id']);
    if($resource==='claims')json_response(['claim'=>staff_claim($id,$user)]);
    $report=staff_report($id,$user);json_response(['report'=>$report,'reports'=>[$report]]);
}
[$page,$limit,$offset]=pagination($_GET,24);$where=[];$values=[];$search=text($_GET,'q',200,false);$status=text($_GET,'status',40,false);
if($resource==='claims'){
    $status=$status===''?'active':$status;
    if($status==='active')$where[]="c.claim_status IN ('PENDING','NEED_MORE_INFO')";
    elseif($status!=='all'){if(!in_array($status,['PENDING','NEED_MORE_INFO','APPROVED','REJECTED','WITHDRAWN'],true))fail('Invalid claim state.',400);$where[]='c.claim_status=?';$values[]=$status;}
    if($search!==''){$where[]="LOCATE(?,CONCAT_WS(' ',i.title,i.location_detail,l.location_name,u.full_name))>0";$values[]=$search;}
    $from=' FROM claims c JOIN items i ON i.item_id=c.item_id JOIN users u ON u.user_id=c.claimant_user_id LEFT JOIN campus_locations l ON l.location_id=i.location_id';
    $clause=$where?' WHERE '.implode(' AND ',$where):'';
    $total=(int)row('SELECT COUNT(*) AS n'.$from.$clause,$values)['n'];
    $claims=rows('SELECT c.claim_id,c.item_id,c.claim_status,c.created_at,c.updated_at,i.title,u.full_name AS claimant_name,(SELECT COUNT(*) FROM claim_photos p WHERE p.claim_id=c.claim_id) AS proof_count'.$from.$clause.' ORDER BY c.updated_at DESC,c.claim_id DESC LIMIT ? OFFSET ?',array_merge($values,[$limit,$offset]));
    foreach($claims as &$claim){$claim['claim_id']=(string)$claim['claim_id'];$claim['item_id']=(string)$claim['item_id'];$claim['created_at']=utc_iso($claim['created_at']);$claim['updated_at']=utc_iso($claim['updated_at']);}unset($claim);
    $counts=array_column(rows('SELECT claim_status,COUNT(*) AS n FROM claims GROUP BY claim_status'),'n','claim_status');
    json_response(['claims'=>$claims,'counts'=>$counts,'total'=>$total,'page'=>$page,'pages'=>max(1,(int)ceil($total/$limit))]);
}
if($status!==''&&$status!=='all'){if(!row('SELECT status_id FROM item_statuses WHERE status_code=?',[$status]))fail('Invalid report state.',400);$where[]='v.status_code=?';$values[]=$status;}
if(isset($_GET['type'])&&$_GET['type']!==''){$type=strtoupper(text($_GET,'type',10));if(!in_array($type,['LOST','FOUND'],true))fail('Invalid report type.',400);$where[]='v.item_type=?';$values[]=$type;}
if($search!==''){$where[]="LOCATE(?,CONCAT_WS(' ',v.title,v.category_name,v.location_name,v.location_detail,v.floor_name,v.reporter_name))>0";$values[]=$search;}
$clause=$where?' WHERE '.implode(' AND ',$where):'';$total=(int)row('SELECT COUNT(*) AS n FROM v_items_overview v'.$clause,$values)['n'];
$reports=rows('SELECT '.public_columns().' FROM v_items_overview v'.$clause.' ORDER BY v.created_at DESC,v.item_id DESC LIMIT ? OFFSET ?',array_merge($values,[$limit,$offset]));
foreach($reports as &$report){$report=safe_item($report,$user);$raw=find_item((int)$report['item_id']);$report['allowed_statuses']=allowed_manual_statuses($raw);$report['revision']=item_revision($raw);}unset($report);
json_response(['reports'=>$reports,'total'=>$total,'page'=>$page,'pages'=>max(1,(int)ceil($total/$limit))]);
