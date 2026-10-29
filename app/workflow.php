<?php
declare(strict_types=1);
require_once __DIR__ . '/repository.php';

function record_revision(array $record, array $keys): string
{
    $values=[];foreach($keys as $key)$values[$key]=(string)($record[$key]??'');
    return hash('sha256',json_encode($values,JSON_THROW_ON_ERROR));
}
function claim_revision(array $claim): string
{
    $claim['evidence']=json_encode(array_column(rows('SELECT claim_photo_id FROM claim_photos WHERE claim_id=? ORDER BY claim_photo_id',[(int)$claim['claim_id']]),'claim_photo_id'),JSON_THROW_ON_ERROR);
    return record_revision($claim,['claim_id','item_id','related_lost_item_id','claimant_user_id','ownership_answer','claim_status','review_note','reviewed_at','updated_at','evidence']);
}
function item_revision(array $item): string
{
    $item['history_id']=row('SELECT COALESCE(MAX(history_id),0) AS id FROM item_status_history WHERE item_id=?',[(int)$item['item_id']])['id'];
    return record_revision($item,['item_id','reporter_user_id','category_id','location_id','item_type','title','description','verification_clue','status_id','updated_at','resolved_at','history_id']);
}
function handover_revision(array $handover): string
{
    return record_revision($handover,['handover_id','claim_id','pickup_location_id','scheduled_at','completed_at','handled_by_user_id','notes','handover_status','updated_at']);
}
function expected_revision(array $data, string $current): void
{
    $expected=$data['revision']??'';
    if(!is_string($expected)||!preg_match('/^[a-f0-9]{64}$/D',$expected)||!hash_equals($current,$expected)) fail('This record changed. Refresh the detail before deciding again.',409,'state_conflict');
}
function confirm_operation(array $data): void
{
    if(($data['confirm']??'')!=='1') field_fail('confirm','Confirm this operation explicitly.');
}
function review_note(array $data, int $max=500, bool $required=true): string
{
    $note=text($data,'note',$max,$required);
    if($required&&mb_strlen($note)<8) field_fail('note','Provide a reason of at least 8 characters.');
    return $note;
}
function workflow_lock(callable $operation): array
{
    $name='refind-matching-'.app_config()['db_name'];
    if((int)row('SELECT GET_LOCK(?,5) AS acquired',[$name])['acquired']!==1) fail('Another workflow is saving. Please retry.',409,'state_conflict');
    try{return $operation();}finally{row('SELECT RELEASE_LOCK(?) AS released',[$name]);}
}
function workflow_error(Throwable $error): never
{
    if($error instanceof mysqli_sql_exception&&in_array($error->getCode(),[1062,1205,1213],true)) fail('The workflow changed while saving. Refresh and retry.',409,'state_conflict');
    throw $error;
}
function matching_related_ids(array $ids): array
{
    $ids=array_values(array_unique(array_map('intval',$ids)));
    if(!$ids)return[];$marks=implode(',',array_fill(0,count($ids),'?'));
    $matches=rows("SELECT lost_item_id,found_item_id FROM item_matches WHERE match_status='SUGGESTED' AND (lost_item_id IN ($marks) OR found_item_id IN ($marks))",array_merge($ids,$ids));
    foreach($matches as $match){$ids[]=(int)$match['lost_item_id'];$ids[]=(int)$match['found_item_id'];}
    return array_values(array_unique($ids));
}
function settle_potential_states(array &$locked,int $actor): void
{
    foreach($locked as &$item) {
        if($item['status_code']!=='POTENTIAL_MATCH'||confirmed_match((int)$item['item_id']))continue;
        if(!has_suggestion((int)$item['item_id'])) status_change($item,'OPEN',$actor,'No current matching suggestions.',false);
    }unset($item);
}
// Called only after claim approval checks, inside the caller's transaction and item locks.
function create_approved_pickup(array &$locked, array $claim, int $actorId): string
{
    $claimId = (int) $claim['claim_id'];
    $foundId = (int) $claim['item_id'];
    $found = &$locked[$foundId];
    $lostId = $claim['related_lost_item_id'] ? (int) $claim['related_lost_item_id'] : null;
    if ($lostId) {
        $lost = &$locked[$lostId];
        sql("INSERT INTO item_matches(lost_item_id,found_item_id,match_score,match_status,confirmed_by_user_id,confirmed_at) VALUES (?,?,?,'CONFIRMED',?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE match_score=VALUES(match_score),match_status='CONFIRMED',confirmed_by_user_id=VALUES(confirmed_by_user_id),confirmed_at=VALUES(confirmed_at)", [$lostId, $foundId, match_score($lost, $found), $actorId]);
        status_change($lost, 'HANDOVER', $actorId, 'Ownership verified; matched item is ready for pickup.', false);
        unset($lost);
    }
    status_change($found, 'HANDOVER', $actorId, 'Ownership verified by BM. Item is ready for pickup.');
    sql("INSERT INTO handovers(claim_id,pickup_location_id,handled_by_user_id,notes) VALUES (?,?,?,'Awaiting a pickup appointment.')", [$claimId, $found['location_id'] ? (int) $found['location_id'] : null, $actorId]);
    // Later history/notification inserts also change insert_id, so capture it immediately.
    return (string) db()->insert_id;
}

function review_claim(array $user, array $data): array
{
    allowed_fields($data, ['action','id','decision','note','revision','confirm','_csrf']);
    $id = record_id($data['id'] ?? null);
    $decision = text($data, 'decision', 30);
    if (!in_array($decision, ['approved','rejected','need_more_info'], true)) {
        field_fail('decision', 'Choose Approve, Reject or Request more info.');
    }
    $note = review_note($data);
    confirm_operation($data);
    return workflow_lock(function () use ($user, $data, $id, $decision, $note) {
        $original = row('SELECT item_id,related_lost_item_id FROM claims WHERE claim_id=?', [$id]);
        if (!$original) fail('Claim not found.', 404, 'not_found');
        $ids = [(int) $original['item_id']];
        if ($original['related_lost_item_id']) $ids[] = (int) $original['related_lost_item_id'];
        // Older data can hold other claims that reuse this Lost report; approval closes them, so their Found reports are locked too.
        $sharedSql = "SELECT claim_id,item_id,claimant_user_id FROM claims WHERE related_lost_item_id=? AND claim_id<>? AND claim_status IN ('PENDING','NEED_MORE_INFO') ORDER BY claim_id";
        $shared = $decision === 'approved' && $original['related_lost_item_id']
            ? rows($sharedSql, [(int) $original['related_lost_item_id'], $id]) : [];
        foreach ($shared as $other) $ids[] = (int) $other['item_id'];
        $ids = matching_related_ids($ids);
        db()->begin_transaction();
        try {
            // Parent reports are locked in numeric order before rereading the claim.
            $locked = lock_items($ids);
            $claim = row('SELECT * FROM claims WHERE claim_id=? FOR UPDATE', [$id]);
            if (!$claim || $claim['item_id'] !== $original['item_id'] || $claim['related_lost_item_id'] !== $original['related_lost_item_id']) {
                fail('Claim relation changed. Refresh the queue.', 409, 'state_conflict');
            }
            expected_revision($data, claim_revision($claim));
            if (!in_array($claim['claim_status'], ['PENDING','NEED_MORE_INFO'], true) || ($decision === 'need_more_info' && $claim['claim_status'] !== 'PENDING')) {
                fail('This claim is no longer eligible for that decision.', 409, 'state_conflict');
            }
            $foundId = (int) $claim['item_id'];
            $found = &$locked[$foundId];
            $lostId = $claim['related_lost_item_id'] ? (int) $claim['related_lost_item_id'] : null;
            if ($found['item_type'] !== 'FOUND' || !in_array($found['status_code'], ACTIVE_ITEM_CODES, true) || confirmed_match($foundId)) {
                fail('This item has already been assigned or closed.', 409, 'state_conflict');
            }
            if ($lostId && ($locked[$lostId]['item_type'] !== 'LOST' || (int) $locked[$lostId]['reporter_user_id'] !== (int) $claim['claimant_user_id'])) {
                fail('Linked Lost relation is invalid.', 409, 'state_conflict');
            }
            $active = rows("SELECT * FROM claims WHERE item_id=? AND claim_status IN ('PENDING','NEED_MORE_INFO') ORDER BY claim_id FOR UPDATE", [$foundId]);
            $status = ['approved'=>'APPROVED','rejected'=>'REJECTED','need_more_info'=>'NEED_MORE_INFO'][$decision];
            if ($decision === 'approved') {
                if ($lostId && (!in_array($locked[$lostId]['status_code'], ACTIVE_ITEM_CODES, true) || confirmed_match($lostId))) {
                    fail('The linked Lost report already has an owner or terminal outcome.', 409, 'state_conflict');
                }
                if (row("SELECT claim_id FROM claims WHERE item_id=? AND claim_status='APPROVED' LIMIT 1", [$foundId])) {
                    fail('Another claim has already been approved.', 409, 'state_conflict');
                }
            }
            sql('UPDATE claims SET claim_status=?,reviewed_by_user_id=?,review_note=?,reviewed_at=UTC_TIMESTAMP() WHERE claim_id=?', [$status, (int) $user['user_id'], $note, $id]);
            if ($decision === 'approved') {
                $handoverId = create_approved_pickup($locked, $claim, (int) $user['user_id']);
                foreach ($active as $other) {
                    if ((int) $other['claim_id'] === $id) continue;
                    $reason = 'Another ownership claim was verified by Building Management.';
                    sql("UPDATE claims SET claim_status='REJECTED',reviewed_by_user_id=?,review_note=?,reviewed_at=UTC_TIMESTAMP() WHERE claim_id=?", [(int) $user['user_id'], $reason, (int) $other['claim_id']]);
                    notification((int) $other['claimant_user_id'], 'CLAIM_REJECTED', 'Claim closed', $reason, $foundId, (int) $other['claim_id']);
                }
                if ($lostId) {
                    $sharedNow = rows(str_replace('ORDER BY claim_id', 'ORDER BY claim_id FOR UPDATE', $sharedSql), [$lostId, $id]);
                    // Recheck the discovered set after locking; never update an unlocked parent report.
                    if (array_diff(array_column($sharedNow, 'claim_id'), array_column($shared, 'claim_id'))) {
                        fail('Claims linked to this Lost report changed. Refresh and retry.', 409, 'state_conflict');
                    }
                    $reason = 'Closed because your linked Lost report was matched to another approved claim.';
                    foreach ($sharedNow as $other) {
                        sql("UPDATE claims SET claim_status='REJECTED',reviewed_by_user_id=?,review_note=?,reviewed_at=UTC_TIMESTAMP() WHERE claim_id=?", [(int) $user['user_id'], $reason, (int) $other['claim_id']]);
                        $otherFound = &$locked[(int) $other['item_id']];
                        if (!row("SELECT claim_id FROM claims WHERE item_id=? AND claim_status IN ('PENDING','NEED_MORE_INFO') LIMIT 1", [(int) $other['item_id']]) && $otherFound['status_code'] === 'VERIFICATION') {
                            settle_idle_status($otherFound, (int) $user['user_id'], 'Ownership claim closed after its Lost report was matched elsewhere.');
                        }
                        unset($otherFound);
                    }
                    if ($sharedNow) {
                        notification((int) $claim['claimant_user_id'], 'CLAIM_REJECTED', 'Other claims closed', count($sharedNow).' other claim(s) that used the same Lost report were closed because this claim was approved.', $foundId, (int) $sharedNow[0]['claim_id']);
                    }
                }
                $assigned = [$foundId];
                if ($lostId) $assigned[] = $lostId;
                $m = implode(',', array_fill(0, count($assigned), '?'));
                sql("DELETE FROM item_matches WHERE match_status='SUGGESTED' AND (lost_item_id IN ($m) OR found_item_id IN ($m))", array_merge($assigned, $assigned));
                settle_potential_states($locked, (int) $user['user_id']);
                notification((int) $claim['claimant_user_id'], 'CLAIM_APPROVED', 'Claim approved', $note, $foundId, $id);
            } elseif ($decision === 'rejected') {
                $previous = $found['status_code'];
                if (count($active) > 1) {
                    history_event($found, (int) $user['user_id'], 'Ownership claim rejected; other claims remain under review.');
                } else {
                    settle_idle_status($found, (int) $user['user_id'], 'Ownership claim rejected after manual review.');
                }
                if ($previous === $found['status_code'] && count($active) <= 1) {
                    history_event($found, (int) $user['user_id'], 'Ownership claim rejected after manual review.');
                }
                notification((int) $claim['claimant_user_id'], 'CLAIM_REJECTED', 'Claim rejected', $note, $foundId, $id);
            } else {
                $previous = $found['status_code'];
                status_change($found, 'VERIFICATION', (int) $user['user_id'], 'Ownership review requested additional detail.');
                if ($previous === 'VERIFICATION') history_event($found, (int) $user['user_id'], 'Ownership review requested additional detail.');
                notification((int) $claim['claimant_user_id'], 'CLAIM_NEEDS_INFO', 'More info requested', $note, $foundId, $id);
            }
            db()->commit();
            return ['id'=>(string)$id,'status'=>$status,'handover_id'=>$handoverId??null];
        } catch (Throwable $error) {
            db()->rollback();
            workflow_error($error);
        }
    });
}
function allowed_manual_statuses(array $item): array
{
    $id=(int)$item['item_id'];
    if(in_array($item['status_code'],['RESOLVED','UNCLAIMED_CLOSED','HANDOVER'],true)||confirmed_match($id)||row("SELECT claim_id FROM claims WHERE (item_id=? OR related_lost_item_id=?) AND claim_status IN ('PENDING','NEED_MORE_INFO','APPROVED') LIMIT 1",[$id,$id]))return[];
    $choices=['OPEN','UNDER_REVIEW','UNCLAIMED_CLOSED'];
    if(has_suggestion($id))$choices[]='POTENTIAL_MATCH';
    if($item['item_type']==='LOST')$choices[]='RESOLVED';
    return array_values(array_diff($choices,[$item['status_code']]));
}
function staff_status(array $user, array $data): array
{
    allowed_fields($data, ['action','id','status','note','revision','confirm','_csrf']);
    $id = record_id($data['id'] ?? null);
    $status = strtoupper(text($data, 'status', 40));
    $note = review_note($data);
    confirm_operation($data);
    return workflow_lock(function () use ($user, $data, $id, $status, $note) {
        $ids = matching_related_ids([$id]);
        db()->begin_transaction();
        try {
            $locked = lock_items($ids);
            $item = &$locked[$id];
            expected_revision($data, item_revision($item));
            if (!in_array($status, allowed_manual_statuses($item), true)) {
                fail('Finish the active claim/handover or choose an eligible transition.', 409, 'state_conflict');
            }
            status_change($item, $status, (int) $user['user_id'], $status === 'RESOLVED' ? 'BM recorded recovery of this Lost report.' : 'Operational status updated by BM.', false);
            if (in_array($status, ['RESOLVED','UNCLAIMED_CLOSED'], true)) {
                sql("DELETE FROM item_matches WHERE match_status='SUGGESTED' AND (lost_item_id=? OR found_item_id=?)", [$id, $id]);
                settle_potential_states($locked, (int) $user['user_id']);
            }
            // One update per decision: the new status and Building Management's note travel together.
            notification((int) $item['reporter_user_id'], 'OPERATIONAL_NOTE', 'Report updated: '.ui_status_name($status), $note, $id);
            db()->commit();
            return ['id'=>(string)$id,'status'=>$status];
        } catch (Throwable $error) {
            db()->rollback();
            workflow_error($error);
        }
    });
}
function valid_schedule(string $value): string
{
    $zone=new DateTimeZone('Asia/Jakarta');$date=DateTimeImmutable::createFromFormat('!Y-m-d\TH:i',$value,$zone);
    if(!$date||$date->format('Y-m-d\TH:i')!==$value||substr($value,0,4)<'1000'||$date->getTimestamp()<=time())field_fail('scheduled_at','Choose a valid future pickup date/time in Asia/Jakarta.');
    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}
function pickup_audit(array $before,array $after,string $operation,string $note,array $user,int $claimant,int $itemId): void
{
    $summary=fn($h)=>$h['handover_status'].' / location '.($h['pickup_location_id']??'none').' / '.($h['scheduled_at']?utc_iso($h['scheduled_at']):'unscheduled');
    $message='BM #'.$user['user_id'].' '.$operation.'. Before: '.$summary($before).'. After: '.$summary($after).'.'.($note!==''?' Reason: '.$note:'');
    if(mb_strlen($message)>500)throw new RuntimeException('Pickup audit exceeds storage contract.');
    $titles=['schedule'=>'Pickup scheduled','reschedule'=>'Pickup rescheduled','cancel_schedule'=>'Pickup schedule cancelled','complete'=>'Item returned','release'=>'Pickup released'];
    // The acting BM already sees the result on screen; other BMs and the claimant are told.
    $recipients=array_map('intval',array_column(rows("SELECT user_id FROM users WHERE role='BUILDING_MANAGEMENT' AND is_active=1 AND user_id<>?",[(int)$user['user_id']]),'user_id'));$recipients[]=$claimant;
    foreach(array_unique($recipients)as $target)notification($target,'HANDOVER_'.strtoupper($operation),$titles[$operation],$message,$itemId,(int)$after['claim_id']);
}
// Release revokes ownership; cancelling an appointment must never call this step.
// The caller owns the transaction, fresh-state checks, report settlement and audit.
function release_approved_pickup(array $handover, int $actorId, string $note): void
{
    sql("UPDATE claims SET claim_status='REJECTED',reviewed_by_user_id=?,review_note=?,reviewed_at=UTC_TIMESTAMP() WHERE claim_id=?", [$actorId, 'Pickup released: '.$note, (int) $handover['claim_id']]);
    if ($handover['related_lost_item_id']) {
        sql("UPDATE item_matches SET match_status='REJECTED',confirmed_by_user_id=?,confirmed_at=UTC_TIMESTAMP() WHERE lost_item_id=? AND found_item_id=? AND match_status='CONFIRMED'", [$actorId, (int) $handover['related_lost_item_id'], (int) $handover['item_id']]);
    }
    sql('DELETE FROM handovers WHERE handover_id=?', [(int) $handover['handover_id']]);
}

function mutate_handover(array $user, array $data): array
{
    allowed_fields($data, ['action','id','pickup_location_id','scheduled_at','note','revision','confirm','_csrf']);
    $id = record_id($data['id'] ?? null);
    $action = text($data, 'action', 30);
    if (!in_array($action, ['schedule','reschedule','cancel_schedule','complete','release'], true)) fail('Invalid pickup operation.', 400);
    confirm_operation($data);
    $note = review_note($data, 250, in_array($action, ['reschedule','cancel_schedule','release'], true));
    $pickupLocationId = null;
    $scheduledAt = null;
    if (in_array($action, ['schedule','reschedule'], true)) {
        if (trim((string) ($data['pickup_location_id'] ?? '')) === '') field_fail('pickup_location_id', 'Choose a pickup area.');
        if (trim((string) ($data['scheduled_at'] ?? '')) === '') field_fail('scheduled_at', 'Choose a pickup date and time.');
        $pickupLocationId = record_id($data['pickup_location_id']);
        if (!row("SELECT location_id FROM campus_locations WHERE location_id=? AND location_kind='AREA' AND is_active=1", [$pickupLocationId])) {
            field_fail('pickup_location_id', 'Choose an active campus pickup area.');
        }
        $scheduledAt = valid_schedule(text($data, 'scheduled_at', 16));
    }
    return workflow_lock(function () use ($user, $data, $id, $action, $note, $pickupLocationId, $scheduledAt) {
        $original = row('SELECT h.claim_id,c.item_id,c.related_lost_item_id FROM handovers h JOIN claims c ON c.claim_id=h.claim_id WHERE h.handover_id=?', [$id]);
        if (!$original) fail('Pickup record not found.', 404, 'not_found');
        $ids = [(int) $original['item_id']];
        if ($original['related_lost_item_id']) $ids[] = (int) $original['related_lost_item_id'];
        db()->begin_transaction();
        try {
            $locked = lock_items($ids);
            $handover = row('SELECT h.*,c.item_id,c.related_lost_item_id,c.claimant_user_id,c.claim_status FROM handovers h JOIN claims c ON c.claim_id=h.claim_id WHERE h.handover_id=? FOR UPDATE', [$id]);
            if (!$handover || $handover['claim_id'] !== $original['claim_id'] || $handover['item_id'] !== $original['item_id'] || $handover['related_lost_item_id'] !== $original['related_lost_item_id']) {
                fail('Pickup relation changed. Refresh first.', 409, 'state_conflict');
            }
            expected_revision($data, handover_revision($handover));
            if ($handover['claim_status'] !== 'APPROVED' || $handover['handover_status'] === 'COMPLETED') {
                fail('Only an active approved pickup can be changed.', 409, 'state_conflict');
            }
            $found = &$locked[(int) $handover['item_id']];
            if ($found['item_type'] !== 'FOUND' || $found['status_code'] !== 'HANDOVER') fail('The item is not ready for pickup.', 409, 'state_conflict');
            if ($handover['related_lost_item_id']) {
                $pair = confirmed_match((int) $handover['item_id']);
                if (!$pair || (int) $pair['lost_item_id'] !== (int) $handover['related_lost_item_id'] || $locked[(int) $handover['related_lost_item_id']]['status_code'] !== 'HANDOVER') {
                    fail('The confirmed pair is inconsistent.', 409, 'state_conflict');
                }
            }
            if (($action === 'schedule' && $handover['handover_status'] !== 'PENDING') ||
                (in_array($action, ['reschedule','cancel_schedule'], true) && $handover['handover_status'] !== 'SCHEDULED') ||
                (in_array($action, ['complete','release'], true) && !in_array($handover['handover_status'], ['PENDING','SCHEDULED'], true))) {
                fail('That operation does not match the current pickup state.', 409, 'state_conflict');
            }
            // Time may pass while waiting for locks: repeat the future-time check here.
            if ($scheduledAt && (new DateTimeImmutable($scheduledAt, new DateTimeZone('UTC')))->getTimestamp() <= time()) {
                field_fail('scheduled_at', 'Choose a future pickup date/time.');
            }
            if ($action === 'reschedule' && (int) $handover['pickup_location_id'] === $pickupLocationId && $handover['scheduled_at'] === $scheduledAt) {
                fail('Choose a different pickup time or location before rescheduling.', 409, 'state_conflict');
            }

            if (in_array($action, ['schedule','reschedule'], true)) {
                sql("UPDATE handovers SET handover_status='SCHEDULED',pickup_location_id=?,scheduled_at=?,handled_by_user_id=?,notes=? WHERE handover_id=?", [$pickupLocationId, $scheduledAt, (int) $user['user_id'], $note ?: 'Pickup scheduled by BM.', $id]);
            } elseif ($action === 'cancel_schedule') {
                sql("UPDATE handovers SET handover_status='PENDING',scheduled_at=NULL,handled_by_user_id=?,notes=? WHERE handover_id=?", [(int) $user['user_id'], $note, $id]);
            } elseif ($action === 'complete') {
                sql("UPDATE handovers SET handover_status='COMPLETED',completed_at=UTC_TIMESTAMP(),handled_by_user_id=?,notes=? WHERE handover_id=?", [(int) $user['user_id'], $note ?: 'Physical return confirmed by BM.', $id]);
            } else {
                release_approved_pickup($handover, (int) $user['user_id'], $note);
            }
            foreach ($locked as &$item) {
                $notifyFinder = (int) $item['reporter_user_id'] !== (int) $handover['claimant_user_id'];
                if ($action === 'complete') {
                    status_change($item, 'RESOLVED', (int) $user['user_id'], 'Verified item returned; handover completed.', $notifyFinder);
                } elseif ($action === 'release') {
                    settle_idle_status($item, (int) $user['user_id'], 'Pickup released by BM; the report is available again.', $notifyFinder);
                } else {
                    history_event($item, (int) $user['user_id'], $action === 'cancel_schedule' ? 'Pickup appointment cancelled; verified ownership retained.' : 'Pickup appointment scheduled or updated.');
                }
            }
            unset($item);
            $after = $action === 'release'
                ? ['handover_status'=>'RELEASED','pickup_location_id'=>null,'scheduled_at'=>null,'claim_id'=>$handover['claim_id']]
                : row('SELECT * FROM handovers WHERE handover_id=?', [$id]);
            pickup_audit($handover, $after, $action, $note, $user, (int) $handover['claimant_user_id'], (int) $handover['item_id']);
            db()->commit();
            return ['id'=>(string)$id,'status'=>$after['handover_status']];
        } catch (Throwable $error) {
            db()->rollback();
            workflow_error($error);
        }
    });
}
