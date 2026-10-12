"""Create/update this project's isolated _Test copy, without copying runtime secrets."""
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT.with_name('ReFind_0.2.0_Test')
MARKER = TARGET / '.refind-b02-test.json'
FOLDERS = ['app', 'api', 'css', 'js', 'assets', 'vendor', 'database', 'docs', 'tools/demo-photos']
FILES = ['.htaccess', 'page.php', 'tools/.htaccess', 'tools/setup-db.php', 'tools/setup-demo.php', 'tools/b02-fixture.php', 'tools/check-database.php', 'tools/check-workflow.php', 'tools/seed-student-demo.php', 'tools/seed-expanded-demo.php', 'tools/demo-summary.php']

if not ROOT.parent.is_dir() or TARGET.name != 'ReFind_0.2.0_Test':
    raise RuntimeError('Unexpected test parent/name')
if TARGET.exists():
    if not MARKER.is_file() or json.loads(MARKER.read_text())['source'] != str(ROOT):
        raise RuntimeError('Existing test folder is not owned by this project; inspect it first')
else:
    TARGET.mkdir()
    MARKER.write_text(json.dumps({'source': str(ROOT), 'scope': 'isolated B02 test copy'}) + '\n')
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
(TARGET / 'app' / 'config.local.php').write_text("<?php\nreturn ['db_name' => 'refind_db_0_2_0_test', 'base_path' => '/ReFind_0.2.0_Test/', 'session_name' => 'refind_020_test'];\n", encoding='utf-8')
for tool in ['setup-db.php', 'setup-demo.php']:
    subprocess.run([r'C:\xampp\php\php.exe', str(TARGET / 'tools' / tool)], check=True)
print('Isolated app/database ready:', TARGET)
