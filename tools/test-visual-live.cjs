// Real-provider browser demonstration. Never drains the worker or fabricates vectors.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const qa = require('./qa-runtime.cjs');
qa.assertQa();
assert.ok(!process.env.REFIND_VISUAL_DISPOSABLE_DB_PORT, 'Use live native QA');
const [corpusPath, receiptPath] = process.argv.slice(2);
assert.ok(corpusPath && receiptPath && !fs.existsSync(receiptPath), 'Use a corpus and a new private receipt');
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const account = JSON.parse(fs.readFileSync(path.join(qa.target,'storage/setup/demo-accounts.json'),'utf8')).accounts['student-a@refind.test'];
const indexStatus = () => JSON.parse(execFileSync(qa.php,[path.join(qa.target,'tools/index-visual-photos.php'),'--status'],{encoding:'utf8'}));
const query = (sql, values=[]) => JSON.parse(execFileSync(qa.php,[path.join(qa.target,'tools/b02-fixture.php')],
  {input:JSON.stringify({action:'query',query:sql,values}),encoding:'utf8'})).rows;
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const result = {source:'live Gemini through Student UI; automatic scheduled indexing',dataset:corpus.dataset,
  started_utc:new Date().toISOString(),runs:[],injected_ui_faults:[],browser_errors:[],complete:false};
const image = role => {
  const asset = corpus.assets.find(item=>item.role===role);
  assert.ok(asset,'Missing '+role);
  const file = path.join(path.dirname(corpusPath),asset.image);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),asset.sha256);
  return file;
};
const save = () => fs.writeFileSync(receiptPath,JSON.stringify(result,null,2)+'\n');

async function ready(page, route) {
  await page.goto(qa.base+route,{waitUntil:'networkidle'});
  await page.waitForSelector('body[data-ready="true"]');
}
async function photoSearch(page, file, filters={}) {
  await ready(page,'browse.html?'+new URLSearchParams(filters));
  assert.ok(await page.locator('#visual-toggle').isVisible());
  await page.click('#visual-toggle');
  await page.setInputFiles('#visual-photo',file);
  await page.waitForFunction(()=>!document.querySelector('#visual-submit').disabled);
  assert.equal(await page.locator('#visual-upload img').count(),1);
  const start=performance.now();
  const reply=page.waitForResponse(response=>response.url().endsWith('/api/visual-search.php')&&response.request().method()==='POST');
  await page.click('#visual-submit');
  const response=await reply;
  const body=await response.json();
  await page.waitForFunction(()=>document.querySelector('#visual-outcome').getAttribute('aria-busy')==='false');
  return {http:response.status(),state:body.state||body.code,ms:Math.round(performance.now()-start),
    ids:await page.locator('#visual-results .discovery-card').evaluateAll(cards=>cards.map(card=>Number(card.dataset.itemId)))};
}

(async()=>{
  const before=indexStatus();
  assert.ok(before.credential_configured,'Configure the key locally');
  assert.ok(!before.queue.some(row=>row.status!=='READY'&&Number(row.photos)>0),'Wait for a clear healthy queue; do not drain during demonstration');
  const {chromium}=qa.playwright();
  const browser=await chromium.launch({executablePath:qa.chromePath(),headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1280,height:900}});
    const session=await (await context.request.get(qa.base+'api/session.php')).json();
    const auth=await context.request.post(qa.base+'api/auth.php',{headers:{'X-CSRF-Token':session.csrf},
      form:{action:'login',email:account.email,password:account.password}});
    assert.equal(auth.status(),200,'QA Student sign-in');
    const page=await context.newPage();
    page.on('pageerror',error=>result.browser_errors.push(error.name));
    for(let attempt=1;attempt<=2;attempt++) {
      const title='Demo VS live '+attempt+' '+Date.now();
      await ready(page,'report.html?type=found');
      assert.equal(await page.locator('#visual-report-opt-in').isChecked(),false);
      await page.fill('#r-title',title);
      await page.selectOption('#r-category','1');
      await page.fill('#r-description','Synthetic QA controller demonstration using cleared licensed studio photos.');
      await page.selectOption('#r-location','39');
      await page.fill('#r-date',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date()));
      await page.fill('#r-clue','Synthetic classroom clue for the cleared Dreamcast controller.');
      await page.setInputFiles('#r-photos',image('demo_reference'));
      await page.waitForFunction(()=>document.querySelector('#public-upload').getAttribute('aria-busy')!=='true'&&document.querySelectorAll('#public-upload .upload-preview').length===1);
      await page.check('#visual-report-opt-in');
      const submitted=Date.now();
      await page.click('#report-submit');
      await page.waitForURL('**/item.html?id=*');
      await page.waitForSelector('body[data-ready="true"]');
      const id=Number(new URL(page.url()).searchParams.get('id'));
      const run={run:attempt,report_id:id,submitted_utc:new Date(submitted).toISOString(),initial_status:null,
        indexed_ms:null,matching:null,no_target:null,correct_link:false};
      result.runs.push(run);save();
      let indexed;
      do {
        indexed=query('SELECT e.status,e.failure_code,e.updated_at FROM item_photo_embeddings e JOIN item_photos p ON p.photo_id=e.photo_id WHERE p.item_id=?',[id])[0];
        run.initial_status??=indexed?.status;
        if(indexed?.status==='READY')break;
        assert.notEqual(indexed?.status,'FAILED','Automatic indexing failed');
        if(Date.now()-submitted>=120000)break;
        await sleep(3000);
      }while(true);
      run.indexed_ms=Date.now()-submitted;run.final_index_status=indexed?.status;run.launcher_tick=indexStatus().last_tick;save();
      assert.equal(indexed?.status,'READY','Automatic indexing must finish within 120 seconds');
      assert.ok(run.indexed_ms<=120000);
      // Search the entire eligible catalog, including the larger discovery set.
      run.matching=await photoSearch(page,image('demo_positive'));
      save();
      assert.equal(run.matching.http,200,'Genuine Gemini search must succeed');
      assert.equal(run.matching.state,'matches');
      assert.ok(run.matching.ids.includes(id),'The new report must be retrieved');
      assert.equal(await page.locator('#visual-heading').innerText(),'Possible Visual Matches');
      await page.screenshot({path:path.join(path.dirname(receiptPath),path.basename(receiptPath,'.json')+'-matches-'+attempt+'.png'),fullPage:true});
      await page.locator('#visual-results [data-item-id="'+id+'"] a.card-details').click();
      await page.waitForSelector('body[data-ready="true"]');
      assert.equal(new URL(page.url()).searchParams.get('id'),String(id));
      assert.equal(await page.locator('#item-title').innerText(),title);run.correct_link=true;
      const irrelevant=corpus.assets.find(item=>item.role==='irrelevant'&&item.split==='demo');
      assert.ok(irrelevant,'Use a cleared independent demo scene unrelated to the complete item catalog');
      run.no_target=await photoSearch(page,path.join(path.dirname(corpusPath),irrelevant.image));
      save();
      assert.equal(run.no_target.http,200);
      assert.equal(run.no_target.state,'no_match','A genuine irrelevant query should be rejected');
      assert.match(await page.locator('#visual-status').innerText(),/No sufficiently similar matches/);
      if(attempt===1) {
        await ready(page,'item.html?id='+id);
        await page.click('#delete-report');await page.click('#confirm-delete');
        await page.waitForURL('**/my-reports.html*');
        assert.equal(query('SELECT p.photo_id FROM item_photos p JOIN item_photo_embeddings e ON e.photo_id=p.photo_id WHERE p.item_id=?',[id]).length,0);
        run.deleted_after_demo=true;
      }
      save();
    }
    // These three responses are deliberately injected, separate from live results.
    for(const fault of [
      {http:429,code:'visual_rate_limited',message:'Photo search has reached a temporary limit. Try again later or search by keyword.'},
      {http:503,code:'visual_timeout',message:'Photo search timed out. Try again or search by keyword.'},
      {http:503,code:'visual_unavailable',message:'Photo search is unavailable. You can still search by keyword.'}
    ]) {
      await page.route('**/api/visual-search.php',route=>route.fulfill({status:fault.http,contentType:'application/json',body:JSON.stringify({ok:false,code:fault.code,message:fault.message})}));
      const observed=await photoSearch(page,image('demo_positive'));
      assert.equal(observed.http,fault.http);assert.equal(observed.ids.length,0);
      assert.equal(await page.locator('#visual-status').innerText(),fault.message);
      result.injected_ui_faults.push({source:'browser response injection; no Gemini call',...observed});
      await page.unroute('**/api/visual-search.php');
    }
    assert.deepEqual(result.browser_errors,[]);
    result.complete=true;
  }catch(error){result.failure={name:error.name,message:error.message};throw error;}
  finally{result.finished_utc=new Date().toISOString();save();await browser.close();}
  console.log('Two live browser demonstrations passed; see the private receipt.');
})().catch(error=>{console.error(error.name+': '+error.message);process.exitCode=1;});
