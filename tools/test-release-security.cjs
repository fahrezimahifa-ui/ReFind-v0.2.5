// Focused release regression; rejected requests and one disposable XSS fixture on QA only.
const qa=require('./qa-runtime.cjs');qa.assertQa();
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const out=process.env.REFIND_EVIDENCE_DIR||path.join(qa.root,'output/playwright/release-readiness/security');fs.mkdirSync(out,{recursive:true});
const results={scope:'Owned QA only',checks:[],errors:[]};let actor,browser;
function q(query,values=[]){return JSON.parse(execFileSync(qa.php,[path.join(qa.target,'tools/b02-fixture.php')],{input:JSON.stringify({action:'query',query,values}),encoding:'utf8'}));}
function save(){fs.writeFileSync(path.join(out,'security-results.json'),JSON.stringify(results,null,2)+'\n');}
async function check(name,fn){await fn();results.checks.push(name);save();console.log('PASS '+name);}
class Session{
 cookies=new Map();csrf='';
 async call(endpoint,values,headers={},files={}){
  const init={redirect:'manual',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...headers}};
  if(values!==undefined){const form=new FormData();for(const[k,v]of Object.entries(values))form.append(k,v);for(const[k,v]of Object.entries(files))form.append(k,new Blob([v.bytes],{type:v.type}),v.name);init.method='POST';init.body=form;init.headers['X-CSRF-Token']??=this.csrf;}
  const r=await fetch(qa.base+endpoint,init);for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1));}
  const text=await r.text();return{status:r.status,headers:r.headers,data:r.headers.get('content-type')?.includes('application/json')?JSON.parse(text):null,text};
 }
 async login(email,password){const guest=await this.call('api/session.php');this.csrf=guest.data.csrf;const r=await this.call('api/auth.php',{action:'login',email,password});assert.equal(r.status,200);this.csrf=r.data.csrf;}
}
(async()=>{
 try{
  const guest=new Session();
  await check('Internal code, SQL, credentials, Git metadata, dependencies and generated evidence are denied by Apache',async()=>{
   for(const relative of ['app/config.local.php','storage/auth/secret.json','storage/setup/demo-accounts.json','database/schema.sql','tools/b02-fixture.php','.git/config','.env','output/playwright/capture.png','node_modules/playwright/package.json','composer.lock','package-lock.json']){
    const r=await guest.call(relative);assert.equal(r.status,403,relative);assert.ok(!r.text.includes('<?php'));
   }
  });
  await check('Unauthenticated private API returns generic JSON and security headers',async()=>{
   const r=await guest.call('api/items.php');assert.equal(r.status,401);assert.equal(r.data.code,'authentication_required');assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');
  });
  const run='SEC-'+crypto.randomBytes(8).toString('hex'),password='Synthetic!'+crypto.randomBytes(14).toString('hex'),name='<img src=x onerror="window.releaseXss=1">';
  const hash=execFileSync(qa.php,['-r','echo password_hash(stream_get_contents(STDIN),PASSWORD_DEFAULT);'],{input:password,encoding:'utf8'});
  const email=run.toLowerCase()+'@refind.test';actor=q("INSERT INTO users(full_name,email,student_id,role,password_hash) VALUES (?,?,?,'STUDENT',?)",[name,email,run,hash]).id;
  const student=new Session();await student.login(email,password);
  await check('Session cookie is HttpOnly/SameSite and Student cannot use BM API',async()=>{
   const response=await student.call('api/staff.php');assert.equal(response.status,403);assert.equal(response.data.code,'forbidden');
   const fresh=new Session(),session=await fresh.call('api/session.php');const cookies=session.headers.getSetCookie().join(';');assert.match(cookies,/httponly/i);assert.match(cookies,/samesite=lax/i);
  });
  await check('Invalid token and cross-site origin are rejected before profile writes',async()=>{
   for(const headers of [{'X-CSRF-Token':'invalid'},{Origin:'https://attacker.invalid'}]){const r=await student.call('api/account.php',{action:'update_profile',name:'Must never be saved'},headers);assert.equal(r.status,403);assert.equal(r.data.code,'csrf_invalid');}
   assert.equal((await student.call('api/account.php')).data.profile.name,name);
  });
  await check('SQL-shaped input stays data and malformed/private-photo requests fail safely',async()=>{
   assert.equal((await student.call('api/items.php?q='+encodeURIComponent("' OR 1=1 --"))).data.total,0);
   assert.equal((await student.call('api/photos.php?kind=../../app&id=1')).status,400);
   assert.equal((await student.call('api/photos.php?kind=claim&id=1')).status,403);
   const r=await student.call('api/items.php',{action:'create',type:'FOUND',title:run,description:'Synthetic upload validation',category_id:'1',location_id:'35',date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),time:'',clue:'Synthetic private clue'}, {}, {'photos[]':{bytes:'<svg onload="alert(1)"></svg>',type:'image/svg+xml',name:'../../unsafe.php'}});
   assert.equal(r.status,422);assert.equal(q('SELECT COUNT(*) AS n FROM items WHERE reporter_user_id=?',[Number(actor)]).rows[0].n,0);
  });
  browser=await qa.playwright().chromium.launch({executablePath:qa.chromePath(),headless:true});
  await check('Stored display-name markup renders as text under the existing CSP',async()=>{
   const c=await browser.newContext();await c.addCookies([{name:'refind_020_test',value:student.cookies.get('refind_020_test'),domain:'localhost',path:'/ReFind_0.2.0_Test/',httpOnly:true,sameSite:'Lax'}]);
   const p=await c.newPage();p.on('pageerror',e=>results.errors.push(String(e)));const response=await p.goto(qa.base+'profile.html');await p.waitForSelector('body[data-ready="true"]');await p.waitForLoadState('networkidle');
   assert.equal(await p.locator('[data-profile-name]').innerText(),name);assert.equal(await p.locator('[data-profile-name] img').count(),0);assert.equal(await p.evaluate(()=>window.releaseXss),undefined);assert.match(response.headers()['content-security-policy'],/script-src 'self'/);assert.deepEqual(results.errors,[]);await c.close();
  });
  results.complete=true;
 }finally{if(browser)await browser.close();if(actor)q('DELETE FROM users WHERE user_id=?',[Number(actor)]);save();}
})().catch(e=>{console.error(e);process.exitCode=1;});
