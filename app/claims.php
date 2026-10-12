<?php
declare(strict_types=1);
require_once __DIR__ . '/repository.php';
require_once __DIR__ . '/uploads.php';

function withdraw_claim(array $user, array $data): array
{
    allowed_fields($data,['action','itemId','_csrf']);
    $itemId=record_id($data['itemId']??null);
    db()->begin_transaction();
    try {
        $locked=lock_items([$itemId]);$found=$locked[$itemId];
        $claim=row('SELECT * FROM claims WHERE item_id=? AND claimant_user_id=? FOR UPDATE',[$itemId,(int)$user['user_id']]);
        if (!$claim) fail('Claim not found.',404,'not_found');
        if (!in_array($claim['claim_status'],['PENDING','NEED_MORE_INFO'],true)) fail('Only a claim that is still under review can be withdrawn.',409,'state_conflict');
        sql("UPDATE claims SET claim_status='WITHDRAWN' WHERE claim_id=?",[(int)$claim['claim_id']]);
        $remaining=(int)row("SELECT COUNT(*) AS n FROM claims WHERE item_id=? AND claim_status IN ('PENDING','NEED_MORE_INFO')",[$itemId])['n'];
        if ($found['status_code']==='VERIFICATION'&&$remaining===0) settle_idle_status($found,(int)$user['user_id'],'Ownership claim withdrawn by the claimant.');
        else history_event($found,(int)$user['user_id'],'Ownership claim withdrawn; other claims remain under review.');
        db()->commit();
    } catch (Throwable $error) {db()->rollback();if ($error instanceof mysqli_sql_exception&&in_array($error->getCode(),[1205,1213],true)) fail('The claim changed while saving. Reload and retry.',409,'state_conflict');throw $error;}
    return ['id'=>(string)$claim['claim_id'],'status'=>'WITHDRAWN','resubmitted'=>false];
}
function mutate_claim(array $user, array $data): array
{
    if (($data['action']??'')==='withdraw') return withdraw_claim($user,$data);
    // Ownership checks precede general field validation, without trusting a target user ID.
    $lostId=isset($data['lostItemId'])&&$data['lostItemId']!==''?record_id($data['lostItemId']):null;
    if ($lostId) { $lost=find_item($lostId);if ($lost['item_type']!=='LOST'||(string)$lost['reporter_user_id']!==$user['user_id']) fail('Choose one of your own Lost reports.',403,'forbidden'); }
    $itemId=record_id($data['itemId']??null);$found=find_item($itemId);
    if ($found['item_type']!=='FOUND'||(string)$found['reporter_user_id']===$user['user_id']) fail('You cannot claim this report.',409,'state_conflict');
    allowed_fields($data,['action','itemId','lostItemId','answer','keep_photo_ids','_csrf']);allowed_fields($_FILES,['ownershipPhotos']);
    $action=$data['action']??'submit';if (!in_array($action,['submit','resubmit'],true)) fail('Invalid claim action.',400);
    $answer=text($data,'answer',1000);if (mb_strlen($answer)<8) field_fail('answer','Provide at least 8 characters of identifying detail.');
    $uploads=uploaded_images('ownershipPhotos',2);$created=[];$removed=[];
    db()->begin_transaction();
    try {
        $locked=lock_items($lostId?[$itemId,$lostId]:[$itemId]);$found=$locked[$itemId];
        if ($found['item_type']!=='FOUND'||(string)$found['reporter_user_id']===$user['user_id']||!in_array($found['status_code'],ACTIVE_ITEM_CODES,true)||confirmed_match($itemId)) fail('This item is no longer eligible for your claim.',409,'state_conflict');
        if ($lostId) { $lost=$locked[$lostId];if ($lost['item_type']!=='LOST'||(string)$lost['reporter_user_id']!==$user['user_id']) fail('Choose one of your own Lost reports.',403,'forbidden');if (!in_array($lost['status_code'],ACTIVE_ITEM_CODES,true)||confirmed_match($lostId)) fail('That Lost report is already assigned or closed.',409,'state_conflict');
            // One Lost report can back only one claim under review at a time.
            if (row("SELECT claim_id FROM claims WHERE related_lost_item_id=? AND item_id<>? AND claim_status IN ('PENDING','NEED_MORE_INFO') LIMIT 1 FOR UPDATE",[$lostId,$itemId])) field_fail('lostItemId','This Lost report is already linked to another claim under review. Withdraw that claim first or choose another report.'); }
        $existing=row('SELECT * FROM claims WHERE item_id=? AND claimant_user_id=? FOR UPDATE',[$itemId,(int)$user['user_id']]);
        if ($existing&&$existing['claim_status']==='REJECTED') fail('Your claim for this item was rejected. A rejection is final for this item.',409,'claim_final');
        if ($existing&&!in_array($existing['claim_status'],RESUBMITTABLE_CLAIM_CODES,true)) fail('You already have an active or approved claim for this item.',409,'duplicate_claim');
        if ($action==='resubmit'&&!$existing) fail('Claim to update not found.',404,'not_found');
        $old=$existing?rows('SELECT claim_photo_id,file_path FROM claim_photos WHERE claim_id=? FOR UPDATE',[(int)$existing['claim_id']]):[];
        $oldIds=array_map('intval',array_column($old,'claim_photo_id'));
        $keep=retained_photos($data,'keep_photo_ids',$oldIds,2);
        if (array_diff($keep,$oldIds)) fail('A retained photo does not belong to your claim.',403,'forbidden');
        if (count($keep)+count($uploads)>2) field_fail('ownershipPhotos','Use at most 2 ownership photos including retained evidence.');
        if ($existing) {
            $claimId=(int)$existing['claim_id'];
            foreach ($old as $photo) if (!in_array((int)$photo['claim_photo_id'],$keep,true)) {sql('DELETE FROM claim_photos WHERE claim_photo_id=?',[(int)$photo['claim_photo_id']]);$removed[]=$photo['file_path'];}
            sql("UPDATE claims SET ownership_answer=?,related_lost_item_id=?,claim_status='PENDING',reviewed_by_user_id=NULL,review_note=NULL,reviewed_at=NULL WHERE claim_id=?",[$answer,$lostId,$claimId]);
        } else {sql('INSERT INTO claims(item_id,related_lost_item_id,claimant_user_id,ownership_answer) VALUES (?,?,?,?)',[$itemId,$lostId,(int)$user['user_id'],$answer]);$claimId=(int)db()->insert_id;}
        foreach ($uploads as $image) sql('INSERT INTO claim_photos(claim_id,file_path) VALUES (?,?)',[$claimId,save_upload($image,'claims',$created)]);
        $prior=$found['status_code'];status_change($found,'VERIFICATION',(int)$user['user_id'],'Ownership claims are awaiting manual BM review.');
        if ($prior==='VERIFICATION') history_event($found,(int)$user['user_id'],$existing?'Ownership claim updated for review.':'Ownership claim submitted for review.');
        notification((int)$user['user_id'],'CLAIM_SUBMITTED',$existing?'Claim resubmitted':'Claim submitted','Your identifying detail was sent to Building Management for manual review.',$itemId,$claimId);
        foreach (rows("SELECT user_id FROM users WHERE role='BUILDING_MANAGEMENT' AND is_active=1") as $staff) notification((int)$staff['user_id'],'CLAIM_QUEUED',$existing?'Claim resubmitted for review':'New claim to review',$existing?'A claimant updated their ownership details.':'An ownership claim is waiting for review.',$itemId,$claimId);
        db()->commit();
    } catch (Throwable $error) {db()->rollback();cleanup_media($created);if ($error instanceof mysqli_sql_exception&&in_array($error->getCode(),[1205,1213,1062],true)) fail('The claim changed while saving. Reload and retry.',409,'state_conflict');throw $error;}
    cleanup_media($removed,true);
    return ['id'=>(string)$claimId,'resubmitted'=>$existing!==null];
}
