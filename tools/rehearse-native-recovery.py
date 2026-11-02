"""Synthetic-only logical migration and matched backup/restore rehearsal."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import time
import zipfile

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('native',HERE/'run-native-qa.py')
qa=importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


def row_digest(rows):
    # The 10.4 Windows client emits CRLF; 11.4 emits LF. Normalize only record delimiters.
    return hashlib.sha256(rows.replace('\r\n','\n').replace('\n','\r\n').encode()).hexdigest()


def fingerprints(root,state,lts=False):
    contract=json.loads((root/'www/ReFind_0.2.3/docs/schema-contract.json').read_text())
    result={}
    for table, definition in contract['tables'].items():
        if not table.replace('_','').isalnum():raise RuntimeError('Unexpected table identifier')
        columns=[c['name'] for c in definition['columns']]
        if not all(c.replace('_','').isalnum() for c in columns):raise RuntimeError('Unexpected column identifier')
        query='SELECT JSON_ARRAY('+','.join(columns)+') FROM '+table+' ORDER BY '+columns[0]+';'
        rows=qa.sql(root,state,'USE '+qa.DB_NAME+'; '+query,lts)
        count=qa.sql(root,state,'SELECT COUNT(*) FROM '+qa.DB_NAME+'.'+table+';',lts).strip()
        result[table]={'rows':int(count),'sha256':row_digest(rows)}
    return result


def checks(root,source,target):
    env=qa.environment(root,source)
    for tool in ['check-database.php','check-workflow.php']:
        result=subprocess.run([str(root/'php/php.exe'),str(target/'tools'/tool)],env=env,capture_output=True,text=True)
        if result.returncode or not json.loads(result.stdout)['passed']:raise RuntimeError(tool+' failed')
        print(tool+' PASS',flush=True)


def capture(root,marker,source,target):
    qa.free_port(8086)  # All HTTP writers must be stopped during the matched snapshot.
    state=json.loads((root/'.native-state.local.json').read_text())
    qa.configure(root,3312,state['password']);qa.sync_harness(root,marker,source,target)
    process=qa.start_db(root,state)
    try:
        env=qa.environment(root,source)
        for tool in ['seed-student-demo.php','seed-expanded-demo.php']:
            result=subprocess.run([str(root/'php/php.exe'),str(target/'tools'/tool)],env=env,capture_output=True,text=True)
            if result.returncode:raise RuntimeError('Synthetic '+tool+' failed: '+result.stderr[:300])
            print(tool+' PASS',flush=True)
        checks(root,source,target)
        directory=root/'backups'/('synthetic-'+time.strftime('%Y%m%d-%H%M%S'))
        directory.mkdir(parents=True,exist_ok=False)
        dump=directory/'database.sql'
        env=os.environ|{'MYSQL_PWD':state['root_password']}
        subprocess.run([str(qa.database_binary(root,False)/'mysqldump.exe'),'--no-defaults','--host=127.0.0.1',
            '--port=3312','--user=root','--default-character-set=utf8mb4','--single-transaction','--routines',
            '--triggers','--hex-blob','--skip-add-drop-table','--result-file='+str(dump),qa.DB_NAME],
            env=env,check=True,capture_output=True)
        files={}
        archive=directory/'storage-config.zip'
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
            paths=list((target/'storage').rglob('*'))+[target/'app/config.local.php']
            for p in paths:
                qa.prep.reject_redirects(p)
                if not p.is_file():continue
                name=p.relative_to(target).as_posix()
                files[name]=qa.prep.sha256(p)
                z.write(p,name)
        receipt={'synthetic_only':True,'source_root':str(root),'writers_paused':True,
            'database':qa.DB_NAME,'source_sha256':marker['source_sha256'],
            'artifacts':{p.name:qa.prep.sha256(p) for p in [dump,archive]},
            'runtime_files':files,'tables':fingerprints(root,state)}
        (directory/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
        print(json.dumps({'backup':str(directory),'tables':len(receipt['tables']),
            'rows':sum(v['rows'] for v in receipt['tables'].values()),'runtime_files':len(files)}),flush=True)
        return directory
    finally:qa.stop_db(root,state,process)


def verified_backup(root,directory):
    qa.prep.reject_redirects(directory)
    directory=directory.resolve()
    if directory.parent!=root/'backups':raise RuntimeError('Only this owned synthetic backup is accepted')
    qa.prep.reject_redirects(directory/'receipt.json')
    receipt=json.loads((directory/'receipt.json').read_text())
    if receipt.get('synthetic_only') is not True or receipt.get('source_root')!=str(root) or receipt.get('writers_paused') is not True or receipt.get('database')!=qa.DB_NAME:
        raise RuntimeError('Foreign backup refused')
    if set(receipt['artifacts'])!={'database.sql','storage-config.zip'}:raise RuntimeError('Unexpected backup artifact set')
    for name,digest in receipt['artifacts'].items():
        qa.prep.reject_redirects(directory/name)
        qa.prep.check_digest(directory/name,digest)
    return receipt


def import_dump(root,state,directory,lts=False):
    qa.verify_server(root,state,lts)
    count=qa.sql(root,state,"SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='"+qa.DB_NAME+"';",lts).strip()
    if count!='0':raise RuntimeError('Import destination must be an empty owned database')
    qa.sql(root,state,'CREATE DATABASE IF NOT EXISTS '+qa.DB_NAME+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',lts)
    env=os.environ|{'MYSQL_PWD':state['root_password']}
    with (directory/'database.sql').open('rb') as dump:
        subprocess.run([str(qa.database_binary(root,lts)/'mysql.exe'),'--no-defaults','--host=127.0.0.1',
            '--port='+str(3313 if lts else 3312),'--user=root','--default-character-set=utf8mb4',
            '--binary-mode=1',qa.DB_NAME],stdin=dump,env=env,check=True,capture_output=True)


def migrate_lts(root,marker,source,target,directory,verify_only=False):
    receipt=verified_backup(root,directory)
    if not (root/'db-lts/data').exists():qa.initialize(root,marker,source,target,lts=True)
    state=json.loads((root/'.native-state.local.json').read_text())
    qa.configure(root,3313,state['password'])
    process=qa.start_db(root,state,lts=True)
    try:
        if not verify_only:import_dump(root,state,directory,lts=True)
        if fingerprints(root,state,True)!=receipt['tables']:raise RuntimeError('LTS logical data fingerprint mismatch')
        checks(root,source,target)
        (directory/'lts-import-receipt.json').write_text(json.dumps({'synthetic_only':True,'port':3313,
            'logical_data_identical':True,'schema_and_workflow_passed':True},indent=2)+'\n')
        print('MariaDB 11.4 logical import, all table values/hashes and invariants PASS',flush=True)
    finally:qa.stop_db(root,state,process,True)


def restore_old(root,marker,source,target,directory):
    receipt=verified_backup(root,directory)
    qa.free_port(8086);qa.free_port(3312)
    created=qa.prep.prepare(source,download=False)
    fresh,newmarker,newsource,newtarget=qa.load(Path(created['root']))
    if newmarker['source_sha256']!=receipt['source_sha256']:raise RuntimeError('Source drift during restore preparation')
    shutil.copytree(root/'php',fresh/'php')
    state=json.loads((root/'.native-state.local.json').read_text())
    (fresh/'.native-state.local.json').write_text(json.dumps({'password':state['password'],'root_password':secrets.token_hex(24)}))
    for name,content in qa.prep.render_configs(fresh).items():(fresh/'conf'/name).write_text(content)
    qa.initialize(fresh,newmarker,newsource,newtarget,setup_application=False)
    newstate=json.loads((fresh/'.native-state.local.json').read_text())
    with zipfile.ZipFile(directory/'storage-config.zip') as bundle:
        if set(bundle.namelist())!=set(receipt['runtime_files']):raise RuntimeError('Archive/receipt manifest mismatch')
    stage=fresh/'restore-archive'
    qa.prep.safe_extract(directory/'storage-config.zip',stage)
    for name,digest in receipt['runtime_files'].items():
        p=stage/name;qa.prep.check_digest(p,digest)
        if not (name.startswith('storage/') or name=='app/config.local.php'):raise RuntimeError('Unexpected restore path')
        dst=newtarget/name;qa.prep.reject_redirects(dst)
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,dst)
    process=qa.start_db(fresh,newstate)
    try:
        import_dump(fresh,newstate,directory)
        if fingerprints(fresh,newstate)!=receipt['tables']:raise RuntimeError('Restored logical data fingerprint mismatch')
        if any(qa.prep.sha256(newtarget/n)!=h for n,h in receipt['runtime_files'].items()):raise RuntimeError('Restored media/config/session hash mismatch')
        checks(fresh,newsource,newtarget)
        result={'synthetic_only':True,'restore_root':str(fresh),'old_version':'10.4.32',
            'logical_data_identical':True,'all_runtime_files_identical':True,'schema_and_workflow_passed':True,
            'no_raw_datadir_copy':True}
        (directory/'old-restore-receipt.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result),flush=True)
    finally:qa.stop_db(fresh,newstate,process)


def provision_runtime_principal(root,marker,source,target):
    state=json.loads((root/'.native-state.local.json').read_text())
    process=qa.start_db(root,state,lts=True)
    try:
        qa.verify_server(root,state,True)
        existing=qa.sql(root,state,"SELECT COUNT(*) FROM mysql.user WHERE User='refind_runtime_dml' AND Host='127.0.0.1';",True).strip()!='0'
        if existing and 'runtime_password' not in state:raise RuntimeError('Refuse unowned existing runtime principal')
        if 'runtime_password' not in state:
            state['runtime_password']=secrets.token_hex(24)
            (root/'.native-state.local.json').write_text(json.dumps(state))
        if not existing:
            qa.sql(root,state,"CREATE USER 'refind_runtime_dml'@'127.0.0.1' IDENTIFIED BY '"+state['runtime_password']+"'; GRANT SELECT, INSERT, UPDATE, DELETE ON "+qa.DB_NAME+".* TO 'refind_runtime_dml'@'127.0.0.1';",True)
        grantee="CONCAT(CHAR(39),'refind_runtime_dml',CHAR(39),'@',CHAR(39),'127.0.0.1',CHAR(39))"
        privileges=qa.sql(root,state,"SELECT PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE="+grantee+" AND TABLE_SCHEMA='"+qa.DB_NAME+"' ORDER BY PRIVILEGE_TYPE;",True).splitlines()
        global_privileges=qa.sql(root,state,"SELECT PRIVILEGE_TYPE FROM information_schema.USER_PRIVILEGES WHERE GRANTEE="+grantee+";",True).splitlines()
        if set(privileges)!={'SELECT','INSERT','UPDATE','DELETE'} or set(global_privileges)-{'USAGE'}:raise RuntimeError('Unexpected runtime privileges')
        env=os.environ|{'MYSQL_PWD':state['runtime_password']}
        result=subprocess.run([str(qa.database_binary(root,True)/'mysql.exe'),'--no-defaults','--host=127.0.0.1','--port=3313','--user=refind_runtime_dml',qa.DB_NAME],input=b'CREATE TABLE security_must_not_create(id INT);',env=env,capture_output=True)
        if result.returncode==0:
            qa.sql(root,state,'DROP TABLE '+qa.DB_NAME+'.security_must_not_create;',True)
            raise RuntimeError('Runtime principal unexpectedly created a table')
        if b'1142' not in result.stderr:raise RuntimeError('DDL denial test failed for an unexpected reason')
        qa.configure(root,3313,state['password'],state['runtime_password'])
        checks(root,source,target)
        receipt={'synthetic_only':True,'port':3313,'runtime_user':'refind_runtime_dml','web_privileges':sorted(privileges),'global_privileges':global_privileges,'create_table_denied':True,'fixture_principal_separate':True}
        (root/'logs/native-principal-result.json').write_text(json.dumps(receipt,indent=2)+'\n')
        print(json.dumps(receipt),flush=True)
    finally:qa.stop_db(root,state,process,True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['capture','lts-import','verify-lts','restore-old','runtime-principal'])
    parser.add_argument('--qa-root',type=Path,required=True)
    parser.add_argument('--backup',type=Path)
    args=parser.parse_args()
    root,marker,source,target=qa.load(args.qa_root)
    if args.action=='capture':capture(root,marker,source,target)
    elif args.action=='runtime-principal':provision_runtime_principal(root,marker,source,target)
    elif not args.backup:parser.error('--backup is required')
    elif args.action in ['lts-import','verify-lts']:migrate_lts(root,marker,source,target,args.backup,verify_only=args.action=='verify-lts')
    else:restore_old(root,marker,source,target,args.backup)

if __name__=='__main__':
    main()
