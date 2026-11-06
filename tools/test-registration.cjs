// Real HTTP/database/browser coverage. Refuses every unowned QA target before mutation.
const qa = require('./qa-runtime.cjs');
qa.assertQa();
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {themedContext} = require('./qa-browser.cjs');
const run = 'registration-' + crypto.randomBytes(8).toString('hex');
const prefix = run + '-';
const out = process.env.REFIND_EVIDENCE_DIR || path.join(qa.root, 'output/playwright/registration', run);
fs.mkdirSync(out, {recursive: true});
const receipt = path.join(out, 'registration-results.json');
assert.ok(!fs.existsSync(receipt), 'Refuse to overwrite registration evidence');
const checks = [], browserErrors = [];
let browser, sequence = 0, begun = false, activeCheck = '', failure;
function control(action) {
  execFileSync(qa.php, [path.join(qa.target, 'tools/registration-fixture.php'), action, run], {stdio: ['ignore', 'pipe', 'pipe']});
}
function q(query, values = []) {
  return JSON.parse(execFileSync(qa.php, [path.join(qa.target, 'tools/b02-fixture.php')], {input: JSON.stringify({action: 'query', query, values}), encoding: 'utf8'})).rows;
}
function save(status = 'RUNNING') { fs.writeFileSync(receipt, JSON.stringify({run, status, scope: 'Owned synthetic QA only; no main requests', theme: process.env.REFIND_THEME, checks, browserErrors, failure}, null, 2) + '\n'); }
async function check(name, fn) { activeCheck=name; await fn(); checks.push(name); save(); console.log('PASS ' + name); }
async function availability(enabled) {
  control(enabled?'enable':'disable');
  // Allow the server's normal configuration cache to observe a CLI-written override.
  const deadline=Date.now()+5000;
  do {
    const session=await new Session().init();
    if((await session.call('api/session.php')).data.registration_enabled===enabled)return;
    await new Promise(resolve=>setTimeout(resolve,100));
  }while(Date.now()<deadline);
  assert.fail('QA server did not observe its registration configuration');
}
function payload(extra = {}) {
  return {name: 'Synthetic Registration Student', email: prefix + (++sequence) + '@refind.test', password: 'Synthetic! ' + crypto.randomBytes(8).toString('hex'), ...extra};
}
class Session {
  cookies = new Map(); csrf = '';
  async call(endpoint, values, options = {}) {
    const headers = {Cookie: [...this.cookies].map(([k,v]) => k + '=' + v).join('; '), ...(options.headers || {})};
    const init = {redirect: 'manual', headers, method: options.method || (values === undefined ? 'GET' : 'POST')};
    if (values !== undefined) {
      headers['X-CSRF-Token'] = options.csrf === undefined ? this.csrf : options.csrf;
      if (options.raw !== undefined) init.body = options.raw;
      else if (values instanceof FormData) init.body = values;
      else { const form = new FormData(); Object.entries(values).forEach(([k,v]) => form.append(k,v)); init.body = form; }
    }
    const response = await fetch(qa.base + endpoint, init);
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], i = pair.indexOf('='), key = pair.slice(0,i), value = pair.slice(i+1);
      if (value) this.cookies.set(key,value); else this.cookies.delete(key);
    }
    const json = (response.headers.get('content-type') || '').includes('application/json');
    return {status: response.status, headers: response.headers, data: json ? await response.json() : await response.text()};
  }
  async init() { const r = await this.call('api/session.php'); assert.equal(r.status,200); this.csrf = r.data.csrf; return this; }
  async register(data) {
    const r = await this.call('api/register.php', {...data, confirm_password: data.confirm_password ?? data.password});
    if (r.status === 201) this.csrf = r.data.csrf;
    return r;
  }
  async login(account) {
    await this.init(); const r = await this.call('api/auth.php', {action:'login', email:account.email, password:account.password});
    assert.equal(r.status,200,'Existing QA account login failed'); this.csrf = r.data.csrf; return this;
  }
  async ok(endpoint, values) { const r = await this.call(endpoint, values); assert.ok(r.status >= 200 && r.status < 300, 'Unexpected QA response status: ' + r.status); return r.data; }
}
const count = () => Number(q('SELECT COUNT(*) AS n FROM users')[0].n);
async function student(extra = {}) {
  control('reset'); const data = payload(extra), session = await new Session().init();
  const r = await session.register(data); assert.equal(r.status,201); return {data, session, id:r.data.user.id};
}
async function rejected(data, status = 422, options = {}) {
  control('reset'); const s = await new Session().init(), before = count();
  const r = await s.call(options.endpoint || 'api/register.php', data, options);
  assert.equal(r.status,status); assert.equal(count(),before); assert.equal((await s.call('api/session.php')).data.authenticated,false);
  return r;
}
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function report(s, type, label) {
  return (await s.ok('api/items.php', {action:'create',type,title:prefix+label,description:'Synthetic registration workflow item with a blue stitched marking.',category_id:'7',location_id:'36',location_detail:'',date:today(),time:'',clue:'Synthetic blue stitching inside the hidden pocket.'})).id;
}
async function pickup(s,id) { return (await s.ok('api/handovers.php?id='+id)).handovers[0]; }
async function operation(s,id,action,extra={}) {
  const d = await pickup(s,id);
  return s.ok('api/handovers.php',{action,id,revision:d.revision,confirm:'1',note:'Synthetic registration pickup operation.',...extra});
}
async function browserPage(session, route) {
  const context = await themedContext(browser,{viewport:{width:1280,height:900},timezoneId:'Asia/Jakarta'});
  await context.addCookies([{name:qa.sessionName,value:session.cookies.get(qa.sessionName),url:qa.base}]);
  const page = await context.newPage(); page.on('pageerror',() => browserErrors.push('Page script error'));
  await page.goto(qa.base+route); await page.waitForSelector('body[data-ready="true"]');
  return {context,page};
}
async function cleanupUsers() {
  const ids = q('SELECT user_id FROM users WHERE LEFT(email,?)=?',[prefix.length,prefix]).map(r=>Number(r.user_id));
  if (!ids.length) return;
  const marks = ids.map(()=>'?').join(',');
  const items = q('SELECT item_id FROM items WHERE reporter_user_id IN ('+marks+')',ids).map(r=>Number(r.item_id));
  if (items.length) {
    const placeholders = items.map(()=>'?').join(',');
    q('DELETE FROM notifications WHERE item_id IN ('+placeholders+')',items);
    q('DELETE FROM items WHERE item_id IN ('+placeholders+')',items);
  }
  q('DELETE FROM claims WHERE claimant_user_id IN ('+marks+')',ids);
  q('DELETE FROM users WHERE user_id IN ('+marks+')',ids);
}

(async () => {
  try {
    begun = true; control('begin');
    await availability(true);
    const accounts = Object.values(JSON.parse(fs.readFileSync(path.join(qa.target,'storage/setup/demo-accounts.json'),'utf8')).accounts);
    browser = await qa.playwright().chromium.launch({headless:true,executablePath:qa.chromePath()});
    await check('Registration commits an active Student with NULL Student ID and rotates identity', async () => {
      control('reset'); const data = payload({name:'  Synthetic Student  ',email:prefix+'Mixed@refind.test'}), s = await new Session().init();
      const old = new Map(s.cookies), oldCsrf = s.csrf, r = await s.register(data);
      assert.equal(r.status,201); assert.equal(r.data.user.role,'STUDENT'); assert.equal(r.data.redirect,qa.basePath+'index.html');
      assert.notEqual(s.csrf,oldCsrf); assert.notEqual(s.cookies.get(qa.sessionName),old.get(qa.sessionName));
      const record = q('SELECT full_name,email,student_id,role,is_active,avatar_path FROM users WHERE user_id=?',[Number(r.data.user.id)])[0];
      assert.equal(record.full_name,'Synthetic Student'); assert.equal(record.email,data.email.toLowerCase());
      assert.equal(record.student_id,null); assert.equal(record.avatar_path,null); assert.equal(record.role,'STUDENT'); assert.equal(Number(record.is_active),1);
      assert.equal((await s.ok('api/session.php')).authenticated,true);
      const replay = new Session(); replay.cookies = old; assert.equal((await replay.ok('api/session.php')).authenticated,false);
      const profile = (await s.ok('api/account.php')).profile;
      assert.equal(profile.name,'Synthetic Student'); assert.equal(profile.email,data.email.toLowerCase()); assert.equal(profile.student_id,null);
      assert.equal((await s.call('api/staff.php')).status,403); assert.equal((await s.call('admin.html')).status,403);
      assert.equal((await s.call('api/handovers.php',{action:'complete',id:'1'})).status,403);
      assert.equal((await s.call('register.html')).status,302); assert.equal((await s.register(payload())).status,409);
      await s.ok('api/auth.php',{action:'logout'}); await s.login(data);
      assert.equal((await s.ok('api/account.php')).profile.student_id,null);
    });
    await check('Existing Student and BM accounts still authenticate', async () => {
      for (const role of ['STUDENT','BUILDING_MANAGEMENT']) {
        const s = await new Session().login(accounts.find(a=>a.role===role));
        assert.equal((await s.ok('api/session.php')).user.role,role);
      }
    });
    await check('Private-network non-loopback requests cannot advertise or create accounts', async () => {
      assert.equal(process.env.REFIND_CI_DISPOSABLE,'1','This network assertion requires the owned disposable Docker environment');
      const target = new URL(qa.base); target.hostname='qa';
      const bootstrap=await fetch(target+'api/session.php'); assert.equal(bootstrap.status,403);
      assert.equal(bootstrap.headers.getSetCookie().length,0,'Apache denial must precede PHP/session work');
      const page=await fetch(target+'register.html',{redirect:'manual'});
      assert.equal(page.status,403);
      const before=count(), data=payload(), form=new FormData();
      Object.entries({...data,confirm_password:data.password}).forEach(([k,v])=>form.append(k,v));
      const response=await fetch(target+'api/register.php',{method:'POST',body:form,headers:{Host:'localhost',Origin:qa.base.slice(0,-1),'X-Forwarded-For':'127.0.0.1',Forwarded:'for="[::1]"'}});
      assert.equal(response.status,403); assert.equal(response.headers.getSetCookie().length,0); assert.equal(count(),before);
    });
    await check('Duplicate and case-variant email return a neutral conflict', async () => {
      const a = await student();
      for (const email of [a.data.email,a.data.email.toUpperCase()]) {
        const r = await rejected({...a.data,email,confirm_password:a.data.password},409);
        assert.equal(r.data.code,'registration_conflict'); assert.ok(!/already registered|exists/i.test(r.data.message));
      }
    });
    await check('Concurrent duplicate identifiers create exactly one account', async () => {
      control('reset'); const data = payload();
      const sessions = await Promise.all(Array.from({length:6},()=>new Session().init()));
      const results = await Promise.all(sessions.map(s=>s.register(data)));
      assert.equal(results.filter(r=>r.status===201).length,1); assert.equal(results.filter(r=>r.status===409).length,5);
      assert.equal(Number(q('SELECT COUNT(*) AS n FROM users WHERE email=?',[data.email])[0].n),1);
    });
    await check('Validation rejects missing, malformed and oversized fields without accounts', async () => {
      const base = payload(); base.confirm_password = base.password;
      const cases = [{name:''},{email:''},{password:''},{confirm_password:''},{name:'x'.repeat(121)},{name:'bad\nname'},{email:'invalid'},{email:'a'.repeat(141)+'@example.test'},{password:'short'},{password:'a'.repeat(73)},{password:'😀'.repeat(19)},{password:'1234567890\0'},{confirm_password:'mismatch'}];
      for (const patch of cases) await rejected({...base,...patch});
      await rejected({});
      for (const key of ['name','email','password','confirm_password']) {
        const form = new FormData(); Object.entries(base).filter(([k])=>k!==key).forEach(([k,v])=>form.append(k,v)); form.append(key+'[]','malformed');
        await rejected(form);
      }
      await student({password:'  1234567890  '});
      await student({name:'😀'.repeat(120),password:'😀'.repeat(18)});
    });
    await check('Role, identity, activation, query, upload and JSON overrides are rejected', async () => {
      const base = payload(); base.confirm_password=base.password;
      for (const key of ['role','user_id','is_active','account','student_id','avatar_path','activation','return','unexpected']) await rejected({...base,[key]:'BUILDING_MANAGEMENT'},400);
      await rejected(base,400,{endpoint:'api/register.php?role=BUILDING_MANAGEMENT'});
      const form = new FormData(); Object.entries(base).forEach(([k,v])=>form.append(k,v)); form.append('avatar',new Blob(['synthetic']), 'avatar.txt');
      await rejected(form,400);
      await rejected(base,400,{raw:'{}',headers:{'Content-Type':'application/json'}});
      const guest = await new Session().init(); assert.equal((await guest.call('api/register.php')).status,405);
    });
    await check('CSRF and cross-origin requests fail before account creation', async () => {
      const base = payload(); base.confirm_password=base.password;
      for (const options of [{csrf:''},{csrf:'invalid'},{headers:{Origin:'https://outside.invalid'}},{headers:{Origin:'null'}},{csrf:'invalid',headers:{Origin:new URL(qa.base).origin}}]) await rejected(base,403,options);
      await rejected({...base,_csrf:'conflicting-token'},403);
    });
    await check('Database failure rolls back without exposing SQL or authenticating', async () => {
      control('fail-on');
      try { const r = await rejected({...payload(),confirm_password:'unused'},422); assert.equal(r.data.code,'validation_error');
        const data=payload(); const failure=await rejected({...data,confirm_password:data.password},500); assert.equal(failure.data.code,'server_error'); assert.ok(!/SQL|trigger|Synthetic registration rollback/i.test(failure.data.message)); }
      finally { control('fail-off'); }
    });
    await check('Successful registrations count across fresh sessions and limiter expiry restores access', async () => {
      control('reset');
      for (let i=0;i<10;i++) { const s=await new Session().init(); assert.equal((await s.register(payload())).status,201); }
      const s = await new Session().init(), before=count(), r=await s.register(payload());
      assert.equal(r.status,429); assert.ok(Number(r.headers.get('retry-after'))>0); assert.equal(count(),before);
      control('expire'); assert.equal((await s.register(payload())).status,201);
    });
    await check('Concurrent invalid attempts reserve exactly ten places', async () => {
      control('reset'); const before=count(), sessions=await Promise.all(Array.from({length:20},()=>new Session().init()));
      const results=await Promise.all(sessions.map(s=>s.register(payload({name:''}))));
      assert.equal(results.filter(r=>r.status===422).length,10); assert.equal(results.filter(r=>r.status===429).length,10); assert.equal(count(),before);
    });
    await check('NULL Student ID works through Profile, reports, claims and complete/release pickup workflows', async () => {
      const owner=await student(), finder=await student(), bm=await new Session().login(accounts.find(a=>a.role==='BUILDING_MANAGEMENT'));
      const profile=await browserPage(owner.session,'profile.html');
      assert.equal(await profile.page.locator('#profile-student-id').inputValue(),''); assert.equal(await profile.page.locator('#profile-email').inputValue(),owner.data.email); await profile.context.close();
      for (const route of ['index.html','browse.html','report.html','my-reports.html','notifications.html','settings.html']) assert.equal((await owner.session.call(route)).status,200);
      for (const end of ['complete','release']) {
        const lost=await report(owner.session,'LOST',end+' backpack'), found=await report(finder.session,'FOUND',end+' backpack');
        const claim=(await owner.session.ok('api/claims.php',{itemId:found,lostItemId:lost,answer:'Synthetic blue stitching inside the hidden pocket.'})).id;
        const detail=(await bm.ok('api/staff.php?resource=claims&id='+claim)).claim; assert.equal(detail.claimant_student_id,null);
        const review=await browserPage(bm,'admin.html?tab=claims&claim='+claim); await review.page.locator('[data-detail-claim-id="'+claim+'"]').waitFor();
        assert.match(await review.page.locator('[data-detail-claim-id="'+claim+'"] .detail-meta').innerText(),/Not specified/); await review.context.close();
        const approved=await bm.ok('api/staff.php',{action:'review',id:claim,decision:'approved',note:'Synthetic ownership verified for registration QA.',revision:detail.revision,confirm:'1'}), h=approved.handover_id;
        const scheduled = new Date(Date.now()+2*86400000).toISOString().slice(0,16);
        await operation(bm,h,'schedule',{pickup_location_id:'36',scheduled_at:scheduled});
        assert.equal((await pickup(bm,h)).claimant_student_id,null); assert.equal((await pickup(owner.session,h)).handover_status,'SCHEDULED');
        const staff=await browserPage(bm,'admin.html?tab=handover&handover='+h); await staff.page.locator('[data-detail-handover-id="'+h+'"]').waitFor();
        assert.match(await staff.page.locator('[data-detail-handover-id="'+h+'"] .detail-meta').innerText(),/Not specified/); await staff.context.close();
        const claimant=await browserPage(owner.session,'my-reports.html?tab=claims&claim='+claim); await claimant.context.close();
        await operation(bm,h,'cancel_schedule'); assert.equal((await pickup(owner.session,h)).handover_status,'PENDING');
        assert.equal((await owner.session.ok('api/claims.php?id='+claim)).claims[0].claim_status,'APPROVED');
        if(end==='complete') { await operation(bm,h,'schedule',{pickup_location_id:'36',scheduled_at:scheduled}); await operation(bm,h,'complete'); assert.equal((await pickup(owner.session,h)).handover_status,'COMPLETED'); }
        else { await operation(bm,h,'release'); assert.equal((await owner.session.ok('api/claims.php?id='+claim)).claims[0].claim_status,'REJECTED'); }
      }
      assert.equal(q('SELECT student_id FROM users WHERE user_id=?',[Number(owner.id)])[0].student_id,null);
      assert.equal(q('SELECT student_id FROM users WHERE user_id=?',[Number(finder.id)])[0].student_id,null);
    });
    await check('Real browser registers once and recovers a malformed successful response through its session', async () => {
      control('reset'); const context=await themedContext(browser,{viewport:{width:390,height:844}}), page=await context.newPage(), data=payload(); let requests=0;
      try {
        await page.route('**/api/register.php',async route=>{ requests++; const response=await route.fetch(); await route.fulfill({response,contentType:'text/plain',body:'invalid-json'}); });
        await page.goto(qa.base+'register.html'); await page.waitForSelector('body[data-ready="true"]');
        await page.fill('#full-name',data.name); await page.fill('#email',data.email); await page.fill('#password',data.password); await page.fill('#confirm-password',data.password);
        await page.evaluate(()=>{ const form=document.getElementById('register-form'); form.requestSubmit(); form.requestSubmit(); });
        await page.waitForURL(qa.base+'index.html'); assert.equal(requests,1);
        assert.equal(Number(q('SELECT COUNT(*) AS n FROM users WHERE email=?',[data.email])[0].n),1);
      } finally { await context.close(); }
    });
    await check('Disabled registration is hidden and unavailable; authenticated pages redirect safely', async () => {
      await availability(false);
      try {
        const s=await new Session().init(), before=count(); assert.equal((await s.call('api/session.php')).data.registration_enabled,false);
        assert.equal((await s.register(payload())).status,403); assert.equal(count(),before);
        const r=await s.call('register.html'); assert.equal(r.status,302); assert.equal(r.headers.get('location'),qa.basePath+'login.html');
        const login=await browserPage(s,'login.html'); assert.equal(await login.page.locator('#registration-link').isVisible(),false); await login.context.close();
      } finally { await availability(true); }
      const bm=await new Session().login(accounts.find(a=>a.role==='BUILDING_MANAGEMENT'));
      assert.equal((await bm.call('register.html')).headers.get('location'),qa.basePath+'admin.html');
    });
    assert.deepEqual(browserErrors,[]); save('PASS');
  } finally {
    try { if(browser)await browser.close(); }
    finally {
      if(begun) {
        try { control('fail-off'); await cleanupUsers(); }
        finally { control('end'); }
      }
    }
  }
})().catch(error=>{
  const primitive=value=>typeof value==='number'||typeof value==='boolean'?value:undefined;
  failure={check:activeCheck,type:error.name,actual:primitive(error.actual),expected:primitive(error.expected),line:String(error.stack).match(/test-registration\.cjs:(\d+):\d+/)?.[1]};
  save('FAIL'); console.error('Registration QA failed: '+JSON.stringify(failure)+'. No form contents recorded.'); process.exitCode=1;
});
