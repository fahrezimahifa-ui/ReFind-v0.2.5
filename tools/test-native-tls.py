"""Private TLS rehearsal with an explicit test CA; never changes OS trust or ignores TLS errors."""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import time

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('native',HERE/'run-native-qa.py')
qa=importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


def prepare(root):
    folder=root/'tls'
    if folder.exists():raise RuntimeError('Refuse existing TLS material')
    folder.mkdir()
    ca='[req]\ndistinguished_name=dn\nx509_extensions=ca\nprompt=no\n[dn]\nCN=ReFind isolated QA CA\n[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n'
    leaf='[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=localhost\n[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1\n'
    (folder/'ca.cnf').write_text(ca, encoding='utf-8');(folder/'server.cnf').write_text(leaf, encoding='utf-8')
    openssl=str(root/'apache/Apache24/bin/openssl.exe')
    commands=[
        ['req','-x509','-newkey','rsa:2048','-noenc','-sha256','-days','7','-config',str(folder/'ca.cnf'),'-keyout',str(folder/'ca.key'),'-out',str(folder/'ca.pem')],
        ['req','-new','-newkey','rsa:2048','-noenc','-config',str(folder/'server.cnf'),'-keyout',str(folder/'server.key'),'-out',str(folder/'server.csr')],
        ['x509','-req','-sha256','-days','7','-in',str(folder/'server.csr'),'-CA',str(folder/'ca.pem'),'-CAkey',str(folder/'ca.key'),'-CAcreateserial','-extfile',str(folder/'server.cnf'),'-extensions','server','-out',str(folder/'server.pem')]]
    for cmd in commands:
        result=subprocess.run([openssl,*cmd],capture_output=True,text=True,creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:raise RuntimeError('Private TLS material generation failed: '+result.stderr[-200:])
    config=f"""LoadModule socache_shmcb_module modules/mod_socache_shmcb.so
LoadModule ssl_module modules/mod_ssl.so
Listen 127.0.0.1:8446
Listen [::1]:8446
SSLProtocol -all +TLSv1.2 +TLSv1.3
SSLCipherSuite HIGH:!aNULL:!MD5:!3DES
<VirtualHost 127.0.0.1:8446 [::1]:8446>
 ServerName localhost:8446
 SSLEngine on
 SSLCertificateFile "{(folder/'server.pem').as_posix()}"
 SSLCertificateKeyFile "{(folder/'server.key').as_posix()}"
</VirtualHost>
"""
    (root/'conf/tls.conf').write_text(config, encoding='utf-8')


def run(root,source):
    state=json.loads((root/'.native-state.local.json').read_text(encoding='utf-8'))
    # Reuse whichever explicitly isolated database the QA config currently selects.
    import base64,re
    target=root/'www/ReFind_0.2.3'
    encoded=re.search("base64_decode\\('([^']+)'\\)",(target/'app/config.local.php').read_text(encoding='utf-8'))[1]
    port=json.loads(base64.b64decode(encoded))['db_port']
    if port not in [3312,3313]:raise RuntimeError('Unexpected synthetic DB endpoint')
    qa.free_port(8086);qa.free_port(8446)
    p=root/'conf/httpd.conf'
    include='Include "'+(root/'conf/tls.conf').as_posix()+'"'
    if include not in p.read_text(encoding='utf-8'):p.write_text(p.read_text(encoding='utf-8')+'\n'+include+'\n', encoding='utf-8')
    result=subprocess.run([str(root/'apache/Apache24/bin/httpd.exe'),'-t','-f',str(p)],capture_output=True,text=True)
    if result.returncode:raise RuntimeError('Owned TLS configuration syntax failed')
    db=qa.start_db(root,state,lts=port==3313)
    apache=None
    try:
        log=(root/'logs/tls-apache-process.log').open('ab')
        apache=subprocess.Popen([str(root/'apache/Apache24/bin/httpd.exe'),'-f',str(p)],cwd=root,
            env=qa.environment(root,source),stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
        log.close()
        for _ in range(100):
            if apache.poll() is not None:raise RuntimeError('Owned TLS Apache stopped')
            if qa.open_port(8446):break
            time.sleep(.2)
        script=r"""
const https=require('node:https'),fs=require('node:fs'),assert=require('node:assert/strict');
const ca=fs.readFileSync(process.argv[1]),checks=[];
function request(options){return new Promise((resolve,reject)=>{const req=https.get({hostname:'localhost',port:8446,path:'/ReFind_0.2.3/api/session.php',rejectUnauthorized:true,...options},r=>{const protocol=r.socket.getProtocol();r.resume();r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,protocol}));});req.on('error',reject);});}
(async()=>{
const good=await request({ca});assert.equal(good.status,200);assert.ok(['TLSv1.2','TLSv1.3'].includes(good.protocol));
assert.ok(good.headers['set-cookie'].some(c=>/;\s*Secure/i.test(c)&&/;\s*HttpOnly/i.test(c)&&/SameSite=Lax/i.test(c)));
checks.push('Explicit CA chain, localhost hostname, TLS1.2+/Secure HttpOnly Lax cookie');
await assert.rejects(request({}),e=>['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(e.code));checks.push('Untrusted CA rejected');
await assert.rejects(request({ca,servername:'wrong.invalid'}),e=>e.code==='ERR_TLS_CERT_ALTNAME_INVALID');checks.push('Wrong hostname rejected');
await assert.rejects(request({ca,minVersion:'TLSv1.1',maxVersion:'TLSv1.1',ciphers:'DEFAULT:@SECLEVEL=0'}),e=>/ALERT_PROTOCOL_VERSION/.test(e.code)||(e.code==='EPROTO'&&/tlsv1 alert protocol version[\s\S]*SSL alert number 70/.test(e.message)));checks.push('Server rejects TLS1.1');
console.log(JSON.stringify({passed:true,protocol:good.protocol,checks}));
})().catch(e=>{console.error((e.code||'')+': '+e.message);process.exitCode=1;});
"""
        result=subprocess.run([str(root/'node/node-v24.22.2-win-x64/node.exe'),'-e',script,str(root/'tls/ca.pem')],
            capture_output=True,text=True,timeout=30)
        if result.returncode:raise RuntimeError('TLS verification failed: '+result.stderr)
        (root/'logs/native-tls-result.json').write_text(result.stdout, encoding='utf-8')
        print(result.stdout,flush=True)
        # Preserve only non-sensitive native module identities; no certificate private keys.
        command="Get-Process -Id "+str(apache.pid)+" | ForEach-Object { $_.Modules | Where-Object { $_.ModuleName -match 'libcrypto|libssl|vcruntime' } | ForEach-Object { [pscustomobject]@{Name=$_.ModuleName;Path=$_.FileName;Version=$_.FileVersionInfo.FileVersion} } } | ConvertTo-Json"
        metadata=subprocess.check_output(['powershell','-NoProfile','-Command',command]).decode()
        (root/'logs/tls-native-modules.json').write_text(metadata, encoding='utf-8')
        print(metadata,flush=True)
    finally:
        if apache and apache.poll() is None:
            subprocess.run(['taskkill','/PID',str(apache.pid),'/T','/F'],check=True,capture_output=True)
            apache.wait(timeout=20)
        qa.stop_db(root,state,db,lts=port==3313)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--qa-root',type=Path,required=True)
    parser.add_argument('--prepare-only',action='store_true')
    args=parser.parse_args()
    root,marker,source,target=qa.load(args.qa_root)
    if not (root/'tls').exists():prepare(root)
    if not args.prepare_only:run(root,source)

if __name__=='__main__':main()
