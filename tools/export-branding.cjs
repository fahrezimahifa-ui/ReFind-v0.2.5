const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.REFIND_PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'opencode','refind-multipage-check','node_modules','playwright-core'));
const assets=path.resolve(__dirname,'../assets');
const exportsToRender=[
 ['refind-logo-horizontal.svg','refind-logo-horizontal.png',688,216],
 ['refind-logo-horizontal-dark.svg','refind-logo-horizontal-dark.png',688,216],
 ['refind-logo-mark.svg','refind-logo-mark.png',256,256],
 ['refind-logo-mark.svg','refind-favicon-16.png',16,16],
 ['refind-logo-mark.svg','refind-favicon-32.png',32,32],
 ['refind-logo-mark.svg','refind-favicon-48.png',48,48],
 ['refind-shortcut.svg','refind-shortcut-180.png',180,180],
 ['refind-shortcut.svg','refind-shortcut-512.png',512,512]
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.REFIND_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
 try{
  const page=await browser.newPage();
  for(const [source,destination,width,height] of exportsToRender){
   const image='data:image/svg+xml;base64,'+fs.readFileSync(path.join(assets,source)).toString('base64');
   await page.setViewportSize({width,height});
   await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${width}px;height:${height}px;object-fit:contain}</style><img src="${image}">`);
   await page.locator('img').evaluate(element=>element.decode());
   await page.screenshot({path:path.join(assets,destination),omitBackground:true});
  }
  console.log('Exported '+exportsToRender.length+' PNG files from the SVG branding masters.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
