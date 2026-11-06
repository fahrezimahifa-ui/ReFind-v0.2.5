// Offline browser checks with intercepted synthetic responses. No server, listener or database.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {chromium} = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const root = path.resolve(__dirname,'..');
const base = 'http://refind-offline.test/ReFind_0.2.0_Test/';
const out = process.env.REFIND_EVIDENCE_DIR || path.join(root,'output/playwright/registration-ui',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(out,{recursive:true});
assert.ok(!fs.existsSync(path.join(out,'results.json')),'Refuse to overwrite offline UI evidence');
const checks = [], errors = [];
let browser;
function save(status) { fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status,scope:'Mocked offline UI only; no PHP, DB, HTTP server or application integration',checks,errors},null,2)+'\n'); }
async function check(name, fn) { await fn(); checks.push(name); save('RUNNING'); console.log('PASS '+name); }
function html(name) {
  return fs.readFileSync(path.join(root,'app/pages',name),'utf8').replace('{{APP_NAVBAR}}',fs.readFileSync(path.join(root,'app/pages/partials/navbar.html'),'utf8')).replaceAll('{{BASE_PATH}}',new URL(base).pathname);
}
async function surface(theme='light',width=390) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
  await context.addInitScript(value=>localStorage.setItem('refind-theme',value),theme);
  const state={mode:'success',authenticated:false,enabled:true,posts:0,sessions:0,csrfSeen:false};
  const user={id:'1000',name:'Synthetic Student',role:'STUDENT',avatar_url:null};
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==new URL(base).origin || !url.pathname.startsWith(new URL(base).pathname)) { await route.abort(); return; }
    const relative=url.pathname.slice(new URL(base).pathname.length);
    const json=(data,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(data)});
    if(relative==='api/session.php') {
      state.sessions++;
      if(state.mode==='bootstrap-error') { await route.fulfill({status:503,contentType:'text/plain',body:'Unavailable'}); return; }
      await json({ok:true,authenticated:state.authenticated,user:state.authenticated?user:null,csrf:String(state.sessions).padStart(64,'a'),registration_enabled:state.enabled}); return;
    }
    if(relative==='api/notifications.php') { await json({ok:true,unread_count:0}); return; }
    if(relative==='api/register.php') {
      state.posts++; state.csrfSeen=Boolean(request.headers()['x-csrf-token']);
      if(state.mode==='pending') await new Promise(resolve=>{state.release=resolve;});
      if(state.mode==='network') { await route.abort('failed'); return; }
      if(state.mode==='bad-json' || state.mode==='recover') {
        state.authenticated=state.mode==='recover'; await route.fulfill({status:201,contentType:'text/plain',body:'invalid-json'}); return;
      }
      if(state.mode==='fields') { await json({ok:false,code:'validation_error',message:'Check your email.',fields:{email:'Enter a valid email.'}},422); return; }
      if(state.mode==='csrf') { await json({ok:false,code:'csrf_invalid',message:'Your session changed. Reload and try again.'},403); return; }
      if(state.mode==='rate') { await json({ok:false,code:'registration_rate_limited',message:'Too many account creation attempts.'},429,{'Retry-After':'2'}); return; }
      if(state.mode==='disabled') { await json({ok:false,code:'registration_disabled',message:'Account creation is currently unavailable.'},403); return; }
      state.authenticated=true; await json({ok:true,authenticated:true,user,csrf:'b'.repeat(64),redirect:new URL(base).pathname+'index.html'},201); return;
    }
    if(relative==='register.html' || relative==='login.html') { await route.fulfill({contentType:'text/html',body:html(relative)}); return; }
    if(relative==='index.html') { await route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><title>Synthetic landing</title><body>Mock authenticated landing</body></html>'}); return; }
    if(!/^(?:js|css|assets|vendor)\//.test(relative)) { await route.abort(); return; }
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { await route.abort(); return; }
    const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
    await route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const page=await context.newPage(); page.on('pageerror',()=>errors.push('Page script error'));
  return {context,page,state};
}
async function ready(view) { await view.page.goto(base+'register.html'); await view.page.waitForSelector('body[data-ready="true"]'); }
async function fill(page) {
  await page.fill('#full-name','Synthetic Student'); await page.fill('#email','synthetic@example.test');
  await page.fill('#password','Synthetic-only-1234'); await page.fill('#confirm-password','Synthetic-only-1234');
}
async function feedback(page) { await page.locator('#register-feedback:not([hidden])').waitFor(); }

(async()=>{
  try {
    const localChrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser=await chromium.launch({headless:true,...(process.env.REFIND_CHROME?{executablePath:process.env.REFIND_CHROME}:process.platform==='win32'&&fs.existsSync(localChrome)?{executablePath:localChrome}:{})});
    for(const theme of ['light','dark'])for(const width of [320,390,768,1280,1440])await check(theme+' '+width+'px normal login/signup layout, accessibility and pristine capture',async()=>{
      const v=await surface(theme,width);
      try {
        await v.page.goto(base+'login.html');await v.page.waitForSelector('body[data-ready="true"]');await v.page.evaluate(()=>document.fonts.ready);
        const primary=v.page.locator('#login-submit'),create=v.page.getByRole('link',{name:'Create account',exact:true});
        assert.equal(await create.isVisible(),true);assert.equal(await create.getAttribute('id'),'registration-link');
        assert.equal(await v.page.locator('#signup-unlock').count(),0);
        const a=await primary.boundingBox(),b=await create.boundingBox();
        assert.ok(Math.abs(a.width-b.width)<1&&Math.abs(a.x-b.x)<1&&b.y>=a.y+a.height&&b.y-a.y-a.height<=16,'CTA must be full width directly below login');
        await primary.focus();await v.page.keyboard.press('Tab');assert.equal(await create.evaluate(e=>e===document.activeElement),true);
        const loginAudit=await new AxeBuilder({page:v.page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
        assert.equal(loginAudit.violations.length,0,'Login accessibility violations: '+loginAudit.violations.map(x=>x.id).join(', '));
        await v.page.evaluate(()=>scrollTo(0,0));await v.page.screenshot({path:path.join(out,theme+'-login-'+width+'.png'),fullPage:true});
        await create.click();await v.page.waitForSelector('body[data-ready="true"]');await v.page.evaluate(()=>document.fonts.ready);
        assert.equal(await v.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        assert.equal(await v.page.locator('#register-submit').isEnabled(),true);
        assert.equal(await v.page.getByLabel('Full name',{exact:true}).count(),1);
        assert.equal(await v.page.getByLabel('Show password',{exact:true}).count(),1);
        const audit=await new AxeBuilder({page:v.page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
        assert.equal(audit.violations.length,0,'Accessibility violations: '+audit.violations.map(x=>x.id).join(', '));
        await v.page.screenshot({path:path.join(out,theme+'-'+width+'.png'),fullPage:true});
      }finally{await v.context.close();}
    });
    await check('Keyboard order, visibility toggles and client validation',async()=>{
      const v=await surface();
      try {
        await ready(v); await v.page.focus('#full-name'); await v.page.keyboard.press('Tab'); assert.equal(await v.page.locator('#email').evaluate(e=>e===document.activeElement),true);
        await v.page.keyboard.press('Tab'); assert.equal(await v.page.locator('#password').evaluate(e=>e===document.activeElement),true);
        await v.page.keyboard.press('Tab'); await v.page.keyboard.press('Space'); assert.equal(await v.page.locator('#password').getAttribute('type'),'text');
        assert.equal(await v.page.getByLabel('Hide password',{exact:true}).getAttribute('aria-pressed'),'true');
        await v.page.keyboard.press('Space'); assert.equal(await v.page.locator('#password').getAttribute('type'),'password');
        await v.page.click('#register-submit'); assert.equal(await v.page.locator('#full-name').getAttribute('aria-invalid'),'true');
        assert.equal(await v.page.locator('#full-name').evaluate(e=>e===document.activeElement),true); assert.equal(v.state.posts,0);
        await fill(v.page); await v.page.fill('#confirm-password','mismatch'); await v.page.click('#register-submit');
        assert.equal(await v.page.locator('#confirm-password').getAttribute('aria-invalid'),'true'); assert.equal(v.state.posts,0);
      }finally{await v.context.close();}
    });
    await check('Loading state blocks duplicate submissions and success navigates once',async()=>{
      const v=await surface();
      try {
        await ready(v); await fill(v.page); v.state.mode='pending';
        await v.page.evaluate(()=>{const f=document.getElementById('register-form');f.requestSubmit();f.requestSubmit();});
        await v.page.waitForFunction(()=>document.getElementById('register-submit').disabled);
        assert.equal(await v.page.locator('#register-form').getAttribute('aria-busy'),'true');
        assert.equal(await v.page.locator('#password').evaluate(e=>e.readOnly),true);
        const deadline=Date.now()+10000;
        while(!v.state.release){assert.ok(Date.now()<deadline,'Registration request did not reach mock transport');await new Promise(resolve=>setTimeout(resolve,10));}
        v.state.release(); await v.page.waitForURL(base+'index.html'); assert.equal(v.state.posts,1); assert.equal(v.state.csrfSeen,true);
      }finally{if(v.state.release)v.state.release();await v.context.close();}
    });
    for(const mode of ['network','bad-json','fields','csrf','rate','disabled'])await check(mode+' feedback clears secrets and never replays POST',async()=>{
      const v=await surface();
      try {
        await ready(v); await fill(v.page); v.state.mode=mode; await v.page.click('#register-submit'); await feedback(v.page);
        await v.page.waitForFunction(()=>document.getElementById('register-form').getAttribute('aria-busy')==='false');
        assert.equal(await v.page.locator('#password').inputValue(),''); assert.equal(await v.page.locator('#confirm-password').inputValue(),''); assert.equal(v.state.posts,1);
        if(mode==='fields') {assert.equal(await v.page.locator('#email').getAttribute('aria-invalid'),'true');assert.equal(await v.page.locator('#email').evaluate(e=>e===document.activeElement),true);}
        if(mode==='csrf')assert.equal(v.state.sessions,2);
        if(mode==='rate'||mode==='disabled')assert.equal(await v.page.locator('#register-submit').isDisabled(),true);
      }finally{await v.context.close();}
    });
    await check('Uncertain success recovers authenticated session without a second POST',async()=>{
      const v=await surface();
      try {await ready(v);await fill(v.page);v.state.mode='recover';await v.page.click('#register-submit');await v.page.waitForURL(base+'index.html');assert.equal(v.state.posts,1);assert.equal(v.state.sessions,2);}
      finally{await v.context.close();}
    });
    await check('Disabled feature is not advertised on login',async()=>{
      const v=await surface();
      try {v.state.enabled=false;await v.page.goto(base+'login.html');await v.page.waitForSelector('body[data-ready="true"]');assert.equal(await v.page.locator('#registration-link').isVisible(),false);}
      finally{await v.context.close();}
    });
    await check('Bootstrap failure keeps submission unavailable',async()=>{
      const v=await surface();
      try {v.state.mode='bootstrap-error';await v.page.goto(base+'register.html');await feedback(v.page);assert.equal(await v.page.locator('#register-submit').isDisabled(),true);assert.equal(v.state.posts,0);}
      finally{await v.context.close();}
    });
    assert.deepEqual(errors,[]);save('PASS');
  }finally{if(browser)await browser.close();}
})().catch(()=>{save('FAIL');console.error('Offline registration UI check failed. Inspect the synthetic receipt; no form contents recorded.');process.exitCode=1;});
