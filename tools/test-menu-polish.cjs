const qa=require('./qa-runtime.cjs');qa.assertQa();
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{execFileSync}=require('node:child_process');const{chromium}=qa.playwright();const sharp=require(process.env.REFIND_SHARP_MODULE||'sharp');
const out=path.resolve(process.env.REFIND_EVIDENCE_DIR||'output/playwright/menu-polish/'+Date.now());fs.mkdirSync(out,{recursive:true});
const accounts=Object.values(JSON.parse(fs.readFileSync(path.join(qa.target,'storage/setup/demo-accounts.json'))).accounts);
const results={checks:[],screens:[],contrast:[],errors:[]},items=[];let browser;
const q=(query,values=[])=>JSON.parse(execFileSync(qa.php,[path.join(qa.target,'tools/b02-fixture.php')],{input:JSON.stringify({action:'query',query,values}),encoding:'utf8'}));
const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');
async function check(name,fn){await fn();results.checks.push(name);save();console.log('PASS '+name);}
async function go(p,route){await p.goto(qa.base+route);await p.waitForSelector('body[data-ready="true"]');await p.waitForLoadState('networkidle');await p.evaluate(()=>{ReFindTheme.setMotion(false);return document.fonts.ready;});assert.equal(await p.locator('footer.footer').count(),0);}
async function login(a,theme='light',width=1440,height=900){const c=await browser.newContext({colorScheme:theme,viewport:{width,height}}),p=await c.newPage();p.on('pageerror',e=>results.errors.push(String(e)));await go(p,'login.html');await p.fill('#email',a.email);await p.fill('#password',a.password);await p.click('#login-submit');await p.waitForURL(a.role==='STUDENT'?'**/index.html':'**/admin.html');await p.waitForSelector('body[data-ready="true"]');return{c,p,a};}
async function open(p){if(await p.locator('#nav-toggle').isVisible()&&await p.getAttribute('#nav-toggle','aria-expanded')!=='true')await p.click('#nav-toggle');await p.click('#account-toggle');await p.waitForSelector('#account-menu:not([hidden])');}
async function capture(p,name){const file=name+'.png';await p.screenshot({path:path.join(out,file)});results.screens.push(file);save();}
async function popupBounds(p,selector='#account-menu'){
 await p.locator(selector).evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
 const m=await p.locator(selector).boundingBox(),h=await p.locator('.app-header').boundingBox();assert.ok(Math.abs(m.y-(h.y+h.height)-12)<=1,selector+' header clearance');assert.ok(m.x>=17&&m.x+m.width<=p.viewportSize().width-17,selector+' horizontal bounds');assert.ok(m.y+m.height<=p.viewportSize().height-15,selector+' vertical bounds');
}
async function contrast(p,name,selector='#account-menu strong,#account-menu span,#account-menu .account-link'){
 await require('./qa-contrast.cjs').sampleTextContrast(p,selector,name,sharp,results.contrast,path.join(out,'contrast-failure.png'));
}
async function style(p,selector){return p.locator(selector).first().evaluate(e=>{const s=getComputedStyle(e),probe=document.createElement('span');probe.style.color='var(--danger)';document.body.append(probe);const danger=getComputedStyle(probe).color;probe.remove();return{color:s.color,border:s.borderTopColor,background:s.backgroundColor,outline:s.outlineStyle,danger};});}
(async()=>{browser=await chromium.launch({executablePath:qa.chromePath(),headless:true});try{
 for(const theme of ['light','dark']){
  await check(theme+' login alignment, typography, wrapping and footer/version placement',async()=>{
   const c=await browser.newContext({colorScheme:theme}),p=await c.newPage();p.on('pageerror',e=>results.errors.push(String(e)));
   for(const width of [360,390,768,1099,1100,1440,720]){
    await p.setViewportSize({width,height:width===720?450:900});await go(p,'login.html');
    const data=await p.evaluate(()=>{const intro=document.querySelector('.intro'),h=intro.querySelector('h1'),eye=intro.querySelector('.eyebrow'),paragraph=intro.querySelector('p'),journey=intro.querySelector('.journey'),card=document.querySelector('.auth-card'),brand=document.querySelector('#nav-brand');const rect=e=>e.getBoundingClientRect();return{font:parseFloat(getComputedStyle(h).fontSize),pfont:parseFloat(getComputedStyle(paragraph).fontSize),br:h.querySelectorAll('br').length,title:h.textContent,eyeGap:rect(h).top-rect(eye).bottom,bodyGap:rect(paragraph).top-rect(h).bottom,journeyGap:rect(journey).top-rect(paragraph).bottom,aligned:rect(intro).left-rect(brand).left,stacked:rect(card).top>=rect(intro).bottom,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.equal(data.font,width>=1100?40:32);assert.equal(data.pfont,16);assert.equal(data.br,0);assert.equal(data.title,"Let's get you back to it.");for(const[k,v]of[['eyeGap',12],['bodyGap',18],['journeyGap',24]])assert.ok(Math.abs(data[k]-v)<1,k);assert.equal(data.overflow,false);if(width>=1100)assert.ok(Math.abs(data.aligned)<1);else assert.ok(data.stacked);
    if([390,1440].includes(width))await capture(p,theme+'-login-'+width);
   }
   await p.fill('#email','bad-email');await p.click('#login-submit');assert.ok(await p.locator('#email-error').isVisible());await c.close();
  });
  for(const role of ['STUDENT','BUILDING_MANAGEMENT']){
   const s=await login(accounts.find(a=>a.role===role),theme),p=s.p;
   await check(theme+' '+role+' menu placement, frosting, long names and viewport boundaries',async()=>{
    for(const width of [360,390,768,1099,1100,1440,720]){
     await p.setViewportSize({width,height:width===720?450:900});await go(p,'profile.html');await open(p);
     const m=await p.locator('#account-menu').evaluate(e=>({inHeader:!!e.closest('.app-header'),blur:getComputedStyle(e).backdropFilter,background:getComputedStyle(e).backgroundColor}));
     assert.equal(m.inHeader,width<1100);if(width>=1100){assert.equal(m.blur,'blur(16px)');await popupBounds(p);}else{assert.ok((await p.locator('#account-menu').boundingBox()).x>=0);}
     assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     if([390,1440].includes(width)){await p.locator('#account-menu [data-shell-user-name]').evaluate(e=>e.textContent='A very long campus account name with several words and anIdentifierThatMustWrapSafely');await capture(p,theme+'-'+role+'-menu-'+width);await contrast(p,theme+'-'+role+'-'+width);}
     await p.keyboard.press('Escape');
    }
   });
   await check(theme+' '+role+' keyboard order, dismissal, scroll and responsive reparenting',async()=>{
    await p.setViewportSize({width:1440,height:900});await go(p,'profile.html');await p.focus('#account-toggle');await p.keyboard.press('ArrowDown');assert.equal(await p.locator('[data-account-nav="profile"]').evaluate(e=>e===document.activeElement),true);
    await p.keyboard.press('Shift+Tab');assert.equal(await p.locator('#account-toggle').evaluate(e=>e===document.activeElement),true);await p.keyboard.press('Tab');await p.keyboard.press('Tab');assert.equal(await p.locator('[data-account-nav="settings"]').evaluate(e=>e===document.activeElement),true);await p.keyboard.press('Tab');assert.equal(await p.locator('#logout').evaluate(e=>e===document.activeElement),true);await p.keyboard.press('Tab');assert.equal(await p.locator('#appearance-toggle').evaluate(e=>e===document.activeElement),true);assert.equal(await p.locator('#account-menu').isVisible(),false);
    await p.focus('#account-toggle');await p.keyboard.press('ArrowDown');await p.keyboard.press('Escape');assert.equal(await p.locator('#account-toggle').evaluate(e=>e===document.activeElement),true);
    await open(p);await p.click('h1');assert.equal(await p.locator('#account-menu').isVisible(),false);
    await open(p);await p.evaluate(()=>scrollTo(0,180));await p.waitForTimeout(50);await popupBounds(p);await p.locator('#account-toggle').press('ArrowDown');await p.setViewportSize({width:1099,height:900});await p.waitForFunction(()=>document.querySelector('#account-menu').hidden&&document.querySelector('.app-header').contains(document.querySelector('#account-menu')));assert.equal(await p.locator('#account-menu').isVisible(),false);assert.equal(await p.locator('#nav-toggle').evaluate(e=>e===document.activeElement),true);assert.equal(await p.locator('#account-menu').evaluate(e=>!!e.closest('.app-header')),true);
    await p.setViewportSize({width:1440,height:900});await go(p,'settings.html');assert.equal(await p.locator('.app-version').innerText(),'Version 0.2.5');await p.fill('#current-password','UNSAVED synthetic draft');await open(p);await p.click('#appearance-toggle');await p.waitForSelector('#appearance-panel[open]');assert.equal(await p.locator('#account-menu').isVisible(),false);await popupBounds(p,'#appearance-panel');await p.keyboard.press('Escape');assert.equal(await p.inputValue('#current-password'),'UNSAVED synthetic draft');
   });
   if(role==='STUDENT')await check(theme+' frosting over extreme backdrops and opaque accessibility fallbacks',async()=>{
    await go(p,'profile.html');await open(p);
    for(const color of ['#000','#fff','repeating-linear-gradient(45deg,#000 0 4px,#fff 4px 8px)']){await p.evaluate(color=>{let e=document.getElementById('menu-test-backdrop');if(!e){e=document.createElement('div');e.id='menu-test-backdrop';Object.assign(e.style,{position:'fixed',inset:'0',zIndex:1035,pointerEvents:'none'});document.body.append(e);}e.style.background=color;},color);await contrast(p,theme+'-backdrop-'+color.slice(0,8));}
    await p.evaluate(()=>document.getElementById('menu-test-backdrop').remove());
    const client=await s.c.newCDPSession(p);await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-transparency',value:'reduce'}]});assert.equal(await p.locator('#account-menu').evaluate(e=>getComputedStyle(e).backdropFilter),'none');assert.ok(!(await p.locator('#account-menu').evaluate(e=>getComputedStyle(e).backgroundColor)).startsWith('rgba'));
    await p.emulateMedia({forcedColors:'active'});assert.equal(await p.locator('#account-menu').evaluate(e=>getComputedStyle(e).backdropFilter),'none');
   });
   await s.c.close();
  }
  await check(theme+' red/warm Delete states, cancel/commit and ownership protection',async()=>{
   const owner=await login(accounts.find(a=>a.role==='STUDENT'),theme),other=await login(accounts.filter(a=>a.role==='STUDENT')[1],theme);
   const id=q("INSERT INTO items(reporter_user_id,category_id,location_id,item_type,title,description,event_date,verification_clue) VALUES (?,1,35,'FOUND',?,'Synthetic UI test',CURRENT_DATE(),'Synthetic private clue')",[Number(owner.a.user_id),'Menu polish '+Date.now()]).id;items.push(Number(id));q("INSERT INTO item_status_history(item_id,status_id,changed_by_user_id,note) VALUES (?,1,?,'Synthetic UI fixture')",[Number(id),Number(owner.a.user_id)]);
   const p=owner.p;await go(p,'item.html?id='+id);const remove=p.locator('#delete-report');let first=await style(p,'#delete-report');assert.equal(first.color,first.danger);assert.equal(first.border,first.danger);await contrast(p,theme+'-delete-default','#delete-report');
   await remove.hover();await p.waitForTimeout(150);const hovered=await style(p,'#delete-report');assert.equal(hovered.color,first.danger);assert.notEqual(hovered.background,first.background);await contrast(p,theme+'-delete-hover','#delete-report');
   const box=await remove.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();assert.equal((await style(p,'#delete-report')).color,first.danger);await p.mouse.move(20,200);await p.mouse.up();await remove.evaluate(e=>e.disabled=true);assert.equal((await style(p,'#delete-report')).color,first.danger);await remove.evaluate(e=>e.disabled=false);
   await p.keyboard.press('Tab');await remove.focus();assert.equal((await style(p,'#delete-report')).outline,'solid');await remove.click();await p.locator('#confirm-dialog [data-close-dialog]').click();assert.equal((await owner.c.request.get(qa.base+'api/items.php?id='+id)).status(),200);
   const csrf=await other.p.evaluate(()=>ReFind.state.csrf);assert.equal((await other.c.request.post(qa.base+'api/items.php',{multipart:{action:'delete',id:String(id)},headers:{'X-CSRF-Token':csrf}})).status(),403);
   await go(p,'my-reports.html');const selector='[data-item-id="'+id+'"] .record-delete';first=await style(p,selector);assert.equal(first.color,first.danger);assert.equal(first.border,first.danger);await capture(p,theme+'-delete-activity');await p.locator(selector).click();await p.click('#confirm-delete');await p.waitForFunction(id=>!document.querySelector('[data-item-id="'+id+'"]'),id);assert.equal((await owner.c.request.get(qa.base+'api/items.php?id='+id)).status(),404);
   await owner.c.close();await other.c.close();
  });
 }
 assert.deepEqual(results.errors,[]);save();console.log('Completed '+results.checks.length+' menu/layout polish groups');
}finally{for(const id of items)q('DELETE FROM items WHERE item_id=?',[id]);await browser.close();}})().catch(e=>{save();console.error(e);process.exitCode=1;});
