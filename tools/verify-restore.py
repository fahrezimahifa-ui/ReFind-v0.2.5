"""Prove a ReFind SQL backup restores: load it into a fresh scratch database and compare with the live source.

Read-only on the source database. Writes only to a new `refind_restore_check_<timestamp>` database that this
tool creates and always drops afterwards. Refuses dumps that switch or create databases, so a restore can
never be redirected into the source. Prints counts and checksums only, never row contents or credentials.

  python tools/verify-restore.py --backup-dir <storage/setup/backups/release-before-...> --source-db refind_db_0_2_0
  python tools/verify-restore.py --dump <file.sql> --source-db refind_db_v1rc_test

Uses the local XAMPP client; set REFIND_DB_USER / REFIND_DB_PASSWORD when root is not passwordless.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile

MYSQL = r'C:\xampp\mysql\bin\mysql.exe'
SOURCES = {'refind_db_0_2_0', 'refind_db_0_2_0_test', 'refind_db_v1rc_test'}
SCRATCH = re.compile(r'^refind_restore_check_\d{14}$')
FORBIDDEN = re.compile(rb'^\s*(?:USE\s|CREATE\s+(?:DATABASE|SCHEMA)\b|DROP\s+(?:DATABASE|SCHEMA)\b)', re.I | re.M)


def client(args, database=None, stdin=None):
    env = os.environ | {'MYSQL_PWD': os.environ.get('REFIND_DB_PASSWORD', '')}
    command = [MYSQL, '--host=127.0.0.1', '--port=3306', '--user=' + os.environ.get('REFIND_DB_USER', 'root'),
               '--batch', '--skip-column-names', '--default-character-set=utf8mb4']
    if database:
        command.append('--database=' + database)
    result = subprocess.run(command + args, env=env, stdin=stdin, capture_output=True)
    if result.returncode:
        raise RuntimeError('MariaDB client step failed: ' + result.stderr.decode(errors='replace').strip()[:200])
    return result.stdout.decode()


def query(sql, database=None):
    return [line.split('\t') for line in client(['-e', sql], database).splitlines() if line]


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--backup-dir', type=Path, help='Folder written by backup-project.py (database.sql, storage.zip, receipt.json)')
    group.add_argument('--dump', type=Path, help='A single-database mysqldump file')
    parser.add_argument('--source-db', required=True, choices=sorted(SOURCES))
    args = parser.parse_args()
    report = {'source': args.source_db, 'checks': {}}

    dump = args.dump
    if args.backup_dir:
        receipt = json.loads((args.backup_dir / 'receipt.json').read_text(encoding='utf-8'))
        if receipt.get('database') != args.source_db:
            raise RuntimeError('Backup receipt names a different database.')
        dump = args.backup_dir / 'database.sql'
        for name, expected in receipt['files'].items():
            report['checks']['receipt_sha256_' + name] = sha256(args.backup_dir / name) == expected
        with zipfile.ZipFile(args.backup_dir / 'storage.zip') as bundle:
            report['checks']['storage_zip_intact'] = bundle.testzip() is None
            report['storage_files'] = sum(1 for info in bundle.infolist() if not info.is_dir())
    data = dump.read_bytes()
    if FORBIDDEN.search(data):
        raise RuntimeError('Dump switches or creates databases; refusing to restore it.')

    scratch = 'refind_restore_check_' + datetime.datetime.now().strftime('%Y%m%d%H%M%S')
    assert SCRATCH.match(scratch)
    if query("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='" + scratch + "'")[0][0] != '0':
        raise RuntimeError('Scratch database name already exists; retry in a second.')
    client(['-e', 'CREATE DATABASE `' + scratch + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'])
    report['scratch'] = scratch
    try:
        with open(dump, 'rb') as handle:
            client([], scratch, stdin=handle)
        list_sql = "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"
        source_tables = [row[0] for row in query(list_sql.format(args.source_db))]
        restored_tables = [row[0] for row in query(list_sql.format(scratch))]
        # Seen once on 15 Nov 2026: an empty source list, which an immediate re-run did not reproduce. Report it plainly.
        if not source_tables or not restored_tables:
            report['error'] = 'empty table list (source {}, restored {}); re-run once and stop if it repeats'.format(len(source_tables), len(restored_tables))
        report['checks']['tables_listed'] = bool(source_tables) and bool(restored_tables)
        report['checks']['same_tables'] = source_tables == restored_tables
        tables = {}
        for table in source_tables:
            if not re.fullmatch(r'[a-z_]+', table):
                raise RuntimeError('Unexpected table name.')
            counts = [query('SELECT COUNT(*) FROM `' + table + '`', db)[0][0] for db in (args.source_db, scratch)]
            sums = [query('CHECKSUM TABLE `' + table + '`', db)[0][1] for db in (args.source_db, scratch)]
            tables[table] = {'rows': int(counts[0]), 'rows_match': counts[0] == counts[1], 'checksum_match': sums[0] == sums[1]}
        report['tables'] = tables
        report['checks']['all_rows_match'] = all(t['rows_match'] for t in tables.values())
        report['checks']['all_checksums_match'] = all(t['checksum_match'] for t in tables.values())
    finally:
        if SCRATCH.match(scratch):
            client(['-e', 'DROP DATABASE IF EXISTS `' + scratch + '`'])
            report['scratch_dropped'] = True
    report['passed'] = all(report['checks'].values())
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
