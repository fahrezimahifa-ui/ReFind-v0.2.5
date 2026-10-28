// Read-only browser review of the owned QA installation. No business POSTs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.REFIND_PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'opencode','refind-multipage-check','node_modules','playwright-core'));
const sharp=require(process.env.REFIND_SHARP_MODULE||'sharp');
const AxeBuilder=require(process.env.REFIND_AXE_MODULE||'@axe-core/playwright').default;
const {auditHeaderFocus}=require('./qa-focus.cjs');
const root=path.resolve(__dirname,'..'),main=process.argv.includes('--main'),target=main?root:path.resolve(root,'../ReFind_0.2.0_Test'),base=main?'http://localhost/ReFind_0.2.3/':'http://localhost/ReFind_0.2.0_Test/';
if(!main)assert.equal(JSON.parse(fs.readFileSync(path.join(target,'.refind-b02-test.json'))).source,root);
const out=path.resolve(process.env.REFIND_EVIDENCE_DIR||path.join(root,'output/playwright/layout-glass/theme'));
fs.mkdirSync(out,{recursive:true});
const accounts=JSON.parse(fs.readFileSync(path.join(target,'storage/setup/demo-accounts.json'))).accounts;
const results={checks:[],screens:[],contrast:[],focusContrast:[],a11y:[],performance:[],errors:[],failedRequests:[]};
function save(){fs.writeFileSync(path.join(out,'theme-results.json'),JSON.stringify(results,null,2)+'\n');}
function fingerprint(){return execFileSync('C:/xampp/php/php.exe',['-r',"require 'app/db.php'; $all=[]; foreach(['users','items','claims','handovers','notifications','item_photos','claim_photos','item_matches','item_status_history'] as $table) $all[$table]=rows('SELECT * FROM '.$table); echo hash('sha256',json_encode($all));"],{cwd:target,encoding:'utf8'}).trim();}
async function check(name,fn){await fn();results.checks.push(name);save();console.log('PASS '+name);}
async function go(page,route){await page.goto(base+route);await page.waitForSelector('body[data-ready="true"]');await page.waitForLoadState('networkidle');}
async function login(page,role){await go(page,'login.html');const a=Object.values(accounts).find(a=>a.role===role);await page.fill('#email',a.email);await page.fill('#password',a.password);await page.click('#login-submit');await page.waitForURL(role==='STUDENT'?'**/index.html':'**/admin.html');await page.waitForSelector('body[data-ready="true"]');}
function observe(page){page.on('pageerror',e=>results.errors.push(String(e)));page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')results.failedRequests.push({url:r.url(),error:r.failure()?.errorText});});}
async function capture(page,name){
  if(!name.includes('bottom'))await page.evaluate(()=>scrollTo(0,0));
  await page.evaluate(async()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
  const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>i.getClientRects().length&&!i.naturalWidth).length,theme:document.documentElement.dataset.theme,logo:document.querySelector('.brand picture:not([style]) img')?.naturalWidth}));
  assert.ok(metrics.scrollWidth<=metrics.width,name+' overflow');assert.equal(metrics.broken,0,name+' broken image');
  const toggle=await page.locator('#theme-toggle').boundingBox();assert.ok(toggle.width>=44&&toggle.height>=44&&toggle.x>=0&&toggle.x+toggle.width<=metrics.width,name+' toggle target');
  if(await page.getAttribute('body','data-page')!=='login'){
    const frame=await page.locator('main,.app-nav,.footer,.shell-feedback-wrap').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return{left:r.left,width:r.width,gutter:parseFloat(getComputedStyle(e).paddingLeft)};}));
    frame.forEach(f=>{assert.ok(Math.abs(f.width-Math.min(metrics.width,1160))<1,name+' frame');assert.equal(f.gutter,metrics.width<768?18:24,name+' gutter');assert.ok(Math.abs(f.left-frame[0].left)<1,name+' aligned edges');});
  }
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:!name.includes('bottom')});results.screens.push({name,...metrics});
  if(name.endsWith('-390')||name.endsWith('-1440')){const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.a11y.push({name,violations:audit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:audit.incomplete.length});}
  save();
}
const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
async function contrast(page,name){
  // Hide glyphs only, then sample the actual composited pixels behind each label.
  const elements=await page.locator('h1,h2,.eyebrow,.intro>p,.hint,.card-meta,.page-heading p,.field label,.btn,.nav-link,.account-link,.item-chip,.private-card .hint,.bm-block.private p,.notification-title,.notification-message,.notification-item,.notification-time,.notification-demo,.notification-unread,.notification-destination,.mark-read').evaluateAll(nodes=>nodes.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&!e.disabled;}).slice(0,45).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{text:e.textContent.trim().slice(0,50),color:s.color.match(/[\d.]+/g).slice(0,3).map(Number),large:parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&parseInt(s.fontWeight)>=700),x:r.x,y:r.y,w:r.width,h:r.height};}));
  // Inline <style> injection is blocked by the app CSP; use reversible CSSOM edits.
  await page.evaluate(()=>{window.qaColors=[...document.querySelectorAll('*')].map(e=>({e,color:e.style.getPropertyValue('color'),priority:e.style.getPropertyPriority('color')}));window.qaColors.forEach(({e})=>e.style.setProperty('color','transparent','important'));});
  let buffer;
  try{await page.waitForTimeout(200);buffer=await page.screenshot();}finally{await page.evaluate(()=>{window.qaColors.forEach(({e,color,priority})=>color?e.style.setProperty('color',color,priority):e.style.removeProperty('color'));delete window.qaColors;});}
  const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
  for(const e of elements){let minimum=Infinity;const backgrounds=[];for(const portion of [.15,.5,.85]){const x=Math.max(0,Math.min(info.width-1,Math.floor(e.x+e.w*portion))),y=Math.floor(e.y+e.h/2),i=(y*info.width+x)*info.channels,background=[...data.subarray(i,i+3)];backgrounds.push(background);minimum=Math.min(minimum,ratio(e.color,background));}const min=e.large?3:4.5;results.contrast.push({name,text:e.text,foreground:e.color,backgrounds,ratio:minimum,min});if(minimum<min)fs.writeFileSync(path.join(out,'contrast-failure.png'),buffer);assert.ok(minimum>=min,`${name}: ${e.text} contrast ${minimum.toFixed(2)} < ${min}`);}
}
(async()=>{
 const before=fingerprint();
 const browser=await chromium.launch({executablePath:process.env.REFIND_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  await check('System, manual override, reload, cross-tab, reset and device changes',async()=>{
   const c=await browser.newContext({colorScheme:'dark',viewport:{width:390,height:844}}),p=await c.newPage();observe(p);
   await p.addInitScript(()=>requestAnimationFrame(()=>window.firstFrameTheme=document.documentElement.dataset.theme));
   await go(p,'login.html');assert.equal(await p.evaluate(()=>window.firstFrameTheme),'dark');
   await p.click('#theme-toggle');assert.equal(await p.evaluate(()=>localStorage.getItem('refind-theme')),'light');await p.reload();assert.equal(await p.getAttribute('html','data-theme'),'light');
   const peer=await c.newPage();await go(peer,'login.html');await p.click('#theme-toggle');await peer.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
   await p.evaluate(()=>ReFindTheme.setPreference('system'));await peer.waitForFunction(()=>ReFindTheme.getPreference()==='system');await p.emulateMedia({colorScheme:'light'});await p.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await p.getAttribute('html','data-theme'),'light');
   await p.evaluate(()=>ReFindTheme.setPreference('dark'));await p.emulateMedia({colorScheme:'light'});assert.equal(await p.getAttribute('html','data-theme'),'dark');await c.close();
  });
  await check('Unavailable storage and invalid saved values still render and toggle',async()=>{
   for(const blocked of [false,true]){const c=await browser.newContext({colorScheme:'dark'}),p=await c.newPage();observe(p);await p.addInitScript(blocked=>{if(blocked){for(const method of ['getItem','setItem','removeItem'])Storage.prototype[method]=()=>{throw new DOMException('Blocked','SecurityError');};}else localStorage.setItem('refind-theme','invalid');},blocked);await go(p,'login.html');assert.equal(await p.getAttribute('html','data-theme'),'dark');await p.click('#theme-toggle');assert.equal(await p.getAttribute('html','data-theme'),'light');await c.close();}
  });
  await check('Header focus meets 3:1 over black and white backdrops at five widths',async()=>{results.focusContrast=await auditHeaderFocus(browser,base,sharp);});
  for(const theme of ['light','dark']){
   for(const [width,height] of [[360,800],[390,844],[768,1024],[1280,800],[1440,900]]){
    const c=await browser.newContext({colorScheme:theme,viewport:{width,height},timezoneId:'Asia/Jakarta'}),p=await c.newPage();observe(p);
    await go(p,'login.html');await capture(p,`${theme}-login-${width}`);await contrast(p,`${theme}-login-${width}`);
    await login(p,'STUDENT');
    const routes=[['home','index.html'],['explore','browse.html'],['lost-form','report.html?type=lost'],['found-form','report.html?type=found'],['activity','my-reports.html'],['claims','my-reports.html?tab=claims'],['history','history.html'],['notifications','notifications.html'],['profile','profile.html'],['settings','settings.html']];
    for(const [label,route] of routes){await go(p,route);await capture(p,`${theme}-${label}-${width}`);await contrast(p,`${theme}-${label}-${width}`);}
    const found=await p.evaluate(async()=>{const data=await ReFind.request('items.php?type=FOUND&active=1&limit=48');return data.items.find(i=>i.can_claim)?.item_id;});
    if(found)for(const [label,route]of [['item','item.html?id='+found],['claim-form','claim.html?id='+found]]){await go(p,route);await capture(p,`${theme}-${label}-${width}`);await contrast(p,`${theme}-${label}-${width}`);}
    if(width===390){await p.click('#nav-toggle');await p.click('#account-toggle');await capture(p,`${theme}-mobile-navigation`);await contrast(p,`${theme}-mobile-navigation`);await p.setViewportSize({width,height:430});await p.waitForFunction(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--usable-height'))<=430);await p.locator('#logout').scrollIntoViewIfNeeded();const header=await p.locator('.app-header').boundingBox(),logout=await p.locator('#logout').boundingBox();assert.ok(header.height<=430&&logout.y>=0&&logout.y+logout.height<=430);await p.screenshot({path:path.join(out,theme+'-short-navigation.png')});await p.setViewportSize({width,height});}
    if(width===1440){
     await check(theme+' glass text over extreme backgrounds and keyboard control states',async()=>{
      await go(p,'index.html');await p.evaluate(()=>{const strip=document.createElement('div');strip.id='contrast-strip';Object.assign(strip.style,{position:'fixed',inset:'0 0 auto',height:'80px',background:'linear-gradient(90deg,#000,#fff)',zIndex:'1029'});document.body.append(strip);});await contrast(p,theme+' header over black/white');await p.evaluate(()=>document.getElementById('contrast-strip').remove());
      const button=p.locator('#theme-toggle');await button.hover();await button.focus();assert.equal(await button.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');await p.keyboard.press('Space');assert.equal(await p.getAttribute('html','data-theme'),theme==='light'?'dark':'light');await p.evaluate(()=>ReFindTheme.setPreference('system'));
      for(const blur of [true,false]){await p.reload();await p.waitForSelector('body[data-ready="true"]');if(!blur)await p.evaluate(()=>document.querySelector('.app-header').style.backdropFilter='none');const frame=await p.evaluate(async()=>{const times=[];let previous=performance.now();for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-previous);previous=now;scrollTo(0,(i%15)*100);}return{frames:times.length,maxMs:Math.max(...times),meanMs:times.reduce((a,b)=>a+b,0)/times.length};});results.performance.push({theme,blur,...frame});}
     });
     await check(theme+' settings switch preserves passwords and System reset',async()=>{await go(p,'settings.html');await p.fill('#current-password','Unsaved example');await p.selectOption('#theme-preference',theme==='light'?'dark':'light');assert.equal(await p.inputValue('#current-password'),'Unsaved example');assert.equal(await p.getAttribute('html','data-theme'),theme==='light'?'dark':'light');await p.selectOption('#theme-preference','system');assert.equal(await p.getAttribute('html','data-theme'),theme);});
     await check(theme+' unsaved report, prepared photo, validation and focus survive switching',async()=>{await go(p,'report.html?type=lost');await p.fill('#r-title','Unsaved report draft');await p.locator('#public-photo-section summary').click();await p.setInputFiles('#r-photos',path.join(root,'tools/demo-photos/headphones-overview.jpg'));await p.waitForSelector('.upload-preview');await p.locator('#r-title').focus();await p.evaluate(()=>ReFindTheme.setPreference(ReFindTheme.effective()==='dark'?'light':'dark'));assert.equal(await p.inputValue('#r-title'),'Unsaved report draft');assert.equal(await p.locator('.upload-preview').count(),1);assert.equal(await p.evaluate(()=>document.activeElement.id),'r-title');await p.evaluate(()=>ReFindTheme.setPreference('system'));});
     await check(theme+' continuous wash at scroll depth, opaque fallback and high contrast',async()=>{
      await go(p,'report.html?type=found');await p.locator('#public-photo-section summary').click();const pixel=async()=>{const {data,info}=await sharp(await p.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});const i=(450*info.width+2)*info.channels;return [...data.subarray(i,i+3)];};await p.evaluate(()=>scrollTo(0,0));const topPixel=await pixel();await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));const bottomPixel=await pixel();assert.deepEqual(bottomPixel,topPixel);await p.screenshot({path:path.join(out,theme+'-gradient-bottom-viewport.png')});results.checks.push(theme+' gradient pixels unchanged at scroll depth: '+bottomPixel.join(','));await capture(p,`${theme}-long-form-bottom`);assert.equal(await p.evaluate(()=>getComputedStyle(document.body,'::before').position),'fixed');
      const client=await c.newCDPSession(p);await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-transparency',value:'reduce'}]});assert.equal(await p.locator('.app-header').evaluate(e=>getComputedStyle(e).backdropFilter),'none');assert.ok(!(await p.locator('.app-header').evaluate(e=>getComputedStyle(e).backgroundColor)).startsWith('rgba'));await capture(p,`${theme}-reduced-transparency`);
      await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'forced-colors',value:'active'}]});assert.equal(await p.locator('#theme-toggle').isVisible(),true);await capture(p,`${theme}-forced-colors`);await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});
      await p.evaluate(()=>{for(const sheet of document.styleSheets)if(sheet.href?.endsWith('/theme.css'))for(let i=sheet.cssRules.length-1;i>=0;i--)if(sheet.cssRules[i] instanceof CSSSupportsRule)sheet.deleteRule(i);});assert.equal(await p.locator('.app-header').evaluate(e=>getComputedStyle(e).backdropFilter),'none');await capture(p,`${theme}-without-backdrop-filter`);
     });
    }
    await c.close();
    const staff=await browser.newContext({colorScheme:theme,viewport:{width,height}}),bm=await staff.newPage();observe(bm);await login(bm,'BUILDING_MANAGEMENT');
    for(const tab of ['claims','reports','handover']){await go(bm,'admin.html?tab='+tab);const card=bm.locator('.bm-queue-card').first();if(await card.count()){await card.click();await bm.waitForSelector('#bm-detail-content [data-detail-'+({claims:'claim',reports:'report',handover:'handover'}[tab])+'-id]');}await capture(bm,`${theme}-bm-${tab}-${width}`);await contrast(bm,`${theme}-bm-${tab}-${width}`);
     if(tab==='claims'&&await bm.locator('[data-bm-action="approved"]').count()){
      await bm.click('[data-bm-action="approved"]');await bm.waitForSelector('#operation-dialog[open]');await bm.fill('#operation-note','Unsaved decision note');await bm.evaluate(()=>ReFindTheme.setPreference(ReFindTheme.effective()==='dark'?'light':'dark'));assert.equal(await bm.inputValue('#operation-note'),'Unsaved decision note');assert.equal(await bm.locator('#operation-confirm').isChecked(),false);assert.equal(await bm.locator('#operation-submit').isDisabled(),true);await bm.evaluate(()=>ReFindTheme.setPreference('system'));await capture(bm,`${theme}-decision-dialog-${width}`);await bm.setViewportSize({width,height:430});await bm.waitForFunction(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--usable-height'))<=430);const box=await bm.locator('#operation-dialog').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=430);await bm.keyboard.press('Escape');await bm.setViewportSize({width,height});
      if(await bm.locator('.bm-report-photo').count()){await bm.click('.bm-report-photo');await bm.waitForSelector('#bm-evidence-dialog[open]');await capture(bm,`${theme}-image-dialog-${width}`);await bm.keyboard.press('Escape');assert.equal(await bm.locator('.bm-report-photo').evaluate(e=>e===document.activeElement),true);}
     }
    }
    await staff.close();results.checks.push(`${theme}: ${width}px all representative routes`);save();
   }
  }
  results.businessDataUnchanged=before===fingerprint();assert.equal(results.businessDataUnchanged,true);assert.deepEqual(results.errors,[]);assert.deepEqual(results.failedRequests,[]);assert.deepEqual(results.a11y.filter(a=>a.violations.length),[],'Accessibility audit violations');results.complete=true;save();console.log('Theme review complete: '+results.screens.length+' screenshots, '+results.contrast.length+' rendered contrast samples.');
 }catch(e){results.complete=false;results.failure=String(e);save();throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
