"""Create/update this project's isolated _Test copy, without copying runtime secrets."""
import json
from pathlib import Path
import shutil
import subprocess
import os
from qa_safety import php_binary, validate_target

ROOT = Path(__file__).resolve().parents[1]
if ROOT.name == 'refind-dev' or os.environ.get('REFIND_TEST_PROFILE') == 'ui-ux-dev':
    raise RuntimeError('Use the dedicated development services; legacy QA preparation is refused from refind-dev')
TARGET = ROOT.with_name('ReFind_0.2.0_Test')
MARKER = TARGET / '.refind-b02-test.json'
FOLDERS = ['app', 'api', 'css', 'js', 'assets', 'vendor', 'database', 'tools/demo-photos']
FILES = ['.htaccess', 'page.php', 'tools/.htaccess', 'tools/setup-db.php', 'tools/setup-demo.php', 'tools/b02-fixture.php', 'tools/qa-guard.php', 'tools/fingerprint.php', 'docs/schema-contract.json', 'tools/check-database.php', 'tools/check-workflow.php', 'tools/seed-student-demo.php', 'tools/seed-expanded-demo.php', 'tools/demo-summary.php', 'tools/refresh-matches.php']

validate_target(ROOT, TARGET)  # Check existing paths/configuration before any writes.
if not TARGET.exists():
    TARGET.mkdir()
    MARKER.write_text(json.dumps({'source': str(ROOT), 'scope': 'owned isolated QA'}) + '\n')
for folder in FOLDERS:
    for source in (ROOT / folder).rglob('*'):
        if not source.is_file() or '__pycache__' in source.parts or source.name == 'config.local.php':
            continue
        destination = TARGET / source.relative_to(ROOT)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
for relative in FILES:
    source = ROOT / relative
    if source.exists():
        destination = TARGET / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
local = TARGET / 'app' / 'config.local.php'
if not local.exists():
    overrides = {'db_name': 'refind_db_0_2_0_test', 'base_path': '/ReFind_0.2.0_Test/', 'session_name': 'refind_020_test'}
    for key, env in [('db_host', 'REFIND_QA_DB_HOST'), ('db_user', 'REFIND_QA_DB_USER'), ('db_password', 'REFIND_QA_DB_PASSWORD')]:
        if env in os.environ:
            overrides[key] = os.environ[env]
    if 'REFIND_QA_DB_PORT' in os.environ:
        overrides['db_port'] = int(os.environ['REFIND_QA_DB_PORT'])
    # A single-quoted base64 literal cannot interpolate credentials as PHP code.
    import base64
    encoded = base64.b64encode(json.dumps(overrides).encode()).decode()
    local.write_text("<?php\nreturn json_decode(base64_decode('" + encoded + "'), true, 32, JSON_THROW_ON_ERROR);\n", encoding='utf-8')
validate_target(ROOT, TARGET)
for tool in ['setup-db.php', 'setup-demo.php']:
    subprocess.run([php_binary(), str(TARGET / 'tools' / tool)], check=True)
print('Isolated QA ready; existing configuration and runtime files preserved.')
