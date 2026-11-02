"""Backup validation tests use synthetic temporary files; no database or runtime starts."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('recovery',HERE/'rehearse-native-recovery.py')
recovery=importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)

class RecoveryBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='refind-recovery-')
        self.root=Path(self.temp.name).resolve()
        self.backup=self.root/'backups/synthetic-test'
        self.backup.mkdir(parents=True)
        for name in ['database.sql','storage-config.zip']:(self.backup/name).write_bytes(b'synthetic-only')
        self.receipt={'synthetic_only':True,'source_root':str(self.root),'writers_paused':True,
            'database':recovery.qa.DB_NAME,
            'artifacts':{name:hashlib.sha256(b'synthetic-only').hexdigest() for name in ['database.sql','storage-config.zip']}}
        self.save()

    def tearDown(self):self.temp.cleanup()
    def save(self):(self.backup/'receipt.json').write_text(json.dumps(self.receipt), encoding='utf-8')

    def test_row_digest_normalizes_transport_only(self):
        first='[1,"synthetic\\nvalue",null]\n'
        self.assertEqual(recovery.row_digest(first),recovery.row_digest(first.replace('\n','\r\n')))
        self.assertNotEqual(recovery.row_digest(first),recovery.row_digest(first.replace('value','changed')))

    def test_valid_own_synthetic_backup(self):
        self.assertTrue(recovery.verified_backup(self.root,self.backup)['synthetic_only'])

    def test_corrupt_artifact_refused_before_restore(self):
        (self.backup/'database.sql').write_bytes(b'corrupted')
        with self.assertRaises(RuntimeError):recovery.verified_backup(self.root,self.backup)
        self.assertFalse((self.root/'db').exists())

    def test_foreign_or_live_receipt_refused(self):
        for key,value in [('synthetic_only',False),('source_root',str(self.root/'other')),
                          ('writers_paused',False),('database','refind_db_0_2_0')]:
            with self.subTest(key=key):
                old=self.receipt[key];self.receipt[key]=value;self.save()
                with self.assertRaises(RuntimeError):recovery.verified_backup(self.root,self.backup)
                self.receipt[key]=old

    def test_redirected_backup_directory_refused(self):
        link=self.root/'backups/redirect'
        result=subprocess.run(['cmd','/d','/c','mklink','/J',str(link),str(self.backup)],capture_output=True)
        if result.returncode:self.skipTest('Junction creation unavailable')
        try:
            with self.assertRaises(RuntimeError):recovery.verified_backup(self.root,link)
        finally:link.rmdir()

    def test_foreign_path_and_artifact_set_refused(self):
        with self.assertRaises(RuntimeError):recovery.verified_backup(self.root,self.root)
        self.receipt['artifacts']['../outside']='0'*64;self.save()
        with self.assertRaises(RuntimeError):recovery.verified_backup(self.root,self.backup)

if __name__=='__main__':unittest.main(verbosity=2)
