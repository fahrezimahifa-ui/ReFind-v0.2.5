// Mocked Gemini transport against the real disposable Apache/PHP/MariaDB app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const qa = require('./qa-runtime.cjs');

qa.assertQa();
const port = Number(process.env.REFIND_VISUAL_DISPOSABLE_DB_PORT);
assert.ok(port >= 1024 && port !== 3306 && new URL(qa.base).port, 'Use an explicit disposable stack');
const db = (query, values = []) => JSON.parse(execFileSync(qa.php, [path.join(qa.target, 'tools/b02-fixture.php')],
  {input: JSON.stringify({action:'query', query, values}), encoding:'utf8'})).rows;
const configPort = execFileSync(qa.php, ['-r','require $argv[1]; echo app_config()["db_port"];',path.join(qa.target,'app/config.php')], {encoding:'utf8'});
assert.equal(Number(configPort), port);
const setup = path.join(qa.target, 'storage/setup');
const manifest = path.join(setup, 'visual-mock-fixture-manifest.json');
const calibration = path.join(setup, 'visual-calibration.json');
assert.ok(!fs.existsSync(calibration) && !fs.existsSync(manifest), 'Fixture requires an uncalibrated disposable index');
assert.equal(Number(db('SELECT COUNT(*) AS total FROM item_photo_embeddings')[0].total), 0, 'Fixture requires an empty index');
const accounts = JSON.parse(fs.readFileSync(path.join(setup, 'demo-accounts.json'), 'utf8')).accounts;
const source = fs.readFileSync(path.join(qa.root,'tools/demo-photos/headphones-overview.jpg'));
const photo = {name:'fixture.jpg', mimeType:'image/jpeg', buffer:source};
const state = (id) => db('SELECT e.status,e.attempts,e.failure_code FROM item_photo_embeddings e JOIN item_photos p ON p.photo_id=e.photo_id WHERE p.item_id=?', [Number(id)])[0];
const drain = (id, mode) => JSON.parse(execFileSync(qa.php, [path.join(qa.root, 'tools/test-visual-search.php'),
  '--drain-fixture',qa.target,String(id),mode],{encoding:'utf8'}));
const log = message => console.log('PASS: ' + message);

async function login(request, account) {
  const session = await (await request.get(qa.base+'api/session.php')).json();
  const result = await request.post(qa.base+'api/auth.php', {
    form:{action:'login',email:account.email,password:account.password},headers:{'X-CSRF-Token':session.csrf}
  });
  assert.equal(result.status(), 200, 'synthetic account sign-in failed');
  return (await result.json()).csrf;
}
async function search(request, csrf, mode, files=photo, filters={}) {
  const headers = {'X-CSRF-Token':csrf};
  if (mode) headers['X-ReFind-Visual-Fixture'] = mode;
  return request.post(qa.base+'api/visual-search.php',{headers,multipart:{'photo[]':files,...filters}});
}
async function pageReady(page, route) {
  await page.goto(qa.base+route,{waitUntil:'networkidle'});
  await page.waitForSelector('body[data-ready="true"]');
}

(async () => {
  const {chromium} = qa.playwright();
  const browser = await chromium.launch({executablePath:qa.chromePath(),headless:true});
  let id, owner;
  const indexTool = (...args) => JSON.parse(execFileSync(qa.php,[path.join(qa.target,'tools/index-visual-photos.php'),
    ...args],{encoding:'utf8'}));
  try {
    fs.writeFileSync(calibration, JSON.stringify({model:'gemini-embedding-2',dimensions:768,preprocessing:'jpeg-white-v1',
      threshold:0.5,validation_sha256:'0'.repeat(64)}),{flag:'wx'});
    const desktop = process.env.REFIND_THEME === 'dark';
    owner = await browser.newContext({viewport:desktop?{width:1280,height:800}:{width:390,height:844},
      colorScheme:desktop?'dark':'light'});
    const csrf = await login(owner.request, accounts['student-a@refind.test']);
    const guest = await browser.newContext();
    assert.equal((await search(guest.request,'','match')).status(),401);
    const staff = await browser.newContext();
    const staffCsrf = await login(staff.request,accounts['bm@refind.test']);
    assert.equal((await search(staff.request,staffCsrf,'match')).status(),403);
    assert.equal((await search(owner.request,'bad','match')).status(),403);
    assert.equal((await search(owner.request,csrf,'match',{...photo,buffer:Buffer.from('not an image')})).status(),422);
    assert.equal((await search(owner.request,csrf,'match',{...photo,buffer:Buffer.alloc(250001)})).status(),422);
    assert.equal((await (await search(owner.request,csrf,'match')).json()).state,'empty_index');
    log('guest, staff, CSRF, bad MIME, oversize and empty index');

    const page = await owner.newPage();
    await pageReady(page,'report.html?type=lost');
    assert.equal(await page.locator('#visual-report-opt-in').isChecked(),false);
    const title='Visual Search disposable fixture '+Date.now();
    await page.fill('#r-title',title);
    await page.selectOption('#r-category','1');
    await page.fill('#r-description','Synthetic photo fixture for deterministic search tests.');
    await page.selectOption('#r-location','37');
    await page.fill('#r-date','2026-01-01');
    await page.fill('#r-clue','Private identifying clue for the isolated fixture.');
    await page.setInputFiles('#r-photos',photo);
    await page.setInputFiles('#r-proof',photo);
    await page.waitForFunction(()=>document.querySelectorAll('#report-form .upload-preview').length===2);
    await page.check('#visual-report-opt-in');
    await page.click('#report-submit');
    await page.waitForURL('**/item.html?id=*');
    id = new URL(page.url()).searchParams.get('id');
    assert.deepEqual(state(id),{status:'PENDING',attempts:0,failure_code:null});
    assert.equal(Number(db('SELECT COUNT(*) AS total FROM item_photos WHERE item_id=?',[Number(id)])[0].total),2);
    assert.equal(Number(db('SELECT COUNT(*) AS total FROM item_photo_embeddings')[0].total),1);
    await pageReady(page,'my-reports.html');
    assert.match(await page.locator('[data-item-id="'+id+'"] .visual-index-status').innerText(),/1 pending/);
    log('normal report form queues its opted-in public photo only and shows pending status');

    assert.equal(drain(id,'quota').paused,'quota');
    assert.equal(state(id).attempts,0);
    assert.equal(drain(id,'ready').ready,0);
    for(let attempt=1;attempt<=3;attempt++){
      db('UPDATE item_photo_embeddings SET next_attempt_at=UTC_TIMESTAMP()');
      drain(id,'timeout');
      assert.equal(state(id).attempts,attempt);
    }
    assert.equal(state(id).status,'FAILED');
    const indexed = db('SELECT photo_id,source_sha256 FROM item_photo_embeddings')[0];
    assert.equal(indexTool('--retry',String(indexed.photo_id)).reset,1);
    assert.equal(drain(id,'ready').ready,1);
    assert.equal(state(id).status,'READY');
    assert.equal(drain(id,'ready').ready,0);
    log('quota deferral, retry budget, explicit recovery, binary vector persistence and idempotent drain');

    const entry = {photo_id:Number(indexed.photo_id),report_id:Number(id),sha256:indexed.source_sha256,
      approved:true,source:'Bundled synthetic fixture used locally',reason:'Disposable backfill test'};
    const setDecision = decision=>fs.writeFileSync(manifest,JSON.stringify({photos:[{...entry,decision}]}));
    setDecision('exclude');
    assert.equal(indexTool('--audit',manifest).photos[0].sha256,entry.sha256);
    assert.equal(indexTool('--dry-run',manifest).exclude,1);
    assert.equal(state(id).status,'READY');
    assert.equal(indexTool('--backfill',manifest).removed,1);
    assert.equal(Number(db('SELECT COUNT(*) AS total FROM item_photos WHERE item_id=?',[Number(id)])[0].total),2);
    setDecision('include');
    assert.equal(indexTool('--backfill',manifest).enqueued,1);
    assert.equal(indexTool('--backfill',manifest).enqueued,0);
    assert.equal(drain(id,'ready').ready,1);
    log('allowlisted backfill, dry run and reversible exclusion preserve report media');

    const missingKey = await search(owner.request,csrf,null);
    assert.equal(missingKey.status(),503);
    assert.equal((await missingKey.json()).code,'visual_unavailable');
    const match = await (await search(owner.request,csrf,'match')).json();
    assert.equal(match.items[0].item_id,id);
    assert.equal(match.items[0].photos.length,1);
    assert.ok(!('private_clue' in match.items[0]) && !('score' in match.items[0]));
    assert.equal((await (await search(owner.request,csrf,'match',photo,{type:'FOUND'})).json()).state,'empty_index');
    assert.equal((await (await search(owner.request,csrf,'nomatch')).json()).state,'no_match');
    for(const [mode,status,code] of [['timeout',503,'visual_timeout'],['quota',429,'visual_rate_limited'],['unavailable',503,'visual_unavailable']]){
      const fault = await search(owner.request,csrf,mode);
      assert.equal(fault.status(),status);
      assert.equal((await fault.json()).code,code);
    }
    log('server filter, real report projection, rejection, missing key and injected provider errors');

    let mode = 'match';
    await page.route('**/api/visual-search.php',route=>route.continue({headers:{
      ...route.request().headers(),'X-ReFind-Visual-Fixture':mode
    }}));
    await pageReady(page,'browse.html');
    await page.click('#visual-toggle');
    await page.setInputFiles('#visual-photo',photo);
    await page.waitForFunction(()=>!document.querySelector('#visual-submit').disabled);
    assert.equal(await page.locator('#visual-upload img').count(),1);
    await page.click('#visual-submit');
    await page.waitForSelector('#visual-heading:visible');
    assert.equal(await page.locator('#visual-results .discovery-card').getAttribute('data-item-id'),id);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const href=await page.locator('#visual-results a.card-details').getAttribute('href');
    assert.equal(new URL(href,qa.base).searchParams.get('id'),id);
    await page.locator('#visual-results a.card-details').click();
    await page.waitForURL('**/item.html?id='+id);
    await pageReady(page,'browse.html');
    await page.click('#visual-toggle');
    await page.setInputFiles('#visual-photo',photo);
    await page.waitForFunction(()=>!document.querySelector('#visual-submit').disabled);
    for(const [fault,copy] of [['nomatch','No sufficiently similar matches'],['timeout','timed out'],['quota','temporary limit'],['unavailable','unavailable']]){
      mode=fault;
      await page.click('#visual-submit');
      await page.waitForFunction(text=>document.querySelector('#visual-status').textContent.includes(text),copy);
    }
    await page.fill('#filter-q',title);
    await page.waitForSelector('#browse-results [data-item-id="'+id+'"]');
    await page.click('[data-filter-type="FOUND"]');
    assert.match(await page.locator('#visual-status').innerText(),/Filters changed/);
    await page.click('#visual-clear');
    assert.equal(await page.locator('#visual-upload img').count(),0);
    log('Explore preview, real detail link, keyword coexistence, cleared filters and error copy');

    const result = await owner.request.post(qa.base+'api/items.php',{
      headers:{'X-CSRF-Token':csrf},form:{action:'delete',id}
    });
    assert.equal(result.status(),200);
    assert.equal(state(id),undefined);
    id=null;
    log('normal report deletion cascades to the index');
  } finally {
    if(id && owner) {
      const session = await (await owner.request.get(qa.base+'api/session.php')).json();
      await owner.request.post(qa.base+'api/items.php',{headers:{'X-CSRF-Token':session.csrf},form:{action:'delete',id}});
    }
    if(fs.existsSync(calibration)) fs.unlinkSync(calibration);
    if(fs.existsSync(manifest)) fs.unlinkSync(manifest);
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
