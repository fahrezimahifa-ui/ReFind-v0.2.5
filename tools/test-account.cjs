const qaRuntime = require('./qa-runtime.cjs');
qaRuntime.assertQa();
const {themedContext}=require('./qa-browser.cjs');
// B03 integration tests: actual HTTP/SQL/browser; mutations only in the owned _test copy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const testRoot = path.resolve(root,'..','ReFind_0.2.0_Test');
const base = 'http://localhost/ReFind_0.2.0_Test/';
const php = qaRuntime.php;
const {chromium} = qaRuntime.playwright();
const out = process.env.REFIND_EVIDENCE_DIR ? path.resolve(process.env.REFIND_EVIDENCE_DIR) : process.env.REFIND_EVIDENCE_BATCH ? path.join(root,'docs','verification',process.env.REFIND_EVIDENCE_BATCH,'account') : path.join(root,'docs','verification','b03');
assert.ok(fs.existsSync(path.join(testRoot,'.refind-b02-test.json')));
fs.mkdirSync(out,{recursive:true});
const run = 'B03-' + Date.now().toString(36);
const results=[], browserErrors=[], viewportChecks=[], created=[];
let browser, reportItem, notification;
function driver(input) { return JSON.parse(execFileSync(php,[path.join(testRoot,'tools','b02-fixture.php')],{input:JSON.stringify(input),encoding:'utf8'})); }
function query(query,values=[]) { return driver({action:'query',query,values}); }
function hash(password) { return execFileSync(php,['-r','echo password_hash(stream_get_contents(STDIN), PASSWORD_DEFAULT);'],{input:password,encoding:'utf8'}); }
function resetLimits() { driver({action:'clear_throttle'}); driver({action:'clear_password_throttle'}); }
function persist(extra={}) { fs.writeFileSync(path.join(out,'account-results.json'),JSON.stringify({scope:'B03 real profile/password/navbar integration on _test; future workflows pending',run,results,passed:results.length,browserErrors,viewportChecks,...extra},null,2)+'\n'); }
async function test(name,fn) { await fn();results.push(name);persist();console.log('PASS '+results.length+': '+name); }
function account(label,role='STUDENT') {
  const password='Initial!'+crypto.randomBytes(8).toString('hex');
  const email=run.toLowerCase()+'-'+label.toLowerCase()+'@refind.test';
  const name='QA '+label;
  const studentId=role==='STUDENT'?run+'-'+label:null;
  const id=query('INSERT INTO users(full_name,email,student_id,role,password_hash) VALUES (?,?,?,?,?)',[name,email,studentId,role,hash(password)]).id;
  created.push(id); return {id,email,name,studentId,role,password};
}
class Session {
  cookies=new Map();csrf='';user=null;
  id() { return this.cookies.get('refind_020_test'); }
  async call(endpoint,values,options={}) {
    const headers={Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...(options.headers||{})};
    const init={headers,redirect:'manual'};
    if(values!==undefined) { const form=new FormData();Object.entries(values).forEach(([k,v])=>form.append(k,v));init.method='POST';init.body=form;headers['X-CSRF-Token']=options.csrf===undefined?this.csrf:options.csrf; }
    const r=await fetch(base+endpoint,init);
    for(const cookie of r.headers.getSetCookie()) {const pair=cookie.split(';')[0],i=pair.indexOf('='),name=pair.slice(0,i),value=pair.slice(i+1);if(value)this.cookies.set(name,value);else this.cookies.delete(name);}
    const text=await r.text();const data=(r.headers.get('content-type')||'').includes('application/json')?JSON.parse(text):text;
    return {status:r.status,headers:r.headers,data,text};
  }
  async login(a) {let r=await this.call('api/session.php');this.csrf=r.data.csrf;r=await this.call('api/auth.php',{action:'login',email:a.email,password:a.password});assert.equal(r.status,200,r.text);this.csrf=r.data.csrf;this.user=r.data.user;return this;}
  async change(a,next) {const r=await this.call('api/account.php',{action:'change_password',current_password:a.password,new_password:next,confirm_password:next});assert.equal(r.status,200,r.text);this.csrf=r.data.csrf;a.password=next;return r;}
}
async function openAccountMenu(page) {
  if(await page.locator('#nav-toggle').isVisible() && await page.locator('#nav-toggle').getAttribute('aria-expanded')!=='true') await page.click('#nav-toggle');
  if(await page.locator('#account-toggle').getAttribute('aria-expanded')!=='true') await page.click('#account-toggle');
}
async function loggedPage(a,viewport={width:390,height:844}) {
  const s=await new Session().login(a),context=await themedContext(browser,{viewport});
  await context.addCookies([{name:'refind_020_test',value:s.id(),domain:'localhost',path:'/ReFind_0.2.0_Test/',httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage();page.on('pageerror',e=>browserErrors.push(String(e)));
  return {s,page,context};
}
async function go(page,route) {const r=await page.goto(base+route);await page.waitForSelector('body[data-ready="true"]');return r;}

(async()=>{
  resetLimits();
  const A=account('StudentA'),B=account('StudentB'),BM=account('Management','BUILDING_MANAGEMENT');
  try {
    const a=await new Session().login(A),b=await new Session().login(B),bm=await new Session().login(BM);
    await test('Profile/Settings real routes are protected and own data is scoped',async()=>{
      const guest=new Session();for(const route of ['profile.html','settings.html']) {assert.equal((await guest.call(route)).status,302);assert.equal((await a.call(route)).status,200);assert.equal((await bm.call(route)).status,200);}
      const own=await a.call('api/account.php');assert.equal(own.data.profile.id,A.id);assert.equal(own.data.profile.email,A.email);assert.equal(own.data.profile.student_id,A.studentId);
      assert.equal((await bm.call('api/account.php')).data.profile.student_id,null);assert.ok(!own.text.includes('password_hash')&&!own.text.includes('fingerprint'));
    });
    await test('Student/BM names persist after reload and relogin',async()=>{
      for(const [session,user] of [[a,A],[bm,BM]]) {
        const next='  Updated '+user.name+'  ';const r=await session.call('api/account.php',{action:'update_profile',name:next});assert.equal(r.status,200,r.text);user.name=next.trim();
        assert.equal(query('SELECT full_name FROM users WHERE user_id=?',[Number(user.id)]).rows[0].full_name,user.name);
        assert.equal((await session.call('api/session.php')).data.user.name,user.name);
        const other=await new Session().login(user);assert.equal((await other.call('api/account.php')).data.profile.name,user.name);
      }
    });
    await test('Display name follows DB public reporter projection without leaking identifiers',async()=>{
      reportItem=query("INSERT INTO items(reporter_user_id,category_id,location_id,item_type,title,description,event_date) VALUES (?,1,35,'LOST',?,'Public test report','2026-10-10')",[Number(A.id),run+' reporter']).id;
      const r=await b.call('api/items.php?id='+reportItem);assert.equal(r.data.item.reporter_name,A.name);assert.ok(!r.text.includes(A.email)&&!r.text.includes(A.studentId));
    });
    await test('Name validation handles UTF-8 boundaries and rejects invalid fields atomically',async()=>{
      const old=query('SELECT * FROM users WHERE user_id=?',[Number(A.id)]).rows;
      for(const name of ['','   ','x'.repeat(121),'Bad\nName','Bad\0Name']) {const r=await a.call('api/account.php',{action:'update_profile',name});assert.equal(r.status,422);assert.ok(r.data.fields.name);assert.deepEqual(query('SELECT * FROM users WHERE user_id=?',[Number(A.id)]).rows,old);}
      const name='é'.repeat(120);assert.equal((await a.call('api/account.php',{action:'update_profile',name})).status,200);
      assert.equal((await a.call('api/account.php')).data.profile.name,name);
      assert.equal((await a.call('api/account.php',{action:'update_profile',name:A.name})).status,200);
    });
    await test('Readonly identity/role and foreign account targets cannot be mutated',async()=>{
      const before=query('SELECT * FROM users WHERE user_id IN (?,?) ORDER BY user_id',[Number(A.id),Number(B.id)]).rows;
      for(const field of ['email','student_id','role','user_id']) {const r=await a.call('api/account.php',{action:'update_profile',name:'Injected', [field]:field==='user_id'?B.id:'BUILDING_MANAGEMENT'});assert.equal(r.status,400);}
      assert.equal((await a.call('api/account.php?user_id='+B.id)).status,400);
      assert.deepEqual(query('SELECT * FROM users WHERE user_id IN (?,?) ORDER BY user_id',[Number(A.id),Number(B.id)]).rows,before);
    });
    await test('Guest/invalid CSRF/foreign origin account writes leave data unchanged',async()=>{
      const before=query('SELECT * FROM users WHERE user_id=?',[Number(A.id)]).rows;
      assert.equal((await new Session().call('api/account.php',{action:'update_profile',name:'No'})).status,401);
      assert.equal((await a.call('api/account.php',{action:'update_profile',name:'No'},{csrf:''})).status,403);
      assert.equal((await a.call('api/account.php',{action:'update_profile',name:'No'},{headers:{Origin:'https://outside.example'}})).status,403);
      assert.deepEqual(query('SELECT * FROM users WHERE user_id=?',[Number(A.id)]).rows,before);
    });
    await test('Password validation rejects incorrect old, mismatch, unchanged and unsafe lengths',async()=>{
      const before=query('SELECT password_hash,updated_at FROM users WHERE user_id=?',[Number(A.id)]).rows;
      const cases=[['wrong',A.password+'new',A.password+'new'],[A.password,'short','short'],[A.password,'ValidNewPassword!','DifferentPassword!'],[A.password,A.password,A.password],[A.password,'x'.repeat(73),'x'.repeat(73)],[A.password,'😀'.repeat(20),'😀'.repeat(20)],[A.password,'abc\0defghijk','abc\0defghijk']];
      for(const [current_password,new_password,confirm_password] of cases) {const r=await a.call('api/account.php',{action:'change_password',current_password,new_password,confirm_password});assert.equal(r.status,422,r.text);assert.ok(r.data.fields);assert.deepEqual(query('SELECT password_hash,updated_at FROM users WHERE user_id=?',[Number(A.id)]).rows,before);}
    });
    await test('Password change rotates current session/CSRF, revokes other sessions, and changes login',async()=>{
      const other=await new Session().login(A),oldCookie=a.id(),oldCsrf=a.csrf,oldPassword=A.password;
      const next='  Zółć New Password!  ';const r=await a.change(A,next);
      assert.notEqual(a.id(),oldCookie);assert.notEqual(a.csrf,oldCsrf);assert.equal((await a.call('api/account.php')).status,200);
      assert.equal((await other.call('api/account.php')).status,401);
      const replay=new Session();replay.cookies.set('refind_020_test',oldCookie);replay.csrf=oldCsrf;assert.equal((await replay.call('api/account.php')).status,401);
      assert.equal((await a.call('api/account.php',{action:'update_profile',name:'Bad stale token'},{csrf:oldCsrf})).status,403);
      const old=new Session();let g=await old.call('api/session.php');old.csrf=g.data.csrf;assert.equal((await old.call('api/auth.php',{action:'login',email:A.email,password:oldPassword})).status,401);
      await new Session().login(A);assert.ok(!r.text.includes('password_hash')&&!r.text.includes(next));
    });
    await test('BM can change own password without gaining Student-only actions',async()=>{
      await bm.change(BM,'B03 Management Password!');assert.equal((await bm.call('report.html')).status,403);assert.equal((await bm.call('settings.html')).status,200);
      await new Session().login(BM);
    });
    await test('Maximum bcrypt byte boundary works and suffix/overlong UTF-8 is rejected',async()=>{
      const next='p'.repeat(72);await b.change(B,next);await new Session().login(B);
      const before=query('SELECT password_hash FROM users WHERE user_id=?',[Number(B.id)]).rows;
      const r=await b.call('api/account.php',{action:'change_password',current_password:next+'x',new_password:'DifferentValid!123',confirm_password:'DifferentValid!123'});assert.equal(r.status,422);
      assert.deepEqual(query('SELECT password_hash FROM users WHERE user_id=?',[Number(B.id)]).rows,before);
      await b.change(B,'StudentB B03 Password!');
    });
    await test('Failed current-password attempts are limited across sessions and refresh',async()=>{
      driver({action:'clear_password_throttle'});
      for(let i=0;i<5;i++) {const s=await new Session().login(B);assert.equal((await s.call('api/account.php',{action:'change_password',current_password:'WrongCurrent!123',new_password:'AnotherValidPassword!',confirm_password:'AnotherValidPassword!'})).status,422);}
      const s=await new Session().login(B);const r=await s.call('api/account.php',{action:'change_password',current_password:B.password,new_password:'AnotherValidPassword!',confirm_password:'AnotherValidPassword!'});assert.equal(r.status,429);assert.ok(Number(r.headers.get('Retry-After'))>0);
      driver({action:'clear_password_throttle'});
    });
    await test('Two concurrent password changes produce one winner, not two overwrites',async()=>{
      const race=account('Race'),s1=await new Session().login(race),s2=await new Session().login(race);
      const values1={action:'change_password',current_password:race.password,new_password:'RacePasswordAlpha!1',confirm_password:'RacePasswordAlpha!1'};
      const values2={action:'change_password',current_password:race.password,new_password:'RacePasswordBeta!2',confirm_password:'RacePasswordBeta!2'};
      const r=await Promise.all([s1.call('api/account.php',values1),s2.call('api/account.php',values2)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,401]);
      race.password=r[0].status===200?values1.new_password:values2.new_password;await new Session().login(race);
    });
    await test('Expired session cannot submit a profile/password mutation',async()=>{
      const s=await new Session().login(A),before=query('SELECT full_name,password_hash FROM users WHERE user_id=?',[Number(A.id)]).rows;
      driver({action:'expire',id:s.id(),type:'idle'});assert.equal((await s.call('api/account.php',{action:'update_profile',name:'Expired'})).status,401);
      assert.deepEqual(query('SELECT full_name,password_hash FROM users WHERE user_id=?',[Number(A.id)]).rows,before);
    });
    if(process.argv.includes('--api-only')) {persist({complete:true,apiOnly:true});return;}
    browser=await chromium.launch({executablePath:qaRuntime.chromePath(),headless:true});
    await test('Profile UI readonly fields and private Student identifier differ correctly by role',async()=>{
      for(const user of [A,BM]) {const {page,context}=await loggedPage(user);await go(page,'profile.html');assert.equal(await page.inputValue('#display-name'),user.name);assert.equal(await page.inputValue('#profile-email'),user.email);assert.equal(await page.locator('#profile-email').getAttribute('readonly'),'');assert.equal(await page.locator('#student-id-field').isVisible(),user.role==='STUDENT');await context.close();}
    });
    await test('Profile save updates summary/navbar, reload and relogin',async()=>{
      const {page,context}=await loggedPage(A);await go(page,'profile.html');const name='Saved through browser '+run;await page.fill('#display-name',name);await page.click('#profile-save');await page.waitForFunction(()=>!document.querySelector('#profile-feedback').hidden&&document.querySelector('#profile-feedback').classList.contains('success'));
      A.name=name;assert.equal(await page.locator('[data-profile-name]').innerText(),name);await openAccountMenu(page);assert.equal(await page.locator('[data-shell-user-name]').innerText(),name);await page.reload();await page.waitForSelector('body[data-ready="true"]');assert.equal(await page.inputValue('#display-name'),name);
      await new Session().login(A);await context.close();
    });
    await test('Client validation and reset keep a meaningful draft and keyboard focus',async()=>{
      const {page,context}=await loggedPage(A);await go(page,'profile.html');await page.fill('#display-name','   ');await page.click('#profile-save');assert.equal(await page.locator('#display-name').getAttribute('aria-invalid'),'true');assert.equal(await page.evaluate(()=>document.activeElement.id),'display-name');
      await page.click('#profile-reset');assert.equal(await page.inputValue('#display-name'),A.name);assert.equal(await page.locator('#name-error').isHidden(),true);await context.close();
    });
    await test('Failed save keeps draft/retry state, and busy controls prevent duplicate requests',async()=>{
      const {page,context}=await loggedPage(A);await go(page,'profile.html');const draft='Retry profile '+run;await page.fill('#display-name',draft);
      await page.route('**/api/account.php',r=>r.request().method()==='POST'?r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({ok:false,message:'Simulated save failure'})}):r.continue());await page.click('#profile-save');await page.waitForFunction(()=>!document.querySelector('#profile-feedback').hidden&&!document.querySelector('#profile-fields').disabled);assert.equal(await page.inputValue('#display-name'),draft);await page.unroute('**/api/account.php');
      let requests=0,release,start;
      const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>start=resolve);
      await page.route('**/api/account.php',async r=>{if(r.request().method()==='POST'){requests++;start();await gate;}await r.continue();});
      await page.click('#profile-save');await started;
      assert.equal(await page.locator('#profile-fields').evaluate(el=>el.disabled),true);
      assert.equal(await page.locator('#profile-save').isDisabled(),true);
      release();await page.waitForFunction(()=>document.querySelector('#profile-feedback').classList.contains('success'));assert.equal(requests,1);A.name=draft;await context.close();
    });
    await test('Password UI success clears inputs, keeps current login, revokes peer and permits logout',async()=>{
      const peer=await new Session().login(A);const {page,context}=await loggedPage(A);await go(page,'settings.html');
      await page.fill('#current-password','WrongCurrent!123');await page.fill('#new-password','BrowserNewPassword!123');await page.fill('#confirm-password','BrowserNewPassword!123');await page.click('#password-save');await page.waitForFunction(()=>document.querySelector('#current-password').getAttribute('aria-invalid')==='true'&&!document.querySelector('#password-fields').disabled);assert.equal(await page.evaluate(()=>document.activeElement.id),'current-password');
      await page.fill('#current-password',A.password);await page.click('#password-save');await page.waitForFunction(()=>document.querySelector('#password-feedback').classList.contains('success'));A.password='BrowserNewPassword!123';
      for(const id of ['current-password','new-password','confirm-password'])assert.equal(await page.inputValue('#'+id),'');assert.equal((await peer.call('api/account.php')).status,401);
      assert.equal(await page.evaluate(async()=>{const r=await fetch('api/session.php',{cache:'no-store'});return (await r.json()).authenticated;}),true);await page.click('#settings-logout');await page.waitForURL('**/login.html');await context.close();await new Session().login(A);
    });
    await test('Password client mismatch/byte errors are inline and secrets stay out of localStorage',async()=>{
      const {page,context}=await loggedPage(A);await go(page,'settings.html');await page.fill('#current-password',A.password);await page.fill('#new-password','A valid different password');await page.fill('#confirm-password','does-not-match');await page.click('#password-save');assert.equal(await page.locator('#confirm-password').getAttribute('aria-invalid'),'true');
      await page.fill('#new-password','😀'.repeat(20));await page.fill('#confirm-password','😀'.repeat(20));await page.click('#password-save');assert.equal(await page.locator('#new-password').getAttribute('aria-invalid'),'true');assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key!=='refind-theme')),[]);assert.ok(await page.evaluate(()=>localStorage.getItem('refind-theme')===null||['light','dark'].includes(localStorage.getItem('refind-theme'))));await context.close();
    });
    await test('Expired browser form redirects to login with a safe return instead of replaying POST',async()=>{
      const {page,context,s}=await loggedPage(A);await go(page,'profile.html');await page.fill('#display-name','Unsaved expired name');driver({action:'expire',id:s.id(),type:'idle'});await page.click('#profile-save');await page.waitForURL('**/login.html?return=*');assert.ok((await page.url()).includes('profile.html'));await context.close();
    });
    await test('DB display-name HTML is escaped in summary/menu/input',async()=>{
      const s=await new Session().login(A),name='<img src=x onerror=alert(1)>';assert.equal((await s.call('api/account.php',{action:'update_profile',name})).status,200);
      const {page,context}=await loggedPage(A);await go(page,'profile.html');assert.equal(await page.locator('[data-profile-name]').innerText(),name);assert.equal(await page.locator('[data-profile-name] img').count(),0);await openAccountMenu(page);assert.equal(await page.locator('[data-shell-user-name]').innerText(),name);assert.equal(await page.locator('[data-shell-user-name] img').count(),0);await context.close();assert.equal((await s.call('api/account.php',{action:'update_profile',name:A.name})).status,200);
    });
    await test('Own unread count is real and does not include another account notifications',async()=>{
      notification=query("INSERT INTO notifications(user_id,notification_type,title,message) VALUES (?,'B03_TEST','Own update','Private update')",[Number(A.id)]).id;
      const p1=await loggedPage(A);await go(p1.page,'profile.html');await openAccountMenu(p1.page);assert.equal(await p1.page.locator('#nav-unread').innerText(),'1');await p1.context.close();
      const p2=await loggedPage(BM);await go(p2.page,'profile.html');assert.equal(await p2.page.locator('#nav-unread').isHidden(),true);await p2.context.close();
    });
    await test('Both roles use top-nav/account menu with active page, keyboard/Escape/outside close',async()=>{
      for(const user of [A,BM]) {const {page,context}=await loggedPage(user);await go(page,'profile.html');assert.match(await page.locator('#nav-home').getAttribute('href'),user.role==='STUDENT'?/index\.html$/:/admin\.html\?tab=claims$/);await page.locator('#nav-toggle').focus();await page.keyboard.press('Enter');await page.locator('#account-toggle').focus();await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'My profile');assert.equal(await page.locator('[data-account-nav="profile"]').getAttribute('aria-current'),'page');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'account-toggle');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'nav-toggle');await openAccountMenu(page);await page.locator('h1').click();assert.equal(await page.locator('#account-menu').isHidden(),true);await context.close();}
    });
    await test('Profile/Settings and nav are usable for both roles at all five required viewports',async()=>{
      for(const [width,height] of [[360,800],[390,844],[768,1024],[1280,800],[1440,900]])for(const user of [A,BM]) {const {page,context}=await loggedPage(user,{width,height});for(const route of ['profile.html','settings.html']) {await go(page,route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+' '+route);await openAccountMenu(page);assert.ok(await page.locator('#account-menu').isVisible());assert.ok(await page.locator('#logout').evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth;}));await page.screenshot({path:path.join(out,(user.role==='STUDENT'?'student':'bm')+'-'+route.split('.')[0]+'-'+width+'.png'),fullPage:true});await page.keyboard.press('Escape');}
        viewportChecks.push({width,height,role:user.role,pages:['profile','settings'],horizontalOverflow:false,menu:true});await context.close();}
    });
    assert.deepEqual(browserErrors,[]);persist({complete:true,chrome:browser.version()});console.log('B03: ALL '+results.length+' SCENARIO GROUPS PASSED');
  } catch(error) {persist({complete:false,failure:String(error)});throw error;}
  finally {
    if(reportItem)query('DELETE FROM items WHERE item_id=?',[Number(reportItem)]);
    if(notification)query('DELETE FROM notifications WHERE notification_id=?',[Number(notification)]);
    for(const id of created)query('DELETE FROM users WHERE user_id=?',[Number(id)]);
    resetLimits();if(browser)await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
