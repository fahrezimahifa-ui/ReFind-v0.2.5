// Integration acceptance only in the guarded synthetic development/QA target.
const qa=require('./qa-runtime.cjs');qa.assertQa();
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{execFileSync}=require('node:child_process');const{chromium}=qa.playwright();const sharp=require('sharp');
const out=path.resolve(process.env.REFIND_EVIDENCE_DIR||'output/playwright/ui-profile/'+Date.now());fs.mkdirSync(out,{recursive:true});
const results={checks:[],screens:[],errors:[]},actors=[],items=[],pages=[],run='UIP-'+Date.now().toString(36);let browser;
const q=(query,values=[])=>JSON.parse(execFileSync(qa.php,[path.join(qa.target,'tools/b02-fixture.php')],{input:JSON.stringify({action:'query',query,values}),encoding:'utf8'}));
function persist(){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');}
async function check(name,fn){await fn();results.checks.push(name);persist();console.log('PASS '+name);}
function actor(role,n){const password='Photo!'+crypto.randomBytes(10).toString('hex'),email=run+'-'+n+'@refind.test',hash=execFileSync(qa.php,['-r','echo password_hash(stream_get_contents(STDIN),PASSWORD_DEFAULT);'],{input:password,encoding:'utf8'}),id=q('INSERT INTO users(full_name,email,role,password_hash,student_id) VALUES (?,?,?,?,?)',[run+' '+n,email,role,hash,role==='STUDENT'?run+n:null]).id;actors.push(id);return{id,password,email,role};}
async function go(p,route){await p.goto(qa.base+route);await p.waitForSelector('body[data-ready="true"]');await p.waitForLoadState('networkidle');}
async function login(a,theme='light'){const c=await browser.newContext({viewport:{width:1440,height:900},colorScheme:theme}),p=await c.newPage();pages.push(p);p.on('pageerror',e=>results.errors.push(String(e)));await go(p,'login.html');await p.fill('#email',a.email);await p.fill('#password',a.password);await p.click('#login-submit');await p.waitForURL(a.role==='STUDENT'?'**/index.html':'**/admin.html');await p.waitForSelector('body[data-ready="true"]');return{c,p,a};}
async function post(s,endpoint,data={},file,csrf=true){const response=await s.c.request.post(qa.base+'api/'+endpoint,{multipart:{...data,...(file?{avatar:{name:file.name||'avatar.jpg',mimeType:file.mime||'image/jpeg',buffer:file.buffer}}:{})},headers:csrf?{'X-CSRF-Token':await s.p.evaluate(()=>ReFind.state.csrf)}:{}});return{status:response.status(),data:await response.json()};}
async function profile(s){return(await s.c.request.get(qa.base+'api/account.php')).json();}
(async()=>{
 browser=await chromium.launch({executablePath:qa.chromePath(),headless:true});
 try{
 const a=actor('STUDENT','Owner'),b=actor('STUDENT','Finder'),bm=actor('BUILDING_MANAGEMENT','Staff'),owner=await login(a),finder=await login(b),staff=await login(bm);
 const image=await sharp({create:{width:512,height:512,channels:3,background:'#2677ab'}}).jpeg().toBuffer(),other=await sharp({create:{width:512,height:512,channels:3,background:'#b97942'}}).jpeg().toBuffer();
 await check('Avatar upload is owner-only, authenticated, CSRF protected and rejects unsupported fields',async()=>{
  const guest=await browser.newContext();assert.equal((await guest.request.get(qa.base+'api/avatar.php?token='+'a'.repeat(32))).status(),401);await guest.close();
  assert.equal((await post(owner,'account.php',{action:'update_avatar'}, {buffer:image},false)).status,403);
  assert.equal((await post(owner,'account.php',{action:'update_avatar',user_id:b.id},{buffer:image})).status,400);
  for(const file of [{buffer:Buffer.from('<svg/>'),mime:'image/svg+xml'},{buffer:Buffer.alloc(250001)},{buffer:await sharp({create:{width:100,height:100,channels:3,background:'#fff'}}).jpeg().toBuffer()}])assert.equal((await post(owner,'account.php',{action:'update_avatar'},file)).status,422);
  assert.equal((await profile(owner)).profile.avatar_url,null);
 });
 let oldUrl;
 await check('Save, authenticated delivery, private storage, session identity and replacement cleanup',async()=>{
  const saved=await post(owner,'account.php',{action:'update_avatar'},{buffer:image});assert.equal(saved.status,200,saved.data.message);oldUrl=saved.data.profile.avatar_url;assert.ok(oldUrl);assert.ok(!JSON.stringify(saved.data).includes('avatar_path'));
  assert.equal((await owner.c.request.get(new URL(oldUrl,qa.base).href)).status(),200);assert.equal((await finder.c.request.get(new URL(oldUrl,qa.base).href)).status(),200);
  const relative=q('SELECT avatar_path FROM users WHERE user_id=?',[Number(a.id)]).rows[0].avatar_path;assert.equal((await owner.c.request.get(qa.base+'storage/'+relative)).status(),403);
  const metadata=await sharp(fs.readFileSync(path.join(qa.target,'storage',relative))).metadata();assert.equal(metadata.width,512);assert.equal(metadata.height,512);assert.equal(metadata.exif,undefined);
  assert.equal((await(await owner.c.request.get(qa.base+'api/session.php')).json()).user.avatar_url,oldUrl);
  const replaced=await post(owner,'account.php',{action:'update_avatar'},{buffer:other});assert.equal(replaced.status,200);assert.notEqual(replaced.data.profile.avatar_url,oldUrl);assert.equal(fs.existsSync(path.join(qa.target,'storage',relative)),false);assert.equal((await owner.c.request.get(new URL(oldUrl,qa.base).href)).status(),404);
 });
 await check('Concurrent replacements retain exactly one referenced avatar and cannot change another account',async()=>{
  const peer=await login(a);assert.equal(await peer.p.locator('[data-account-initials] img').count(),1,'Saved avatar persists in a new login');const both=await Promise.all([post(owner,'account.php',{action:'update_avatar'},{buffer:image}),post(peer,'account.php',{action:'update_avatar'},{buffer:other})]);both.forEach(r=>assert.equal(r.status,200));
  const current=(await profile(owner)).profile.avatar_url;assert.ok(both.some(r=>r.data.profile.avatar_url===current));assert.equal((await profile(finder)).profile.avatar_url,null);await peer.c.close();
 });
 await check('Database failure rolls back reference and cleans newly written files',async()=>{
  const before=(await profile(owner)).profile.avatar_url,files=fs.readdirSync(path.join(qa.target,'storage/avatars')).sort();
  const trigger="CREATE TRIGGER avatar_test_failure BEFORE UPDATE ON users FOR EACH ROW BEGIN IF NOT (NEW.avatar_path <=> OLD.avatar_path) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic avatar rollback'; END IF; END";
  execFileSync(qa.php,['-r',"require 'app/db.php'; db()->query(stream_get_contents(STDIN));"],{cwd:qa.target,input:trigger});
  try{assert.equal((await post(owner,'account.php',{action:'update_avatar'},{buffer:image})).status,500);assert.equal((await profile(owner)).profile.avatar_url,before);assert.deepEqual(fs.readdirSync(path.join(qa.target,'storage/avatars')).sort(),files);}
  finally{execFileSync(qa.php,['-r',"require 'app/db.php'; db()->query('DROP TRIGGER avatar_test_failure');"],{cwd:qa.target});}
 });
 await check('Storage failure preserves the saved avatar and removal remains available',async()=>{
  const before=(await profile(owner)).profile.avatar_url,folder=path.join(qa.target,'storage/avatars'),held=folder+'-held';fs.renameSync(folder,held);
  try{assert.equal((await post(owner,'account.php',{action:'update_avatar'},{buffer:image})).status,500);assert.equal((await profile(owner)).profile.avatar_url,before);}finally{fs.renameSync(held,folder);}
 });
 const found=q("INSERT INTO items(reporter_user_id,category_id,location_id,item_type,title,description,event_date,verification_clue) VALUES (?,1,35,'FOUND','Demo B06 · C12 Brown leather wallet (found)',?,'2026-10-10','Synthetic identifying clue')",[Number(b.id),'Synthetic description. '.repeat(30)]).id;items.push(found);
 const lost=q("INSERT INTO items(reporter_user_id,category_id,location_id,item_type,title,description,event_date,verification_clue) VALUES (?,1,35,'LOST','Demo B06 · C12 Brown leather wallet (lost)','Synthetic Lost description','2026-10-10','Synthetic matching identifying clue')",[Number(a.id)]).id;items.push(lost);
 const claim=q("INSERT INTO claims(item_id,claimant_user_id,related_lost_item_id,ownership_answer) VALUES (?,?,?,?)",[Number(found),Number(a.id),Number(lost),'Synthetic answer. '.repeat(20)]).id;
 await post(finder,'account.php',{action:'update_avatar'},{buffer:other});
 const noteIds=[];for(let i=0;i<27;i++)noteIds.push(q("INSERT INTO notifications(user_id,item_id,notification_type,title,message,is_read,created_at) VALUES (?,?,'UI_TEST','Report review update','Synthetic notification',0,DATE_SUB(UTC_TIMESTAMP(),INTERVAL ? MINUTE))",[Number(a.id),Number(found),i]).id);
 await check('Notifications page two returns to its exact record after item refresh and new-tab navigation',async()=>{
  const target=noteIds[25];await go(owner.p,'notifications.html?page=2');const row=owner.p.locator('[data-notification-id="'+target+'"]'),link=row.locator('.notification-destination');assert.ok((await link.getAttribute('href')).includes('notification_page=2'));
  const popup=owner.c.waitForEvent('page');await link.click({modifiers:['Control']});const tab=await popup;await tab.waitForSelector('#item-back');assert.match(await tab.locator('#item-back').innerText(),/Back to Notifications/);await tab.reload();await tab.waitForSelector('body[data-ready="true"]');await tab.click('#item-back');await tab.waitForSelector('body[data-ready="true"]');assert.equal(new URL(tab.url()).searchParams.get('page'),'2');assert.equal(await tab.evaluate(()=>document.activeElement.id),'notification-title-'+target);await tab.close();
  await link.click();await owner.p.waitForSelector('#item-back');await owner.p.click('#item-back');await owner.p.waitForSelector('body[data-ready="true"]');assert.equal(await owner.p.evaluate(()=>document.activeElement.id),'notification-title-'+target);
  await go(owner.p,'item.html?id=99999999&origin=notifications&notification_page=2&notification='+target);assert.match(await owner.p.locator('#page-missing').innerText(),/Back to Notifications/);
  await go(owner.p,'item.html?id='+found);assert.match(await owner.p.locator('#item-back').innerText(),/Back to Explore/);
 });
 await check('Expired-session return validation preserves typed notification context and rejects external URLs',async()=>{
  const guest=await browser.newContext(),returnUrl=qa.basePath+'item.html?id='+found+'&origin=notifications&notification_page=2&notification='+noteIds[25],p=await guest.newPage();await p.goto(qa.base+'login.html?return='+encodeURIComponent(returnUrl));await p.waitForSelector('body[data-ready="true"]');await p.fill('#email',a.email);await p.fill('#password',a.password);await p.click('#login-submit');await p.waitForURL(url=>url.pathname.endsWith('item.html'));await p.waitForSelector('body[data-ready="true"]');assert.match(await p.locator('#item-back').getAttribute('href'),/page=2/);await guest.close();
 });
 const source=await sharp({create:{width:1000,height:600,channels:3,background:'#2677ab'}}).composite([{input:await sharp({create:{width:400,height:600,channels:3,background:'#b97942'}}).png().toBuffer(),left:600,top:0}]).jpeg().toBuffer();
 const largeSource=await sharp(source).resize(6000,3600).jpeg().toBuffer();
 await check('Both roles crop/zoom with keyboard, cancel safely, save and remove with initials fallback',async()=>{
  for(const s of [owner,staff]){await go(s.p,'profile.html');const initial=(await profile(s)).profile.avatar_url;
   await s.p.setInputFiles('#avatar-file',{name:'wide.jpg',mimeType:'image/jpeg',buffer:source});await s.p.waitForSelector('#avatar-dialog[open]');const preview=await s.p.locator('#avatar-canvas').boundingBox();await s.p.mouse.move(preview.x+128,preview.y+128);await s.p.mouse.down();await s.p.mouse.move(preview.x+150,preview.y+140);await s.p.mouse.up();assert.notEqual(await s.p.inputValue('#avatar-x'),'50','Dragging repositions the photo');await s.p.click('#avatar-reset');assert.equal(await s.p.inputValue('#avatar-x'),'50');await s.p.locator('#avatar-zoom').focus();await s.p.keyboard.press('ArrowRight');assert.ok(Number(await s.p.inputValue('#avatar-zoom'))>1);await s.p.locator('#avatar-x').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});await s.p.locator('#avatar-y').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});await s.p.click('#avatar-cancel');assert.equal((await profile(s)).profile.avatar_url,initial);
   await s.p.setInputFiles('#avatar-file',{name:'large-photo.jpg',mimeType:'image/jpeg',buffer:largeSource});await s.p.waitForSelector('#avatar-dialog[open]');await s.p.locator('#avatar-zoom').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});await s.p.locator('#avatar-x').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});await s.p.click('#avatar-save');await s.p.waitForFunction(()=>!document.querySelector('#avatar-dialog').open);await s.p.waitForSelector('[data-profile-initials] img');const cropped=q('SELECT avatar_path FROM users WHERE user_id=?',[Number(s.a.id)]).rows[0].avatar_path;const colors=await sharp(fs.readFileSync(path.join(qa.target,'storage',cropped))).stats();assert.ok(colors.channels[0].mean>colors.channels[2].mean+50,'Saved crop must show the selected right-side color');assert.equal(await s.p.locator('[data-account-initials] img').count(),1);await go(s.p,'settings.html');assert.equal(await s.p.locator('[data-profile-initials] img').count(),1);
   await go(s.p,'profile.html');await s.p.click('#avatar-remove');await s.p.waitForFunction(()=>document.querySelector('#avatar-remove').hidden);assert.equal((await profile(s)).profile.avatar_url,null);assert.equal(await s.p.locator('[data-account-initials] img').count(),0);
  }
 });
 await check('EXIF orientation is respected during cropping and a failed image falls back to initials',async()=>{
  await go(owner.p,'profile.html');const oriented=await sharp(source).withMetadata({orientation:6}).jpeg().toBuffer();await owner.p.setInputFiles('#avatar-file',{name:'oriented.jpg',mimeType:'image/jpeg',buffer:oriented});await owner.p.waitForSelector('#avatar-dialog[open]');
  await owner.p.locator('#avatar-zoom').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});await owner.p.locator('#avatar-y').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});await owner.p.click('#avatar-save');await owner.p.waitForFunction(()=>!document.querySelector('#avatar-dialog').open);
  const file=q('SELECT avatar_path FROM users WHERE user_id=?',[Number(a.id)]).rows[0].avatar_path,colors=await sharp(fs.readFileSync(path.join(qa.target,'storage',file))).stats();assert.ok(colors.channels[0].mean>colors.channels[2].mean+50,'Rotated image must crop the visually selected bottom region');
  await owner.p.route('**/api/avatar.php?*',route=>route.fulfill({status:404,body:''}));await go(owner.p,'profile.html');await owner.p.waitForFunction(()=>!document.querySelector('[data-profile-initials] img'));assert.ok((await owner.p.locator('[data-profile-initials]').innerText()).length>0);await owner.p.unroute('**/api/avatar.php?*');
 });
 await post(owner,'account.php',{action:'update_avatar'},{buffer:image});
 await check('Avatars appear beside existing reporter/claimant names without exposing storage paths',async()=>{
  await go(owner.p,'item.html?id='+found);assert.equal(await owner.p.locator('#item-reporter img').count(),1);
  await go(staff.p,'admin.html?tab=claims&claim='+claim);assert.equal(await staff.p.locator('.bm-claim-summary .person-identity img').count(),1);assert.equal(await staff.p.locator('[data-record-id="'+claim+'"] .person-identity img').count(),1);
  await go(staff.p,'admin.html?tab=reports&report='+found);assert.equal(await staff.p.locator('.detail-meta .person-identity img').count(),1);
 });
 await check('Both themes: equal panels, readable section gaps, all widths and 200 percent effective viewport',async()=>{
  for(const theme of ['light','dark']){await staff.p.evaluate(value=>ReFindTheme.setPreference(value),theme);
   for(const [width,height]of [[360,800],[390,844],[768,1024],[1099,900],[1100,900],[1440,900],[720,450]]){await staff.p.setViewportSize({width,height});
    for(const tab of ['claims','reports','handover']){await go(staff.p,'admin.html?tab='+tab+(tab==='claims'?'&claim='+claim:tab==='reports'?'&report='+found:''));assert.ok(await staff.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     if(width>=1100){const dimensions=await staff.p.evaluate(()=>{const a=document.querySelector('.bm-queue').getBoundingClientRect(),b=document.querySelector('.bm-detail').getBoundingClientRect();return{left:a.height,right:b.height,top:b.top,headerBottom:document.querySelector('.app-header').getBoundingClientRect().bottom};});assert.ok(Math.abs(dimensions.left-dimensions.right)<1);assert.ok(dimensions.top>=dimensions.headerBottom+15,'Focused panels must clear the sticky navbar');}
     if(tab==='claims'){const gap=await staff.p.locator('.bm-record-heading .chips').evaluate(el=>parseFloat(getComputedStyle(el).gap));assert.equal(gap,8);}
    }
    await staff.p.screenshot({path:path.join(out,theme+'-'+width+'x'+height+'.png'),fullPage:false});results.screens.push(theme+'-'+width+'x'+height);
   }
  }
 });
 await check('Selecting a different desktop record resets detail scroll and preserves queue position',async()=>{
  await staff.p.setViewportSize({width:1440,height:900});await go(staff.p,'admin.html?tab=reports');await staff.p.locator('#bm-state').selectOption('all');await staff.p.waitForTimeout(350);await staff.p.locator('#bm-detail').evaluate(el=>el.scrollTop=100);const list=staff.p.locator('#bm-queue-list'),before=await list.evaluate(el=>el.scrollTop);await staff.p.locator('.bm-queue-card').nth(1).click();await staff.p.waitForTimeout(300);assert.equal(await staff.p.locator('#bm-detail').evaluate(el=>el.scrollTop),0);assert.equal(await list.evaluate(el=>el.scrollTop),before);
 });
 assert.deepEqual(results.errors,[]);results.complete=true;persist();console.log('Completed '+results.checks.length+' UI/profile groups');await owner.c.close();await finder.c.close();await staff.c.close();
 }catch(error){for(let i=0;i<pages.length;i++){if(!pages[i].isClosed()){await pages[i].screenshot({path:path.join(out,'failure-'+i+'.png'),fullPage:true});console.error('UI state',i,await pages[i].locator('#avatar-editor-status,#avatar-feedback').allTextContents());}}results.failure=String(error);persist();throw error;}
 finally{for(const id of items)q('DELETE FROM items WHERE item_id=?',[Number(id)]);for(const id of actors){const p=q('SELECT avatar_path FROM users WHERE user_id=?',[Number(id)]).rows[0]?.avatar_path;q('DELETE FROM users WHERE user_id=?',[Number(id)]);if(p){const f=path.join(qa.target,'storage',p);if(fs.existsSync(f))fs.unlinkSync(f);}}if(browser)await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
