"""Initialize private files for the owned UI/profile development worktree only."""
from pathlib import Path
import json
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]
if ROOT.name != 'refind-dev' or ROOT.is_symlink() or getattr(ROOT, 'is_junction', lambda: False)():
    raise RuntimeError('Use the separate refind-dev Git worktree')
branch = subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip()
if branch != 'codex/ui-ux-profile-enhancements':
    raise RuntimeError('Unexpected development branch')
for name in ['app', 'storage', 'storage/auth', 'storage/sessions', 'storage/setup', 'storage/items', 'storage/evidence', 'storage/claims', 'storage/avatars']:
    folder = ROOT / name
    if folder.is_symlink() or getattr(folder, 'is_junction', lambda: False)():
        raise RuntimeError('Development paths cannot redirect elsewhere')
marker = {'profile': 'ui-ux-dev', 'project': 'refind-ui-ux-dev', 'root_name': 'refind-dev'}
path = ROOT / '.refind-dev.json'
if path.exists():
    existing = json.loads(path.read_text())
    if any(existing.get(k) != v for k, v in marker.items()):
        raise RuntimeError('Foreign development marker')
else:
    path.write_text(json.dumps(marker) + '\n')
env = ROOT / '.dev.env'
if not env.exists():
    env.write_text('REFIND_DEV_DB_PASSWORD=' + secrets.token_hex(24) + '\n')
config = ROOT / 'app/config.local.php'
expected = "<?php\nreturn ['db_host'=>'database','db_name'=>'refind_db_ui_ux_dev','db_user'=>'refind_dev','db_password'=>getenv('REFIND_DEV_DB_PASSWORD') ?: '', 'base_path'=>'/refind-dev/','session_name'=>'refind_ui_ux_dev'];\n"
if config.exists() and config.read_text() != expected:
    raise RuntimeError('Existing development configuration differs; it was preserved')
if not config.exists():
    config.write_text(expected)
print('Private development identity ready; no existing installation was read or modified.')
