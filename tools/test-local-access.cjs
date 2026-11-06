// Apache boundary checks only; disposable QA ownership is required before any request.
const qa=require('./qa-runtime.cjs');qa.assertQa();
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
assert.equal(process.env.REFIND_CI_DISPOSABLE,'1');
const out=process.env.REFIND_EVIDENCE_DIR||path.join(qa.root,'output/playwright/local-access',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(out,{recursive:true});assert.ok(!fs.existsSync(path.join(out,'results.json')));
const checks=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
(async()=>{
 try{
  await check('Real IPv4 and IPv6 loopback peers reach pages, APIs and assets',async()=>{
   for(const host of ['127.0.0.1','[::1]','[::ffff:127.0.0.1]']){
    const base='http://'+host+qa.basePath;
    for(const url of ['login.html','api/session.php','css/auth.css']){
     const response=await fetch(base+url,{redirect:'manual'});assert.equal(response.status,200,'Loopback request failed');
    }
   }
  });
  await check('Non-loopback peers cannot access root, pages, API, assets or alternate paths',async()=>{
   const base='http://qa'+qa.basePath;
   for(const endpoint of ['', 'login.html','register.html','api/session.php','api/register.php','css/auth.css','assets/refind-logo-mark.svg','api/bootstrap.php','app/config.php','storage/','page.php?route=register.html','%6cogin.html','REGISTER.html']){
    for(const method of ['GET','HEAD']){
     const response=await fetch(base+endpoint,{method,redirect:'manual',headers:{Host:'localhost','X-Forwarded-For':'127.0.0.1',Forwarded:'for="[::1]"'}});
     assert.equal(response.status,403,'Non-loopback resource was not denied');assert.equal(response.headers.getSetCookie().length,0);
    }
   }
   const post=await fetch(base+'api/register.php',{method:'POST',headers:{Host:'localhost','X-Forwarded-For':'::1','Content-Type':'application/x-www-form-urlencoded'},body:'name=Synthetic+Blocked'});
   assert.equal(post.status,403);assert.equal(post.headers.getSetCookie().length,0);
  });
  await check('The sibling site retains non-loopback access; removed key API is unavailable locally',async()=>{
   const sibling=await fetch('http://qa/refind-boundary-sibling.txt');assert.equal(sibling.status,200);assert.equal(await sibling.text(),'owned QA sibling\n');
   assert.equal((await fetch(qa.base+'api/registration-access.php')).status,404);
   for(const endpoint of ['api/bootstrap.php','app/config.php','tools/','storage/','database/']){
    assert.equal((await fetch(qa.base+endpoint,{redirect:'manual'})).status,403,'Internal denial was weakened');
   }
  });
  if(process.env.REFIND_QA_TLS_CERT)await check('The same directory boundary covers verified HTTPS on loopback and non-loopback',async()=>{
   const cert=process.env.REFIND_QA_TLS_CERT;
   assert.equal(cert,'/tmp/refind-owned-tls/cert.pem');
   for(const host of ['127.0.0.1','[::1]','qa'])for(const endpoint of ['login.html','register.html','api/session.php','css/auth.css']){
    const status=execFileSync('curl',['--silent','--show-error','--cacert',cert,'--output','/dev/null','--write-out','%{http_code}','--header','X-Forwarded-For: 127.0.0.1','https://'+host+qa.basePath+endpoint],{encoding:'utf8'});
    assert.equal(status,host==='qa'?'403':endpoint==='register.html'?'302':'200');
   }
  });
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',scope:'Owned unpublished QA network only',https:process.env.REFIND_QA_TLS_CERT?'PASS':'NOT RUN: TLS profile not configured',checks},null,2));
 }catch{
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'FAIL',checks,sensitive_details:'not recorded'},null,2));
  console.error('Apache local access check failed; inspect the sanitized stage receipt.');process.exitCode=1;
 }
})();
