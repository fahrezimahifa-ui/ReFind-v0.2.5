"""Owned native rehearsal only. Never starts or changes main XAMPP services."""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import time

HARNESS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preparation', HARNESS/'tools/prepare-runtime-qa.py')
prep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)
DB_NAME = 'refind_db_0_2_0_test'


def load(root):
    root = root.absolute()
    prep.reject_redirects(root)
    logical = root
    root = root.resolve()
    prep.reject_redirects(root)
    parent = (Path(os.environ['LOCALAPPDATA'])/'ReFindRuntimeQA').resolve()
    if root.parent != parent or not re.fullmatch('security-modernization-[a-f0-9]{16}',root.name):
        raise RuntimeError('Unexpected native QA root')
    prep.reject_redirects(root/'.refind-runtime-qa.json')
    marker = json.loads((root/'.refind-runtime-qa.json').read_text(encoding='utf-8'))
    if Path(marker['root']).resolve() != root or marker['profile'] != 'runtime-upgrade':
        raise RuntimeError('Native QA ownership mismatch')
    marker.setdefault('logical_root',str(logical))
    marker['root']=str(root)
    save_marker(root,marker)
    source = Path(marker['source'])
    prep.reject_redirects(source)
    target = root/'www/ReFind_0.2.3'
    for relative in ['.native-state.local.json','conf/httpd.conf','conf/php.ini','conf/cli-guard.php','db/data','db-lts/data','www/ReFind_0.2.3/app/config.local.php']:
        prep.reject_redirects(root/relative)
    for name,digest in marker['source_manifest'].items():
        prep.reject_redirects(target/name)
        if prep.sha256(target/name)!=digest or prep.sha256(source/name)!=digest:raise RuntimeError('Frozen deployment source drift')
    for folder in ['app','storage','tools']:
        prep.reject_redirects(target/folder)
    return root, marker, source, target


def environment(root, source):
    return os.environ | {'NODE_PATH':r'C:\xampp\htdocs\ReFind_0.2.3\node_modules','PLAYWRIGHT_BROWSERS_PATH':str(root/'playwright-cache'),'LOCALAPPDATA':str(root.parent.parent),'REFIND_TEST_PROFILE':'runtime-upgrade','REFIND_RUNTIME_QA_ROOT':str(root),
        'REFIND_RUNTIME_QA_SOURCE':str(source),'REFIND_PHP':str(root/'php/php.exe'),
        'PHPRC':str(root/'conf'),'REFIND_PLAYWRIGHT_MODULE':r'C:\xampp\htdocs\ReFind_0.2.3\node_modules\playwright',
        'REFIND_SHARP_MODULE':r'C:\xampp\htdocs\ReFind_0.2.3\node_modules\sharp',
        'REFIND_AXE_MODULE':r'C:\xampp\htdocs\ReFind_0.2.3\node_modules\@axe-core\playwright'}


def configure(root, port, password,web_password=None):
    target = root/'www/ReFind_0.2.3'
    prep.reject_redirects(target/'app/config.local.php')
    prep.reject_redirects(root/'conf/cli-guard.php')
    prep.reject_redirects(root/'conf/php.ini')
    config = {'db_host':'127.0.0.1','db_port':port,'db_name':DB_NAME,'db_user':'refind_runtime_qa',
              'db_password':password,'base_path':'/ReFind_0.2.3/','session_name':'refind_runtime_upgrade_qa'}
    encoded = base64.b64encode(json.dumps(config).encode()).decode()
    code="<?php $c=json_decode(base64_decode('"+encoded+"'),true,32,JSON_THROW_ON_ERROR);"
    if web_password:
        if not re.fullmatch('[a-f0-9]{48}',web_password):raise RuntimeError('Unexpected synthetic web password shape')
        code+=" if(PHP_SAPI !== 'cli'){$c['db_user']='refind_runtime_dml';$c['db_password']='"+web_password+"';}"
    (target/'app/config.local.php').write_text(code+" return $c;\n", encoding='utf-8')
    code = "<?php\nif (PHP_SAPI === 'cli' && isset($_SERVER['SCRIPT_FILENAME'])) {\n"
    code += "$file = realpath($_SERVER['SCRIPT_FILENAME']); $tools = " + json.dumps((target/'tools').as_posix()) + ";\n"
    code += "if ($file && str_starts_with(str_replace('\\\\','/',$file), $tools.'/') && !in_array(basename($file), ['qa-guard.php','runtime-qa-guard.php'],true)) {\n"
    code += "require_once "+json.dumps((target/'app/config.php').as_posix())+";\nrequire_once "+json.dumps((target/'tools/qa-guard.php').as_posix())+";\n"
    code += "try { assert_qa_installation(app_root()); } catch (Throwable $e) { fwrite(STDERR, 'QA target must be the real isolated test directory. No fixture mutation performed.'.PHP_EOL); exit(1); }\n}}\n"
    (root/'conf/cli-guard.php').write_text(code, encoding='utf-8')
    ini = root/'conf/php.ini'
    text = '\n'.join(line for line in ini.read_text(encoding='utf-8').splitlines() if not line.startswith('auto_prepend_file='))
    ini.write_text(text+'\nauto_prepend_file="'+(root/'conf/cli-guard.php').as_posix()+'"\n', encoding='utf-8')


def save_marker(root, marker):
    (root/'.refind-runtime-qa.json').write_text(json.dumps(marker,indent=2)+'\n', encoding='utf-8')


def sync_harness(root, marker, source, target):
    names = subprocess.check_output(['git','--no-optional-locks','-C',str(source),'ls-files','--cached','-z']).decode().split('\0')
    names += ['tools/test-maintainability.cjs']
    copied = {}
    for name in sorted(set(names)):
        if not name or not (name.startswith(('tools/','database/')) or name=='docs/schema-contract.json'):
            continue
        src = source/name
        if not src.is_file(): continue
        prep.reject_redirects(src)
        dst = target/name
        prep.reject_redirects(dst)
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dst)
        copied[name] = prep.sha256(dst)
    for name in ['qa-guard.php','runtime-qa-guard.php','qa-runtime.cjs','setup-db.php','prepare-test.py']:
        shutil.copy2(HARNESS/'tools'/name,target/'tools'/name)
    for name in ['test-projection.php','profile-queries.php']:
        p=target/'tools'/name
        text=p.read_text(encoding='utf-8')
        first=text.index('require $target')
        text=text[:first]+"if (getenv('REFIND_TEST_PROFILE') === 'runtime-upgrade') { $target = (getenv('REFIND_RUNTIME_QA_ROOT') ?: '') . '/www/ReFind_0.2.3'; }\n"+text[first:]
        text=text.replace("require __DIR__ . '/qa-guard.php';", "require_once __DIR__ . '/qa-guard.php';")
        p.write_text(text, encoding='utf-8')
    marker['harness_source_manifest']=copied
    marker['harness_overlays']={name:prep.sha256(target/'tools'/name) for name in
        ['qa-guard.php','runtime-qa-guard.php','qa-runtime.cjs','setup-db.php','prepare-test.py','test-projection.php','profile-queries.php']}
    save_marker(root,marker)


def free_port(port):
    for family,address in [(socket.AF_INET,'127.0.0.1'),(socket.AF_INET6,'::1')]:
        with socket.socket(family,socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
            probe.bind((address,port))


def open_port(port):
    with socket.socket() as probe:
        probe.settimeout(.2)
        return probe.connect_ex(('127.0.0.1',port))==0


def database_binary(root, lts):
    return root/'mariadb/mariadb-11.4.13-winx64/bin' if lts else Path('C:/xampp/mysql/bin')


def sql(root, state, query, lts=False, initial=False):
    port=3313 if lts else 3312
    env=os.environ | {'MYSQL_PWD':'' if initial else state['root_password']}
    return subprocess.check_output([str(database_binary(root,lts)/'mysql.exe'),'--no-defaults',
        '--host=127.0.0.1','--port='+str(port),'--user=root','--default-character-set=utf8mb4','--batch','--raw','--skip-column-names'],
        input=query.encode(),env=env,stderr=subprocess.PIPE).decode()


def verify_server(root,state,lts=False,initial=False):
    port=3313 if lts else 3312
    expected=root/('db-lts/data' if lts else 'db/data')
    values=sql(root,state,'SELECT @@port,@@datadir;',lts,initial).strip().split('\t')
    if values[0]!=str(port) or Path(values[1]).resolve()!=expected.resolve():
        raise RuntimeError('Foreign server refused before mutation: port='+values[0]+'; datadir='+repr(values[1])+'; expected='+str(expected))


def start_db(root,state,lts=False,initial=False,tls=False):
    port=3313 if lts else 3312
    free_port(port)
    bin_path=database_binary(root,lts)
    data=root/('db-lts/data' if lts else 'db/data')
    prep.reject_redirects(data)
    if not data.is_dir(): raise RuntimeError('Owned initialized datadir required')
    tls_args=[]
    if tls:
        if not lts:raise RuntimeError('Explicit TLS qualification uses only the owned LTS server')
        for name in ['ca.pem','server.pem','server.key']:
            path=root/'tls'/name
            prep.reject_redirects(path)
            if not path.is_file():raise RuntimeError('Owned TLS material required')
        tls_args=['--ssl-ca='+str(root/'tls/ca.pem'),'--ssl-cert='+str(root/'tls/server.pem'),
                  '--ssl-key='+str(root/'tls/server.key'),'--tls-version=TLSv1.2,TLSv1.3']
    log=(root/'logs'/('lts-process.log' if lts else 'current-process.log')).open('ab')
    process=subprocess.Popen([str(bin_path/'mysqld.exe'),'--no-defaults','--basedir='+str(bin_path.parent),
        '--datadir='+str(data),'--port='+str(port),'--bind-address=127.0.0.1',
        '--pid-file='+str(root/'run'/('lts.pid' if lts else 'current.pid')),
        '--tmpdir='+str(root/'tmp'),'--skip-log-bin','--innodb-buffer-pool-size=64M',
        '--aria-pagecache-buffer-size=16M','--console',*tls_args],stdout=log,stderr=subprocess.STDOUT,
        cwd=root,creationflags=subprocess.CREATE_NO_WINDOW)
    log.close()
    try:
        for _ in range(150):
            if process.poll() is not None: raise RuntimeError('Owned MariaDB startup failed; inspect its private log')
            if open_port(port):
                verify_server(root,state,lts,initial)
                return process
            time.sleep(.2)
        raise RuntimeError('Owned MariaDB startup timeout')
    except Exception:
        if process.poll() is None: process.terminate();process.wait(timeout=20)
        raise


def stop_db(root,state,process,lts=False):
    if process.poll() is not None: return
    verify_server(root,state,lts)
    env=os.environ | {'MYSQL_PWD':state['root_password']}
    subprocess.run([str(database_binary(root,lts)/'mysqladmin.exe'),'--no-defaults','--host=127.0.0.1',
        '--port='+str(3313 if lts else 3312),'--user=root','shutdown'],env=env,check=True,capture_output=True)
    process.wait(timeout=30)


def initialize(root,marker,source,target,lts=False,bootstrap=True,setup_application=True):
    state_path=root/'.native-state.local.json'
    if not state_path.exists():
        encoded=re.search("base64_decode\\('([^']+)'\\)",(target/'app/config.local.php').read_text(encoding='utf-8'))[1]
        c=json.loads(base64.b64decode(encoded))
        if c['db_port']!=3312 or c['db_user']!='refind_runtime_qa':raise RuntimeError('Unexpected synthetic configuration')
        state={'password':c['db_password'],'root_password':secrets.token_hex(24)}
        state_path.write_text(json.dumps(state), encoding='utf-8')
    state=json.loads(state_path.read_text(encoding='utf-8'))
    if not all(re.fullmatch('[a-f0-9]{48}',state[k]) for k in ['password','root_password']):raise RuntimeError('Synthetic credential shape mismatch')
    data=root/('db-lts/data' if lts else 'db/data')
    prep.reject_redirects(data)
    free_port(3313 if lts else 3312)
    if bootstrap:
        if data.exists():raise RuntimeError('Refuse existing datadir initialization')
        data.parent.mkdir(exist_ok=True)
        install=database_binary(root,lts)/'mysql_install_db.exe'
        result=subprocess.run([str(install),'--datadir='+str(data),'--port='+str(3313 if lts else 3312)],
            capture_output=True,text=True,creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:raise RuntimeError('Synthetic datadir initialization failed')
    elif not data.is_dir():
        raise RuntimeError('Owned bootstrap datadir missing')
    process=start_db(root,state,lts,initial=True)
    configured=False
    try:
        verify_server(root,state,lts,True)
        if sql(root,state,"SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='"+DB_NAME+"';",lts,True).strip()!='0':raise RuntimeError('Refuse provisioning over existing application data')
        sql(root,state,"CREATE USER 'refind_runtime_qa'@'127.0.0.1' IDENTIFIED BY '"+state['password']+"'; GRANT ALL ON "+DB_NAME+".* TO 'refind_runtime_qa'@'127.0.0.1'; SET PASSWORD FOR 'root'@'localhost' = PASSWORD('"+state['root_password']+"');",lts,True)
        configured=True
        verify_server(root,state,lts)
        marker['phase']='qa-enabled';marker['fixture_mutations_enabled']=True
        save_marker(root,marker)
        configure(root,3313 if lts else 3312,state['password'])
        sync_harness(root,marker,source,target)
        env=environment(root,source)
        subprocess.run([str(root/'php/php.exe'),str(target/'tools/qa-guard.php'),str(target)],env=env,check=True,capture_output=True)
        if not lts and setup_application:
            for tool in ['setup-db.php','setup-demo.php','seed-student-demo.php','seed-expanded-demo.php']:
                result=subprocess.run([str(root/'php/php.exe'),str(target/'tools'/tool)],env=env,capture_output=True,text=True)
                if result.returncode:raise RuntimeError('Synthetic '+tool+' failed; '+result.stderr[:400])
                print(tool+' PASS',flush=True)
    finally:
        if configured:stop_db(root,state,process,lts)
        elif process.poll() is None:process.terminate();process.wait(timeout=20)
    return state


def full_test(root,marker,source,target,lts=False,remainder=False,appearance_only=False):
    state=json.loads((root/'.native-state.local.json').read_text(encoding='utf-8'))
    configure(root,3313 if lts else 3312,state['password'],state.get('runtime_password') if lts else None)
    sync_harness(root,marker,source,target)
    env=environment(root,source)
    env['REFIND_TESTED_SHA']=marker['source_sha256']
    env['REFIND_QA_RUN']=time.strftime('%Y%m%d-%H%M%S')+('-lts' if lts else '-current')
    process=start_db(root,state,lts)
    apache=None
    try:
        subprocess.run([str(root/'php/php.exe'),str(target/'tools/qa-guard.php'),str(target)],env=env,check=True,capture_output=True)
        free_port(8086)
        log=(root/'logs/apache-process.log').open('ab')
        apache=subprocess.Popen([str(root/'apache/Apache24/bin/httpd.exe'),'-f',str(root/'conf/httpd.conf')],
            cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
        log.close()
        for _ in range(100):
            if apache.poll() is not None:raise RuntimeError('Owned Apache stopped; inspect private logs')
            if open_port(8086):break
            time.sleep(.2)
        else:raise RuntimeError('Owned Apache start timeout')
        print('Owned database and Apache ready; main remains untouched.',flush=True)
        node=root/'node/node-v24.22.2-win-x64/node.exe'
        log_path=root/'logs'/('qa-'+env['REFIND_QA_RUN']+'.log')
        print('Regression log: '+str(log_path),flush=True)
        with log_path.open('w') as output:
            if appearance_only:
                result=subprocess.run([str(node),'tools/run-qa.cjs','--appearance-only'],cwd=target,env=env,stdout=output,stderr=subprocess.STDOUT)
            elif remainder:
                # Original assertions are unchanged; this runs only stages not yet completed.
                script = "const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'); const out=path.join('output/playwright/release-readiness/results',process.env.REFIND_QA_RUN);fs.mkdirSync(out,{recursive:true});const summary={testedSha:process.env.REFIND_TESTED_SHA,scope:'Remaining UI matrix stages after module-discovery correction; combine only with matching-source prior receipt',checks:[]};for(const name of ['ui-profile','glass-titles','menu-polish','maintainability','theme','appearance-subset']){const dir=path.resolve(out,name);fs.mkdirSync(dir,{recursive:true});const args=name==='appearance-subset'?['tools/run-qa.cjs','--appearance-only']:['tools/test-'+name+'.cjs'];const r=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,REFIND_EVIDENCE_DIR:dir,REFIND_QA_RUN:process.env.REFIND_QA_RUN+'-appearance'}});summary.checks.push({name,status:r.status===0?'PASS':'FAIL',exitCode:r.status});fs.writeFileSync(path.join(out,'remainder-summary.json'),JSON.stringify(summary,null,2));if(r.status!==0)process.exit(r.status||1);}"
                result=subprocess.run([str(node),'-e',script],cwd=target,env=env,stdout=output,stderr=subprocess.STDOUT)
            else:
                result=subprocess.run([str(node),'tools/run-qa.cjs'],cwd=target,env=env,stdout=output,stderr=subprocess.STDOUT)
        if result.returncode:raise RuntimeError('Native regression failed; retain receipt and fix before proceeding')
        print(('Appearance subset' if appearance_only else 'Remaining native' if remainder else 'Full native')+' '+('LTS' if lts else 'current')+' matrix PASS: '+env['REFIND_QA_RUN'],flush=True)
    finally:
        if apache and apache.poll() is None:
            subprocess.run(['taskkill','/PID',str(apache.pid),'/T','/F'],check=True,capture_output=True)
            apache.wait(timeout=20)
        stop_db(root,state,process,lts)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['init-current','init-lts','test-current','test-lts','test-current-remainder','test-current-appearance'])
    parser.add_argument('--qa-root',type=Path,required=True)
    args=parser.parse_args()
    root,marker,source,target=load(args.qa_root)
    if args.action.startswith('init'):initialize(root,marker,source,target,args.action.endswith('lts'))
    else:full_test(root,marker,source,target,args.action.endswith('lts'),args.action.endswith('remainder'),args.action.endswith('appearance'))

if __name__=='__main__':
    main()
