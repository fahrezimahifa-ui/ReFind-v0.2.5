const qa=require('./qa-runtime.cjs');qa.assertQa();
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=qa.playwright();const sharp=require(process.env.REFIND_SHARP_MODULE||'sharp');
const out=path.resolve(process.env.REFIND_EVIDENCE_DIR||'output/playwright/glass-titles/'+Date.now());fs.mkdirSync(out,{recursive:true});
const accounts=Object.values(JSON.parse(fs.readFileSync(path.join(qa.target,'storage/setup/demo-accounts.json'))).accounts);
const results={checks:[],screens:[],contrast:[],errors:[]};
const persist=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');
async function check(name,fn){await fn();results.checks.push(name);persist();console.log('PASS '+name);}
async function go(p,route){await p.goto(qa.base+route);await p.waitForSelector('body[data-ready="true"]');await p.waitForLoadState('networkidle');await p.evaluate(()=>{ReFindTheme.setMotion(false);return document.fonts.ready;});assert.ok(!(await p.title()).includes('\u2014'),'application tab title');}
async function material(p,selector,glass=true){const actual=await p.locator(selector).first().evaluate(e=>{const s=getComputedStyle(e);return{blur:s.backdropFilter,background:s.backgroundColor};});assert.equal(actual.blur.includes('blur'),glass,selector+' blur: '+actual.blur);return actual;}
(async()=>{const browser=await chromium.launch({executablePath:qa.chromePath(),headless:true});try{
 for(const theme of ['light','dark']){
  const c=await browser.newContext({colorScheme:theme,viewport:{width:1440,height:900}}),p=await c.newPage();p.on('pageerror',e=>results.errors.push(String(e)));
  await check(theme+' static, account and dynamic browser titles',async()=>{
   const a=accounts.find(a=>a.role==='STUDENT');await go(p,'login.html');await p.fill('#email',a.email);await p.fill('#password',a.password);await p.click('#login-submit');await p.waitForURL('**/index.html');await p.waitForSelector('body[data-ready="true"]');assert.equal(await p.title(),'ReFind · UMN Lost & Found');
   for(const route of ['browse.html','my-reports.html','notifications.html','history.html','settings.html','profile.html','report.html','item.html?id=1'])await go(p,route);
  });
  await check(theme+' card, empty state and editor materials across requested viewports',async()=>{
   for(const width of [360,390,768,1099,1100,1440,720]){
    await p.setViewportSize({width,height:width===720?450:900});
    for(const [route,selector]of [['browse.html','.discovery-card'],['my-reports.html?tab=claims','.activity-card']]){
     await go(p,route);await material(p,selector);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
     if([390,1440].includes(width)){const file=theme+'-'+route.split('.')[0]+'-'+width+'.png';await p.screenshot({path:path.join(out,file),fullPage:true});results.screens.push(file);}
    }
   }
   await p.setViewportSize({width:1440,height:900});await go(p,'browse.html?q=NoMatchingGlassRecord9381');await material(p,'.empty-state');
   await go(p,'profile.html');const image=await sharp({create:{width:700,height:900,channels:3,background:'#247a91'}}).png().toBuffer();await p.setInputFiles('#avatar-file',{name:'glass.png',mimeType:'image/png',buffer:image});await p.waitForSelector('.avatar-dialog[open]');await material(p,'.avatar-dialog');
   await require('./qa-contrast.cjs').sampleTextContrast(p,'.avatar-dialog h2,.avatar-dialog p,.avatar-controls label,.avatar-dialog .btn',theme+'-editor',sharp,results.contrast,path.join(out,'contrast-failure.png'));
   const file=theme+'-editor-1440.png';await p.screenshot({path:path.join(out,file)});results.screens.push(file);await p.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  await check(theme+' reduced-transparency and forced-colors opaque fallbacks',async()=>{
   await go(p,'browse.html');const session=await c.newCDPSession(p);await session.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-transparency',value:'reduce'}]});const m=await material(p,'.discovery-card',false);assert.ok(!m.background.startsWith('rgba'),'opaque background');
   await p.emulateMedia({forcedColors:'active'});await material(p,'.discovery-card',false);await c.close();
  });
  const bc=await browser.newContext({colorScheme:theme,viewport:{width:1440,height:900}}),bp=await bc.newPage();bp.on('pageerror',e=>results.errors.push(String(e)));const bm=accounts.find(a=>a.role==='BUILDING_MANAGEMENT');await go(bp,'login.html');await bp.fill('#email',bm.email);await bp.fill('#password',bm.password);await bp.click('#login-submit');await bp.waitForURL('**/admin.html');await bp.waitForSelector('body[data-ready="true"]');
  await check(theme+' BM tab titles and nested cards avoid repeated blur',async()=>{
   for(const tab of ['claims','reports','handover']){await go(bp,'admin.html?tab='+tab);await material(bp,'.bm-queue-card',false);const file=theme+'-bm-'+tab+'.png';await bp.screenshot({path:path.join(out,file)});results.screens.push(file);}
   await bc.close();
  });
 }
 assert.deepEqual(results.errors,[]);persist();
}finally{await browser.close();}})().catch(e=>{persist();console.error(e);process.exitCode=1;});
