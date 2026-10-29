// Sample composited backgrounds under text ranges, excluding adjacent icons and inputs.
const assert=require('node:assert/strict'),fs=require('node:fs');
const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
async function sampleTextContrast(page,selector,name,sharp,results,failurePath){
 await page.waitForTimeout(180);
 const texts=await page.locator(selector).evaluateAll(nodes=>nodes.filter(e=>!e.disabled).slice(0,60).flatMap(e=>{
  const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),out=[];let node;
  while(node=walker.nextNode()){
   if(!node.textContent.trim())continue;
   const range=document.createRange();range.selectNodeContents(node);const style=getComputedStyle(node.parentElement);
   if(style.visibility==='hidden')continue;
   const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0&&r.y>=0&&r.bottom<=innerHeight&&r.x>=0&&r.right<=innerWidth).map(r=>({x:r.x,y:r.y,w:r.width,h:r.height}));
   const points=rects.flatMap(r=>[.15,.5,.85].map(f=>({x:r.x+r.w*f,y:r.y+r.h/2}))).filter(point=>{const hit=document.elementFromPoint(point.x,point.y);return hit===node.parentElement||node.parentElement.contains(hit);});
   if(points.length)out.push({text:node.textContent.trim().slice(0,55),foreground:style.color.match(/[\d.]+/g).slice(0,3).map(Number),min:parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&parseInt(style.fontWeight)>=700)?3:4.5,points});
  }return out;
 }));
 // Text fill has no UI color transition and leaves currentColor borders/icons intact.
 await page.evaluate(()=>{window.qaFills=[...document.querySelectorAll('*')].map(e=>({e,value:e.style.getPropertyValue('-webkit-text-fill-color'),priority:e.style.getPropertyPriority('-webkit-text-fill-color')}));window.qaFills.forEach(({e})=>e.style.setProperty('-webkit-text-fill-color','transparent','important'));});
 let buffer;try{buffer=await page.screenshot();}finally{await page.evaluate(()=>{window.qaFills.forEach(({e,value,priority})=>value?e.style.setProperty('-webkit-text-fill-color',value,priority):e.style.removeProperty('-webkit-text-fill-color'));delete window.qaFills;});}
 const{data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
 for(const text of texts){let minimum=Infinity;const backgrounds=[];for(const point of text.points){const x=Math.min(info.width-1,Math.max(0,Math.floor(point.x))),y=Math.min(info.height-1,Math.floor(point.y)),i=(y*info.width+x)*info.channels,bg=[...data.subarray(i,i+3)];backgrounds.push(bg);minimum=Math.min(minimum,ratio(text.foreground,bg));}results.push({name,text:text.text,foreground:text.foreground,backgrounds,ratio:minimum,min:text.min});if(minimum<text.min)fs.writeFileSync(failurePath,buffer);assert.ok(minimum>=text.min,name+': '+text.text+' contrast '+minimum.toFixed(2)+' < '+text.min);}
}
module.exports={sampleTextContrast};
