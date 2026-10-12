<?php
declare(strict_types=1);
require_once __DIR__ . '/workflow.php';

function staff_report(int $id,array $user): array
{
    $raw=find_item($id);
    $public=row('SELECT '.public_columns().' FROM v_items_overview v WHERE v.item_id=?',[$id]);
    $result=safe_item($public,$user);
    $result['verification_clue']=$raw['verification_clue'];
    $result['ownership_photos']=array_map(fn($p)=>app_config()['base_path'].'api/photos.php?kind=item&id='.$p['photo_id'],rows("SELECT photo_id FROM item_photos WHERE item_id=? AND photo_kind='OWNERSHIP' ORDER BY photo_id",[$id]));
    $result['allowed_statuses']=allowed_manual_statuses($raw);$result['revision']=item_revision($raw);
    $result['history']=array_map(fn($e)=>['at'=>utc_iso($e['changed_at']),'status'=>ui_status_name($e['status_code']),'note'=>$e['note']??''],rows('SELECT h.changed_at,h.note,s.status_code FROM item_status_history h JOIN item_statuses s ON s.status_id=h.status_id WHERE h.item_id=? ORDER BY h.changed_at,h.history_id',[$id]));
    // The claim or pickup that currently locks this report, so the lock note can link to it.
    $lock=row("SELECT c.claim_id,c.claim_status,h.handover_id FROM claims c LEFT JOIN handovers h ON h.claim_id=c.claim_id WHERE (c.item_id=? OR c.related_lost_item_id=?) AND c.claim_status IN ('PENDING','NEED_MORE_INFO','APPROVED') ORDER BY c.claim_status='APPROVED' DESC,c.updated_at DESC LIMIT 1",[$id,$id]);
    $result['active_claim_id']=$lock?(string)$lock['claim_id']:null;
    $result['active_handover_id']=$lock&&$lock['handover_id']!==null?(string)$lock['handover_id']:null;
    return $result;
}
function staff_claim(int $id,array $user): array
{
    $raw=row('SELECT c.*,u.full_name AS claimant_name,u.email AS claimant_email,u.student_id AS claimant_student_id FROM claims c JOIN users u ON u.user_id=c.claimant_user_id WHERE c.claim_id=?',[$id]);
    if(!$raw)fail('Claim not found.',404,'not_found');
    $revision=claim_revision($raw);$raw['claim_id']=(string)$raw['claim_id'];
    $raw['item']=staff_report((int)$raw['item_id'],$user);
    $raw['lost']= $raw['related_lost_item_id']?staff_report((int)$raw['related_lost_item_id'],$user):null;
    $raw['ownership_photos']=array_map(fn($p)=>app_config()['base_path'].'api/photos.php?kind=claim&id='.$p['claim_photo_id'],rows('SELECT claim_photo_id FROM claim_photos WHERE claim_id=? ORDER BY claim_photo_id',[$id]));
    $raw['revision']=$revision;
    $active=in_array($raw['claim_status'],['PENDING','NEED_MORE_INFO'],true)&&in_array($raw['item']['status_code'],ACTIVE_ITEM_CODES,true)&&!$raw['item']['matched_item_id'];
    $raw['decisions']=$active?['rejected']:[];
    $lostAvailable=!$raw['lost']||(in_array($raw['lost']['status_code'],ACTIVE_ITEM_CODES,true)&&!$raw['lost']['matched_item_id']);
    if($active&&$lostAvailable)$raw['decisions'][]='approved';
    $raw['approval_blocked']=$active&&!$lostAvailable?'The linked Lost report is already matched to another item, so this claim cannot be approved.':null;
    if($active&&$raw['claim_status']==='PENDING')$raw['decisions'][]='need_more_info';
    $pickup=row('SELECT handover_id FROM handovers WHERE claim_id=?',[$id]);$raw['handover_id']=$pickup?(string)$pickup['handover_id']:null;
    // The previous "more info" request survives in the claimant's notification, so a resubmitted claim can be compared with what was asked.
    $request=row("SELECT message,created_at FROM notifications WHERE claim_id=? AND user_id=? AND notification_type='CLAIM_NEEDS_INFO' ORDER BY notification_id DESC LIMIT 1",[$id,(int)$raw['claimant_user_id']]);
    $raw['previous_request']=$request&&$raw['claim_status']==='PENDING'?['note'=>$request['message'],'at'=>utc_iso($request['created_at'])]:null;
    $raw['resubmitted_at']=$raw['previous_request']?utc_iso($raw['updated_at']):null;
    foreach(['created_at','updated_at','reviewed_at']as $key)$raw[$key]=utc_iso($raw[$key]);
    return $raw;
}
