"""Verify TLS only on an owned synthetic LTS server, using an explicit private CA."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('native',HERE/'run-native-qa.py')
qa=importlib.util.module_from_spec(spec);spec.loader.exec_module(qa)

def run(root):
    state=json.loads((root/'.native-state.local.json').read_text(encoding='utf-8'))
    material=root/'tls'
    if not material.is_dir():raise RuntimeError('Run the existing private TLS preparer first')
    qa.prep.reject_redirects(material)
    wrong=material/'wrong-ca.pem'
    for path in [wrong,material/'wrong-ca.key']:
        qa.prep.reject_redirects(path)
        if path.exists():raise RuntimeError('Refuse existing wrong-CA test material')
    # A second independent CA is the ordinary negative case, not an exploit certificate.
    config=material/'ca.cnf'
    qa.prep.reject_redirects(config)
    generated=subprocess.run([str(root/'apache/Apache24/bin/openssl.exe'),'req','-x509','-newkey','rsa:2048',
        '-noenc','-sha256','-days','1','-config',str(config),'-keyout',str(material/'wrong-ca.key'),
        '-out',str(wrong)],capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW)
    if generated.returncode:raise RuntimeError('Negative test CA generation failed')
    db=qa.start_db(root,state,lts=True,tls=True)
    try:
        def client(ca):
            args=[str(qa.database_binary(root,True)/'mysql.exe'),'--no-defaults','--protocol=TCP',
                  '--host=127.0.0.1','--port=3313','--user=refind_runtime_dml','--default-character-set=utf8mb4',
                  '--batch','--raw','--skip-column-names','--ssl','--ssl-verify-server-cert','--ssl-ca='+str(ca)]
            query="SHOW SESSION STATUS LIKE 'Ssl_version'; SHOW SESSION STATUS LIKE 'Ssl_cipher'; SELECT CURRENT_USER();"
            return subprocess.run(args,input=query.encode(),env=os.environ|{'MYSQL_PWD':state['runtime_password']},capture_output=True)
        good=client(material/'ca.pem')
        if good.returncode:raise RuntimeError('Strict database TLS positive check failed: '+good.stderr.decode(errors='replace'))
        value=good.stdout.decode()
        if not ('TLSv1.3' in value or 'TLSv1.2' in value) or 'refind_runtime_dml@127.0.0.1' not in value:
            raise RuntimeError('Expected encrypted LTS runtime connection not established')
        bad=client(wrong)
        if bad.returncode==0 or b'2026' not in bad.stderr or not any(x in bad.stderr.lower() for x in [b'certificate',b'verify']):
            raise RuntimeError('Untrusted database certificate was not rejected for the expected reason')
        result={'synthetic_only':True,'passed':True,'explicit_private_ca':True,'server_certificate_verification_enabled':True,
                'encrypted_session_status':value.splitlines(),'untrusted_ca_denied_2026':True,
                'os_trust_changed':False,'application_db_tls_not_changed':True,
                'limitation':'Ordinary CA/TLS behavior does not establish WolfSSL advisory backport or build-flag status'}
        (root/'logs/native-db-tls-result.json').write_text(json.dumps(result,indent=2)+'\n', encoding='utf-8')
        print(json.dumps(result),flush=True)
    finally:qa.stop_db(root,state,db,lts=True)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--qa-root',type=Path,required=True)
    args=p.parse_args();root,_,_,_=qa.load(args.qa_root);run(root)

if __name__=='__main__':main()
