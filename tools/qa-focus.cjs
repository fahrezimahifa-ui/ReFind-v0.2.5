const assert=require('node:assert/strict');
const luminance=rgb=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

// Read-only guest pages. Measure rendered outline pixels against the actual glass backdrop.
async function auditHeaderFocus(browser,base,sharp){
  const checks=[];
  for(const theme of ['light','dark'])for(const width of [360,390,768,1280,1440]){
    const context=await browser.newContext({colorScheme:theme,viewport:{width,height:900}});
    try{
      const page=await context.newPage();
      await page.goto(base+'login.html');
      await page.waitForSelector('body[data-ready="true"]');await page.evaluate(async()=>{await document.fonts.ready;ReFindTheme.setMotion(false);});
      for(const color of ['#000','#fff']){
        await page.evaluate(color=>{
          let strip=document.getElementById('qa-focus-backdrop');
          if(!strip){strip=document.createElement('div');strip.id='qa-focus-backdrop';Object.assign(strip.style,{position:'fixed',inset:'0 0 auto',height:'90px',zIndex:'1029'});document.body.append(strip);}
          strip.style.background=color;
        },color);
        await page.keyboard.press('Tab');
        await page.locator('#appearance-toggle').focus();
        await page.waitForTimeout(200);
        const box=await page.locator('#appearance-toggle').boundingBox();
        const {data,info}=await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
        const pixel=y=>{const i=(Math.floor(y)*info.width+Math.floor(box.x+box.width/2))*info.channels;return [...data.subarray(i,i+3)];};
        const foreground=pixel(box.y+box.height+5),background=pixel(box.y+box.height+7),ratio=contrast(foreground,background);
        checks.push({theme,width,color,foreground,background,ratio});
        assert.ok(ratio>=3,theme+' '+width+' keyboard focus over '+color+': '+ratio.toFixed(2)+' < 3');
      }
    }finally{await context.close();}
  }
  return checks;
}
module.exports={auditHeaderFocus};
