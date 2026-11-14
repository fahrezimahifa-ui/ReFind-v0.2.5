"""Provision the disposable v1.0.0 release-candidate QA environment (local only).

Scope: this worktree (folder `refind-v1-rc`), database `refind_db_v1rc_test`,
MariaDB principal `refind_v1rc` granted on that database only, URL
`/refind-v1-rc/`, session `refind_v1rc_test`, and this worktree's ignored
`storage/`. It never reads or writes the main installation, the persistent
QA corpus (`ReFind_0.2.0_Test`) or their databases.

Admin access is used once, to create/align the scoped principal. Supply it with
REFIND_V1RC_ADMIN_USER / REFIND_V1RC_ADMIN_PASSWORD (defaults: XAMPP root, no
password). No password is printed.
"""
import base64
import json
import os
from pathlib import Path
import secrets
import subprocess
from qa_safety import php_binary, reject_links

ROOT = Path(__file__).resolve().parents[1]
MARKER = ROOT / '.refind-v1-rc.json'
LOCAL = ROOT / 'app' / 'config.local.php'
IDENTITY = {'db_host': '127.0.0.1', 'db_port': 3306, 'db_name': 'refind_db_v1rc_test', 'db_user': 'refind_v1rc',
            'base_path': '/refind-v1-rc/', 'session_name': 'refind_v1rc_test'}
MARKER_VALUE = {'profile': 'v1-rc', 'database': 'refind_db_v1rc_test', 'scope': 'disposable synthetic release-candidate QA'}
PROVISION = r'''
$c = app_config();
$admin = new mysqli('127.0.0.1', getenv('REFIND_V1RC_ADMIN_USER') ?: 'root', (string) getenv('REFIND_V1RC_ADMIN_PASSWORD'), '', 3306);
foreach (['localhost', '127.0.0.1'] as $host) {
    $exists = $admin->prepare('SELECT COUNT(*) FROM mysql.user WHERE User=? AND Host=?');
    $user = $c['db_user']; $exists->bind_param('ss', $user, $host); $exists->execute();
    $verb = $exists->get_result()->fetch_row()[0] ? 'ALTER' : 'CREATE';
    // Identifiers are the fixed values validated above; the password is escaped as a string literal.
    $admin->query($verb . " USER 'refind_v1rc'@'" . $host . "' IDENTIFIED BY '" . $admin->real_escape_string($c['db_password']) . "'");
    $admin->query("GRANT ALL PRIVILEGES ON `refind_db_v1rc_test`.* TO 'refind_v1rc'@'" . $host . "'");
}
$admin->close();
echo json_encode(['principal' => 'refind_v1rc', 'grant_scope' => 'refind_db_v1rc_test.*']), PHP_EOL;
'''


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
        values = IDENTITY | {'db_password': secrets.token_urlsafe(24)}
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
    result = php(PROVISION, env)
    if result.returncode:
        raise RuntimeError('Could not create the scoped database principal. Check the admin login variables.')
    print(result.stdout.strip())
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
