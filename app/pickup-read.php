<?php
declare(strict_types=1);
require_once __DIR__.'/repository.php';

// Read-only presentation of the existing private audit. Never rewrite its stored message.
function pickup_event(string $message): ?array
{
    $state='(PENDING|SCHEDULED|COMPLETED|RELEASED) / location (none|[1-9][0-9]*) / (unscheduled|[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)';
    if(!preg_match('~^BM #([1-9][0-9]*) (schedule|reschedule|cancel_schedule|complete|release)\. Before: '.$state.'\. After: '.$state.'\.(?: Reason: (.*))?$~sD',$message,$parts))return null;
    static $locations;
    $locations??=array_column(rows('SELECT location_id,location_name FROM campus_locations'),'location_name','location_id');
    $actor=row('SELECT full_name FROM users WHERE user_id=?',[(int)$parts[1]]);
    $snapshot=fn($offset)=>['status'=>$parts[$offset],'location'=>$parts[$offset+1]==='none'?null:($locations[$parts[$offset+1]]??'Previous pickup area'),
        'scheduled_at'=>$parts[$offset+2]==='unscheduled'?null:$parts[$offset+2]];
    return ['actor'=>$actor['full_name']??'Building Management','operation'=>$parts[2],'before'=>$snapshot(3),'after'=>$snapshot(6),'reason'=>$parts[9]??''];
}
