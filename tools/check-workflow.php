<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../app/uploads.php';
try{
 $queries=[
  'public_private_limits'=>"SELECT item_id FROM item_photos GROUP BY item_id HAVING SUM(photo_kind='ITEM')>4 OR SUM(photo_kind='OWNERSHIP')>2",
  'claim_photo_limits'=>'SELECT claim_id FROM claim_photos GROUP BY claim_id HAVING COUNT(*)>2',
  'ownership_only_lost'=>"SELECT p.photo_id FROM item_photos p JOIN items i ON i.item_id=p.item_id WHERE p.photo_kind='OWNERSHIP' AND (i.item_type<>'LOST' OR p.is_primary<>0)",
  'claim_relations'=>"SELECT c.claim_id FROM claims c JOIN items f ON f.item_id=c.item_id LEFT JOIN items l ON l.item_id=c.related_lost_item_id WHERE f.item_type<>'FOUND' OR (l.item_id IS NOT NULL AND (l.item_type<>'LOST' OR l.reporter_user_id<>c.claimant_user_id))",
  'one_approved_owner'=>"SELECT item_id FROM claims WHERE claim_status='APPROVED' GROUP BY item_id HAVING COUNT(*)>1",
  'one_confirmed_lost'=>"SELECT lost_item_id FROM item_matches WHERE match_status='CONFIRMED' GROUP BY lost_item_id HAVING COUNT(*)>1",
  'one_confirmed_found'=>"SELECT found_item_id FROM item_matches WHERE match_status='CONFIRMED' GROUP BY found_item_id HAVING COUNT(*)>1",
  'confirmed_pair_status'=>"SELECT m.match_id FROM item_matches m JOIN items l ON l.item_id=m.lost_item_id JOIN items f ON f.item_id=m.found_item_id WHERE m.match_status='CONFIRMED' AND (l.status_id<>f.status_id OR l.status_id NOT IN (5,6))",
  'approved_handover'=>"SELECT c.claim_id FROM claims c LEFT JOIN handovers h ON h.claim_id=c.claim_id WHERE c.claim_status='APPROVED' AND h.handover_id IS NULL",
  'completed_handover'=>"SELECT h.handover_id FROM handovers h JOIN claims c ON c.claim_id=h.claim_id JOIN items i ON i.item_id=c.item_id WHERE h.handover_status='COMPLETED' AND (c.claim_status<>'APPROVED' OR i.status_id<>6 OR h.completed_at IS NULL OR i.resolved_at IS NULL)",
  'latest_history_status'=>'SELECT i.item_id FROM items i WHERE i.status_id<>COALESCE((SELECT h.status_id FROM item_status_history h WHERE h.item_id=i.item_id ORDER BY h.changed_at DESC,h.history_id DESC LIMIT 1),0)',
  'handover_approved_claim'=>"SELECT h.handover_id FROM handovers h JOIN claims c ON c.claim_id=h.claim_id WHERE c.claim_status<>'APPROVED'",
  'one_active_claim_per_lost'=>"SELECT related_lost_item_id FROM claims WHERE related_lost_item_id IS NOT NULL AND claim_status IN ('PENDING','NEED_MORE_INFO') GROUP BY related_lost_item_id HAVING COUNT(*)>1",
  'scheduled_pickup_timestamp'=>"SELECT handover_id FROM handovers WHERE (handover_status='SCHEDULED' AND scheduled_at IS NULL) OR (handover_status='PENDING' AND scheduled_at IS NOT NULL)",
  'active_claim_not_assigned'=>"SELECT c.claim_id FROM claims c JOIN items i ON i.item_id=c.item_id JOIN item_statuses s ON s.status_id=i.status_id WHERE c.claim_status IN ('PENDING','NEED_MORE_INFO') AND s.status_code IN ('HANDOVER','RESOLVED','UNCLAIMED_CLOSED')",
 ];$checks=[];foreach($queries as $name=>$query)$checks[$name]=!rows($query);
 $records=rows("SELECT file_path,IF(photo_kind='ITEM','items','evidence') AS collection FROM item_photos UNION ALL SELECT file_path,'claims' FROM claim_photos UNION ALL SELECT avatar_path,'avatars' FROM users WHERE avatar_path IS NOT NULL");$missing=[];$invalid=[];$references=[];
 foreach($records as $r){$references[]=$r['file_path'];if(!preg_match('~^'.$r['collection'].'/[a-f0-9]{32}\.(jpg|png|webp)$~D',$r['file_path']))$invalid[]=$r['file_path'];$path=media_path($r['file_path']);if(!$path||!is_file($path))$missing[]=$r['file_path'];}
 $orphan=[];foreach(['items','evidence','claims','avatars'] as $collection)foreach(glob(storage_dir($collection).'/*')?:[] as $p)if(is_file($p)&&!in_array($collection.'/'.basename($p),$references,true))$orphan[]=$collection.'/'.basename($p);
 $checks['media_collection_paths']=!$invalid;$checks['media_exists']=!$missing;$checks['no_orphan_media']=!$orphan;
 echo json_encode(['database'=>app_config()['db_name'],'passed'=>!in_array(false,$checks,true),'checks'=>$checks,'missing'=>$missing,'orphan'=>$orphan,'invalid'=>$invalid],JSON_PRETTY_PRINT).PHP_EOL;
 exit(in_array(false,$checks,true)?1:0);
}catch(Throwable $e){fwrite(STDERR,'Workflow check stopped: '.$e->getMessage().PHP_EOL);exit(1);}
