const qaRuntime = require('./qa-runtime.cjs');
qaRuntime.assertQa();
const {themedContext}=require('./qa-browser.cjs');
// UX01 real browser/HTTP acceptance. Fresh fixture actors and cleanup stay in owned _test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const edition=process.argv.includes('--v025')?'v025':process.argv.includes('--ux02')?'ux02':'ux01';
const root=path.resolve(__dirname,'..'),target=path.resolve(root,'..','ReFind_0.2.0_Test'),base='http://localhost/ReFind_0.2.0_Test/',php=qaRuntime.php,out=process.env.REFIND_EVIDENCE_DIR?path.resolve(process.env.REFIND_EVIDENCE_DIR):edition==='v025'?path.join(root,'docs','verification','v025','ux'):path.join(root,'docs','verification',edition);
assert.equal(JSON.parse(fs.readFileSync(path.join(target,'.refind-b02-test.json'))).source,root);
const {chromium} = qaRuntime.playwright();
fs.mkdirSync(out,{recursive:true});
const run=edition.toUpperCase()+'-'+Date.now().toString(36),actors=[],results=[],browserErrors=[],viewportChecks=[],contrastChecks=[];let browser;
function driver(input){return JSON.parse(execFileSync(php,[path.join(target,'tools','b02-fixture.php')],{input:JSON.stringify(input),encoding:'utf8'}));}
function q(query,values=[]){return driver({action:'query',query,values});}
function actor(label,role='STUDENT'){const password='UX!'+crypto.randomBytes(10).toString('hex'),email=run.toLowerCase()+'-'+label+'@refind.test',hash=execFileSync(php,['-r','echo password_hash(stream_get_contents(STDIN),PASSWORD_DEFAULT);'],{input:password,encoding:'utf8'}),id=q('INSERT INTO users(full_name,email,role,password_hash,student_id) VALUES (?,?,?,?,?)',[run+' '+label,email,role,hash,role==='STUDENT'?run+'-'+label:null]).id;actors.push(id);return{id,email,password};}
class Session{
  cookies=new Map();csrf='';
  async call(endpoint,values){const headers={Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')},options={headers,redirect:'manual'};if(values){const body=new FormData();Object.entries(values).forEach(([k,v])=>body.append(k,v));options.method='POST';options.body=body;headers['X-CSRF-Token']=this.csrf;}const response=await fetch(base+endpoint,options);for(const c of response.headers.getSetCookie()){const pair=c.split(';')[0],index=pair.indexOf('=');this.cookies.set(pair.slice(0,index),pair.slice(index+1));}return{status:response.status,data:await response.json()};}
  async login(a){this.csrf=(await this.call('api/session.php')).data.csrf;const r=await this.call('api/auth.php',{action:'login',email:a.email,password:a.password});assert.equal(r.status,200);this.csrf=r.data.csrf;return this;}
  async ok(endpoint,values){const r=await this.call(endpoint,values);assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.data;}
}
function report(type,label){return{action:'create',type,title:run+' '+label,description:'Classroom verification item with a hidden identifying detail.',category_id:'1',location_id:'37',date:'2026-10-10',time:'',clue:'Private hidden mark for UX acceptance.'};}
async function found(s,label){return(await s.ok('api/items.php',report('FOUND',label))).id;}
async function claim(s,id,lost=''){return(await s.ok('api/claims.php',{itemId:id,lostItemId:lost,answer:'Private identifying detail from the owner.'})).id;}
async function review(s,id,decision){const d=(await s.ok('api/staff.php?resource=claims&id='+id)).claim;return s.ok('api/staff.php',{action:'review',id,decision,revision:d.revision,confirm:'1',note:'Private '+run+' '+decision+' review reason.'});}
async function pickup(s,id,action,extra={}){const d=(await s.ok('api/handovers.php?id='+id)).handovers[0];return s.ok('api/handovers.php',{action,id,revision:d.revision,confirm:'1',note:'Private '+run+' '+action+' reason.',...extra});}
function future(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(Date.now()+3*86400000)),v=k=>parts.find(p=>p.type===k).value;return v('year')+'-'+v('month')+'-'+v('day')+'T'+v('hour')+':'+v('minute');}
async function logged(a,viewport={width:390,height:844}){const s=await new Session().login(a),context=await themedContext(browser,{viewport,timezoneId:'America/Los_Angeles'});await context.addCookies([{name:'refind_020_test',value:s.cookies.get('refind_020_test'),domain:'localhost',path:'/ReFind_0.2.0_Test/'}]);const page=await context.newPage();page.on('pageerror',e=>browserErrors.push(String(e)));return{page,context};}
async function go(page,route){await page.goto(base+route);await page.waitForSelector('body[data-ready="true"]');}
async function exact(page,id){await page.waitForSelector('[data-detail-claim-id="'+id+'"]',{state:'attached'});}
async function group(name,fn){await fn();results.push(name);console.log('PASS UX '+results.length+': '+name);}

(async()=>{
  driver({action:'clear_throttle'});const A=actor('owner'),B=actor('finder'),BM=actor('staff','BUILDING_MANAGEMENT'),BM2=actor('peer','BUILDING_MANAGEMENT');
  const a=await new Session().login(A),b=await new Session().login(B),bm=await new Session().login(BM),peer=await new Session().login(BM2);
  try{
    const itemA=await found(b,'Pending A'),itemB=await found(b,'Pending B'),idA=await claim(a,itemA),idB=await claim(a,itemB);
    const completedItem=await found(b,'Completed without appointment'),completedClaim=await claim(a,completedItem),completed=(await review(bm,completedClaim,'approved')).handover_id;
    await pickup(bm,completed,'complete');
    const scheduledItem=await found(b,'Scheduled appointment'),scheduledClaim=await claim(a,scheduledItem),scheduled=(await review(bm,scheduledClaim,'approved')).handover_id;
    const rejectedItem=await found(b,'Rejected record'),rejectedClaim=await claim(a,rejectedItem);await review(bm,rejectedClaim,'rejected');
    for(let index=0;index<25;index++)await claim(a,await found(b,'Other queued '+index));
    await pickup(bm,scheduled,'schedule',{pickup_location_id:'37',scheduled_at:future()});
    browser=await chromium.launch({executablePath:qaRuntime.chromePath(),headless:true});
    const p=await logged(BM),owner=await logged(A),peerPage=await logged(BM2);
    await group('Search/filter clears stale action targets immediately and empty results have no decisions',async()=>{
      await go(p.page,'admin.html?tab=claims&claim='+idA);await p.page.fill('#bm-search',run+' Pending B');await exact(p.page,idB);assert.equal(await p.page.locator('[data-detail-claim-id="'+idA+'"]').count(),0);
      await p.page.fill('#bm-search','NoSuch'+run);await p.page.waitForFunction(()=>document.querySelector('#bm-queue-list').textContent.includes('Queue is clear'));assert.equal(await p.page.locator('[data-bm-action]').count(),0);
    });
    await group('Pagination selects only a record on the new page',async()=>{
      await go(p.page,'admin.html?tab=claims');const first=await p.page.locator('.bm-queue-card').evaluateAll(cards=>cards.map(c=>c.dataset.recordId));await p.page.locator('#bm-pager').getByRole('button',{name:'Next',exact:true}).click();await p.page.waitForFunction(()=>document.querySelector('#bm-pager').textContent.includes('2 /'));
      const selected=await p.page.locator('[data-detail-claim-id]').getAttribute('data-detail-claim-id');assert.ok(!first.includes(selected));assert.ok(await p.page.locator('.bm-queue-card[data-record-id="'+selected+'"]').count());
    });
    await group('Late detail response cannot replace the current filtered record',async()=>{
      await p.page.setViewportSize({width:1280,height:800});await go(p.page,'admin.html?tab=claims');await p.page.fill('#bm-search',run+' Pending');await p.page.waitForFunction(()=>document.querySelector('#queue-count').textContent==='2 record(s)');
      let release;const gate=new Promise(resolve=>release=resolve),pattern='**/api/staff.php?resource=claims&id='+idA;
      await p.page.route(pattern,async route=>{await gate;await route.continue();});await p.page.locator('.bm-queue-card[data-record-id="'+idA+'"]').click();await p.page.waitForFunction(()=>document.querySelector('#bm-detail-content').textContent.includes('Loading selected record'));
      await p.page.fill('#bm-search',run+' Pending B');await exact(p.page,idB);const response=p.page.waitForResponse(r=>r.url().endsWith('resource=claims&id='+idA));release();await response;await p.page.waitForTimeout(80);await exact(p.page,idB);await p.page.unroute(pattern);
    });
    await group('Review hierarchy has one primary and confirmation identifies item/claimant/claim',async()=>{
      await go(p.page,'admin.html?tab=claims&claim='+idA);assert.equal(await p.page.locator('.bm-detail-actions .btn-primary').count(),1);assert.ok(await p.page.locator('[data-bm-action="need_more_info"]').evaluate(e=>e.classList.contains('btn-outline')));assert.ok(await p.page.locator('[data-bm-action="rejected"]').evaluate(e=>e.classList.contains('btn-danger-outline')));
      await p.page.click('[data-bm-action="approved"]');assert.equal(await p.page.locator('#operation-record-title').innerText(),run+' Pending A');assert.match(await p.page.locator('#operation-record-meta').innerText(),new RegExp('Claim #'+idA));assert.match(await p.page.locator('#operation-record-meta').innerText(),/owner/);assert.equal(await p.page.locator('#operation-submit').isDisabled(),true);await p.page.keyboard.press('Escape');
      await p.page.click('[data-bm-action="rejected"]');assert.ok(await p.page.locator('#operation-submit').evaluate(e=>e.classList.contains('btn-danger')));await p.page.keyboard.press('Escape');
    });
    await group('Linked reviewed outcome opens detail first on mobile and Back restores queue',async()=>{
      await p.page.setViewportSize({width:390,height:844});await go(p.page,'admin.html?tab=claims&claim='+completedClaim);assert.equal(await p.page.locator('.bm-queue').isVisible(),false);assert.equal(await p.page.locator('#bm-selection-note').isVisible(),true);assert.equal(await p.page.evaluate(()=>document.activeElement.id),'bm-detail');assert.equal(await p.page.locator('[data-bm-action="approved"]').count(),0);
      await p.page.click('#bm-back');assert.equal(await p.page.locator('.bm-queue').isVisible(),true);assert.equal(await p.page.locator('#bm-detail').isVisible(),false);assert.equal(new URL(p.page.url()).searchParams.get('claim'),null);
    });
    await group('Conflict refresh retains note but resets confirmation and never replays the POST',async()=>{
      await go(p.page,'admin.html?tab=claims&claim='+idA);await p.page.click('[data-bm-action="approved"]');const draft='My retained UX decision note.';await p.page.fill('#operation-note',draft);await p.page.check('#operation-confirm');await review(peer,idA,'need_more_info');await p.page.click('#operation-submit');await p.page.waitForSelector('#operation-refresh',{state:'visible'});assert.equal(await p.page.inputValue('#operation-note'),draft);
      await p.page.click('#operation-refresh');await p.page.waitForFunction(()=>!document.querySelector('#operation-dialog').open);await exact(p.page,idA);await p.page.click('[data-bm-action="approved"]');assert.equal(await p.page.inputValue('#operation-note'),draft);assert.equal(await p.page.locator('#operation-confirm').isChecked(),false);assert.equal(await p.page.locator('#operation-submit').isDisabled(),true);assert.equal((await bm.ok('api/staff.php?resource=claims&id='+idA)).claim.claim_status,'NEED_MORE_INFO');await p.page.keyboard.press('Escape');
    });
    await group('Student completed claim shows Returned/completion time and exact focused deep link',async()=>{
      await go(owner.page,'my-reports.html?tab=claims&claim='+completedClaim);const card=owner.page.locator('[data-claim-id="'+completedClaim+'"]');assert.equal(await card.locator('[data-state="COMPLETED"]').innerText(),'Returned');assert.match(await card.locator('.pickup-summary').innerText(),/WIB/);assert.ok(!(await card.innerText()).includes('Not scheduled yet'));assert.equal(await owner.page.evaluate(()=>document.activeElement.dataset.claimId),String(completedClaim));assert.equal((await a.ok('api/claims.php?id='+completedClaim)).claims[0].claim_status,'APPROVED');
    });
    await group('Pickup read model is human-friendly and private while original audit remains intact',async()=>{
      const data=await bm.ok('api/handovers.php?id='+scheduled),event=data.handovers[0].audit[0];assert.match(event.message,/Before:/);assert.equal(event.pickup_event.after.location,'Gedung C');assert.equal(event.pickup_event.operation,'schedule');
      await go(owner.page,'notifications.html');const note=owner.page.locator('.notification-card').filter({hasText:'Pickup scheduled'}).first();assert.match(await note.innerText(),/Gedung C/);assert.match(await note.innerText(),/WIB/);assert.ok(!(await note.innerText()).includes('location 37'));assert.ok(!(await note.innerText()).includes('Before: PENDING'));
      assert.ok(!JSON.stringify((await a.ok('api/items.php?id='+scheduledItem)).item.history).includes('Private '+run));assert.equal((await b.call('api/handovers.php?id='+scheduled)).status,404);
      await go(p.page,'notifications.html');assert.equal(await p.page.locator('.notification-card').filter({hasText:'Pickup scheduled'}).filter({hasText:run+' Scheduled appointment'}).count(),0);await go(peerPage.page,'notifications.html');const staffNote=peerPage.page.locator('.notification-card').filter({hasText:'Pickup scheduled'}).first();const nid=await staffNote.getAttribute('data-notification-id');assert.match(await staffNote.locator('a').getAttribute('href'),new RegExp('tab=handover&handover='+scheduled));await staffNote.locator('a').click();await peerPage.page.waitForURL('**/admin.html?tab=handover&handover=*');assert.equal(await peerPage.page.locator('[data-detail-handover-id]').getAttribute('data-detail-handover-id'),String(scheduled));assert.equal(Number(q('SELECT is_read FROM notifications WHERE notification_id=?',[Number(nid)]).rows[0].is_read),1);
    });
    await group('Optional custom upload disclosure works by keyboard and reveals errors/prepared photos',async()=>{
      await go(owner.page,'report.html?type=lost');assert.ok(await owner.page.evaluate(()=>document.querySelector('#report-submit').getBoundingClientRect().width>document.querySelector('.sticky-form-actions .btn-outline').getBoundingClientRect().width));assert.equal(await owner.page.locator('#public-photo-section').evaluate(e=>e.open),false);await owner.page.locator('#public-photo-section summary').focus();await owner.page.keyboard.press('Enter');assert.equal(await owner.page.locator('#public-photo-section').evaluate(e=>e.open),true);
      await owner.page.setInputFiles('#r-photos',{name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await owner.page.waitForSelector('#public-upload .upload-status.error');await owner.page.setInputFiles('#r-photos',path.join(root,'tools','demo-photos','headphones-overview.jpg'));await owner.page.waitForSelector('#public-upload .upload-preview');assert.match(await owner.page.locator('#public-upload .upload-file-hint').innerText(),/1 new/);assert.equal(await owner.page.locator('#public-upload .upload-choose').innerText(),'Choose photos');
    });
    await group('Live text/focus/control contrast meets thresholds and semantic states agree across roles',async()=>{
      await go(p.page,'admin.html?tab=claims&claim='+idB);await p.page.keyboard.press('Tab');await p.page.locator('[data-bm-action="approved"]').focus();
      const computed=await p.page.evaluate(()=>{
        const rgb=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=value=>rgb(value).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0),ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
        const background=element=>{for(let e=element;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent')return c;}return'rgb(255, 255, 255)';};
        const primary=document.querySelector('[data-bm-action="approved"]'),body=document.querySelector('.page-heading p'),input=document.querySelector('#bm-search'),chip=document.querySelector('#bm-detail [data-state="PENDING"]');
        return [{name:'primary text',ratio:ratio(getComputedStyle(primary).color,background(primary)),min:4.5},{name:'page secondary text',ratio:ratio(getComputedStyle(body).color,background(body)),min:4.5},{name:'keyboard focus',ratio:ratio(getComputedStyle(primary).outlineColor,background(primary.parentElement)),min:3},{name:'search boundary',ratio:ratio(getComputedStyle(input).borderTopColor,background(input.parentElement)),min:3},{name:'pending chip',ratio:ratio(getComputedStyle(chip).color,background(chip)),min:4.5}];
      });computed.forEach(check=>assert.ok(check.ratio>=check.min,check.name+' '+check.ratio));contrastChecks.push(...computed);
      const bmColor=await p.page.locator('#bm-detail [data-state="PENDING"]').evaluate(e=>getComputedStyle(e).backgroundColor);await go(owner.page,'my-reports.html?tab=claims&claim='+idB);assert.equal(await owner.page.locator('[data-claim-id="'+idB+'"] [data-state="PENDING"]').evaluate(e=>getComputedStyle(e).backgroundColor),bmColor);
    });
    await group('Synthetic headings remain labelled and all five viewports preserve usable actions/dialogs',async()=>{
      const seedTitle='Demo B06 · C77 Wallet <img src=x onerror=alert(1)> (found)';await p.page.setViewportSize({width:1280,height:800});await go(p.page,'admin.html?tab=claims&claim='+idB);await p.page.evaluate(title=>{const item={item_id:'1',item_type:'FOUND',status_code:'OPEN',title,photos:[],category_name:'Other',location_name:'Gedung C',event_date:'2026-10-10',event_time:null};document.querySelector('#bm-detail-content').append(window.StudentUI.card(item)[0]);},seedTitle);assert.ok(await p.page.getByText('Classroom example · C77',{exact:true}).count());assert.equal(await p.page.locator('img[src="x"]').count(),0);
      for(const[width,height]of[[360,800],[390,844],[768,1024],[1280,800],[1440,900]]){
        await p.page.setViewportSize({width,height});await go(p.page,'admin.html?tab=claims&claim='+idB);assert.ok(await p.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.page.click('[data-bm-action="need_more_info"]');assert.ok(await p.page.locator('#operation-dialog').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));await p.page.keyboard.press('Escape');
        for(const selector of['[data-bm-action="approved"]','[data-bm-action="need_more_info"]','[data-bm-action="rejected"]'])assert.ok(await p.page.locator(selector).evaluate(e=>e.getBoundingClientRect().height>=44));
        if(width===390||width===1440){await p.page.evaluate(async()=>{scrollTo({top:0,behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await p.page.screenshot({path:path.join(out,'review-'+width+'.png'),fullPage:true});}viewportChecks.push({width,height,noOverflow:true,dialogFits:true,actions44px:true});
      }
    });
    await group('Reduced usable viewport keeps confirmation scrollable with explicit confirmation required',async()=>{
      await p.page.setViewportSize({width:390,height:420});await go(p.page,'admin.html?tab=claims&claim='+idB);await p.page.click('[data-bm-action="approved"]');assert.ok(await p.page.locator('#operation-dialog').evaluate(e=>{const r=e.getBoundingClientRect();return r.height<=innerHeight-32&&r.top>=0;}));await p.page.fill('#operation-note','Small viewport review note.');await p.page.check('#operation-confirm');await p.page.locator('#operation-submit').scrollIntoViewIfNeeded();assert.equal(await p.page.locator('#operation-submit').isEnabled(),true);await p.page.keyboard.press('Escape');
    });
    if(['ux02','v025'].includes(edition)){
      const ownItem=(await a.ok('api/items.php',report('LOST','Own editable report'))).id;
      const pairLost=(await a.ok('api/items.php',report('LOST','Linked Lost'))).id,pairFound=await found(b,'Linked Found'),pairClaim=await claim(a,pairFound,pairLost);await review(bm,pairClaim,'approved');
      async function clickDestination(page,link,pathEnd,query={}){await link.click();await page.waitForURL(url=>url.pathname.endsWith('/'+pathEnd)&&Object.entries(query).every(([key,value])=>url.searchParams.get(key)===String(value)));await page.waitForSelector('body[data-ready="true"]');}
      await group('Nine navigation labels preserve real anchor destinations, keyboard activation and native new tabs',async()=>{
        await owner.page.setViewportSize({width:390,height:844});await go(owner.page,'index.html');await clickDestination(owner.page,owner.page.getByRole('link',{name:'Follow my reports and claims',exact:true}),'my-reports.html');
        await go(owner.page,'index.html');const popup=owner.context.waitForEvent('page');await owner.page.getByRole('link',{name:'Explore all',exact:true}).click({modifiers:['Control']});const opened=await popup;await opened.waitForURL(url=>url.pathname.endsWith('/browse.html'));await opened.waitForSelector('body[data-ready="true"]');await opened.close();assert.ok(new URL(owner.page.url()).pathname.endsWith('/index.html'));
        await go(owner.page,'item.html?id='+itemB);await owner.page.getByRole('link',{name:'Back to Explore',exact:true}).focus();await owner.page.keyboard.press('Enter');await owner.page.waitForURL(url=>url.pathname.endsWith('/browse.html'));
        await go(owner.page,'claim.html?id='+itemB);await clickDestination(owner.page,owner.page.locator('#back-to-item'),'item.html',{id:itemB});
        await go(owner.page,'profile.html');await clickDestination(owner.page,owner.page.locator('.profile-summary .navigation-action'),'settings.html');await clickDestination(owner.page,owner.page.locator('.profile-summary .navigation-action'),'profile.html');
        await go(owner.page,'my-reports.html');await clickDestination(owner.page,owner.page.getByRole('link',{name:'View read-only campus history',exact:true}),'history.html');
        await go(owner.page,'my-reports.html');await clickDestination(owner.page,owner.page.locator('[data-item-id="'+ownItem+'"] .own-report-actions a'),'report.html',{edit:ownItem});assert.equal(await owner.page.inputValue('#r-title'),run+' Own editable report');
        await go(owner.page,'item.html?id='+pairFound);await clickDestination(owner.page,owner.page.getByRole('link',{name:'Open linked report',exact:true}),'item.html',{id:pairLost});
        await go(p.page,'admin.html?tab=claims&claim='+pairClaim);await clickDestination(p.page,p.page.getByRole('link',{name:'Open linked report',exact:true}),'item.html',{id:pairLost});
      });
      await group('Outline Edit and danger Delete retain ownership/confirmation/cancel/commit behavior',async()=>{
        await go(owner.page,'my-reports.html');const card=owner.page.locator('[data-item-id="'+ownItem+'"]');assert.equal(await card.getByRole('link',{name:'Edit report',exact:true}).count(),1);const remove=card.getByRole('button',{name:'Delete',exact:true});assert.ok(await remove.evaluate(e=>e.classList.contains('btn-danger-outline')));await remove.click();await owner.page.locator('#confirm-dialog [data-close-dialog]').click();assert.equal((await a.call('api/items.php?id='+ownItem)).status,200);
        assert.equal((await b.call('api/items.php',{action:'delete',id:ownItem})).status,403);await remove.click();await owner.page.click('#confirm-delete');await owner.page.waitForFunction(id=>!document.querySelector('[data-item-id="'+id+'"]'),ownItem);assert.equal((await a.call('api/items.php?id='+ownItem)).status,404);
      });
      await group('Button-link touch/focus/readability and layout fit the five required viewports',async()=>{
        const routes=['index.html','profile.html','settings.html','my-reports.html','item.html?id='+pairFound,'claim.html?id='+itemB];
        for(const[width,height]of[[360,800],[390,844],[768,1024],[1280,800],[1440,900]]){
          await owner.page.setViewportSize({width,height});for(const route of routes){await go(owner.page,route);if(route==='index.html')await owner.page.waitForSelector('#home-discovery:not([hidden])');const checks=await owner.page.locator('a.navigation-action').evaluateAll(links=>links.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect(),style=getComputedStyle(e);return{height:r.height,width:r.width,left:r.left,right:r.right,decoration:style.textDecorationLine,href:e.href,clipped:e.scrollWidth>e.clientWidth+1};}));assert.ok(checks.length);checks.forEach(check=>{assert.ok(check.height>=44&&check.width>=44);assert.ok(check.left>=0&&check.right<=width);assert.equal(check.decoration,'none');assert.equal(check.clipped,false);assert.ok(check.href.startsWith(base));});assert.ok(await owner.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if((width===390||width===1440)&&route==='index.html'){await owner.page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await owner.page.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true});}}
          await go(owner.page,'profile.html');await owner.page.keyboard.press('Tab');await owner.page.locator('.profile-summary .navigation-action').focus();assert.equal(await owner.page.locator('.profile-summary .navigation-action').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
        }
      });
    }
    assert.deepEqual(browserErrors,[]);await p.context.close();await owner.context.close();await peerPage.context.close();
    const invariants=JSON.parse(execFileSync(php,[path.join(target,'tools','check-workflow.php')],{encoding:'utf8'}));assert.equal(invariants.passed,true);
    fs.writeFileSync(path.join(out,'ux-results.json'),JSON.stringify({scope:edition.toUpperCase()+' real isolated HTTP/browser selection, navigation, statuses, presentation/accessibility fixes',results,passed:results.length,complete:true,browserErrors,viewportChecks,contrastChecks,invariants,realDeviceKeyboard:'Manual check pending; reduced viewport simulated'},null,2)+'\n');
  }catch(e){fs.writeFileSync(path.join(out,'ux-results.json'),JSON.stringify({scope:edition.toUpperCase(),results,passed:results.length,complete:false,failure:String(e),browserErrors,viewportChecks,contrastChecks},null,2)+'\n');throw e;}
  finally{
    if(browser)await browser.close();const ids=actors.map(Number),marks=ids.map(()=>'?').join(','),items=q('SELECT item_id FROM items WHERE reporter_user_id IN ('+marks+')',ids).rows.map(r=>Number(r.item_id));let files=[];
    if(items.length){const m=items.map(()=>'?').join(',');files=q('SELECT file_path FROM item_photos WHERE item_id IN ('+m+') UNION ALL SELECT p.file_path FROM claim_photos p JOIN claims c ON c.claim_id=p.claim_id WHERE c.item_id IN ('+m+')',[...items,...items]).rows.map(r=>r.file_path);q('DELETE FROM notifications WHERE item_id IN ('+m+')',items);q('DELETE FROM items WHERE item_id IN ('+m+')',items);}
    q('DELETE FROM notifications WHERE user_id IN ('+marks+')',ids);for(const id of actors)q('DELETE FROM users WHERE user_id=?',[Number(id)]);for(const relative of files){assert.match(relative,/^(items|evidence|claims)\/[a-f0-9]{32}\.(jpg|png|webp)$/);const file=path.join(target,'storage',relative);if(fs.existsSync(file))fs.unlinkSync(file);}driver({action:'clear_throttle'});
  }
  console.log(edition.toUpperCase()+': '+results.length+' scenario groups PASS.');
})().catch(e=>{console.error(e);process.exitCode=1;});
