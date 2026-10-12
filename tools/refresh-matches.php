<?php
declare(strict_types=1);
// v0.2.5 maintenance: recompute stored match suggestions with the current rules (no self-matches, same category, threshold).
// Usage: php tools/refresh-matches.php [--dry-run]. Run a backup first; statuses change without notifying anyone.
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../app/repository.php';
$dry=in_array('--dry-run',$argv,true);
$lock='refind-matching-'.app_config()['db_name'];
if((int)row('SELECT GET_LOCK(?,5) AS acquired',[$lock])['acquired']!==1){fwrite(STDERR,"Another report is saving. Retry.\n");exit(1);}
try{
    $actor=row("SELECT user_id FROM users WHERE role='BUILDING_MANAGEMENT' AND is_active=1 ORDER BY user_id LIMIT 1");
    if(!$actor)throw new RuntimeException('No active Building Management account to record the history entries.');
    $actor=(int)$actor['user_id'];
    db()->begin_transaction();
    $locked=lock_items(array_map('intval',array_column(rows('SELECT item_id FROM items'),'item_id')));
    $before=array_map(fn($i)=>$i['status_code'],$locked);
    $removed=(int)row("SELECT COUNT(*) AS n FROM item_matches WHERE match_status='SUGGESTED'")['n'];
    sql("DELETE FROM item_matches WHERE match_status='SUGGESTED'");
    $eligible=array_filter($locked,fn($i)=>in_array($i['status_code'],ACTIVE_ITEM_CODES,true)&&!confirmed_match((int)$i['item_id']));
    $added=0;
    foreach($eligible as $lost){
        if($lost['item_type']!=='LOST')continue;
        foreach($eligible as $found){
            if($found['item_type']!=='FOUND')continue;
            $score=suggestion_score($lost,$found);if($score===null)continue;
            sql("INSERT INTO item_matches(lost_item_id,found_item_id,match_score) VALUES (?,?,?) ON DUPLICATE KEY UPDATE match_score=IF(match_status='SUGGESTED',VALUES(match_score),match_score)",[(int)$lost['item_id'],(int)$found['item_id'],$score]);$added++;
        }
    }
    foreach($locked as &$item){
        if(!in_array($item['status_code'],['OPEN','POTENTIAL_MATCH'],true)||confirmed_match((int)$item['item_id']))continue;
        status_change($item,has_suggestion((int)$item['item_id'])?'POTENTIAL_MATCH':'OPEN',$actor,'Suggestions recalculated with the v0.2.5 matching rules.',false);
    }unset($item);
    $changed=[];foreach($locked as $id=>$item)if($before[$id]!==$item['status_code'])$changed[]=['item_id'=>$id,'from'=>$before[$id],'to'=>$item['status_code']];
    if($dry)db()->rollback();else db()->commit();
    echo json_encode(['database'=>app_config()['db_name'],'dry_run'=>$dry,'suggestions_removed'=>$removed,'suggestions_added'=>$added,'status_changes'=>$changed],JSON_PRETTY_PRINT).PHP_EOL;
}catch(Throwable $e){if(db()->ping())@db()->rollback();fwrite(STDERR,'Refresh stopped: '.$e->getMessage().PHP_EOL);exit(1);}
finally{row('SELECT RELEASE_LOCK(?) AS released',[$lock]);}
