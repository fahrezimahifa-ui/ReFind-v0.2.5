"""Native guard negatives use synthetic files only and never contact a database."""
import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
PHP = os.environ['REFIND_PHP']

class NativeIdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='refind-native-guard-')
        self.parent = Path(self.temp.name)
        self.source = self.parent / 'source'
        self.source.mkdir()
        self.qa = self.parent / 'ReFindRuntimeQA/security-modernization-0123456789abcdef'
        self.target = self.qa / 'www/ReFind_0.2.3'
        (self.target / 'app').mkdir(parents=True)
        shutil.copy2(ROOT/'app/config.php', self.target/'app/config.php')
        for name in ['auth','sessions','setup','items','evidence','claims','avatars']:
            (self.target/'storage'/name).mkdir(parents=True,exist_ok=True)
        (self.qa/'db/data').mkdir(parents=True)
        self.config = {'db_host':'127.0.0.1','db_port':3312,'db_name':'refind_db_0_2_0_test',
                       'db_user':'refind_runtime_qa','db_password':'synthetic-only',
                       'base_path':'/ReFind_0.2.3/','session_name':'refind_runtime_upgrade_qa'}
        self.marker = {'root':str(self.qa),'source':str(self.source),'profile':'runtime-upgrade',
                       'phase':'qa-enabled','fixture_mutations_enabled':True,'ports':[8086,8446,3312]}
        self.env = os.environ | {'LOCALAPPDATA':str(self.parent),'REFIND_TEST_PROFILE':'runtime-upgrade',
            'REFIND_RUNTIME_QA_ROOT':str(self.qa),'REFIND_RUNTIME_QA_SOURCE':str(self.source)}

    def tearDown(self):
        self.temp.cleanup()

    def check(self, config=None, marker=None, env=None, full=False):
        c = self.config | (config or {})
        encoded = base64.b64encode(json.dumps(c).encode()).decode()
        (self.target/'app/config.local.php').write_text("<?php return json_decode(base64_decode('"+encoded+"'),true);")
        (self.qa/'.refind-runtime-qa.json').write_text(json.dumps(self.marker | (marker or {})))
        code = 'require $argv[1]."/app/config.php"; require $argv[2]."/tools/qa-guard.php"; require $argv[2]."/tools/runtime-qa-guard.php"; ' + ('assert_runtime_upgrade_installation' if full else 'runtime_qa_identity') + '($argv[1]); echo "accepted";'
        return subprocess.run([PHP,'-r',code,str(self.target),str(ROOT)],env=self.env | (env or {}),capture_output=True)

    def test_valid_structural_identity(self):
        self.assertEqual(self.check().returncode,0)

    def test_wrong_database_boundaries_refused(self):
        for patch in [{'db_port':3306},{'db_port':3311},{'db_host':'localhost'},
                      {'db_name':'refind_db_0_2_0'},{'db_user':'root'},
                      {'base_path':'/ReFind_0.2.0_Test/'},{'session_name':'refind_020'}]:
            with self.subTest(patch=patch):
                self.assertNotEqual(self.check(config=patch).returncode,0)

    def test_unowned_markers_and_disabled_phase_refused(self):
        for patch in [{'profile':'xampp-stage'},{'phase':'prepared-only'},
                      {'fixture_mutations_enabled':False},{'root':str(self.source)},
                      {'source':str(self.qa)},{'ports':[80,443,3306]}]:
            with self.subTest(patch=patch):
                self.assertNotEqual(self.check(marker=patch).returncode,0)

    def test_explicit_environment_required(self):
        for patch in [{'REFIND_TEST_PROFILE':''},{'REFIND_RUNTIME_QA_ROOT':''},
                      {'REFIND_RUNTIME_QA_SOURCE':str(self.qa)}]:
            with self.subTest(patch=patch):
                self.assertNotEqual(self.check(env=patch).returncode,0)

    def test_unknown_profile_cannot_fall_back_to_legacy_guard(self):
        legacy=self.parent/'ReFind_0.2.0_Test'
        (legacy/'app').mkdir(parents=True)
        shutil.copy2(ROOT/'app/config.php',legacy/'app/config.php')
        (legacy/'.refind-b02-test.json').write_text(json.dumps({'source':str(self.source)}))
        c=self.config | {'base_path':'/ReFind_0.2.0_Test/','session_name':'refind_020_test'}
        encoded=base64.b64encode(json.dumps(c).encode()).decode()
        (legacy/'app/config.local.php').write_text("<?php return json_decode(base64_decode('"+encoded+"'),true);")
        code='require $argv[1]."/app/config.php";require $argv[2]."/tools/qa-guard.php";assert_qa_installation($argv[1]);'
        for profile,accepted in [('',True),('runtime-upgarde',False)]:
            result=subprocess.run([PHP,'-r',code,str(legacy),str(ROOT)],env=self.env|{'REFIND_TEST_PROFILE':profile},capture_output=True)
            self.assertEqual(result.returncode==0,accepted)
        result=subprocess.run(['python','-B',str(ROOT/'tools/prepare-test.py')],env=self.env|{'REFIND_TEST_PROFILE':'runtime-upgarde'},capture_output=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn(b'Unknown QA profile',result.stderr)

    def test_missing_datadir_refused(self):
        (self.qa/'db/data').rmdir()
        self.assertNotEqual(self.check().returncode,0)

    def test_junction_refused_before_database_access(self):
        item = self.target/'storage/items';item.rmdir()
        other = self.parent/'foreign';other.mkdir()
        subprocess.run(['cmd','/d','/c','mklink','/J',str(item),str(other)],check=True,capture_output=True)
        try:
            self.assertNotEqual(self.check().returncode,0)
        finally:
            item.rmdir()

if __name__ == '__main__':
    unittest.main(verbosity=2)
