<?php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../app/reports.php';
method('GET', 'POST');
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$user = request_user($post ? 'STUDENT' : null, $post);
allowed_fields($_GET, ['id','mine','editable','q','type','category_id','location_id','status','date','closed','active','page','limit']);
if ($post) {
    $result=mutate_report($user,$_POST);
    json_response($result,$result['action']==='create'?201:200);
}
$where = []; $values = [];
if (isset($_GET['id'])) { $where[] = 'v.item_id = ?'; $values[] = record_id($_GET['id']); }
if (isset($_GET['mine'])) {
    if ($_GET['mine'] !== '1') fail('Invalid mine filter.', 400);
    $where[] = 'v.reporter_user_id = ?'; $values[] = (int) $user['user_id'];
}
if (isset($_GET['type'])&&$_GET['type']!=='') { $type=strtoupper(text($_GET,'type',10));if (!in_array($type,['LOST','FOUND'],true)) fail('Invalid report type.',400);$where[]='v.item_type=?';$values[]=$type; }
foreach (['category_id','location_id'] as $key) if (isset($_GET[$key])&&$_GET[$key]!=='') {$where[]='v.'.$key.'=?';$values[]=record_id($_GET[$key]);}
if (isset($_GET['status'])&&$_GET['status']!=='') {$status=strtoupper(text($_GET,'status',40));if (!row('SELECT status_id FROM item_statuses WHERE status_code=?',[$status])) fail('Invalid status filter.',400);$where[]='v.status_code=?';$values[]=$status;}
if (isset($_GET['date'])&&$_GET['date']!=='') {$where[]='v.event_date=?';$values[]=valid_event_date(text($_GET,'date',10));}
if (isset($_GET['closed'])) {if ($_GET['closed']!=='1') fail('Invalid archive filter.',400);$where[]="v.status_code IN ('RESOLVED','UNCLAIMED_CLOSED')";}
if (isset($_GET['active'])) {if ($_GET['active']!=='1'||isset($_GET['closed'])) fail('Invalid active filter.',400);$where[]="v.status_code NOT IN ('RESOLVED','UNCLAIMED_CLOSED')";}
if (isset($_GET['q'])) {$q=text($_GET,'q',200,false);if ($q!=='') {$where[]="LOCATE(?,CONCAT_WS(' ',v.title,v.description,v.category_name,v.location_name,v.location_detail,v.floor_name))>0";$values[]=$q;}}
$clause=$where?' WHERE '.implode(' AND ',$where):'';
[$page,$limit,$offset]=pagination($_GET);
$total=(int)row('SELECT COUNT(*) AS n FROM v_items_overview v'.$clause,$values)['n'];
$items=rows('SELECT '.public_columns().' FROM v_items_overview v'.$clause.' ORDER BY v.created_at DESC,v.item_id DESC LIMIT ? OFFSET ?',array_merge($values,[$limit,$offset]));
if (isset($_GET['id']) && !$items) fail('Report not found.', 404, 'not_found');
$items=safe_items($items,$user);
if (isset($_GET['editable'])) {
    if ($_GET['editable'] !== '1' || !isset($_GET['id'])) fail('Invalid edit request.', 400);
    $raw = find_item(record_id($_GET['id'])); require_editable_item($user, $raw);
    $items[0]['private_clue'] = $raw['verification_clue'];
    $items[0]['ownership_photo_ids'] = array_column(rows("SELECT photo_id FROM item_photos WHERE item_id = ? AND photo_kind = 'OWNERSHIP'", [(int) $raw['item_id']]), 'photo_id');
}
if (isset($_GET['id'])) {
    $id=record_id($_GET['id']);
    $items[0]['history']=array_map(fn($h)=>['status_code'=>$h['status_code'],'status_name'=>ui_status_name($h['status_code']),'at'=>utc_iso($h['changed_at']),'note'=>$h['note']],rows('SELECT s.status_code,s.status_name,h.changed_at,h.note FROM item_status_history h JOIN item_statuses s ON s.status_id=h.status_id WHERE h.item_id=? ORDER BY h.changed_at,h.history_id',[$id]));
    $items[0]['matches']=$items[0]['matched_item_id']||in_array($items[0]['status_code'],['RESOLVED','UNCLAIMED_CLOSED'],true)?[]:possible_matches($id,$user);
    json_response(['item'=>$items[0]]);
}
json_response(['items'=>$items,'total'=>$total,'page'=>$page,'limit'=>$limit,'pages'=>max(1,(int)ceil($total/$limit))]);
