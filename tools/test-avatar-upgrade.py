"""Fresh install, populated legacy upgrade and SQL/media recovery, on new dev services only."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
if os.environ.get('REFIND_TEST_PROFILE') != 'ui-ux-dev' or ROOT.name != 'refind-dev':
    raise RuntimeError('Requires the isolated development profile')
subprocess.run(['php', str(ROOT/'tools/qa-guard.php'), str(ROOT)],check=True,capture_output=True)
OUT=ROOT/'output/playwright/avatar-upgrade'
OUT.mkdir(parents=True,exist_ok=True)
TEMP=Path(tempfile.mkdtemp(prefix='upgrade-',dir=ROOT/'storage/setup'))
checks=[]
def call(folder,tool):
    return subprocess.check_output(['php',str(folder/'tools'/tool)],cwd=folder,text=True)
def config(folder,host):
    (folder/'app/config.local.php').write_text("<?php return ['db_host'=>'"+host+"','db_name'=>'refind_db_ui_ux_dev','db_user'=>'refind_dev','db_password'=>getenv('REFIND_DEV_DB_PASSWORD'),'base_path'=>'/refind-dev/','session_name'=>'refind_ui_ux_dev'];")
def sql(folder,query):
    return subprocess.check_output(['php','-r',"require 'app/db.php'; foreach(explode(';',stream_get_contents(STDIN)) as $q) if(trim($q)!=='') db()->query($q);"],cwd=folder,input=query,text=True)
def mysql(host,args,input=None):
    env=os.environ.copy();env['MYSQL_PWD']=os.environ['REFIND_DEV_DB_PASSWORD']
    return subprocess.check_output(['mariadb','--host='+host,'--user=refind_dev','refind_db_ui_ux_dev',*args],input=input,env=env)
try:
    folder=TEMP/'legacy'/'refind-dev'
    for name in ['app','api','database','tools','docs']:
        shutil.copytree(ROOT/name,folder/name,ignore=shutil.ignore_patterns('config.local.php','node_modules','verification','references','__pycache__'))
    shutil.copy2(ROOT/'.refind-dev.json',folder/'.refind-dev.json')
    config(folder,'upgrade-database')
    call(folder,'setup-db.php');checks.append('fresh install on a separate empty development database')
    call(folder,'setup-demo.php')
    sql(folder,"INSERT INTO items(reporter_user_id,category_id,location_id,item_type,title,description,event_date) SELECT user_id,1,35,'LOST','Preserved legacy record','Synthetic upgrade sentinel','2026-10-10' FROM users LIMIT 1")
    sentinel=folder/'storage/items'/('b'*32+'.jpg')
    shutil.copy2(folder/'tools/demo-photos/wallet-overview.jpg',sentinel)
    sql(folder,"INSERT INTO item_photos(item_id,file_path,photo_kind,is_primary) SELECT item_id,'items/"+'b'*32+".jpg','ITEM',1 FROM items LIMIT 1; INSERT INTO item_status_history(item_id,status_id,changed_by_user_id,note) SELECT item_id,status_id,reporter_user_id,'Synthetic migration fixture' FROM items")
    # Downgrade only this disposable synthetic fixture to the recognized prior schema/receipt.
    sql(folder,'ALTER TABLE users DROP COLUMN avatar_path')
    receipt=folder/'storage/setup/database-receipt.json'
    data=json.loads(receipt.read_text());data['sql_hashes']=json.loads((folder/'database/migrations/avatars-previous-files.json').read_text());receipt.write_text(json.dumps(data))
    before=mysql('upgrade-database',['--batch','--skip-column-names','-e','SELECT user_id,full_name,email,password_hash,role,created_at,updated_at FROM users ORDER BY user_id; SELECT * FROM items ORDER BY item_id'])
    sentinel_bytes=sentinel.read_bytes()
    secret=(folder/'storage/auth/secret.json').read_bytes()
    call(folder,'setup-db.php')
    after=mysql('upgrade-database',['--batch','--skip-column-names','-e','SELECT user_id,full_name,email,password_hash,role,created_at,updated_at FROM users ORDER BY user_id; SELECT * FROM items ORDER BY item_id'])
    assert before==after and sentinel.read_bytes()==sentinel_bytes and (folder/'storage/auth/secret.json').read_bytes()==secret
    checks.append('populated legacy upgrade preserves records, password hashes, timestamps, upload and auth secret')
    first=json.loads(call(folder,'fingerprint.php'));call(folder,'setup-db.php');assert json.loads(call(folder,'fingerprint.php'))==first
    assert json.loads(call(folder,'check-database.php'))['passed'];checks.append('repeat upgrade is idempotent and schema contract passes')
    avatar=folder/'storage/avatars'/('a'*32+'.jpg');subprocess.run(['php','-r',"$i=imagecreatetruecolor(512,512); imagejpeg($i,$argv[1],85);",str(avatar)],check=True);sql(folder,"UPDATE users SET avatar_path='avatars/"+'a'*32+".jpg' WHERE user_id=1")
    env=os.environ.copy();env['MYSQL_PWD']=os.environ['REFIND_DEV_DB_PASSWORD']
    dump=subprocess.check_output(['mariadb-dump','--host=upgrade-database','--user=refind_dev','--single-transaction','--skip-add-drop-table','refind_db_ui_ux_dev'],env=env)
    mysql('recovery-database',[],dump)
    restored=TEMP/'recovery'/'refind-dev';shutil.copytree(folder,restored);config(restored,'recovery-database')
    source=json.loads(call(folder,'fingerprint.php'));copy=json.loads(call(restored,'fingerprint.php'))
    assert source['tables']==copy['tables'] and source['schema_sha256']==copy['schema_sha256']
    for collection in ['items','evidence','claims','avatars','auth']:
        for p in (folder/'storage'/collection).glob('*'):
            if p.is_file():assert p.read_bytes()==(restored/'storage'/collection/p.name).read_bytes()
    assert json.loads(call(restored,'check-database.php'))['passed']
    assert json.loads(call(restored,'check-workflow.php'))['passed']
    checks.append('SQL, original media, avatars and auth secret recover on separate development service')
    (OUT/'results.json').write_text(json.dumps({'passed':True,'checks':checks},indent=2)+'\n')
    print(json.dumps({'passed':True,'checks':checks},indent=2))
finally:
    # Only this resolved, freshly generated temporary fixture is removed.
    assert TEMP.resolve().is_relative_to((ROOT/'storage/setup').resolve()) and TEMP.name.startswith('upgrade-')
    shutil.rmtree(TEMP)
