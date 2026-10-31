"""Fresh install/idempotence/restore proof, restricted to the two disposable CI services."""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile
from qa_safety import php_binary, validate_target

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT.with_name('ReFind_0.2.0_Test')
if os.environ.get('REFIND_CI_DISPOSABLE') != '1' or os.environ.get('REFIND_QA_DB_HOST') != 'database' or os.environ.get('REFIND_QA_DB_USER') != 'refind_qa':
    raise RuntimeError('Recovery proof requires the dedicated disposable Compose services')
validate_target(ROOT, TARGET)
OUT = ROOT / 'output/playwright/release-readiness/results/recovery'
OUT.mkdir(parents=True, exist_ok=True)
PRIVATE = Path(tempfile.mkdtemp(prefix='owned-recovery-', dir=TARGET / 'storage/setup'))
result = {'scope': 'Fresh disposable CI installation and restoration into a second empty database service', 'checks': {}}


def tool(folder, name):
    run = subprocess.run([php_binary(), str(folder / 'tools' / name)], cwd=folder, capture_output=True)
    if run.returncode:
        raise RuntimeError('Disposable verification failed: ' + name)
    return json.loads(run.stdout)


def mysql(host, query=None, dump=False, data=None):
    command = ['mariadb-dump' if dump else 'mariadb', '--host=' + host, '--user=refind_qa']
    if dump:
        command += ['--single-transaction', '--skip-add-drop-table', '--skip-comments', '--skip-add-locks', '--skip-disable-keys']
    elif query:
        command += ['--batch', '--skip-column-names', '-e', query]
    command += ['refind_db_0_2_0_test']
    run = subprocess.run(command, input=data, capture_output=True, env=os.environ | {'MYSQL_PWD': os.environ['REFIND_QA_DB_PASSWORD']})
    if run.returncode:
        raise RuntimeError('Disposable database backup/restore command failed')
    return run.stdout


def media(folder):
    return {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest() for collection in ['items', 'evidence', 'claims', 'avatars'] for p in (folder / 'storage' / collection).glob('*') if p.is_file()}


try:
    empty = mysql('database', 'SELECT (SELECT COUNT(*) FROM users)=3 AND (SELECT COUNT(*) FROM items)=0 AND (SELECT COUNT(*) FROM claims)=0 AND (SELECT COUNT(*) FROM notifications)=0').strip()
    if empty != b'1':
        raise RuntimeError('Fresh-install proof refuses a populated installation')
    before = tool(TARGET, 'fingerprint.php')
    tool(TARGET, 'setup-db.php')
    tool(TARGET, 'setup-demo.php')
    result['checks']['setup_idempotent_credentials_and_secret_preserved'] = tool(TARGET, 'fingerprint.php') == before
    tool(TARGET, 'seed-student-demo.php')
    tool(TARGET, 'seed-expanded-demo.php')
    source = tool(TARGET, 'fingerprint.php')
    schema = tool(TARGET, 'check-database.php')
    workflow = tool(TARGET, 'check-workflow.php')
    result['checks']['fresh_schema'] = schema['passed']
    result['checks']['fresh_workflow_and_media'] = workflow['passed']
    dump = mysql('database', dump=True)
    (PRIVATE / 'database.sql').write_bytes(dump)
    archive = PRIVATE / 'private-media.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for relative in media(TARGET):
            bundle.write(TARGET / relative, relative)
        bundle.write(TARGET / 'storage/auth/secret.json', 'storage/auth/secret.json')
    # The second service is newly created and must still be empty. No DROP/DELETE is used.
    absent = mysql('restore-database', "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()").strip()
    if absent != b'0':
        raise RuntimeError('Restore destination is not empty; existing data retained')
    mysql('restore-database', data=dump)
    restored = PRIVATE / 'restored-install'
    restored.mkdir()
    for folder in ['app', 'database']:
        shutil.copytree(TARGET / folder, restored / folder, ignore=shutil.ignore_patterns('config.local.php'))
    (restored / 'tools').mkdir()
    for name in ['fingerprint.php', 'check-database.php', 'check-workflow.php']:
        shutil.copy2(TARGET / 'tools' / name, restored / 'tools' / name)
    (restored / 'docs').mkdir()
    shutil.copy2(ROOT / 'docs/schema-contract.json', restored / 'docs/schema-contract.json')
    config = {'db_name': 'refind_db_0_2_0_test', 'db_host': 'restore-database', 'db_user': 'refind_qa', 'db_password': os.environ['REFIND_QA_DB_PASSWORD'], 'session_name': 'refind_020_restore'}
    encoded = base64.b64encode(json.dumps(config).encode()).decode()
    (restored / 'app/config.local.php').write_text("<?php return json_decode(base64_decode('" + encoded + "'),true);", encoding='utf-8')
    with zipfile.ZipFile(archive) as bundle:
        # This archive was just built from the fixed collection paths above.
        bundle.extractall(restored)
    copy = tool(restored, 'fingerprint.php')
    result['checks']['restored_all_table_data_and_schema'] = source['tables'] == copy['tables'] and source['schema_sha256'] == copy['schema_sha256']
    result['checks']['restored_media_bytes'] = media(TARGET) == media(restored)
    result['checks']['restored_secret'] = (TARGET / 'storage/auth/secret.json').read_bytes() == (restored / 'storage/auth/secret.json').read_bytes()
    result['checks']['restored_schema_and_workflow'] = tool(restored, 'check-database.php')['passed'] and tool(restored, 'check-workflow.php')['passed']
    result['checks']['source_unchanged_by_restore'] = tool(TARGET, 'fingerprint.php') == source
    result['passed'] = all(result['checks'].values())
    if not result['passed']:
        raise RuntimeError('Disposable recovery proof failed')
finally:
    # Private SQL/media/secret snapshots stay inside the disposable container, outside collected artifacts.
    (OUT / 'recovery-results.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print('PASS disposable fresh installation and recovery: ' + str(len(result['checks'])) + ' checks')
