"""Synthetic PHP 8.2 -> 8.4 password and session-format compatibility; no database."""
import argparse
import importlib.util
import json
from pathlib import Path
import secrets
import subprocess
import tempfile

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('native',HERE/'run-native-qa.py')
qa=importlib.util.module_from_spec(spec);spec.loader.exec_module(qa)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--qa-root',type=Path,required=True)
    args=parser.parse_args()
    root,marker,source,target=qa.load(args.qa_root)
    old=r'C:\xampp\php\php.exe';new=str(root/'php/php.exe')
    password='Synthetic!'+secrets.token_hex(12)
    result=subprocess.run([old,'-n','-r',"echo password_hash(stream_get_contents(STDIN), PASSWORD_BCRYPT, ['cost'=>10]);"],
        input=password.encode(),capture_output=True,check=True)
    original_hash=result.stdout.decode()
    code="$x=json_decode(stream_get_contents(STDIN),true);echo json_encode(['verified'=>password_verify($x['password'],$x['hash']),'cost'=>password_get_info($x['hash'])['options']['cost']]);"
    value=json.loads(subprocess.check_output([new,'-n','-r',code],input=json.dumps({'password':password,'hash':original_hash}).encode()))
    assert value=={'verified':True,'cost':10}
    payload={'auth':{'user_id':42,'issued_at':1770000000,'last_seen':1770000100,'fingerprint':'f'*64},
             'csrf':'a'*64,'synthetic_unicode':'ReFind · campus 🔎','unknown_event_time':None}
    with tempfile.TemporaryDirectory(prefix='php-compat-',dir=root/'tmp') as folder:
        assert Path(folder).resolve().is_relative_to((root/'tmp').resolve())
        common=['-n','-d','session.save_path='+folder,'-d','session.serialize_handler=php']
        write='session_name("refind_runtime_compat");session_start();$_SESSION=json_decode(stream_get_contents(STDIN),true);$id=session_id();session_write_close();echo $id;'
        sid=subprocess.check_output([old,*common,'-d','session.sid_length=26','-d','session.sid_bits_per_character=5','-r',write],input=json.dumps(payload,ensure_ascii=False).encode()).decode()
        assert len(sid)==26
        read='session_name("refind_runtime_compat");session_id($argv[1]);session_start();echo json_encode(["id"=>session_id(),"payload"=>$_SESSION]);session_write_close();'
        restored=json.loads(subprocess.check_output([new,*common,'-d','session.use_strict_mode=1','-r',read,sid]))
        assert restored['id']==sid and restored['payload']==payload
        result={'passed':True,'legacy_bcrypt_cost10_verified':True,'legacy_hash_unchanged':True,
                'legacy_session_id_length':len(sid),'strict_session_reader_preserved_id':True,
                'session_payload_unicode_null_and_auth_identical':True,'real_sessions_or_hashes_read':False}
    (root/'logs/php-legacy-compatibility.json').write_text(json.dumps(result,indent=2)+'\n', encoding='utf-8')
    print(json.dumps(result))

if __name__=='__main__':main()
