"""Offline registration checks: synthetic files only, no HTTP or database connection."""
import concurrent.futures
import json
import secrets
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from qa_safety import php_binary

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/playwright/registration-unit'


class RegistrationTests(unittest.TestCase):
    def setUp(self):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='owned-', dir=OUTPUT)
        self.root = Path(self.temp.name)
        (self.root / 'app').mkdir()
        for name in ['config', 'http', 'db', 'auth', 'accounts', 'registration', 'registration-policy', 'routes']:
            shutil.copy2(ROOT / 'app' / (name + '.php'), self.root / 'app' / (name + '.php'))
        # A regression in an offline test must never open even a local database socket.
        (self.root / 'app/db.php').write_text('''<?php require_once __DIR__.'/config.php';
        function db(): never { throw new RuntimeException('Offline database access refused.'); }
        function sql(string $query, array $values=[]): never { db(); }
        function row(string $query, array $values=[]): never { db(); }
        function rows(string $query, array $values=[]): never { db(); }
        ''', encoding='utf-8')
        for folder in ['auth', 'sessions']:
            (self.root / 'storage' / folder).mkdir(parents=True)
        config = {'db_name': 'refind_db_0_2_0_test', 'base_path': '/registration-unit/', 'session_name': 'registration_unit'}
        encoded = json.dumps(json.dumps(config))
        (self.root / 'app/config.local.php').write_text('<?php return json_decode(' + encoded + ',true);', encoding='utf-8')
        dummy = self.php('echo password_hash("synthetic-dummy-only", PASSWORD_DEFAULT);')
        (self.root / 'storage/auth/secret.json').write_text(json.dumps({'key': secrets.token_hex(32), 'dummy_hash': dummy}))

    def tearDown(self):
        self.temp.cleanup()

    def php(self, code):
        result = subprocess.run([php_binary(), '-d', 'display_errors=0', '-r', code], cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, 'Synthetic PHP check failed; no form contents recorded')
        self.assertEqual(result.stderr, '', 'Synthetic PHP emitted diagnostics')
        return result.stdout

    def test_config_is_disabled_by_default_and_strictly_typed(self):
        output = self.php('''require "app/config.php"; $bad=0;
        foreach ([['registration_enabled'=>'true'],['registration_enabled'=>1],['registration_enabled'=>null],['registration_window_seconds'=>0],['registration_ip_limit'=>0],['registration_ip_limit'=>'10'],['registration_local_only'=>'true'],['registration_local_only'=>1],['registration_local_only'=>null]] as $p) {
            try { validate_app_config(array_replace(app_defaults(),$p)); } catch (RuntimeException $e) { $bad++; }
        } echo json_encode([app_defaults()['registration_enabled'],app_defaults()['registration_local_only'],$bad]);''')
        self.assertEqual(json.loads(output), [False, True, 9])

    def test_loopback_peer_cannot_be_forged_by_headers(self):
        config = {'db_name': 'refind_db_0_2_0_test', 'base_path': '/registration-unit/', 'session_name': 'registration_unit', 'registration_enabled': True}
        (self.root / 'app/config.local.php').write_text('<?php return json_decode(' + json.dumps(json.dumps(config)) + ',true);', encoding='utf-8')
        output = self.php('''require "app/registration-policy.php";
        $yes=['127.0.0.1','127.12.3.4','::1','0:0:0:0:0:0:0:1','::ffff:127.0.0.1'];
        $no=['192.0.2.1','0.0.0.0','::','2001:db8::1','::ffff:192.0.2.1','localhost','invalid',null,[],1];
        $checks=[]; foreach($yes as $ip)$checks[]=registration_loopback_peer($ip);
        foreach($no as $ip)$checks[]=!registration_loopback_peer($ip);
        $_SERVER['REMOTE_ADDR']='192.0.2.1'; $_SERVER['HTTP_HOST']='localhost'; $_SERVER['HTTP_X_FORWARDED_FOR']='127.0.0.1'; $_SERVER['HTTP_FORWARDED']='for="[::1]"';
        $checks[]=!registration_available(); echo json_encode($checks);''')
        self.assertEqual(json.loads(output), [True] * 16)

    def test_effective_availability_obeys_both_validated_flags(self):
        for enabled, local_only, peer, expected in [(True, True, '127.0.0.1', True), (True, True, '::1', True), (True, True, '192.0.2.1', False), (False, True, '127.0.0.1', False), (True, False, '192.0.2.1', True)]:
            config = {'db_name': 'refind_db_0_2_0_test', 'base_path': '/registration-unit/', 'session_name': 'registration_unit', 'registration_enabled': enabled, 'registration_local_only': local_only}
            (self.root / 'app/config.local.php').write_text('<?php return json_decode(' + json.dumps(json.dumps(config)) + ',true);', encoding='utf-8')
            code = 'require "app/registration-policy.php"; $_SERVER["REMOTE_ADDR"]=' + json.dumps(peer) + '; echo json_encode(registration_available());'
            self.assertEqual(json.loads(self.php(code)), expected)

    def test_values_normalization_and_exact_untrimmed_password(self):
        output = self.php('''require "app/registration.php";
        $v=registration_values(['name'=>'  Synthetic Student  ','email'=>'  Student@Example.TEST  ','password'=>'  secret 1234  ','confirm_password'=>'  secret 1234  ']);
        echo json_encode([$v['name']==='Synthetic Student',$v['email']==='student@example.test',$v['password']==='  secret 1234  ']);''')
        self.assertEqual(json.loads(output), [True, True, True])

    def test_normal_signup_has_no_temporary_grant_or_expiry_dependency(self):
        config = {'registration_enabled': True, 'registration_local_only': True, 'base_path': '/registration-unit/', 'session_name': 'registration_unit'}
        (self.root / 'app/config.local.php').write_text('<?php return json_decode(' + json.dumps(json.dumps(config)) + ',true);', encoding='utf-8')
        output = self.php("""require 'app/registration-policy.php'; $_SERVER['REMOTE_ADDR']='127.0.0.1';
        $_SESSION['registration_access']=['activation'=>'retired','expires_at'=>0];
        $obsolete=false;try{validate_app_config(array_replace(app_defaults(),['registration_access_file'=>'/retired/file']));}catch(RuntimeException $e){$obsolete=true;}
        echo json_encode([registration_available(),$obsolete]);""")
        self.assertEqual(json.loads(output), [True, True])

    def test_field_boundaries_and_malformed_types(self):
        output = self.php('''require "app/registration.php";
        $base=['name'=>'Student','email'=>'student@example.test','password'=>'synthetic-1234','confirm_password'=>'synthetic-1234'];
        $cases=[['name'=>''],['name'=>[]],['name'=>str_repeat('a',121)],['name'=>"a\\nb"],['name'=>"\\xff"],['email'=>''],['email'=>[]],['email'=>'not-email'],['email'=>str_repeat('a',141).'@example.test'],['password'=>[]],['password'=>'short'],['password'=>str_repeat('a',73)],['password'=>str_repeat('😀',19)],['password'=>"1234567890\\0"],['password'=>"\\xff"],['confirm_password'=>[]],['confirm_password'=>'wrong'],['confirm_password'=>'']];
        $n=0; foreach($cases as $patch){try{registration_values(array_replace($base,$patch));}catch(HttpError $e){if($e->status===422 && count($e->fields)===1)$n++;}}
        $valid=registration_values(array_replace($base,['name'=>str_repeat('😀',120),'password'=>str_repeat('😀',18),'confirm_password'=>str_repeat('😀',18)]));
        echo json_encode([$n,mb_strlen($valid['name'])===120,strlen($valid['password'])===72]);''')
        self.assertEqual(json.loads(output), [18, True, True])

    def test_parallel_limiter_reserves_exactly_ten_and_does_not_reset(self):
        code = '''require "app/registration.php"; $_SERVER['REMOTE_ADDR']='192.0.2.1';
        try {registration_attempt(); echo 'admitted';} catch(HttpError $e){echo $e->status;}'''
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            outcomes = list(pool.map(lambda _: self.php(code), range(18)))
        self.assertEqual(outcomes.count('admitted'), 10)
        self.assertEqual(outcomes.count('429'), 8)
        self.assertEqual(self.php(code), '429')
        limiter = self.root / 'storage/auth/registration-attempts.json'
        buckets = json.loads(limiter.read_text())
        self.assertEqual(len(buckets), 1)
        self.assertTrue(all(len(key) == 64 and set(key) <= set('0123456789abcdef') for key in buckets))
        self.assertEqual(next(iter(buckets.values()))['count'], 10)
        spoofed = code.replace("try {", "$_SERVER['HTTP_X_FORWARDED_FOR']='192.0.2.99'; try {")
        self.assertEqual(self.php(spoofed), '429')
        for bucket in buckets.values():
            bucket['start'] -= 901
        limiter.write_text(json.dumps(buckets))
        self.assertEqual(self.php(code), 'admitted')
        self.assertEqual(self.php(code.replace('192.0.2.1', '192.0.2.2')), 'admitted')

    def test_corrupt_limiter_fails_closed(self):
        limiter = self.root / 'storage/auth/registration-attempts.json'
        for payload in ['not-json', 'null', '{"key":{"start":"wrong","count":1}}']:
            limiter.write_text(payload)
            output = self.php('''require "app/registration.php"; try {registration_attempt(); echo 'unsafe';} catch(Throwable $e){echo 'closed';}''')
            self.assertEqual(output, 'closed')

    def test_session_helper_rotates_and_omits_private_fields(self):
        output = self.php('''require "app/auth.php"; start_app_session(); $id=session_id(); $csrf=$_SESSION['csrf'];
        $record=['user_id'=>42,'full_name'=>'Synthetic','email'=>'synthetic@example.test','student_id'=>null,'role'=>'STUDENT','is_active'=>1,'avatar_path'=>null,'password_hash'=>site_secret()['dummy_hash']];
        $user=authenticate_account($record);
        echo json_encode([session_id()!==$id,$_SESSION['csrf']!==$csrf,$_SESSION['auth']['user_id']===42,!isset($user['password_hash']),!isset($user['is_active']),$user['student_id']===null,public_identity($user)['role']==='STUDENT',!is_file(storage_dir('sessions').'/sess_'.$id)]);''')
        self.assertEqual(json.loads(output), [True] * 8)

    def test_registration_cannot_be_a_safe_return_target(self):
        output = self.php('''require "app/routes.php"; echo json_encode([safe_return('register.html',['role'=>'STUDENT']),safe_return('register.html',['role'=>'BUILDING_MANAGEMENT'])]);''')
        self.assertEqual(json.loads(output), ['/registration-unit/index.html', '/registration-unit/admin.html'])

    def test_api_guards_and_validation_without_any_database_access(self):
        (self.root / 'api').mkdir()
        for name in ['bootstrap.php', 'register.php']:
            shutil.copy2(ROOT / 'api' / name, self.root / 'api' / name)
        runner = self.root / 'request.php'
        runner.write_text('''<?php
        require __DIR__.'/app/auth.php'; start_app_session();
        $input=json_decode(stream_get_contents(STDIN),true);
        $_SERVER['REQUEST_METHOD']=$input['method']??'POST';
        $_SERVER['HTTP_HOST']='offline.invalid'; $_SERVER['CONTENT_TYPE']=$input['content_type']??'multipart/form-data';
        $_SERVER['HTTP_X_CSRF_TOKEN']=($input['csrf']??true)?$_SESSION['csrf']:'invalid';
        $_SERVER['REMOTE_ADDR']=$input['peer']??'127.0.0.1';
        $_SERVER['HTTP_X_FORWARDED_FOR']='127.0.0.1'; $_SERVER['HTTP_FORWARDED']='for="[::1]"';
        if(isset($input['origin']))$_SERVER['HTTP_ORIGIN']=$input['origin'];
        $_POST=$input['post']??[]; $_GET=$input['query']??[]; $_FILES=$input['files']??[];
        register_shutdown_function(function(){file_put_contents(__DIR__.'/status.txt',(string)http_response_code());});
        require __DIR__.'/api/register.php';
        ''', encoding='utf-8')

        def request(values, expected_status, expected_code):
            result = subprocess.run([php_binary(), str(runner)], input=json.dumps(values), cwd=self.root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stderr, '')
            self.assertEqual((self.root / 'status.txt').read_text(), str(expected_status))
            self.assertEqual(json.loads(result.stdout)['code'], expected_code)

        request({}, 403, 'registration_disabled')
        config = {'db_name': 'refind_db_0_2_0_test', 'base_path': '/registration-unit/', 'session_name': 'registration_unit', 'registration_enabled': True}
        (self.root / 'app/config.local.php').write_text('<?php return json_decode(' + json.dumps(json.dumps(config)) + ',true);', encoding='utf-8')
        request({'method': 'GET'}, 405, 'method_not_allowed')
        request({'peer': '192.0.2.1'}, 403, 'registration_disabled')
        request({'peer': '2001:db8::1'}, 403, 'registration_disabled')
        request({'csrf': False}, 403, 'csrf_invalid')
        request({'origin': 'https://outside.invalid'}, 403, 'csrf_invalid')
        request({'query': {'role': 'BUILDING_MANAGEMENT'}}, 400, 'invalid_request')
        request({'post': {'role': 'BUILDING_MANAGEMENT'}}, 400, 'invalid_request')
        request({'files': {'avatar': {'name': 'synthetic'}}}, 400, 'invalid_request')
        request({'content_type': 'application/json'}, 400, 'invalid_request')
        request({}, 422, 'validation_error')

    def test_fixture_refuses_unowned_source_before_mutation(self):
        (self.root / 'tools').mkdir()
        for name in ['registration-fixture.php', 'qa-guard.php']:
            shutil.copy2(ROOT / 'tools' / name, self.root / 'tools' / name)
        config = (self.root / 'app/config.local.php').read_bytes()
        result = subprocess.run([php_binary(), str(self.root / 'tools/registration-fixture.php'), 'begin', 'registration-' + 'a' * 16], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b'')
        self.assertEqual((self.root / 'app/config.local.php').read_bytes(), config)


if __name__ == '__main__':
    unittest.main(verbosity=2)
