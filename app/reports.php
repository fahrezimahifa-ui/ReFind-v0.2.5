<?php
declare(strict_types=1);
require_once __DIR__ . '/repository.php';
require_once __DIR__ . '/uploads.php';

function valid_event_date(string $value): string
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value || substr($value,0,4) < '1000') field_fail('date', 'Enter a valid event date.');
    return $value;
}
function report_values(array $data, string $type): array
{
    $title = text($data, 'title', 120); $description = text($data, 'description', 2000); $clue = text($data, 'clue', 1000);
    if (mb_strlen($title) < 3) field_fail('title', 'Use at least 3 characters for the item name.');
    if (mb_strlen($clue) < 8) field_fail('clue', 'Give at least 8 characters so Building Management can verify the owner.');
    $category = record_id($data['category_id'] ?? null); $location = record_id($data['location_id'] ?? null);
    if (!row('SELECT category_id FROM categories WHERE category_id=? AND is_active=1', [$category])) field_fail('category_id', 'Choose an active category.');
    if (!row("SELECT location_id FROM campus_locations WHERE location_id=? AND location_kind='AREA' AND is_active=1", [$location])) field_fail('location_id', 'Choose an active campus area.');
    $date = valid_event_date(text($data, 'date', 10)); $time = text($data, 'time', 5, false);
    if ($date > campus_today()) field_fail('date', 'The event date cannot be in the future.');
    if ($time !== '' && !preg_match('/^([01][0-9]|2[0-3]):[0-5][0-9]$/D', $time)) field_fail('time', 'Enter a valid time or leave it unknown.');
    return [$title,$description,$category,$location,text($data,'location_detail',500,false),$date,$time !== '' ? $time . ':00' : null,$clue];
}
function mutate_report(array $user, array $data): array
{
    $action = text($data, 'action', 20);
    if (!in_array($action, ['create','update','delete'], true)) fail('Invalid report action.', 400);
    $id = $action === 'create' ? null : record_id($data['id'] ?? null);
    $original = $id ? find_item($id) : null;
    if ($original) require_editable_item($user, $original);
    allowed_fields($data, ['action','id','type','title','description','category_id','location_id','location_detail','date','time','clue','keep_photo_ids','keep_ownership_ids','_csrf']);
    allowed_fields($_FILES, ['photos','ownershipPhotos']);
    $type = $original['item_type'] ?? strtoupper(text($data,'type',10));
    if (!in_array($type,['LOST','FOUND'],true)) field_fail('type','Choose Lost or Found.');
    if ($original && isset($data['type']) && strtoupper(text($data,'type',10)) !== $type) fail('Report type cannot change during edit.',409);
    $values = $action === 'delete' ? null : report_values($data,$type);
    $public = $action === 'delete' ? [] : uploaded_images('photos',4);
    $proof = $action === 'delete' ? [] : uploaded_images('ownershipPhotos',2);
    if ($type === 'FOUND' && $proof) field_fail('ownershipPhotos','Found reports use a private clue, not Lost ownership photos.');
    $lockName = 'refind-matching-' . app_config()['db_name'];
    if ((int) row('SELECT GET_LOCK(?,5) AS acquired',[$lockName])['acquired'] !== 1) fail('Another report is saving. Please retry.',409,'state_conflict');
    $created=[];$removed=[];
    try {
        $ids = array_map('intval',array_column(rows("SELECT item_id FROM items WHERE item_type<>?",[$type]),'item_id'));
        if ($id) $ids[]=$id;
        db()->begin_transaction();
        try {
            $locked=lock_items($ids);
            if ($id) require_editable_item($user,$locked[$id]);
            if ($action === 'delete') {
                // Closed claims on this report cascade away with it, so their private photos are removed too.
                $removed=array_column(rows('SELECT file_path FROM item_photos WHERE item_id=? UNION ALL SELECT p.file_path FROM claim_photos p JOIN claims c ON c.claim_id=p.claim_id WHERE c.item_id=?',[$id,$id]),'file_path');
                $title=$locked[$id]['title'];
                sql('DELETE FROM items WHERE item_id=?',[$id]);unset($locked[$id]);
                notification((int)$user['user_id'],'REPORT_DELETED','Report deleted','Your report "'.mb_substr($title,0,120).'" was deleted.');
                foreach ($locked as &$candidate) {
                    if ($candidate['status_code']==='POTENTIAL_MATCH'&&!confirmed_match((int)$candidate['item_id'])&&!has_suggestion((int)$candidate['item_id'])) status_change($candidate,'OPEN',(int)$user['user_id'],'No current matching suggestions.',false);
                } unset($candidate);
            } else {
                [$title,$description,$category,$location,$detail,$date,$time,$clue]=$values;
                $old = $id ? rows('SELECT photo_id,photo_kind,file_path FROM item_photos WHERE item_id=? FOR UPDATE',[$id]) : [];
                $publicIds=array_column(array_filter($old,fn($p)=>$p['photo_kind']==='ITEM'),'photo_id');
                $proofIds=array_column(array_filter($old,fn($p)=>$p['photo_kind']==='OWNERSHIP'),'photo_id');
                $keepPublic=retained_photos($data,'keep_photo_ids',$publicIds,4);
                $keepProof=retained_photos($data,'keep_ownership_ids',$proofIds,2);
                if (array_diff($keepPublic,array_map('intval',$publicIds))||array_diff($keepProof,array_map('intval',$proofIds))) fail('A retained photo does not belong to this report.',403,'forbidden');
                if (count($keepPublic)+count($public)>4||count($keepProof)+count($proof)>2) field_fail('photos','Use at most 4 public photos and 2 ownership photos including retained files.');
                if ($type==='FOUND'&&$keepProof) field_fail('ownershipPhotos','Found reports do not contain Lost evidence.');
                if (!$id) {
                    $open=(int)row("SELECT status_id FROM item_statuses WHERE status_code='OPEN'")['status_id'];
                    sql('INSERT INTO items(reporter_user_id,category_id,location_id,status_id,item_type,title,description,location_detail,event_date,event_time,verification_clue) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[(int)$user['user_id'],$category,$location,$open,$type,$title,$description,$detail?:null,$date,$time,$clue]);
                    $id=(int)db()->insert_id;
                    $locked[$id]=find_item($id);
                    history_event($locked[$id],(int)$user['user_id'],'Report submitted.');
                    notification((int)$user['user_id'],'REPORT_SUBMITTED','Report submitted','Your '.strtolower($type).' report has been saved.',$id);
                } else {
                    sql('UPDATE items SET title=?,description=?,category_id=?,location_id=?,location_floor_id=NULL,location_detail=?,event_date=?,event_time=?,verification_clue=? WHERE item_id=?',[$title,$description,$category,$location,$detail?:null,$date,$time,$clue,$id]);
                    $locked[$id]=find_item($id);history_event($locked[$id],(int)$user['user_id'],'Report details updated by the reporter.');
                    foreach ($old as $photo) if (!in_array((int)$photo['photo_id'],array_merge($keepPublic,$keepProof),true)) { sql('DELETE FROM item_photos WHERE photo_id=?',[(int)$photo['photo_id']]);$removed[]=$photo['file_path']; }
                }
                foreach ([['ITEM',$public,'items'],['OWNERSHIP',$proof,'evidence']] as [$kind,$images,$collection]) foreach ($images as $image) sql('INSERT INTO item_photos(item_id,photo_kind,file_path) VALUES (?,?,?)',[$id,$kind,save_upload($image,$collection,$created)]);
                sql("UPDATE item_photos SET is_primary=0 WHERE item_id=? AND photo_kind='ITEM'",[$id]);
                $primary=row("SELECT photo_id FROM item_photos WHERE item_id=? AND photo_kind='ITEM' ORDER BY photo_id LIMIT 1",[$id]);
                if ($primary) sql('UPDATE item_photos SET is_primary=1 WHERE photo_id=?',[(int)$primary['photo_id']]);
                refresh_suggestions($locked[$id],$locked,(int)$user['user_id']);
            }
            db()->commit();
        } catch (Throwable $error) {
            db()->rollback();cleanup_media($created);
            if ($error instanceof mysqli_sql_exception && in_array($error->getCode(),[1205,1213],true)) fail('Reports changed while saving. Reload and retry.',409,'state_conflict');
            throw $error;
        }
        cleanup_media($removed,true);
        return ['id'=>(string)$id,'action'=>$action];
    } finally { row('SELECT RELEASE_LOCK(?) AS released',[$lockName]); }
}
