// Sequential integration runner. All writes are confined to the owned QA app.
const fs=require('node:fs'),path=require('node:path');
const {spawnSync,execFileSync}=require('node:child_process');
const qa=require('./qa-runtime.cjs');
qa.assertQa();
const appearanceOnly=process.argv.includes('--appearance-only');
if(process.argv.slice(2).some(arg=>arg!=='--appearance-only'))throw new Error('Use no arguments or --appearance-only');
const run=process.env.REFIND_QA_RUN || new Date().toISOString().replace(/[:.]/g,'-');
if(!/^[A-Za-z0-9_-]+$/.test(run))throw new Error('Invalid evidence run name');
const out=path.join(qa.root,'output/playwright/release-readiness/results',run);
fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out); // Never overwrite a previous attempt.
const summary={testedSha:process.env.REFIND_TESTED_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:qa.root,encoding:'utf8'}).trim(),run,scope:appearanceOnly?'Owned QA Appearance/smoke subset; not a full matrix':'Owned QA full matrix; no main application requests',checks:[]};
function save(){fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');}
// Optional native-Windows cool-down: lets TIME_WAIT client ports from one suite's bursts drain before the next starts.
const stagePause=Number(process.env.REFIND_QA_STAGE_PAUSE_SECONDS||0);if(!Number.isInteger(stagePause)||stagePause<0||stagePause>300)throw new Error('REFIND_QA_STAGE_PAUSE_SECONDS must be 0-300');
function command(name,exe,args,env={}){
 if(stagePause&&summary.checks.length)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,stagePause*1000);
 const evidence=path.join(out,name);fs.mkdirSync(evidence,{recursive:true});
 const result=spawnSync(exe,args,{cwd:qa.root,env:{...process.env,...env,REFIND_EVIDENCE_DIR:evidence},stdio:'inherit'});
 const status=result.status===0?'PASS':'FAIL';summary.checks.push({name,status,exitCode:result.status});save();
 if(status==='FAIL')throw new Error(name+' failed; inspect its retained receipt before rerunning');
}
function q(query,values=[]){return JSON.parse(execFileSync(qa.php,[path.join(qa.target,'tools/b02-fixture.php')],{input:JSON.stringify({action:'query',query,values}),encoding:'utf8'}));}
let visualItem;
// A Found report by the second demo Student with a pending claim by the first; returns {item, claim}.
function pendingClaimFixture(label){
 const accounts=JSON.parse(fs.readFileSync(path.join(qa.target,'storage/setup/demo-accounts.json'),'utf8')).accounts;
 const students=Object.values(accounts).filter(a=>a.role==='STUDENT');
 const status=q("SELECT status_id FROM item_statuses WHERE status_code='VERIFICATION'").rows[0].status_id;
 const item=q("INSERT INTO items(reporter_user_id,category_id,location_id,status_id,item_type,title,description,event_date,verification_clue) VALUES (?,1,35,?,'FOUND',?,'Synthetic visual regression fixture',CURRENT_DATE(),'Synthetic private clue')",[Number(students[1].user_id),Number(status),label+' '+run]).id;
 q("INSERT INTO item_status_history(item_id,status_id,changed_by_user_id,note) VALUES (?,?,?,'Synthetic visual fixture')",[Number(item),Number(status),Number(students[1].user_id)]);
 return {item,claim:q("INSERT INTO claims(item_id,claimant_user_id,ownership_answer) VALUES (?,?,'Synthetic identifying answer')",[Number(item),Number(students[0].user_id)]).id};
}
try{
 command('schema-before',qa.php,[path.join(qa.target,'tools/check-database.php')]);
 command('invariants-before',qa.php,[path.join(qa.target,'tools/check-workflow.php')]);
 if(!appearanceOnly){
 command('projection',qa.php,[path.join(qa.root,'tools/test-projection.php')]);
 command('search-sql',qa.php,[path.join(qa.root,'tools/test-search-sql.php')]);
 command('registration-ui',process.execPath,['tools/test-registration-ui.cjs']);
 command('security',process.execPath,['tools/test-release-security.cjs']);
 command('visual-disabled',process.execPath,['tools/test-visual-disabled.cjs']);
 for(const theme of ['light','dark'])command(theme+'-registration',process.execPath,['tools/test-registration.cjs'],{REFIND_THEME:theme});
 // Needs the disposable CI container's second, non-loopback host; native release-candidate QA records it as skipped.
 if(process.env.REFIND_TEST_PROFILE==='v1-rc'&&process.env.REFIND_CI_DISPOSABLE!=='1'){summary.checks.push({name:'local-access',status:'SKIPPED',reason:'CI-only: requires the disposable container network'});save();}
 else command('local-access',process.execPath,['tools/test-local-access.cjs']);
 for(const theme of ['light','dark'])for(const suite of ['auth','account','student','workflow','v025','ux']){
  command(theme+'-'+suite,process.execPath,['tools/test-'+suite+'.cjs',...(suite==='ux'?['--v025']:[])],{REFIND_THEME:theme});
 }
 command('layout',process.execPath,['tools/test-layout.cjs']);
 command('ui-profile',process.execPath,['tools/test-ui-profile.cjs']);
 // Glass titles inspect My Activity claim cards for the first demo Student; a fresh database has none, so the suite gets its own temporary claim.
 {const glass=pendingClaimFixture('Glass titles');try{command('glass-titles',process.execPath,['tools/test-glass-titles.cjs']);}finally{q('DELETE FROM items WHERE item_id=?',[Number(glass.item)]);}}
 command('menu-polish',process.execPath,['tools/test-menu-polish.cjs']);
 }
 // A fresh pending claim ensures BM draft preservation is exercised even on an empty QA seed.
 const fixture=pendingClaimFixture('Release visual');visualItem=fixture.item;const claim=fixture.claim;
 if(!appearanceOnly)command('theme',process.execPath,['tools/test-theme.cjs']);
 command('appearance',process.execPath,['tools/test-appearance.cjs'],{REFIND_APPEARANCE_CLAIM_ID:claim});
 command('smoke',process.execPath,['tools/smoke-auth.cjs','--v025']);
}finally{
 if(visualItem)q('DELETE FROM items WHERE item_id=?',[Number(visualItem)]);
 command('schema-after',qa.php,[path.join(qa.target,'tools/check-database.php')]);
 command('invariants-after',qa.php,[path.join(qa.target,'tools/check-workflow.php')]);
 save();
}
