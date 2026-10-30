"""Owned XAMPP rehearsal: separate directory, credentials, sessions and MariaDB server3311."""
import argparse
import base64
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import time
from qa_safety import reject_links, php_binary

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT.with_name('refind-xampp-stage')
STATE = ROOT / '.xampp-stage.local.json'
BIN = Path('C:/xampp/mysql/bin')
PORT = 3311
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('action', choices=['init', 'sync', 'start', 'stop'])
args = parser.parse_args()
if os.name != 'nt' or ROOT.name != 'refind-dev' or ROOT.resolve() != ROOT:
    raise RuntimeError('Use the Windows refind-dev source worktree')

def port_open():
    with socket.socket() as probe:
        probe.settimeout(.5)
        return probe.connect_ex(('127.0.0.1', PORT)) == 0

def load():
    state = json.loads(STATE.read_text())
    marker = json.loads((TARGET/'.refind-xampp-stage.json').read_text())
    if state['target'] != str(TARGET) or marker != {'profile':'xampp-stage','source':str(ROOT),'port':PORT}:
        raise RuntimeError('Staging ownership mismatch')
    reject_links(TARGET)
    return state

def mysql(state, query):
    env = os.environ.copy()
    env['MYSQL_PWD'] = state['root_password']
    return subprocess.check_output([str(BIN/'mysql.exe'),'--no-defaults','--host=127.0.0.1','--port='+str(PORT),'--user=root','--batch','--skip-column-names'],input=query.encode(),env=env,stderr=subprocess.PIPE).decode()

def verify_server(state):
    values = mysql(state,'SELECT @@port,@@datadir;').strip().split('\t')
    if values[0] != str(PORT) or Path(values[1]).resolve() != Path(state['data']).resolve():
        raise RuntimeError('Foreign MariaDB server; no mutation performed')

def start(state, initial=False):
    if port_open():
        if initial: raise RuntimeError('Port3311 is occupied')
        verify_server(state)
        return
    data = Path(state['data'])
    with (data.parent/'server.log').open('ab') as log:
        process = subprocess.Popen([str(BIN/'mysqld.exe'),'--no-defaults','--basedir='+str(BIN.parent),'--datadir='+str(data),'--port='+str(PORT),'--bind-address=127.0.0.1','--skip-log-bin','--innodb-buffer-pool-size=64M','--console'],cwd=data.parent,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
    for _ in range(100):
        if process.poll() is not None: raise RuntimeError('Staging MariaDB stopped; inspect private server log')
        if port_open(): break
        time.sleep(.2)
    else: raise RuntimeError('Staging MariaDB startup timed out')
    if not initial: verify_server(state)

def sync(state):
    names = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
    for name in names:
        source = ROOT/name
        if not name or not source.is_file() or name == 'app/config.local.php': continue
        target = TARGET/name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,target)
    overrides = {'db_host':'127.0.0.1','db_port':PORT,'db_name':'refind_db_0_2_0_test','db_user':'refind_stage','db_password':state['password'],'base_path':'/refind-xampp-stage/','session_name':'refind_xampp_stage'}
    local = TARGET/'app/config.local.php'
    encoded = base64.b64encode(json.dumps(overrides).encode()).decode()
    expected = "<?php return json_decode(base64_decode('"+encoded+"'),true,32,JSON_THROW_ON_ERROR);\n"
    if local.exists() and local.read_text() != expected: raise RuntimeError('Existing staging configuration differs')
    local.write_text(expected)
    env = os.environ.copy();env['REFIND_TEST_PROFILE']='xampp-stage'
    subprocess.run([php_binary(),str(ROOT/'tools/qa-guard.php'),str(TARGET)],env=env,check=True,capture_output=True)

if args.action == 'init':
    if TARGET.exists() or STATE.exists() or port_open(): raise RuntimeError('Staging destination, state or port already exists')
    reject_links(ROOT/'app')
    private = Path(os.environ['LOCALAPPDATA'])/'ReFind'/'staging'/secrets.token_hex(8)
    private.mkdir(parents=True,exist_ok=False)
    subprocess.run(['icacls',str(private),'/inheritance:r','/grant:r',os.environ['USERNAME']+':(OI)(CI)F','SYSTEM:(OI)(CI)F'],check=True,capture_output=True)
    data = private/'mariadb'
    subprocess.run([str(BIN/'mysql_install_db.exe'),'--datadir='+str(data),'--port='+str(PORT)],check=True,capture_output=True)
    state = {'target':str(TARGET),'data':str(data),'password':secrets.token_hex(24),'root_password':secrets.token_hex(24)}
    initial = state | {'root_password':''}
    start(initial,initial=True)
    query = "CREATE USER 'refind_stage'@'127.0.0.1' IDENTIFIED BY '"+state['password']+"'; GRANT ALL ON `refind_db_0_2_0_test`.* TO 'refind_stage'@'127.0.0.1'; SET PASSWORD FOR 'root'@'localhost' = PASSWORD('"+state['root_password']+"');"
    mysql(initial,query)
    verify_server(state)
    TARGET.mkdir()
    (TARGET/'.refind-xampp-stage.json').write_text(json.dumps({'profile':'xampp-stage','source':str(ROOT),'port':PORT})+'\n')
    STATE.write_text(json.dumps(state))
    sync(state)
    print('Owned XAMPP staging created; MariaDB3311 verified. No main/QA setup performed.')
else:
    state = load()
    if args.action == 'sync': sync(state)
    elif args.action == 'start': start(state)
    elif port_open():
        verify_server(state)
        env = os.environ.copy();env['MYSQL_PWD']=state['root_password']
        subprocess.run([str(BIN/'mysqladmin.exe'),'--no-defaults','--host=127.0.0.1','--port='+str(PORT),'--user=root','shutdown'],env=env,check=True,capture_output=True)
    print('Staging '+args.action+' complete.')
