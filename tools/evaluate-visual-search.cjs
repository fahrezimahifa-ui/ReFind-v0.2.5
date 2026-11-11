// Live, held-out browser evaluation. Run again with a new receipt path for a reliability repeat.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const qa = require('./qa-runtime.cjs');

qa.assertQa();
const [manifestPath, receiptPath] = process.argv.slice(2);
assert.ok(manifestPath && receiptPath && !fs.existsSync(receiptPath), 'Use a held-out manifest and a new private receipt path.');
assert.ok(!process.env.REFIND_VISUAL_DISPOSABLE_DB_PORT, 'Use the live QA configuration without the mock transport.');
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const verified = JSON.parse(execFileSync(qa.php,[path.join(qa.target,'tools/calibrate-visual-search.php'),
  '--verify-held-out',manifestPath],{encoding:'utf8'}));
const setup = path.join(qa.target,'storage/setup');
const calibration = JSON.parse(fs.readFileSync(path.join(setup,'visual-calibration.json'),'utf8'));
const demo = JSON.parse(fs.readFileSync(path.join(setup,'demo-accounts.json'),'utf8')).accounts;
const account = demo[process.env.REFIND_VISUAL_DEMO_EMAIL || 'student-a@refind.test'];
assert.ok(account?.role==='STUDENT','Select an approved synthetic Student from the QA receipt.');
const limit = Number(execFileSync(qa.php,['-r','require $argv[1]; $c=app_config(); echo min($c["visual_search_student_per_minute"],$c["visual_search_calls_per_minute"]);',
  path.join(qa.target,'app/config.php')],{encoding:'utf8'}));
const pace = Math.ceil(62000 / limit);
const percentile = (values,q) => values.length ? [...values].sort((a,b)=>a-b)[Math.ceil(values.length*q)-1] : null;

async function run() {
  const {chromium} = qa.playwright();
  const browser = await chromium.launch({executablePath:qa.chromePath(),headless:true});
  const cases = [];
  let stopped = null;
  try {
    const context = await browser.newContext();
    const session = await (await context.request.get(qa.base+'api/session.php')).json();
    const auth = await context.request.post(qa.base+'api/auth.php',{headers:{'X-CSRF-Token':session.csrf},
      form:{action:'login',email:account.email,password:account.password}});
    assert.equal(auth.status(),200,'Synthetic Student sign-in failed.');
    const page = await context.newPage();
    await page.goto(qa.base+'browse.html?'+new URLSearchParams(manifest.filters),{waitUntil:'networkidle'});
    await page.waitForSelector('body[data-ready="true"]');
    await page.click('#visual-toggle');
    for (let index=0;index<manifest.queries.length;index++) {
      const query = manifest.queries[index];
      await page.click('#visual-clear');
      await page.setInputFiles('#visual-photo',path.join(path.dirname(manifestPath),query.image));
      await page.waitForFunction(()=>!document.querySelector('#visual-submit').disabled);
      const start = performance.now();
      const reply = page.waitForResponse(r=>r.url().endsWith('/api/visual-search.php') && r.request().method()==='POST');
      await page.click('#visual-submit');
      const response = await reply;
      const body = await response.json();
      await page.waitForFunction(()=>document.querySelector('#visual-outcome').getAttribute('aria-busy')==='false');
      const ms = Math.round(performance.now()-start);
      const itemIds = response.ok() ? await page.locator('#visual-results .discovery-card')
        .evaluateAll(cards=>cards.map(card=>Number(card.dataset.itemId))) : [];
      const ranks = itemIds.map((id,i)=>query.expected_ids.map(Number).includes(id)?i+1:0).filter(Boolean);
      cases.push({case:index+1,group:query.group,http_status:response.status(),state:body.state||body.code,
        error:!response.ok()||body.state==='empty_index',ms,item_ids:itemIds,expected_ranks:ranks});
      if (index+1<manifest.queries.length) await new Promise(resolve=>setTimeout(resolve,Math.max(0,pace-ms)));
    }
  } catch (error) {
    stopped = error.name;
    throw error;
  } finally {
    await browser.close();
    const good = cases.filter(item=>!item.error);
    const byGroup = name=>good.filter(item=>item.group===name);
    const positive = byGroup('same_object'), irrelevant = byGroup('irrelevant'), lookalike = byGroup('lookalike');
    const falseReturns = irrelevant.filter(item=>item.item_ids.length).length;
    const summary = {source:'live configured Gemini via Explore', model:calibration.model, dimensions:calibration.dimensions,
      validation_sha256:calibration.validation_sha256, held_out_sha256:verified.verified_held_out_sha256,
      tested_revision:execFileSync('git',['rev-parse','HEAD'],{cwd:qa.root,encoding:'utf8'}).trim(),
      working_tree_clean:execFileSync('git',['status','--porcelain'],{cwd:qa.root,encoding:'utf8'}).trim()==='',
      attempted:cases.length, planned:manifest.queries.length, successful:good.length, stopped,
      accuracy_complete:good.length===manifest.queries.length,
      group_counts:Object.fromEntries(['same_object','lookalike','irrelevant'].map(name=>[name,{
        planned:manifest.queries.filter(item=>item.group===name).length,
        attempted:cases.filter(item=>item.group===name).length,
        successful:byGroup(name).length
      }])),
      all_responses_p50_ms:percentile(cases.map(item=>item.ms),0.5),
      all_responses_p95_ms:percentile(cases.map(item=>item.ms),0.95),
      api_errors:cases.filter(item=>item.http_status>=400).map(item=>({case:item.case,code:item.state})),
      p50_ms:percentile(good.map(item=>item.ms),0.5),p95_ms:percentile(good.map(item=>item.ms),0.95),
      same_object:{total:positive.length,hit1:positive.filter(item=>item.expected_ranks[0]===1).length,
        hit5:positive.filter(item=>item.expected_ranks[0]<=5).length,
        mrr:positive.length?positive.reduce((sum,item)=>sum+(item.expected_ranks[0]?1/item.expected_ranks[0]:0),0)/positive.length:null},
      irrelevant:{total:irrelevant.length,returns:falseReturns,rate:irrelevant.length?falseReturns/irrelevant.length:null},
      lookalike:{total:lookalike.length,returns:lookalike.filter(item=>item.item_ids.length).length,
        candidate_ranks:lookalike.map(item=>item.expected_ranks)},cases};
    fs.writeFileSync(receiptPath,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
    console.log('Live evaluation '+summary.successful+'/'+summary.planned+' successful. See the private receipt.');
    if(summary.successful!==summary.planned)process.exitCode=1;
  }
}
run().catch(()=>{process.exitCode=1;});
