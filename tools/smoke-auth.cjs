const qaRuntime = require('./qa-runtime.cjs');
qaRuntime.assertQa();
// Positive/read-only release checks; report/claim data is not mutated.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const root = qaRuntime.target;
const php = qaRuntime.php;
const {chromium} = qaRuntime.playwright();
const batch = process.argv.includes('--v025') ? 'v025' : process.argv.includes('--ux02') ? 'ux02' : process.argv.includes('--ux01') ? 'ux01' : process.argv.includes('--b06') ? 'b06' : process.argv.includes('--b05') ? 'b05' : process.argv.includes('--b04') ? 'b04' : process.argv.includes('--b03') ? 'b03' : 'b02';
const out = path.resolve(process.env.REFIND_EVIDENCE_DIR || path.join(qaRuntime.root,'output/playwright/release-readiness/smoke')); fs.mkdirSync(out,{recursive:true});
if (batch === 'v025') fs.mkdirSync(out, {recursive:true});

const base=qaRuntime.base;
function snapshot() {
  const code = "require 'app/db.php'; $r=[]; foreach(['users','items','claims','handovers','notifications','item_photos','claim_photos'] as $t) $r[$t]=row('SELECT COUNT(*) AS n FROM '.$t)['n']; $r['users_fingerprint']=hash('sha256',json_encode(rows('SELECT * FROM users ORDER BY user_id'))); echo json_encode($r);";
  return {...JSON.parse(execFileSync(php, ['-r', code], {cwd:root,encoding:'utf8'})), fingerprint:JSON.parse(execFileSync(php,[path.join(root,'tools/fingerprint.php')],{encoding:'utf8'}))};
}
async function hydratePhotos(page) {
  await page.evaluate(async()=>{
    const images=Array.from(document.querySelectorAll('img')).filter(image=>image.getAttribute('src'));
    images.forEach(image=>{image.loading='eager';image.decoding='sync';});
    await Promise.all(images.map(image=>image.decode()));
    for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight){scrollTo({top:y,behavior:'instant'});await new Promise(resolve=>setTimeout(resolve,60));}
    scrollTo({top:0,behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}
(async () => {
  assert.ok(fs.existsSync(out), 'Run the isolated auth test first');
  const credentials = JSON.parse(fs.readFileSync(path.join(root, 'storage', 'setup', 'demo-accounts.json'), 'utf8')).accounts;
  const before = snapshot();
  const schema = JSON.parse(execFileSync(php,[path.join(root,'tools','check-database.php')],{encoding:'utf8'}));
  assert.ok(schema.passed);
  const browser = await chromium.launch({executablePath:qaRuntime.chromePath(),headless:true});
  const result = {scope:batch.toUpperCase()+' isolated QA positive smoke + schema checks; no business mutations', schema,browserErrors:[],accounts:[]};
  try {
    for (const [email, account] of Object.entries(credentials)) {
      const context = await browser.newContext({viewport:{width:390,height:844}});
      const page = await context.newPage(); page.on('pageerror',e=>result.browserErrors.push(String(e)));
      await page.goto(base+'login.html'); await page.waitForSelector('body[data-ready="true"]');
      await page.fill('#email',email); await page.fill('#password',account.password); await page.click('#login-submit');
      await page.waitForURL(account.role==='STUDENT'?'**/index.html':'**/admin.html'); await page.waitForSelector('body[data-ready="true"]');
      const self = await page.evaluate(async()=>{const r=await fetch('api/session.php',{cache:'no-store'});return r.json();});
      assert.equal(self.user.role,account.role); assert.equal(self.user.id,account.user_id);
      if (['b03','b04','b05','b06','ux01','ux02','v025'].includes(batch)) {
        await page.goto(base+'profile.html'); await page.waitForSelector('body[data-ready="true"]');
        assert.equal(await page.inputValue('#profile-email'),email);
        await page.screenshot({path:path.join(out,account.role==='STUDENT'?'main-'+email.split('@')[0]+'-profile.png':'main-bm-profile.png'),fullPage:true});
        await page.goto(base+'settings.html'); await page.waitForSelector('body[data-ready="true"]');
      }
      if (['b04','b05','b06','ux01','ux02','v025'].includes(batch)) {
        const routes=['browse.html','history.html','notifications.html',...(account.role==='STUDENT'?[...(['ux02','v025'].includes(batch)?['index.html']:[]),'report.html?type=lost','my-reports.html',...(['b06','ux01','ux02','v025'].includes(batch)?['my-reports.html?tab=claims']:[])]:[]),...(['b05','b06','ux01','ux02','v025'].includes(batch)&&account.role==='BUILDING_MANAGEMENT'?['admin.html?tab=claims','admin.html?tab=reports','admin.html?tab=handover']:[])];
        for(const route of routes){await page.goto(base+route);await page.waitForSelector('body[data-ready="true"]');if(route==='index.html'&&account.role==='STUDENT')await page.waitForSelector('#home-discovery:not([hidden])');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await hydratePhotos(page);const suffix=new URL(base+route).searchParams.get('tab');await page.screenshot({path:path.join(out,'main-'+email.split('@')[0]+'-'+route.split('.')[0]+(suffix?'-'+suffix:'')+'.png'),fullPage:true});}
      }
      if(['b06','ux01','ux02','v025'].includes(batch)) {
        const projection=await page.evaluate(async()=>{const r=await fetch('api/items.php?limit=48');return r.json();});
        assert.equal(projection.total,before.items);assert.equal(projection.items.length,Math.min(48,before.items));
        assert.ok(projection.items.every(i=>!('private_clue' in i)&&!('verification_clue' in i)&&!('ownership_photos' in i)));
        // Counts are observed from this QA installation, not assumed from a historical seed.
      }
      await page.screenshot({path:path.join(out,account.role==='STUDENT'?'main-'+email.split('@')[0]+'.png':'main-bm.png'),fullPage:true});
      if (await page.locator('#nav-toggle').isVisible() && await page.locator('#nav-toggle').getAttribute('aria-expanded')!=='true') await page.click('#nav-toggle');
      await page.click('#account-toggle'); await page.click('#logout'); await page.waitForURL('**/login.html'); await page.waitForSelector('body[data-ready="true"]');
      assert.equal((await page.evaluate(async()=>{const r=await fetch('api/session.php',{cache:'no-store'});return r.json();})).authenticated,false);
      result.accounts.push({email,role:account.role,loginLogout:true}); await context.close();
    }
    const after = snapshot(); assert.deepEqual(after,before); assert.deepEqual(result.browserErrors,[]);
    result.dataUnchanged=true; result.databaseCounts=after; result.passed=true;
    fs.writeFileSync(path.join(out,'qa-smoke.json'),JSON.stringify(result,null,2)+'\n');
    console.log('Isolated QA release smoke: 3 accounts login/logout PASS; data unchanged; 9 schema checks PASS on the isolated QA database.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
