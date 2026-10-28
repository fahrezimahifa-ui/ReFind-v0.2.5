"""Private SQL + runtime snapshot; the operator must first pause application writes."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
from qa_safety import php_binary
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--writes-paused', action='store_true', help='Confirm all application writers are paused for the entire snapshot')
args = parser.parse_args()
if not args.writes_paused:
    parser.error('Pause application writes, then explicitly supply --writes-paused. No backup was started.')
PHP = php_binary()
config = json.loads(subprocess.check_output([PHP, '-r', "require 'app/config.php'; echo json_encode(app_config());"], cwd=ROOT))
if config['db_name'] != 'refind_db_0_2_0' or config['db_port'] != 3306:
    raise RuntimeError('This checkpoint backs up the main demo only')
parent = ROOT / 'storage' / 'setup'
if not parent.is_dir():
    raise RuntimeError('Run application setup before backup')
target = parent / 'backups' / ('release-before-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
target.mkdir(mode=0o700, parents=True, exist_ok=False)
sql = target / 'database.sql'
env = os.environ.copy()
env['MYSQL_PWD'] = config['db_password']
subprocess.run([r'C:\xampp\mysql\bin\mysqldump.exe', '--host=' + config['db_host'], '--port=' + str(config['db_port']),
                '--user=' + config['db_user'], '--single-transaction', '--routines', '--triggers', '--skip-add-drop-table',
                '--result-file=' + str(sql), config['db_name']], env=env, check=True)
archive = target / 'storage.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for file in (ROOT / 'storage').rglob('*'):
        if file.is_file() and 'backups' not in file.relative_to(ROOT / 'storage').parts:
            bundle.write(file, file.relative_to(ROOT))
    if (ROOT / 'app/config.local.php').is_file():
        bundle.write(ROOT / 'app/config.local.php', 'app/config.local.php')
receipt = {'scope': 'Private main SQL + storage + local configuration; operator confirmed writes paused', 'database': config['db_name'],
           'files': {file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in (sql, archive)}}
(target / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'backup': str(target), 'database': config['db_name'], 'private': True, 'sql_and_storage': True}, indent=2))
