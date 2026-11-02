"""Prepare an inert, owned Windows-native QA tree. Never starts services or databases."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import ntpath
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import stat
import subprocess
import urllib.request
import urllib.parse
import urllib.error
import zipfile

HARNESS = Path(__file__).resolve().parents[1]
PROFILE = 'runtime-upgrade'
PORTS = (8086, 8446, 3312)
COLLECTIONS = ('auth', 'sessions', 'setup', 'items', 'evidence', 'claims', 'avatars')


def reject_redirects(path):
    """Check every ancestor, including junctions (Python 3.12+ required on Windows)."""
    for part in (path, *path.parents):
        if part.is_symlink() or part.is_junction():
            raise RuntimeError('Filesystem links are refused')


def ensure_unused_ports():
    # Binding checks IPv4 and IPv6; no connection to any existing service.
    for port in PORTS:
        for family, address in ((socket.AF_INET, '127.0.0.1'), (socket.AF_INET6, '::1')):
            with socket.socket(family, socket.SOCK_STREAM) as probe:
                if os.name == 'nt':
                    probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                probe.bind((address, port))


def sha256(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def check_digest(path, expected):
    if not re.fullmatch('[a-f0-9]{64}', expected) or sha256(path) != expected:
        raise RuntimeError('Package SHA256 mismatch; do not execute or extract it')


def safe_extract(archive, destination):
    """Validate the complete ZIP before writing any archive member."""
    if destination.exists():
        raise RuntimeError('Extraction destination already exists')
    reject_redirects(destination.parent)
    with zipfile.ZipFile(archive) as z:
        members = []
        seen = set()
        if len(z.infolist()) > 50000 or sum(i.file_size for i in z.infolist()) > 512 * 1024 * 1024:
            raise RuntimeError('Unexpected archive size')
        for info in z.infolist():
            name = info.filename.replace('\\', '/')
            parts = name.rstrip('/').split('/')
            key = name.rstrip('/').casefold()
            if (not name or ntpath.splitdrive(name)[0] or name.startswith('/') or
                    any(p in ('', '.', '..') or ':' in p or p.endswith((' ', '.')) or
                        re.fullmatch(r'(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?', p)
                        for p in parts) or key in seen or
                    stat.S_ISLNK(info.external_attr >> 16)):
                raise RuntimeError('Unsafe or duplicate archive member')
            seen.add(key)
            members.append((info, parts))
        destination.mkdir()
        for info, parts in members:
            target = destination.joinpath(*parts)
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with z.open(info) as src, target.open('xb') as dst:
                    shutil.copyfileobj(src, dst)


class PackageRedirectPolicy(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_host):
        self.allowed_host = allowed_host

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlparse(newurl)
        if parsed.scheme != 'https' or parsed.hostname != self.allowed_host:
            raise RuntimeError('Package redirect rejected: HTTPS and the pinned origin are required')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def public_source_files(source):
    # Deliberate deployment allowlist. No tools, SQL, uploads, ignored local config,
    # sessions, output, backups, Git metadata or dependencies from node_modules.
    raw = subprocess.check_output(
        ['git', '--no-optional-locks', '-C', str(source),
         'ls-files', '--cached', '-z'])
    # Only these reviewed follow-up partials may be untracked. Other untracked files are never copied.
    extras = {name for name in ('app/pages/partials/head.html', 'app/pages/partials/scripts.html') if (source / name).is_file()}
    result = []
    for name in sorted((set(raw.decode('utf-8').split('\0')) | extras) - {''}):
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise RuntimeError('Invalid source path')
        if name in ('app/config.local.php', 'api/config.local.php'):
            continue
        if any(p.startswith('.') for p in relative.parts) and relative.name != '.htaccess':
            continue
        allowed = (relative.parts[0] in ('api', 'app', 'assets', 'css', 'js', 'vendor') or
                   len(relative.parts) == 1 and
                   (name in ('.htaccess', 'page.php') or relative.suffix in ('.html', '.ico', '.svg', '.png', '.webmanifest')))
        if not allowed:
            continue
        path = source / relative
        reject_redirects(path)
        if path.is_file():
            result.append(name)
    if '.htaccess' not in result or 'app/config.php' not in result:
        raise RuntimeError('Not a ReFind application source')
    return result


def render_configs(root):
    p = root.as_posix()
    app = p + '/www/ReFind_0.2.3'
    php = p + '/php'
    apache = p + '/apache/Apache24'
    httpd = f"""# INERT PREPARATION: activate only after CRT, ownership and synthetic-fixture gates.
ServerRoot "{apache}"
Listen 127.0.0.1:8086
Listen [::1]:8086
ServerName localhost:8086
PidFile "{p}/run/httpd.pid"
ErrorLog "{p}/logs/apache-error.log"
LogLevel warn
ServerTokens Prod
ServerSignature Off
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule dir_module modules/mod_dir.so
LoadModule mime_module modules/mod_mime.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule headers_module modules/mod_headers.so
LoadFile "{php}/php8ts.dll"
LoadModule php_module "{php}/php8apache2_4.dll"
PHPIniDir "{p}/conf"
TypesConfig conf/mime.types
DocumentRoot "{p}/www"
<Directory />
    AllowOverride None
    Require all denied
</Directory>
<Directory "{app}">
    Options -Indexes
    AllowOverride All
    Require local
</Directory>
<FilesMatch "\\.php$">
    SetHandler application/x-httpd-php
</FilesMatch>
<LocationMatch "^/(?:php-cgi|cgi-bin|phpmyadmin|webalizer|examples)(?:/|$)">
    Require all denied
</LocationMatch>
# No CGI, AJP, proxy, userdir, status, DAV, Brotli, cURL or admin modules/aliases.
# TLS 8446 is reserved; not enabled until isolated certificate/library checks.
"""
    ini = f"""[PHP]
extension_dir="{php}/ext"
extension=mysqli
extension=mbstring
extension=fileinfo
extension=gd
; OpenSSL is not required by ReFind; leave the extension unloaded.
date.timezone=Asia/Jakarta
display_errors=Off
display_startup_errors=Off
log_errors=On
error_log="{p}/logs/php-error.log"
expose_php=Off
memory_limit=512M
post_max_size=40M
upload_max_filesize=40M
max_execution_time=900
max_input_time=60
upload_tmp_dir="{p}/tmp"
sys_temp_dir="{p}/tmp"
session.save_path="{app}/storage/sessions"
session.name=refind_runtime_upgrade_qa
session.use_strict_mode=1
session.use_only_cookies=1
session.cookie_httponly=1
session.cookie_samesite=Lax
session.upload_progress.enabled=0
"""
    my = f"""# FUTURE SYNTHETIC SERVER ONLY. Never use/copy the main datadir.
[mysqld]
port=3312
bind-address=127.0.0.1
datadir="{p}/db/data"
pid-file="{p}/run/mysqld.pid"
log-error="{p}/logs/mariadb-error.log"
skip-log-bin
innodb-buffer-pool-size=64M
"""
    return {'httpd.conf': httpd, 'php.ini': ini, 'my.ini': my}


def prepare(source, download=False):
    if os.name != 'nt':
        raise RuntimeError('This profile requires Windows and Python 3.12+')
    source = source.absolute()
    reject_redirects(source)
    names = public_source_files(source)
    ensure_unused_ports()
    parent = Path(os.environ['LOCALAPPDATA']) / 'ReFindRuntimeQA'
    reject_redirects(parent)
    parent.mkdir(exist_ok=True)
    root = parent / ('security-modernization-' + secrets.token_hex(8))
    root.mkdir(exist_ok=False)  # Never adopt, sync over or remove an existing tree.
    (root / '.refind-runtime-qa.json').write_text(json.dumps({'profile': PROFILE, 'phase': 'preparing', 'root': str(root), 'source': str(source), 'fixture_mutations_enabled': False}), encoding='utf-8')
    print('Preparing owned QA tree: ' + str(root), flush=True)
    # Restrict only this newly created tree, not any source/runtime installation.
    subprocess.run(['icacls', str(root), '/inheritance:r', '/grant:r',
                    os.environ['USERNAME'] + ':(OI)(CI)F', 'SYSTEM:(OI)(CI)F'],
                   check=True, capture_output=True)
    for folder in ('conf', 'downloads', 'logs', 'tmp', 'run', 'db', 'www/ReFind_0.2.3'):
        (root / folder).mkdir(parents=True, exist_ok=True)
    target = root / 'www/ReFind_0.2.3'
    copied = {}
    for name in names:
        path = source / name
        data = path.read_bytes()
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        copied[name] = hashlib.sha256(data).hexdigest()
    for collection in COLLECTIONS:
        (target / 'storage' / collection).mkdir(parents=True)
    (target / 'storage/.htaccess').write_text('Require all denied\n', encoding='utf-8')
    # New synthetic configuration only. No source config is read or imported.
    config = {'db_host': '127.0.0.1', 'db_port': 3312,
              'db_name': 'refind_db_0_2_0_test', 'db_user': 'refind_runtime_qa',
              'db_password': secrets.token_hex(24), 'base_path': '/ReFind_0.2.3/',
              'session_name': 'refind_runtime_upgrade_qa'}
    import base64
    encoded = base64.b64encode(json.dumps(config).encode()).decode()
    (target / 'app/config.local.php').write_text(
        "<?php return json_decode(base64_decode('" + encoded + "'),true,32,JSON_THROW_ON_ERROR);\n",
        encoding='utf-8')
    for name, content in render_configs(root).items():
        (root / 'conf' / name).write_text(content, encoding='utf-8')
    packages = json.loads((HARNESS / 'tools/runtime-qa-packages.json').read_text(encoding='utf-8'))
    fingerprint = hashlib.sha256(''.join(name + '\0' + h + '\n' for name, h in copied.items()).encode()).hexdigest()
    marker = {'profile': PROFILE, 'phase': 'prepared-incomplete', 'root': str(root),
              'source': str(source), 'created_utc': datetime.now(timezone.utc).isoformat(),
              'source_files': len(copied), 'source_sha256': fingerprint,
              'source_manifest': copied, 'packages': {},
              'ports': list(PORTS), 'fixture_mutations_enabled': False,
              'blockers': ['Provider CRT prerequisite must pass',
                           'Add and negatively test the runtime-upgrade fixture ownership/server-identity profile',
                           'Initialize only a new synthetic MariaDB datadir on 3312',
                           'CLI/web version, loaded libraries, IPv4/IPv6 and full regression gates']}
    receipt = root / '.refind-runtime-qa.json'
    def save():
        receipt.write_text(json.dumps(marker, indent=2) + '\n', encoding='utf-8')
    save()  # Retain ownership and source identities even if a package download fails.
    if download:
        try:
            for name in ('php', 'apache'):
                package = packages[name]
                url = package['url']
                allowed_host = {'php': 'downloads.php.net', 'apache': 'www.apachelounge.com'}[name]
                if urllib.parse.urlparse(url).scheme != 'https' or urllib.parse.urlparse(url).hostname != allowed_host:
                    raise RuntimeError('Unexpected package origin')
                archive = root / 'downloads' / url.rsplit('/', 1)[1]
                print('Downloading pinned ' + name + ' package', flush=True)
                opener = urllib.request.build_opener(PackageRedirectPolicy(allowed_host))
                with opener.open(urllib.request.Request(url, headers={'User-Agent':'ReFindRuntimeQA/1.0'}), timeout=60) as response, archive.open('xb') as handle:
                    shutil.copyfileobj(response, handle)
                check_digest(archive, package['sha256'])
                safe_extract(archive, root / name)
                marker['packages'][name] = {'url': url, 'sha256': sha256(archive)}
                save()
        except (OSError, RuntimeError, urllib.error.URLError, zipfile.BadZipFile) as error:
            marker['download_failure_category'] = type(error).__name__
            save()
            raise RuntimeError('Package preparation incomplete; inspect the owned receipt. No services or databases were started.') from error
    marker['phase'] = 'prepared-only'
    save()
    return {'root': str(root), 'phase': marker['phase'], 'source_files': len(copied),
            'source_sha256': fingerprint, 'packages_verified': list(marker['packages']),
            'services_started': False, 'database_initialized': False}



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True,
                        help='Read-only source checkout; ignored/private files are never imported')
    parser.add_argument('--download', action='store_true', help='Download, hash-check and extract the two pinned packages')
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.download), indent=2))


if __name__ == '__main__':
    main()
