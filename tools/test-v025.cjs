const qaRuntime = require('./qa-runtime.cjs');
qaRuntime.assertQa();
const {themedContext}=require('./qa-browser.cjs');
// v0.2.5 acceptance: one group per QA finding fixed in this release. Fresh actors and exact-ID cleanup in the owned _test copy.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),testRoot=path.resolve(root,'..','ReFind_0.2.0_Test'),base='http://localhost/ReFind_0.2.0_Test/',php=qaRuntime.php;
const {chromium} = qaRuntime.playwright();
const out=process.env.REFIND_EVIDENCE_DIR?path.resolve(process.env.REFIND_EVIDENCE_DIR):path.join(root,'docs','verification','v025','fixes');assert.equal(JSON.parse(fs.readFileSync(path.join(testRoot,'.refind-b02-test.json'))).source,root);fs.mkdirSync(out,{recursive:true});
const run='V025-'+Date.now().toString(36),results=[],browserErrors=[],actors=[];let browser;
function driver(input){return JSON.parse(execFileSync(php,[path.join(testRoot,'tools','b02-fixture.php')],{input:JSON.stringify(input),encoding:'utf8'}));}
function q(query,values=[]){return driver({action:'query',query,values});}
function persist(extra={}){fs.writeFileSync(path.join(out,'v025-results.json'),JSON.stringify({scope:'v0.2.5 fixes for the 49 QA findings, on isolated _test',run,results,passed:results.length,browserErrors,...extra},null,2)+'\n');}
async function test(name,fn){await fn();results.push(name);persist();console.log('PASS '+results.length+': '+name);}
function actor(label,role='STUDENT'){const password='V025!'+crypto.randomBytes(8).toString('hex'),email=run.toLowerCase()+'-'+label+'@refind.test',hash=execFileSync(php,['-r','echo password_hash(stream_get_contents(STDIN),PASSWORD_DEFAULT);'],{input:password,encoding:'utf8'});const id=q('INSERT INTO users(full_name,email,role,password_hash,student_id) VALUES (?,?,?,?,?)',[run+' '+label,email,role,hash,role==='STUDENT'?run+'-'+label:null]).id;actors.push(id);return{id:String(id),email,password,role};}
class Session{
 cookies=new Map();csrf='';
 async call(endpoint,values,files={}){const headers={Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')},init={headers,redirect:'manual'};if(values!==undefined){const form=new FormData();Object.entries(values).forEach(([k,v])=>form.append(k,v));Object.entries(files).forEach(([key,list])=>list.forEach(f=>form.append(key+'[]',new Blob([f.buffer],{type:f.type}),f.name)));init.method='POST';init.body=form;headers['X-CSRF-Token']=this.csrf;}const r=await fetch(base+endpoint,init);for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');if(pair.slice(i+1))this.cookies.set(pair.slice(0,i),pair.slice(i+1));else this.cookies.delete(pair.slice(0,i));}const buf=Buffer.from(await r.arrayBuffer()),type=r.headers.get('content-type')||'';return{status:r.status,data:type.includes('application/json')?JSON.parse(buf.toString()):buf,text:buf.toString()};}
 async login(a){let r=await this.call('api/session.php');this.csrf=r.data.csrf;r=await this.call('api/auth.php',{action:'login',email:a.email,password:a.password});assert.equal(r.status,200,r.text);this.csrf=r.data.csrf;return this;}
 async ok(endpoint,values,files){const r=await this.call(endpoint,values,files);assert.ok(r.status>=200&&r.status<300,r.text);return r.data;}
}
const image={name:'headphones.jpg',type:'image/jpeg',buffer:fs.readFileSync(path.join(root,'tools','demo-photos','headphones-overview.jpg'))};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const tomorrow=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+86400000));
// Each scenario gets its own vocabulary so suggestions never leak between scenarios or into the demo data.
function report(type,label,extra={}){return{action:'create',type,title:run+' '+label,description:run+' '+label+' item with a distinctive marking.',category_id:'1',location_id:'37',location_detail:'',date:'2026-10-10',time:'',clue:'PRIVATE '+label+' hidden mark under the cover.',...extra};}
async function create(s,type,label,extra={},files={}){return(await s.ok('api/items.php',report(type,label,extra),files)).id;}
async function item(s,id){return(await s.ok('api/items.php?id='+id)).item;}
async function claim(s,found,lost='',files={}){return(await s.ok('api/claims.php',{itemId:found,lostItemId:lost,answer:'PRIVATE owner detail about the hidden mark.'},files)).id;}
async function detail(s,id){return(await s.ok('api/staff.php?resource=claims&id='+id)).claim;}
async function review(s,id,decision,note='PRIVATE ownership review note for v025.'){const d=await detail(s,id);return s.ok('api/staff.php',{action:'review',id,decision,note,revision:d.revision,confirm:'1'});}
async function pickup(s,id){return(await s.ok('api/handovers.php?id='+id)).handovers[0];}
function futureInput(days=2){const d=new Date(Date.now()+days*86400000),p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d),v=k=>p.find(x=>x.type===k).value;return v('year')+'-'+v('month')+'-'+v('day')+'T'+v('hour')+':'+v('minute');}
async function changePickup(s,id,action,extra={}){const d=await pickup(s,id);return s.call('api/handovers.php',{id,action,revision:d.revision,confirm:'1',note:'PRIVATE pickup operation reason.',...extra});}
const notes=(userId,where='',values=[])=>q('SELECT notification_type,title,message,claim_id,item_id FROM notifications WHERE user_id=? '+where+' ORDER BY notification_id',[Number(userId),...values]).rows;
const pairs=(lost,found)=>q('SELECT match_status,match_score FROM item_matches WHERE lost_item_id=? AND found_item_id=?',[Number(lost),Number(found)]).rows;
async function browserPage(a,viewport={width:1280,height:900}){const s=await new Session().login(a),context=await themedContext(browser,{viewport,timezoneId:'Asia/Jakarta'});await context.addCookies([{name:'refind_020_test',value:s.cookies.get('refind_020_test'),domain:'localhost',path:'/ReFind_0.2.0_Test/'}]);const page=await context.newPage();page.on('pageerror',e=>browserErrors.push(String(e)));return{page,context,s};}
async function go(page,route){await page.goto(base+route);await page.waitForSelector('body[data-ready="true"]');}

(async()=>{
 driver({action:'clear_throttle'});driver({action:'failpoint',mode:'off'});
 const A=actor('owner'),B=actor('finder'),C=actor('other'),BM=actor('staff','BUILDING_MANAGEMENT'),BM2=actor('peer','BUILDING_MANAGEMENT');
 const a=await new Session().login(A),b=await new Session().login(B),c=await new Session().login(C),bm=await new Session().login(BM),bm2=await new Session().login(BM2);
 const ctx={};
 try{
  await test('F01/F08 matching skips own reports, other categories and impossible dates; stricter score',async()=>{
   const lost=await create(a,'LOST','silverlaptop charger',{description:run+' silverlaptop charger with blue tape and a dented plug.'});
   const self=await create(a,'FOUND','silverlaptop charger',{description:run+' silverlaptop charger with blue tape and a dented plug.'});
   const otherCategory=await create(b,'FOUND','silverlaptop charger',{category_id:'8',description:run+' silverlaptop charger with blue tape and a dented plug.'});
   const tooEarly=await create(b,'FOUND','silverlaptop charger',{date:'2026-09-01',description:run+' silverlaptop charger with blue tape and a dented plug.'});
   const real=await create(b,'FOUND','silverlaptop charger',{description:run+' silverlaptop charger with blue tape and a dented plug.'});
   assert.equal(pairs(lost,self).length,0);assert.equal(pairs(lost,otherCategory).length,0);assert.equal(pairs(lost,tooEarly).length,0);
   const pair=pairs(lost,real);assert.equal(pair.length,1);assert.ok(Number(pair[0].match_score)>=55);
   const l=await item(a,lost);assert.equal(l.status_code,'POTENTIAL_MATCH');assert.deepEqual(l.matches.map(m=>m.item_id),[real]);
   const weak=await create(b,'FOUND','unrelatedthing',{location_id:'38',date:'2026-09-20',description:run+' something else entirely.'});assert.equal(pairs(lost,weak).length,0);
   ctx.matchLost=lost;ctx.matchFound=real;
  });
  await test('F05 future event date, one-letter title and short private clue are rejected with field errors',async()=>{
   for(const [extra,field] of [[{date:tomorrow},'date'],[{title:'X'},'title'],[{clue:'short'},'clue']]){const r=await a.call('api/items.php',report('LOST','invalid',extra));assert.equal(r.status,422,r.text);assert.ok(r.data.fields[field],field);}
   assert.equal((await a.call('api/items.php',report('LOST','today ok',{date:today}))).status,201);
  });
  await test('F02 a Lost report backs one claim under review; approval closes legacy claims that reused it',async()=>{
   const lost=await create(a,'LOST','shared bluebottle',{category_id:'7',description:run+' shared bluebottle steel flask.'}),f1=await create(b,'FOUND','shared bluebottle',{category_id:'7',description:run+' shared bluebottle steel flask.'}),f2=await create(b,'FOUND','shared bluebottle copy',{category_id:'7',description:run+' shared bluebottle steel flask copy.'});
   const c1=await claim(a,f1,lost);const second=await a.call('api/claims.php',{itemId:f2,lostItemId:lost,answer:'PRIVATE reuse of the same Lost report.'});assert.equal(second.status,422);assert.ok(second.data.fields.lostItemId);
   // Legacy data from before v0.2.5 could contain such a second claim; create it directly and check approval closes it.
   const legacy=q("INSERT INTO claims(item_id,related_lost_item_id,claimant_user_id,ownership_answer,claim_status) VALUES (?,?,?,'Legacy shared claim','PENDING')",[Number(f2),Number(lost),Number(A.id)]).id;
   q('UPDATE items SET status_id=4 WHERE item_id=?',[Number(f2)]);q("INSERT INTO item_status_history(item_id,status_id,changed_by_user_id,note) VALUES (?,4,?,'Legacy claim fixture')",[Number(f2),Number(A.id)]);
   await review(bm,c1,'approved');
   assert.equal(q('SELECT claim_status FROM claims WHERE claim_id=?',[Number(legacy)]).rows[0].claim_status,'REJECTED');
   assert.ok(['OPEN','POTENTIAL_MATCH'].includes((await item(b,f2)).status_code));
   assert.ok(notes(A.id,"AND title='Other claims closed'").length===1);
  });
  await test('A03 withdraw returns the item, leaves the BM queue and allows a new claim later',async()=>{
   const f=await create(b,'FOUND','withdraw wallet',{category_id:'3',description:run+' withdraw wallet leather.'});const id=await claim(c,f);
   assert.equal((await item(c,f)).status_code,'VERIFICATION');assert.equal((await c.ok('api/claims.php?id='+id)).claims[0].can_withdraw,true);
   const r=await c.ok('api/claims.php',{action:'withdraw',itemId:f});assert.equal(r.status,'WITHDRAWN');
   assert.equal((await c.ok('api/claims.php?id='+id)).claims[0].claim_status,'WITHDRAWN');assert.ok(['OPEN','POTENTIAL_MATCH'].includes((await item(c,f)).status_code));
   assert.ok(!(await bm.ok('api/staff.php?resource=claims&status=PENDING&limit=48&q='+encodeURIComponent(run+' withdraw'))).claims.some(x=>x.claim_id===id));
   assert.equal((await c.call('api/claims.php',{action:'withdraw',itemId:f})).status,409);
   assert.equal((await c.ok('api/claims.php',{itemId:f,answer:'PRIVATE renewed ownership detail.'})).id,id);
   await review(bm,id,'approved');assert.equal((await c.call('api/claims.php',{action:'withdraw',itemId:f})).status,409);
  });
  await test('A04/F03/F04 rejection is final, unlocks the Lost report, settles to Possible match and delete removes claim photos',async()=>{
   const lost=await create(c,'LOST','redumbrella folding',{category_id:'8',location_id:'39',description:run+' redumbrella folding compact.'}),f=await create(b,'FOUND','redumbrella folding',{category_id:'8',location_id:'39',description:run+' redumbrella folding compact.'});
   const id=await claim(c,f,lost,{ownershipPhotos:[image]});assert.equal((await item(c,lost)).can_edit,false);assert.match((await item(c,lost)).edit_locked_reason,/claim/);
   await review(bm,id,'rejected');
   const again=await c.call('api/claims.php',{action:'resubmit',itemId:f,lostItemId:lost,answer:'PRIVATE trying again after rejection.'});assert.equal(again.status,409);assert.equal(again.data.code,'claim_final');
   assert.equal((await item(c,lost)).can_edit,true);assert.equal((await item(b,f)).status_code,'POTENTIAL_MATCH');
   assert.equal((await c.ok('api/claims.php?id='+id)).claims[0].can_resubmit,false);
   const photo=q('SELECT p.file_path FROM claim_photos p WHERE p.claim_id=?',[Number(id)]).rows[0].file_path;assert.ok(fs.existsSync(path.join(testRoot,'storage',photo)));
   await b.ok('api/items.php',{action:'delete',id:f});assert.equal(fs.existsSync(path.join(testRoot,'storage',photo)),false);
   assert.ok(notes(B.id,"AND notification_type='REPORT_DELETED'").some(n=>n.message.includes('redumbrella')));
  });
  await test('A06 release closes an uncollected pickup, removes the handover and reopens both reports',async()=>{
   const lost=await create(a,'LOST','greenbackpack canvas',{category_id:'7',location_id:'36',description:run+' greenbackpack canvas zip.'}),f=await create(b,'FOUND','greenbackpack canvas',{category_id:'7',location_id:'36',description:run+' greenbackpack canvas zip.'});
   const id=await claim(a,f,lost),approved=await review(bm,id,'approved'),h=approved.handover_id;
   assert.equal(notes(A.id,"AND notification_type='STATUS_CHANGED' AND item_id=?",[Number(lost)]).filter(n=>n.title==='Ready for pickup').length,0);
   assert.ok((await pickup(bm,h)).operations.includes('release'));
   assert.equal((await changePickup(bm,h,'schedule',{pickup_location_id:'36',scheduled_at:futureInput(2)})).status,200);
   assert.equal((await changePickup(bm,h,'release',{note:'short'})).status,422);
   const r=await changePickup(bm,h,'release',{note:'PRIVATE owner never came to collect the item.'});assert.equal(r.status,200,r.text);assert.equal(r.data.status,'RELEASED');
   assert.equal(Number(q('SELECT COUNT(*) AS n FROM handovers WHERE handover_id=?',[Number(h)]).rows[0].n),0);
   const cl=q('SELECT claim_status,review_note FROM claims WHERE claim_id=?',[Number(id)]).rows[0];assert.equal(cl.claim_status,'REJECTED');assert.match(cl.review_note,/^Pickup released:/);
   assert.equal(pairs(lost,f)[0].match_status,'REJECTED');
   for(const x of [lost,f])assert.ok(['OPEN','POTENTIAL_MATCH'].includes((await item(a,x)).status_code));
   const released=notes(A.id,"AND notification_type='HANDOVER_RELEASE'");assert.equal(released.length,1);
   assert.equal((await bm.call('api/handovers.php?id='+h)).status,404);
  });
  await test('R02 pickup changes notify the claimant and other BMs but not the acting BM; audit stays complete',async()=>{
   const f=await create(b,'FOUND','blackcalculator scientific',{category_id:'6',location_id:'40',description:run+' blackcalculator scientific solar.'}),id=await claim(c,f),h=(await review(bm,id,'approved')).handover_id;
   assert.equal((await changePickup(bm,h,'schedule',{pickup_location_id:'40',scheduled_at:futureInput(3)})).status,200);
   const typeFilter="AND notification_type='HANDOVER_SCHEDULE' AND claim_id=?";
   assert.equal(notes(BM.id,typeFilter,[Number(id)]).length,0);assert.equal(notes(BM2.id,typeFilter,[Number(id)]).length,1);assert.equal(notes(C.id,typeFilter,[Number(id)]).length,1);
   const audit=(await pickup(bm,h)).audit;assert.equal(audit.length,1);assert.equal(audit[0].pickup_event.operation,'schedule');assert.equal((await pickup(bm2,h)).audit.length,1);
   ctx.pickupClaim=id;ctx.pickup=h;ctx.pickupFound=f;
  });
  await test('R02 one notification per BM status update, titled with the new status',async()=>{
   const f=await create(b,'FOUND','yellowumbrella status',{category_id:'8',location_id:'35',description:run+' yellowumbrella status check.'}),before=notes(B.id).length;
   const d=(await bm.ok('api/staff.php?id='+f)).report;await bm.ok('api/staff.php',{action:'status',id:f,status:'UNDER_REVIEW',note:'PRIVATE operational review started.',revision:d.revision,confirm:'1'});
   const after=notes(B.id);assert.equal(after.length,before+1);assert.equal(after.at(-1).title,'Report updated: Under review');assert.equal(after.at(-1).message,'PRIVATE operational review started.');
  });
  await test('R08/R02 unread count mode and mark-all-read',async()=>{
   const count=await a.ok('api/notifications.php?count=1');assert.ok(count.unread_count>0);assert.equal(count.notifications,undefined);
   assert.equal((await a.call('api/notifications.php?count=2')).status,400);
   const r=await a.ok('api/notifications.php',{action:'read_all'});assert.equal(r.unread_count,0);assert.equal((await a.ok('api/notifications.php?count=1')).unread_count,0);
   assert.equal((await a.call('api/notifications.php',{action:'delete_all'})).status,400);
  });
  await test('R01 Explore active filter, History closed filter and conflicting filters',async()=>{
   const active=await a.ok('api/items.php?active=1&limit=48&q='+encodeURIComponent(run)),closed=await a.ok('api/items.php?closed=1&limit=48&q='+encodeURIComponent(run));
   assert.ok(active.items.every(i=>!['RESOLVED','UNCLAIMED_CLOSED'].includes(i.status_code)));assert.ok(closed.items.every(i=>['RESOLVED','UNCLAIMED_CLOSED'].includes(i.status_code)));
   assert.equal((await a.call('api/items.php?active=1&closed=1')).status,400);assert.equal((await a.call('api/items.php?active=0')).status,400);
  });
  await test('A01/A05/A07 BM sees claimant contact, the previous request after resubmit and lock links; students see the pickup desk',async()=>{
   const f=await create(b,'FOUND','pinkpencilcase zipper',{category_id:'6',location_id:'38',description:run+' pinkpencilcase zipper pouch.'}),id=await claim(a,f);
   const note='PRIVATE please describe the zipper charm.';await review(bm,id,'need_more_info',note);
   await a.ok('api/claims.php',{action:'resubmit',itemId:f,answer:'PRIVATE the zipper charm is a small star.'});
   const d=await detail(bm,id);assert.equal(d.claimant_email,A.email);assert.equal(d.claimant_student_id,run+'-owner');assert.equal(d.previous_request.note,note);assert.ok(d.resubmitted_at);
   const rep=(await bm.ok('api/staff.php?id='+f)).report;assert.equal(rep.active_claim_id,id);assert.deepEqual(rep.allowed_statuses,[]);
   const h=(await pickup(bm,ctx.pickup));assert.equal(h.claimant_email,C.email);assert.equal((await bm.ok('api/staff.php?id='+ctx.pickupFound)).report.active_handover_id,ctx.pickup);
   const studentView=await c.ok('api/handovers.php?id='+ctx.pickup);assert.equal(studentView.handovers[0].claimant_email,undefined);assert.equal(studentView.handovers[0].audit,undefined);
   const refs=await a.ok('api/references.php');assert.ok(refs.pickup_desk.name&&refs.pickup_desk.location&&refs.pickup_desk.hours&&refs.pickup_desk.contact);
   assert.equal(refs.filter_locations.length,6);assert.ok(refs.statuses.some(s=>s.code==='HANDOVER'&&s.name==='Ready for pickup'));
  });
  await test('F10 schedule errors name the field; F14 guest photos need a session; C01 history uses UI status names',async()=>{
   const f=await create(b,'FOUND','orangecap schedule',{category_id:'4',location_id:'35',description:run+' orangecap schedule test.'}),id=await claim(a,f),h=(await review(bm,id,'approved')).handover_id;
   let r=await changePickup(bm,h,'schedule',{pickup_location_id:'',scheduled_at:futureInput(2)});assert.equal(r.status,422);assert.ok(r.data.fields.pickup_location_id);
   r=await changePickup(bm,h,'schedule',{pickup_location_id:'35',scheduled_at:''});assert.equal(r.status,422);assert.ok(r.data.fields.scheduled_at);
   const photoItem=await create(b,'FOUND','photo check',{category_id:'4',location_id:'35'},{photos:[image]}),url=(await item(b,photoItem)).photos[0].replace('/ReFind_0.2.0_Test/','');
   assert.equal((await new Session().call(url)).status,401);assert.equal((await a.call(url)).status,200);
   assert.ok((await item(a,f)).history.some(x=>x.status_code==='HANDOVER'&&x.status_name==='Ready for pickup'));
  });
  await test('Maintenance: refresh-matches dry run reports the recalculation without changing data',async()=>{
   const before=q("SELECT COUNT(*) AS n FROM item_matches WHERE match_status='SUGGESTED'").rows[0].n;
   const result=JSON.parse(execFileSync(php,[path.join(testRoot,'tools','refresh-matches.php'),'--dry-run'],{encoding:'utf8'}));assert.equal(result.dry_run,true);
   assert.equal(q("SELECT COUNT(*) AS n FROM item_matches WHERE match_status='SUGGESTED'").rows[0].n,before);
  });
  if(process.argv.includes('--api-only')){persist({complete:true,apiOnly:true});return;}
  browser=await chromium.launch({executablePath:qaRuntime.chromePath(),headless:true});
  await test('F06/C14 missing or invalid ids show a not-found state with a way out and no Retry',async()=>{
   const p=await browserPage(A);for(const route of ['item.html','item.html?id=abc','item.html?id=99999999','claim.html','report.html?edit=abc']){await go(p.page,route);assert.ok(await p.page.locator('#page-missing').isVisible(),route);assert.equal(await p.page.locator('#retry-page').isVisible(),false,route);assert.ok(!(await p.page.locator('main').innerText()).includes('Cannot read'),route);}
   await p.context.close();
  });
  await test('F07/A02/A07 item page keeps the claim status beside a verified pair, offers "I found this item" and BM review link',async()=>{
   const lost=await create(a,'LOST','tealheadset wireless',{description:run+' tealheadset wireless foldable.'}),f=await create(b,'FOUND','tealheadset wireless',{description:run+' tealheadset wireless foldable.'}),id=await claim(a,f,lost);await review(bm,id,'approved');
   const p=await browserPage(A);await go(p.page,'item.html?id='+f);const text=await p.page.locator('#item-notice').innerText();assert.match(text,/Your claim: Approved/);assert.match(text,/Verified report pair/);assert.equal(await p.page.getByRole('link',{name:'Open linked report',exact:true}).count(),1);
   const other=await create(c,'LOST','lavenderscarf knitted',{category_id:'4',location_id:'36',description:run+' lavenderscarf knitted wool.'});await go(p.page,'item.html?id='+other);await p.page.getByRole('link',{name:'I found this item',exact:true}).click();await p.page.waitForURL('**/report.html?type=found&from='+other);await p.page.waitForSelector('body[data-ready="true"]');
   assert.equal(await p.page.inputValue('#r-category'),'4');assert.equal(await p.page.inputValue('#r-location'),'36');assert.ok(await p.page.locator('#report-context').isVisible());assert.equal(await p.page.locator('#lost-evidence').isHidden(),true);assert.match(await p.page.locator('#report-intro').innerText(),/where you found it/);
   await p.context.close();const s=await browserPage(BM);await go(s.page,'item.html?id='+f);assert.equal(await s.page.getByRole('link',{name:'Open in Review Queue',exact:true}).getAttribute('href'),'/ReFind_0.2.0_Test/admin.html?tab=reports&report='+f);await s.context.close();
  });
  await test('F05/C05/C10 report form blocks future dates in the browser and shows a success message after saving',async()=>{
   const p=await browserPage(B);await go(p.page,'report.html?type=lost');assert.equal(await p.page.getAttribute('#r-date','max'),today);await p.page.click('[data-report-type="FOUND"]');assert.ok(p.page.url().includes('type=found'));
   await p.page.fill('#r-title',run+' browser ivorycomb');await p.page.selectOption('#r-category','7');await p.page.fill('#r-description',run+' ivorycomb with wide teeth.');await p.page.selectOption('#r-location','35');await p.page.fill('#r-clue','PRIVATE a chip near the handle.');
   await p.page.evaluate(v=>{const e=document.querySelector('#r-date');e.max='';e.value=v;},tomorrow);await p.page.click('#report-submit');assert.match(await p.page.locator('[data-error="date"]').innerText(),/future/);
   await p.page.fill('#r-date',today);await p.page.click('#report-submit');await p.page.waitForURL('**/item.html?id=*');await p.page.waitForSelector('body[data-ready="true"]');assert.match(await p.page.locator('#shell-feedback').innerText(),/Report submitted/);
   await p.context.close();
  });
  await test('F09/C13 Explore drops bad URL values, shows active reports by default and opens filters with a count',async()=>{
   const p=await browserPage(A);await go(p.page,'browse.html?status=bogus&category_id=999&page=abc');const url=new URL(p.page.url());assert.equal(url.searchParams.get('status'),null);assert.equal(url.searchParams.get('category_id'),null);assert.ok(!p.page.url().includes('null'));assert.match(await p.page.locator('#result-count').innerText(),/active/);
   await go(p.page,'browse.html?status=HANDOVER&category_id=1');assert.ok(await p.page.locator('#advanced-filters').isVisible());assert.equal(await p.page.locator('#filter-toggle').innerText(),'Filters · 2');
   assert.equal(await p.page.locator('#filter-location option').count(),7);
   await go(p.page,'browse.html?page=999');assert.ok(!(await p.page.locator('#pager').innerText()).includes('999'));
   await p.context.close();
  });
  await test('R07/F12/A03 claim form preselects the matching Lost report, blocks emoji-only answers and supports withdraw',async()=>{
   const lost=await create(c,'LOST','goldbracelet charm',{category_id:'7',location_id:'38',description:run+' goldbracelet charm links.'}),f=await create(b,'FOUND','goldbracelet charm',{category_id:'7',location_id:'38',description:run+' goldbracelet charm links.'});
   const p=await browserPage(C);await go(p.page,'claim.html?id='+f);assert.equal(await p.page.inputValue('#c-lost'),lost);assert.ok(await p.page.locator('#linked-suggestion').isVisible());assert.equal(await p.page.locator('#claim-cancel').count(),0);
   await p.page.fill('#c-answer','😀😀😀😀');await p.page.click('#claim-submit');assert.match(await p.page.locator('[data-error="answer"]').innerText(),/8 characters/);assert.equal(await p.page.locator('#claim-submit').innerText(),'Submit claim');
   await p.page.fill('#c-answer','PRIVATE engraved initials inside the clasp.');await p.page.click('#claim-submit');await p.page.waitForURL('**/my-reports.html?tab=claims&claim=*');await p.page.waitForSelector('body[data-ready="true"]');assert.match(await p.page.locator('#shell-feedback').innerText(),/Claim submitted/);
   const id=new URL(p.page.url()).searchParams.get('claim');await p.page.locator('[data-claim-id="'+id+'"]').getByRole('button',{name:'Withdraw claim'}).click();await p.page.click('#confirm-withdraw');await p.page.waitForFunction(()=>document.querySelector('#shell-feedback').textContent.includes('withdrawn'));
   assert.equal((await c.ok('api/claims.php?id='+id)).claims[0].claim_status,'WITHDRAWN');
   await p.page.click('[data-activity="reports"]');await p.page.waitForSelector('body[data-ready="true"]');await p.page.click('[data-activity="claims"]');await p.page.waitForFunction(()=>!location.search.includes('claim='));assert.equal(await p.page.locator('.selected-claim').count(),0);
   await p.context.close();
  });
  await test('C12/R02 badge sits on Notifications and the Menu button; mark-all and unread links work',async()=>{
   const badgeClaim=await claim(a,await create(b,'FOUND','badgecheck item',{category_id:'8',location_id:'40'}));await review(bm,badgeClaim,'need_more_info','PRIVATE badge check request text.');
   const p=await browserPage(A,{width:390,height:844});await go(p.page,'notifications.html');assert.ok(await p.page.locator('#menu-unread').isVisible());assert.equal(await p.page.locator('#account-toggle .unread-badge').count(),0);
   await p.page.click('#nav-toggle');assert.ok(await p.page.locator('[data-main-nav="notifications"] #nav-unread').isVisible());await p.page.click('#nav-toggle');
   await p.page.click('#mark-all-read');await p.page.waitForFunction(()=>document.querySelector('#shell-feedback').textContent.includes('marked as read'));assert.equal(await p.page.locator('#menu-unread').isVisible(),false);assert.equal(await p.page.locator('.notification-card.unread').count(),0);assert.equal(await p.page.locator('#mark-all-read').isVisible(),false);
   await p.context.close();
  });
  await test('R03/A10/C07/F11/R06 BM confirmation only for final actions, status placeholder, clear labels and per-tab titles',async()=>{
   const p=await browserPage(BM);await go(p.page,'admin.html?tab=handover&handover='+ctx.pickup);assert.equal(await p.page.title(),'Handover — ReFind');
   await p.page.click('[data-bm-action="reschedule"]');assert.equal(await p.page.locator('#operation-confirm').isVisible(),false);await p.page.fill('#operation-note','PRIVATE unchanged reschedule attempt.');const before=await pickup(bm,ctx.pickup);await p.page.click('#operation-submit');assert.match(await p.page.locator('[data-bm-error="scheduled_at"]').innerText(),/different/);assert.equal((await pickup(bm,ctx.pickup)).revision,before.revision);await p.page.keyboard.press('Escape');
   await p.page.click('[data-bm-action="cancel_schedule"]');assert.equal(await p.page.locator('#operation-dismiss').innerText(),'Keep appointment');await p.page.keyboard.press('Escape');
   await p.page.click('[data-bm-action="release"]');assert.ok(await p.page.locator('#operation-confirm').isVisible());assert.equal(await p.page.locator('#operation-submit').isDisabled(),true);await p.page.keyboard.press('Escape');
   const f=await create(b,'FOUND','statusplaceholder item',{category_id:'8',location_id:'35'});await go(p.page,'admin.html?tab=reports&report='+f);assert.equal(await p.page.title(),'Report review — ReFind');await p.page.click('[data-bm-action="status"]');assert.equal(await p.page.inputValue('#operation-status'),'');assert.ok((await p.page.locator('#operation-status').innerText()).includes('Never retrieved (final)'));
   await p.page.selectOption('#operation-status','UNCLAIMED_CLOSED');assert.ok(await p.page.locator('#operation-confirm').isVisible());assert.ok(await p.page.locator('#operation-status-warning').isVisible());await p.page.selectOption('#operation-status','UNDER_REVIEW');assert.equal(await p.page.locator('#operation-confirm').isVisible(),false);await p.page.keyboard.press('Escape');
   assert.equal(await p.page.locator('[data-main-nav="handover"]').count(),0);
   await p.context.close();
  });
  await test('R03/A06 approve offers "Schedule pickup now" in place and Confirm returned warns about a future appointment',async()=>{
   const f=await create(b,'FOUND','approveflow item',{category_id:'8',location_id:'36'}),id=await claim(c,f),p=await browserPage(BM);await go(p.page,'admin.html?tab=claims&claim='+id);
   let releaseUnread,unreadStarted;const unreadGate=new Promise(resolve=>{releaseUnread=resolve;}),unreadHeld=new Promise(resolve=>{unreadStarted=resolve;});
   await p.page.route('**/api/notifications.php?count=1',async route=>{unreadStarted();await unreadGate;await route.continue();});
   await p.page.click('[data-bm-action="approved"]');await p.page.check('#operation-confirm');await p.page.click('#operation-submit');await p.page.waitForFunction(()=>!document.querySelector('#operation-dialog').open);
   await unreadHeld;assert.equal(await p.page.getByRole('button',{name:'Schedule pickup now'}).isDisabled(),true);releaseUnread();
   await p.page.getByRole('button',{name:'Schedule pickup now'}).click();await p.page.waitForSelector('[data-detail-handover-id]');assert.equal(new URL(p.page.url()).searchParams.get('tab'),'handover');
   await p.page.click('[data-bm-action="schedule"]');assert.match(await p.page.inputValue('#operation-date'),/T10:00$/);await p.page.selectOption('#operation-location','36');await p.page.click('#operation-submit');await p.page.waitForFunction(()=>!document.querySelector('#operation-dialog').open);await p.page.waitForSelector('[data-bm-action="complete"]');
   await p.page.click('[data-bm-action="complete"]');assert.match(await p.page.locator('#operation-intro').innerText(),/collected the item early/);await p.page.keyboard.press('Escape');
   await p.context.close();
  });
  await test('A06 releasing a pickup in the browser lands on the closed claim with its reason',async()=>{
   const f=await create(b,'FOUND','releaseui item',{category_id:'8',location_id:'38'}),id=await claim(c,f),h=(await review(bm,id,'approved')).handover_id,p=await browserPage(BM);
   await go(p.page,'admin.html?tab=handover&handover='+h);await p.page.click('[data-bm-action="release"]');await p.page.fill('#operation-note','PRIVATE owner never collected the item.');await p.page.check('#operation-confirm');await p.page.click('#operation-submit');
   await p.page.waitForSelector('[data-detail-claim-id="'+id+'"]');assert.equal(new URL(p.page.url()).searchParams.get('tab'),'claims');assert.match(await p.page.locator('#bm-feedback').innerText(),/Pickup released/);assert.match(await p.page.locator('#bm-detail-content').innerText(),/Pickup released: PRIVATE owner never collected/);
   await p.context.close();
  });
  await test('A08/F15 mobile BM: card opens detail as its own history step and the browser Back returns to the queue',async()=>{
   const p=await browserPage(BM,{width:390,height:844});await go(p.page,'admin.html?tab=reports');assert.equal(new URL(p.page.url()).searchParams.get('report'),null);
   await p.page.locator('.bm-queue-card').first().click();await p.page.waitForSelector('[data-detail-report-id]');assert.ok(new URL(p.page.url()).searchParams.get('report'));assert.ok(await p.page.locator('#bm-detail').isVisible());
   await p.page.goBack();await p.page.waitForFunction(()=>document.querySelector('.bm-layout').dataset.mobileView==='queue');assert.ok(p.page.url().includes('admin.html'));assert.ok(await p.page.locator('.bm-queue').isVisible());
   await p.page.locator('.bm-queue-card').first().click();await p.page.waitForSelector('[data-detail-report-id]');await p.page.click('#bm-back');await p.page.waitForFunction(()=>document.querySelector('.bm-layout').dataset.mobileView==='queue');assert.ok(p.page.url().includes('admin.html'));
   await p.context.close();
  });
  await test('Copy and version: 0.2.5 footer, History in Student nav, no developer jargon on key pages',async()=>{
   const p=await browserPage(A);for(const route of ['index.html','browse.html','history.html','notifications.html','my-reports.html','profile.html','settings.html']){await go(p.page,route);const body=await p.page.locator('body').innerText();assert.match(body,/ReFind 0\.2\.5/,route);for(const jargon of ['UTF-8','readonly','transaction commits','saved to the database','setup receipt','not UMN SSO'])assert.ok(!body.includes(jargon),route+' '+jargon);}
   assert.ok(await p.page.locator('[data-main-nav="history"]').isVisible()||await p.page.locator('#nav-toggle').isVisible());
   await go(p.page,'history.html');assert.match(await p.page.locator('#result-count').innerText(),/closed report/);
   for(const[width,height]of[[390,844],[768,1024],[1440,900]]){await p.page.setViewportSize({width,height});for(const route of ['notifications.html','my-reports.html?tab=claims','history.html']){await go(p.page,route);assert.ok(await p.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+' '+route);}}
   await p.page.screenshot({path:path.join(out,'history-1440.png'),fullPage:true});await p.context.close();
  });
  assert.deepEqual(browserErrors,[]);
  const invariants=JSON.parse(execFileSync(php,[path.join(testRoot,'tools','check-workflow.php')],{encoding:'utf8'}));assert.equal(invariants.passed,true);
  persist({complete:true,chrome:browser.version(),invariants});console.log('V025: ALL '+results.length+' GROUPS PASSED');
 }catch(e){persist({complete:false,failure:String(e)});throw e;}
 finally{
  if(browser)await browser.close();const ids=actors.map(Number),marks=ids.map(()=>'?').join(','),items=q('SELECT item_id FROM items WHERE reporter_user_id IN ('+marks+')',ids).rows.map(x=>Number(x.item_id));let paths=[];
  if(items.length){const m=items.map(()=>'?').join(',');paths=q('SELECT file_path FROM item_photos WHERE item_id IN ('+m+') UNION ALL SELECT p.file_path FROM claim_photos p JOIN claims c ON c.claim_id=p.claim_id WHERE c.item_id IN ('+m+')',[...items,...items]).rows.map(x=>x.file_path);q('DELETE FROM notifications WHERE item_id IN ('+m+')',items);q('DELETE FROM items WHERE item_id IN ('+m+')',items);}
  q('DELETE FROM notifications WHERE user_id IN ('+marks+')',ids);for(const id of actors)q('DELETE FROM users WHERE user_id=?',[Number(id)]);
  for(const relative of paths){assert.match(relative,/^(items|evidence|claims)\/[a-f0-9]{32}\.(jpg|png|webp)$/);const f=path.join(testRoot,'storage',relative);if(fs.existsSync(f))fs.unlinkSync(f);}driver({action:'clear_throttle'});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
