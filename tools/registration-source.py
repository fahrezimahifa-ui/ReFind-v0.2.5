"""Byte-exact tracked-source manifests. Never inspect ignored private configuration/runtime."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

RUNTIME = ('app/', 'api/', 'css/', 'js/', 'assets/', 'vendor/', 'database/')
PRIVATE = ('app/config.local.php', 'api/config.local.php')


def permitted(name):
    if not name or '\\' in name or ':' in name or '\0' in name or name.startswith('/') or any(p in ('.', '..') for p in name.split('/')):
        return False
    return not (name in PRIVATE or name.startswith(('output/', 'node_modules/', '.git/', 'docs/references/'))
                or (name.startswith('storage/') and name not in ('storage/.htaccess', 'storage/README.md'))
                or name.endswith(('.local.php', '.local.json', '.zip'))
                or (name.startswith('.env') and name != '.env.example'))


def contents(root, name):
    path = root / name
    if not permitted(name) or not path.is_file() or path.is_symlink() or path.resolve() != path:
        raise RuntimeError('Source path unavailable, private or redirected: ' + name)
    return path.read_bytes()


def git(root, *args):
    return subprocess.check_output(['git', *args], cwd=root)


def tracked(root):
    result = {}
    for entry in git(root, 'ls-files', '--stage', '-z').split(b'\0'):
        if not entry:
            continue
        meta, raw_name = entry.split(b'\t', 1)
        mode, oid, stage = meta.decode().split()
        name = raw_name.decode('utf-8')
        if stage != '0' or mode not in ('100644', '100755') or not permitted(name):
            raise RuntimeError('Unresolved, private or unsupported tracked source: ' + name)
        result[name] = {'mode': mode, 'blob': oid}
    return result


def check_extra_runtime(root, names):
    for prefix in RUNTIME:
        folder = root / prefix
        if not folder.is_dir():
            raise RuntimeError('Missing source directory: ' + prefix)
        for file in folder.rglob('*'):
            if file.is_symlink() or getattr(file, 'is_junction', lambda: False)():
                raise RuntimeError('Redirected application source refused')
            if file.is_file():
                name = file.relative_to(root).as_posix()
                if name not in PRIVATE and name not in names:
                    raise RuntimeError('Unexpected application source: ' + name)


def capture(root):
    if subprocess.call(['git', 'diff', '--quiet'], cwd=root) or subprocess.call(['git', 'diff', '--cached', '--quiet'], cwd=root):
        raise RuntimeError('Commit the reviewed source before capturing its manifest')
    files = tracked(root)
    flags = git(root, 'ls-files', '-v').decode().splitlines()
    if any(line[0].islower() or line.startswith('S ') for line in flags):
        raise RuntimeError('Hidden index flags require review')
    for name, record in files.items():
        data = contents(root, name)
        actual_blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if actual_blob != record['blob']:
            raise RuntimeError('Actual tracked bytes differ from index: ' + name)
        record.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    check_extra_runtime(root, files)
    return {'format': 1, 'commit': git(root, 'rev-parse', 'HEAD').decode().strip(),
            'tree': git(root, 'rev-parse', 'HEAD^{tree}').decode().strip(),
            'files': files}


def verify(root, manifest, profile):
    files = manifest['files']
    if (root / '.git').exists() and profile == 'checkout':
        actual = tracked(root)
        if set(actual) != set(files) or any(actual[n] != {k: files[n][k] for k in ('mode', 'blob')} for n in files):
            raise RuntimeError('Tracked inventory/blob/mode mismatch')
    checked = skipped = 0
    for name, record in files.items():
        if not permitted(name):
            raise RuntimeError('Manifest contains a private path')
        if profile == 'docker' and name.startswith('docs/verification/'):
            skipped += 1
            continue
        if profile == 'qa' and not ((root / name).is_file() or name.startswith(RUNTIME) or name in ('.htaccess', 'page.php')):
            skipped += 1
            continue
        data = contents(root, name)
        if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']:
            raise RuntimeError('Source byte mismatch: ' + name)
        checked += 1
    check_extra_runtime(root, files)
    return {'source_equivalent': True, 'checked': checked, 'excluded_historical_files': skipped, 'profile': profile}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['capture', 'verify'])
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--profile', choices=['checkout', 'docker', 'qa'], default='checkout')
    args = parser.parse_args()
    root = args.root.resolve()
    if args.action == 'capture':
        manifest = capture(root)
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        with args.manifest.open('x', encoding='utf-8') as output:
            json.dump(manifest, output, indent=2)
        print(json.dumps({'captured': len(manifest['files']), 'commit': manifest['commit'], 'private_files': 'excluded'}))
    else:
        print(json.dumps(verify(root, json.loads(args.manifest.read_text(encoding='utf-8')), args.profile)))


if __name__ == '__main__':
    main()
