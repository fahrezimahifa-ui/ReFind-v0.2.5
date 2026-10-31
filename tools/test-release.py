"""Offline regression tests. All temporary config/secrets are synthetic, under ignored output."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from qa_safety import php_binary, validate_target

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/playwright/release-readiness/unit'
OUTPUT.mkdir(parents=True, exist_ok=True)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='owned-unit-', dir=OUTPUT)
        self.parent = Path(self.temp.name).resolve()
        assert self.parent.is_relative_to(OUTPUT.resolve())
        self.source = self.parent / 'source'
        self.target = self.parent / 'ReFind_0.2.0_Test'
        for folder in [self.source, self.target]:
            (folder / 'app').mkdir(parents=True)
            shutil.copy2(ROOT / 'app/config.php', folder / 'app/config.php')
        self.marker = self.target / '.refind-b02-test.json'
        self.marker.write_text(json.dumps({'source': str(self.source)}))
        self.local = self.target / 'app/config.local.php'
        self.configure()

    def tearDown(self):
        self.temp.cleanup()

    def configure(self, extra=None):
        c = {'db_name': 'refind_db_0_2_0_test', 'base_path': '/ReFind_0.2.0_Test/', 'session_name': 'refind_020_test'} | (extra or {})
        # JSON double encoding produces a PHP string; values here are controlled synthetic tests.
        literal = json.dumps(json.dumps(c)).replace('$', '\\$')
        self.local.write_text('<?php return json_decode(' + literal + ',true);', encoding='utf-8')

    def php(self, code, *args):
        result = subprocess.run([php_binary(), '-d', 'display_errors=0', '-r', code, *map(str, args)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def test_xampp_stage_identity_rejects_main_port_and_session(self):
        import base64
        stage = self.parent / 'refind-xampp-stage'
        (stage / 'app').mkdir(parents=True)
        shutil.copy2(ROOT / 'app/config.php', stage / 'app/config.php')
        (stage / '.refind-xampp-stage.json').write_text(json.dumps({'profile':'xampp-stage','source':str(self.source),'port':3311}))
        config = {'db_host':'127.0.0.1','db_port':3311,'db_name':'refind_db_0_2_0_test','db_user':'refind_stage','base_path':'/refind-xampp-stage/','session_name':'refind_xampp_stage'}
        code = 'putenv("REFIND_TEST_PROFILE=xampp-stage"); require $argv[1]."/app/config.php"; require $argv[2]; assert_xampp_stage_installation($argv[1]);'
        for overrides in [{}, {'db_port':3306}, {'session_name':'refind_020'}, {'db_name':'refind_db_0_2_0'}, {'base_path':'/ReFind_0.2.3/'}]:
            encoded = base64.b64encode(json.dumps(config | overrides).encode()).decode()
            (stage / 'app/config.local.php').write_text("<?php return json_decode(base64_decode('"+encoded+"'),true);")
            result = subprocess.run([php_binary(),'-r',code,str(stage),str(ROOT/'tools/qa-guard.php')],capture_output=True)
            self.assertEqual(result.returncode == 0, not overrides)

    def test_notification_return_context_is_typed_and_local(self):
        code = "require 'app/routes.php'; $u=['role'=>'STUDENT']; echo json_encode([safe_return('item.html?id=12&origin=notifications&notification_page=2&notification=50',$u),safe_return('https://example.com/item.html?id=12',$u),safe_return('item.html?id=12&origin=https://example.com',$u)]);"
        result = json.loads(self.php(code))
        base = self.php("require 'app/config.php'; echo app_config()['base_path'];")
        self.assertEqual(result[0], base + 'item.html?id=12&origin=notifications&notification_page=2&notification=50')
        self.assertEqual(result[1:], [base+'index.html', base+'index.html'])

    def test_avatar_reference_is_current_token_only(self):
        code = "require 'app/auth.php'; echo json_encode([avatar_url(null),avatar_url('../private.jpg'),avatar_url('avatars/'.str_repeat('a',32).'.jpg')]);"
        result = json.loads(self.php(code))
        base = self.php("require 'app/config.php'; echo app_config()['base_path'];")
        self.assertEqual(result, [None,None,base+'api/avatar.php?token='+'a'*32])

    def test_development_profile_cannot_prepare_the_legacy_qa_sibling(self):
        env = os.environ.copy()
        env['REFIND_TEST_PROFILE'] = 'ui-ux-dev'
        result = subprocess.run([os.sys.executable,str(ROOT/'tools/prepare-test.py')],env=env,capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('legacy QA preparation is refused',result.stderr)

    def test_valid_qa_preserves_config_and_existing_upload(self):
        sentinel = self.target / 'storage/items/keep.png'
        sentinel.parent.mkdir(parents=True)
        sentinel.write_bytes(b'Existing synthetic upload')
        config = self.local.read_bytes()
        validate_target(self.source, self.target)
        self.assertEqual(self.local.read_bytes(), config)
        self.assertEqual(sentinel.read_bytes(), b'Existing synthetic upload')

    def test_missing_and_foreign_markers_refused(self):
        for marker in [None, {'source': str(ROOT)}]:
            if marker is None:
                self.marker.unlink()
            else:
                self.marker.write_text(json.dumps(marker))
            with self.assertRaises(RuntimeError):
                validate_target(self.source, self.target)

    def test_main_database_wrong_url_and_session_refused(self):
        before = self.local.read_bytes()
        for extra in [{'db_name': 'refind_db_0_2_0'}, {'base_path': '/ReFind_0.2.3/'}, {'session_name': 'refind_020'}]:
            self.configure(extra)
            rejected = self.local.read_bytes()
            with self.assertRaises(RuntimeError):
                validate_target(self.source, self.target)
            self.assertEqual(self.local.read_bytes(), rejected)
        self.local.write_bytes(before)

    def test_filesystem_link_refused(self):
        outside = self.parent / 'other-media'
        outside.mkdir()
        (self.target / 'storage').mkdir()
        link = self.target / 'storage/items'
        if os.name == 'nt':
            result = subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(outside)], capture_output=True)
            if result.returncode:
                self.skipTest('Cannot create a test junction')
        else:
            link.symlink_to(outside, target_is_directory=True)
        try:
            with self.assertRaises(RuntimeError):
                validate_target(self.source, self.target)
        finally:
            # Remove only this verified temporary link, never its target.
            self.assertTrue(link.parent.resolve().is_relative_to(self.parent))
            if os.name == 'nt':
                link.rmdir()
            else:
                link.unlink()

    def test_repeated_invalid_configuration_never_becomes_cached(self):
        self.configure({'db_name': 'forbidden'})
        code = 'require $argv[1]; $n=0; for($i=0;$i<2;$i++){try{app_config();}catch(Throwable $e){$n++;}} echo $n;'
        self.assertEqual(self.php(code, self.target / 'app/config.php'), '2')

    def test_repeated_invalid_secret_never_becomes_cached(self):
        folder = self.target / 'storage/auth'
        folder.mkdir(parents=True)
        (folder / 'secret.json').write_text(json.dumps({'key': 'invalid', 'dummy_hash': 'invalid'}))
        code = 'require $argv[1]; $n=0; for($i=0;$i<2;$i++){try{site_secret();}catch(Throwable $e){$n++;}} echo $n;'
        self.assertEqual(self.php(code, self.target / 'app/config.php'), '2')

    def test_config_types_ranges_unknown_keys_and_paths(self):
        code = '''require $argv[1]; $cases=[['db_port'=>'3306'],['db_port'=>0],['db_port'=>65536],['db_host'=>[]],['db_user'=>''],['db_password'=>[]],['base_path'=>[]],['base_path'=>'/../'],['base_path'=>'/./'],['session_name'=>[]],['idle_seconds'=>0],['pickup_desk_name'=>[]],['unexpected'=>1]];
        $n=0; foreach($cases as $patch){try{validate_app_config(array_replace(app_defaults(),$patch));}catch(Throwable $e){$n++;}} echo $n;'''
        self.assertEqual(self.php(code, self.target / 'app/config.php'), '13')

    def install_fake_app(self):
        for name in ['http.php', 'auth.php', 'db.php', 'routes.php']:
            shutil.copy2(ROOT / 'app' / name, self.target / 'app' / name)
        shutil.copy2(ROOT / 'page.php', self.target / 'page.php')
        (self.target / 'api').mkdir()
        shutil.copy2(ROOT / 'api/bootstrap.php', self.target / 'api/bootstrap.php')
        self.configure({'db_password': 'SYNTHETIC-SECRET-NEVER-PRINT', 'db_port': []})

    def test_broken_configuration_page_returns_generic_error(self):
        self.install_fake_app()
        code = '$_SERVER["REQUEST_METHOD"]="GET"; $_SERVER["REQUEST_URI"]="/ReFind_0.2.0_Test/login.html"; require $argv[1];'
        output = self.php(code, self.target / 'page.php')
        self.assertIn('Unable to open page', output)
        self.assertNotIn('SYNTHETIC-SECRET', output)
        self.assertNotIn(str(self.target), output)
        self.assertNotIn('Fatal error', output)

    def test_broken_configuration_api_returns_generic_json(self):
        self.install_fake_app()
        # An uncaught exception is handled only after leaving the PHP entry script.
        script = self.target / 'api/test.php'
        script.write_text('<?php require __DIR__."/bootstrap.php"; app_config();')
        result = subprocess.run([php_binary(), str(script)], capture_output=True, text=True)
        data = json.loads(result.stdout)
        self.assertEqual(data['code'], 'server_error')
        self.assertNotIn('SYNTHETIC-SECRET', result.stdout)
        self.assertNotIn(str(self.target), result.stdout)

    def test_php_guard_refuses_main_and_accepts_owned_qa(self):
        guard = ROOT / 'tools/qa-guard.php'
        accepted = subprocess.run([php_binary(), str(guard), str(self.target)], capture_output=True)
        self.assertEqual(accepted.returncode, 0)
        self.configure({'db_name': 'refind_db_0_2_0'})
        rejected = subprocess.run([php_binary(), str(guard), str(self.target)], capture_output=True)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertEqual(rejected.stdout, b'')

    def test_backup_requires_quiescence_before_reading_configuration(self):
        result = subprocess.run([os.sys.executable, str(ROOT / 'tools/backup-project.py')], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('--writes-paused', result.stderr)
        self.assertNotIn('database.sql', result.stdout)


if __name__ == '__main__':
    unittest.main(verbosity=2)
