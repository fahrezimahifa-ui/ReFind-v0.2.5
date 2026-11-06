"""Real Git/byte-manifest negatives; temporary synthetic repositories only."""
import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('registration_source', ROOT / 'tools/registration-source.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)


class SourceTests(unittest.TestCase):
    def setUp(self):
        out = ROOT / 'output/playwright/source-unit'
        out.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=out)
        self.root = Path(self.temp.name).resolve()
        for prefix in source.RUNTIME:
            folder = self.root / prefix
            folder.mkdir()
            (folder / 'fixture.txt').write_bytes(b'synthetic source\n')
        (self.root / 'README.md').write_bytes(b'original documentation\n')
        self.git('init', '-q')
        self.git('add', '.')
        self.git('-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.test', 'commit', '-qm', 'Synthetic source')
        self.manifest = source.capture(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, stderr=subprocess.DEVNULL)

    def test_exact_source_and_documentation_changes_are_detected(self):
        self.assertTrue(source.verify(self.root, self.manifest, 'checkout')['source_equivalent'])
        self.git('update-index', '--assume-unchanged', 'README.md')
        (self.root / 'README.md').write_bytes(b'unrelated documentation change\n')
        self.assertEqual(self.git('status', '--porcelain'), b'')
        with self.assertRaises(RuntimeError):
            source.verify(self.root, self.manifest, 'checkout')
        with self.assertRaises(RuntimeError):
            source.capture(self.root)

    def test_extra_application_source_is_not_silently_ignored(self):
        (self.root / 'api/extra.php').write_text('<?php', encoding='utf-8')
        with self.assertRaises(RuntimeError):
            source.verify(self.root, self.manifest, 'checkout')

    def test_private_paths_and_traversal_are_refused(self):
        for name in ['app/config.local.php', 'storage/auth/secret.json', '../private', '/private', 'C:/private', 'app/../private']:
            self.assertFalse(source.permitted(name))
        (self.root / 'app/config.local.php').write_text('synthetic private fixture', encoding='utf-8')
        self.git('add', 'app/config.local.php')
        with self.assertRaises(RuntimeError):
            source.tracked(self.root)


if __name__ == '__main__':
    unittest.main(verbosity=2)
