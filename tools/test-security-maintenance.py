import importlib.util
from datetime import date
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('security',Path(__file__).with_name('check-security-maintenance.py'))
security=importlib.util.module_from_spec(spec);spec.loader.exec_module(security)

class MaintenanceTests(unittest.TestCase):
    def test_private_filenames_are_blocked_without_reading_contents(self):
        with tempfile.TemporaryDirectory() as p:
            # Files deliberately do not exist: a read would fail this test.
            result=security.scan(Path(p),['app/config.local.php','storage/sessions/private','test.local.json'])
            self.assertEqual(len(result),3)
            self.assertTrue(all('content not read' in r['type'] for r in result))

    def test_secret_value_is_redacted(self):
        with tempfile.TemporaryDirectory() as p:
            token='ghp_'+'A'*36
            (Path(p)/'example.php').write_text(token)
            result=security.scan(Path(p),['example.php'])
            self.assertEqual(result[0]['value'],'REDACTED')
            self.assertNotIn(token,json.dumps(result))

    def test_new_advisory_and_expired_exception_fail(self):
        finding={'id':'GHSA-synthetic','ecosystem':'npm','package':'synthetic','version':'1.0.0'}
        policy={'exceptions':[],'native_reviews':[]}
        self.assertEqual(security.assess([finding],policy,date(2026,11,2))['unreviewed_advisories'],[finding])
        policy['exceptions']=[finding|{'owner':'maintainer','decision':'synthetic decision','expires':'2026-11-01'}]
        self.assertTrue(security.assess([finding],policy,date(2026,11,2))['policy_errors'])

    def test_review_is_exact_and_time_bounded(self):
        finding={'id':'GHSA-synthetic','ecosystem':'npm','package':'synthetic','version':'1.0.0'}
        policy={'exceptions':[finding|{'owner':'maintainer','decision':'synthetic decision','expires':'2026-11-16'}],'native_reviews':[]}
        self.assertEqual(len(security.assess([finding],policy,date(2026,11,2))['reviewed_exceptions']),1)
        self.assertEqual(len(security.assess([finding|{'version':'2.0.0'}],policy,date(2026,11,2))['unreviewed_advisories']),1)

    def test_stale_native_inventory_fails(self):
        policy={'exceptions':[],'native_reviews':[{'component':'synthetic','owner':'maintainer','review_due':'2026-11-01'}]}
        self.assertTrue(security.assess([],policy,date(2026,11,2))['policy_errors'])

if __name__=='__main__':unittest.main(verbosity=2)
