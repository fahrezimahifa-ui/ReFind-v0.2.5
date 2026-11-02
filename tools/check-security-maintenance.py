"""Read-only lockfile advisory review and redacted tracked-source secret checks."""
import argparse
from datetime import date
import json
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
PATTERNS={
    'GitHub token':re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'),
    'AWS access key':re.compile(rb'AKIA[0-9A-Z]{16}'),
    'private key':re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
}
TEXT={'.php','.js','.cjs','.py','.json','.lock','.md','.yml','.yaml','.sql','.ini','.conf','.html','.css','.xml'}


def protected_name(name):
    p=Path(name)
    if name in ['storage/.htaccess','storage/README.md','.env.example']:return False
    return (p.parts[0]=='storage' or p.name in ['config.local.php','.env','.dev.env'] or
            p.name.startswith('.env.') or p.name.endswith(('.local.json','.key','.p12','.pfx')))


def scan(root,names):
    findings=[]
    for name in names:
        p=Path(name)
        if p.is_absolute() or '..' in p.parts:
            findings.append({'file':name,'type':'invalid tracked path'});continue
        if protected_name(name):
            findings.append({'file':name,'type':'protected filename; content not read'});continue
        source=root/p
        if any(q.is_symlink() or getattr(q,'is_junction',lambda:False)() for q in [source,*source.parents] if q!=root.parent):
            findings.append({'file':name,'type':'filesystem redirect; content not read'});continue
        if p.suffix not in TEXT and p.name not in ['.htaccess','.gitignore']:continue
        data=source.read_bytes()
        for kind,pattern in PATTERNS.items():
            for match in pattern.finditer(data):
                findings.append({'file':name,'line':data.count(b'\n',0,match.start())+1,'type':kind,'value':'REDACTED'})
    return findings


def packages(root):
    result=set()
    lock=json.loads((root/'package-lock.json').read_text())
    for path,p in lock['packages'].items():
        if path and p.get('version'):
            result.add(('npm',p.get('name',path.rsplit('node_modules/',1)[-1]),p['version']))
    composer=json.loads((root/'composer.lock').read_text())
    for p in composer.get('packages',[])+composer.get('packages-dev',[]):
        result.add(('Packagist',p['name'],p['version'].lstrip('v')))
    return [{'package':{'ecosystem':e,'name':n},'version':v} for e,n,v in sorted(result)]


def query_osv(locked):
    request=urllib.request.Request('https://api.osv.dev/v1/querybatch',
        data=json.dumps({'queries':locked}).encode(),headers={'Content-Type':'application/json','User-Agent':'ReFindSecurityReview/1.0'})
    with urllib.request.urlopen(request,timeout=30) as response:
        raw=response.read(4*1024*1024+1)
    if len(raw)>4*1024*1024:raise RuntimeError('Unexpected advisory response size')
    results=json.loads(raw)['results']
    if len(results)!=len(locked):raise RuntimeError('Incomplete advisory response')
    return [{'ecosystem':p['package']['ecosystem'],'package':p['package']['name'],'version':p['version'],'id':v['id']}
            for p,result in zip(locked,results) for v in result.get('vulns',[])]


def assess(findings,policy,today):
    errors=[]
    exceptions=policy['exceptions']
    for entry in exceptions:
        if not entry.get('owner') or not entry.get('decision') or date.fromisoformat(entry['expires'])<today:
            errors.append({'type':'missing owner/decision or expired exception','id':entry.get('id')})
    for item in policy['native_reviews']:
        if not item.get('owner') or date.fromisoformat(item['review_due'])<today:
            errors.append({'type':'native advisory review overdue','component':item['component']})
    reviewed=[];unreviewed=[]
    for finding in findings:
        matching=[e for e in exceptions if all(e.get(k)==finding[k] for k in ['ecosystem','package','version','id'])
                  and date.fromisoformat(e['expires'])>=today]
        (reviewed if matching else unreviewed).append(finding)
    return {'reviewed_exceptions':reviewed,'unreviewed_advisories':unreviewed,'policy_errors':errors}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--online',action='store_true',help='Query OSV; no package installation or lockfile mutation')
    args=parser.parse_args()
    names=subprocess.check_output(['git','--no-optional-locks','ls-files','-z'],cwd=ROOT).decode().strip('\0').split('\0')
    secrets=scan(ROOT,names)
    policy=json.loads((ROOT/'docs/security/DEPENDENCY_REVIEW_POLICY.json').read_text())
    findings=query_osv(packages(ROOT)) if args.online else []
    result=assess(findings,policy,date.today())
    result.update({'scope':'Tracked public source and locked npm/Packagist versions; native BOM requires separate vendor review',
                   'online':args.online,'locked_packages':len(packages(ROOT)),'secret_findings':secrets})
    print(json.dumps(result,indent=2))
    raise SystemExit(bool(secrets or result['unreviewed_advisories'] or result['policy_errors']))

if __name__=='__main__':main()
