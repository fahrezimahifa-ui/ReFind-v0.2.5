"""Offline negative tests; no databases, services or dependency installation."""
import importlib.util
import subprocess
import contextlib
import io
from unittest import mock
from pathlib import Path
import tempfile
import unittest
import zipfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('runtime_qa', HERE / 'prepare-runtime-qa.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


class PreparationSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='refind-runtime-preparation-')
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def archive(self, entries):
        archive = self.root / 'input.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            for name, data in entries:
                z.writestr(name, data)
        return archive

    def test_malformed_archives_do_not_write_any_member(self):
        for bad in ('../escape', '/absolute', 'C:/escape', 'x/../../escape',
                    'x:stream', 'x/CON.txt', 'x/trailing.', 'x/trailing '):
            with self.subTest(name=bad):
                archive = self.archive([('valid/file.txt', 'synthetic'), (bad, 'bad')])
                destination = self.root / 'expanded'
                with self.assertRaises(RuntimeError):
                    qa.safe_extract(archive, destination)
                self.assertFalse(destination.exists())

    def test_symlink_and_case_collision_refused(self):
        symlink = zipfile.ZipInfo('linked')
        symlink.external_attr = 0o120777 << 16
        for entries in [[(symlink, '../outside')], [('file', 'one'), ('FILE', 'two')]]:
            with self.subTest(entries=entries):
                archive = self.archive(entries)
                with self.assertRaises(RuntimeError):
                    qa.safe_extract(archive, self.root / 'expanded')
                self.assertFalse((self.root / 'expanded').exists())

    def test_existing_destination_preserved(self):
        destination = self.root / 'expanded'
        destination.mkdir()
        sentinel = destination / 'keep'
        sentinel.write_text('existing')
        with self.assertRaises(RuntimeError):
            qa.safe_extract(self.archive([('keep', 'replacement')]), destination)
        self.assertEqual(sentinel.read_text(), 'existing')

    def test_hash_mismatch_prevents_extraction(self):
        archive = self.archive([('file', 'synthetic')])
        with self.assertRaises(RuntimeError):
            qa.check_digest(archive, '0' * 64)
        self.assertFalse((self.root / 'expanded').exists())

    def test_valid_archive_extracts_exact_content(self):
        archive = self.archive([('Apache24/', ''), ('Apache24/conf/file', 'synthetic')])
        qa.check_digest(archive, qa.sha256(archive))
        qa.safe_extract(archive, self.root / 'expanded')
        self.assertEqual((self.root / 'expanded/Apache24/conf/file').read_text(), 'synthetic')

    def test_redirected_parent_refused(self):
        destination = self.root / 'redirect'
        try:
            destination.symlink_to(self.root, target_is_directory=True)
        except OSError:
            result = subprocess.run(['cmd', '/d', '/c', 'mklink', '/J', str(destination), str(self.root)], capture_output=True)
            if result.returncode:
                self.skipTest('Windows link creation unavailable')
        with self.assertRaises(RuntimeError):
            qa.reject_redirects(destination / 'child')

    def test_download_redirects_refuse_downgrade_and_foreign_origin(self):
        policy = qa.PackageRedirectPolicy('www.apachelounge.com')
        for url in ('http://localhost/', 'https://other.invalid/package.zip', 'file:///C:/xampp/php/php.exe'):
            with self.subTest(url=url), self.assertRaises(RuntimeError):
                policy.redirect_request(None, None, 302, 'Redirect', {}, url)

    def test_source_copy_excludes_private_and_unreviewed_files(self):
        source = self.root / 'source'
        (source / 'app').mkdir(parents=True)
        (source / '.htaccess').write_text('synthetic public source')
        (source / 'app/config.php').write_text('synthetic public source')
        (source / 'app/.htaccess').write_text('Require all denied')
        (source / 'app/config.local.php').write_text('synthetic secret')
        subprocess.run(['git', 'init', '-q', str(source)], check=True, capture_output=True)
        subprocess.run(['git', '-C', str(source), 'add', '.'], check=True, capture_output=True)
        (source / 'app/unreviewed.php').write_text('synthetic private untracked file')
        names = qa.public_source_files(source)
        self.assertEqual(names, ['.htaccess', 'app/.htaccess', 'app/config.php'])

    @unittest.skipUnless(qa.os.name == 'nt', 'Windows-owned-tree preparation')
    def test_failed_download_retains_inert_owned_receipt(self):
        source = self.root / 'source'
        (source / 'app').mkdir(parents=True)
        (source / '.htaccess').write_text('synthetic public source')
        (source / 'app/config.php').write_text('synthetic public source')
        subprocess.run(['git', 'init', '-q', str(source)], check=True, capture_output=True)
        subprocess.run(['git', '-C', str(source), 'add', '.'], check=True, capture_output=True)
        opener = mock.Mock()
        opener.open.side_effect = RuntimeError('Rejected redirect')
        with mock.patch.dict(qa.os.environ, {'LOCALAPPDATA': str(self.root)}), mock.patch.object(qa, 'ensure_unused_ports'), mock.patch.object(qa.urllib.request, 'build_opener', return_value=opener), contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(RuntimeError):
                qa.prepare(source, download=True)
        receipt_path, = (self.root / 'ReFindRuntimeQA').glob('security-modernization-*/.refind-runtime-qa.json')
        receipt = qa.json.loads(receipt_path.read_text())
        self.assertEqual(receipt['phase'], 'prepared-incomplete')
        self.assertFalse(receipt['fixture_mutations_enabled'])
        self.assertEqual(receipt['packages'], {})
        self.assertEqual(receipt['source_files'], 2)
        self.assertFalse((receipt_path.parent / 'db/data').exists())

    def test_configs_bind_only_reserved_loopback_ports(self):
        configs = qa.render_configs(self.root)
        self.assertIn('Listen 127.0.0.1:8086', configs['httpd.conf'])
        self.assertIn('Listen [::1]:8086', configs['httpd.conf'])
        self.assertIn('bind-address=127.0.0.1', configs['my.ini'])
        self.assertIn('port=3312', configs['my.ini'])
        self.assertNotIn('3306', configs['my.ini'])
        self.assertIn('session.upload_progress.enabled=0', configs['php.ini'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
