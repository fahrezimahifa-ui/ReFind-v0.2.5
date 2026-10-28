"""Read-only preflight shared by QA preparation and its regression tests."""
import json
import os
from pathlib import Path
import shutil
import subprocess


def php_binary():
    binary = os.environ.get('REFIND_PHP')
    if binary:
        return binary
    xampp = Path('C:/xampp/php/php.exe')
    return str(xampp) if xampp.is_file() else (shutil.which('php') or 'php')


def reject_links(path):
    """Reject junctions/symlinks before copying into an existing tree."""
    if path.is_symlink() or getattr(path, 'is_junction', lambda: False)():
        raise RuntimeError('QA paths cannot contain filesystem links')
    if path.is_dir():
        for child in path.iterdir():
            reject_links(child)


def read_identity(folder):
    # Never serialize the complete config: passwords must stay out of diagnostics.
    code = 'require $argv[1]; $c=app_config(); echo json_encode(array_intersect_key($c,array_flip(["db_name","db_host","db_port","base_path","session_name"])));'
    result = subprocess.run([php_binary(), '-r', code, str(folder / 'app/config.php')], capture_output=True)
    if result.returncode:
        raise RuntimeError('Cannot validate application configuration')
    return json.loads(result.stdout)


def validate_target(root, target):
    if target.name != 'ReFind_0.2.0_Test' or target.parent.resolve() != root.parent.resolve() or target.resolve() == root.resolve():
        raise RuntimeError('Unexpected QA target')
    if target.exists():
        reject_links(target)
        marker = target / '.refind-b02-test.json'
        if not marker.is_file() or Path(json.loads(marker.read_text())['source']).resolve() != root.resolve():
            raise RuntimeError('Existing QA folder is not owned by this source')
        identity = read_identity(target)
        if identity['db_name'] != 'refind_db_0_2_0_test' or identity['base_path'] != '/ReFind_0.2.0_Test/' or identity['session_name'] != 'refind_020_test':
            raise RuntimeError('QA configuration must select the isolated database, URL and session')
        if identity['session_name'] == read_identity(root)['session_name']:
            raise RuntimeError('Source and QA must not share a session name')
