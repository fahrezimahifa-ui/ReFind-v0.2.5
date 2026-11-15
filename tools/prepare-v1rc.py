"""Provision the disposable v1.0.0 release-candidate QA environment (local only).

Scope: this worktree (folder `refind-v1-rc`), database `refind_db_v1rc_test`,
URL `/refind-v1-rc/`, session `refind_v1rc_test`, and this worktree's ignored
`storage/`. It never reads or writes the main installation, the persistent QA
corpus (`ReFind_0.2.0_Test`) or their databases.

It uses the local XAMPP `root` login that the main and QA installations already
use and never creates users or grants: on 14 Nov 2026 a GRANT hit a damaged
`mysql.db` privilege table and crashed the shared server. Isolation comes from
the exact config identity, the ownership marker and assert_v1rc_installation().
Set REFIND_V1RC_DB_PASSWORD only if root has a password. No password is printed.
"""
import base64
import json
import os
from pathlib import Path
import subprocess
from qa_safety import php_binary, reject_links

ROOT = Path(__file__).resolve().parents[1]
MARKER = ROOT / '.refind-v1-rc.json'
LOCAL = ROOT / 'app' / 'config.local.php'
IDENTITY = {'db_host': '127.0.0.1', 'db_port': 3306, 'db_name': 'refind_db_v1rc_test', 'db_user': 'root',
            'base_path': '/refind-v1-rc/', 'session_name': 'refind_v1rc_test'}
MARKER_VALUE = {'profile': 'v1-rc', 'database': 'refind_db_v1rc_test', 'scope': 'disposable synthetic release-candidate QA'}


def php(code, env=None):
    return subprocess.run([php_binary(), '-r', 'require $argv[1]; ' + code, str(ROOT / 'app/config.php')],
                          capture_output=True, text=True, env=env, cwd=ROOT)


def identity():
    # A JSON list of fixed key names is also a valid PHP array literal.
    result = php('$c=app_config(); echo json_encode(array_intersect_key($c, array_flip(%s)));' % json.dumps(list(IDENTITY)))
    if result.returncode:
        raise RuntimeError('The release-candidate configuration is invalid; inspect app/config.local.php.')
    return json.loads(result.stdout)


def main():
    if ROOT.name != 'refind-v1-rc':
        raise RuntimeError('Run only from the refind-v1-rc worktree')
    for relative in ['app', 'storage']:
        if (ROOT / relative).exists():
            reject_links(ROOT / relative)
    if MARKER.exists():
        if json.loads(MARKER.read_text(encoding='utf-8')) != MARKER_VALUE:
            raise RuntimeError('Unexpected release-candidate marker; inspect before provisioning.')
    if LOCAL.exists():
        if identity() != IDENTITY:
            raise RuntimeError('Existing local configuration does not select the release-candidate identity.')
    else:
        values = IDENTITY | {'db_password': os.environ.get('REFIND_V1RC_DB_PASSWORD', '')}
        encoded = base64.b64encode(json.dumps(values).encode()).decode()
        LOCAL.write_text("<?php\nreturn json_decode(base64_decode('" + encoded + "'), true, 32, JSON_THROW_ON_ERROR);\n",
                         encoding='utf-8')
        if identity() != IDENTITY:
            raise RuntimeError('Generated configuration failed validation.')
    if not MARKER.exists():
        MARKER.write_text(json.dumps(MARKER_VALUE) + '\n', encoding='utf-8')
    env = os.environ | {'REFIND_TEST_PROFILE': 'v1-rc'}
    guard = subprocess.run([php_binary(), str(ROOT / 'tools/qa-guard.php'), str(ROOT)], capture_output=True, env=env)
    if guard.returncode:
        raise RuntimeError('Release-candidate isolation check failed before provisioning.')
    for tool in ['setup-db.php', 'setup-demo.php']:
        step = subprocess.run([php_binary(), str(ROOT / 'tools' / tool)], env=env, cwd=ROOT, capture_output=True, text=True)
        if step.returncode:
            raise RuntimeError(tool + ' stopped: ' + step.stderr.strip()[:300])
        # setup-demo prints only emails and the private receipt path, never passwords.
        print(tool, 'OK')
    print(json.dumps({'release_candidate_qa_ready': True, 'url': 'http://localhost' + IDENTITY['base_path'],
                      'database': IDENTITY['db_name'], 'session': IDENTITY['session_name']}))


if __name__ == '__main__':
    main()
