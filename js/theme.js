(function () {
  'use strict';
  const root=document.documentElement,themeKey='refind-theme',motionKey='refind-motion';
  const system=matchMedia('(prefers-color-scheme: dark)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const transparency=matchMedia('(prefers-reduced-transparency: reduce)'),forced=matchMedia('(forced-colors: active)');
  function stored(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function validTheme(value){return value==='light'||value==='dark'?value:null;}
  let preference=validTheme(stored(themeKey)),motion=stored(motionKey)!=='off';
  function effective(){return preference||(system.matches?'dark':'light');}
  function devicePaused(){return reduced.matches||transparency.matches||forced.matches;}
  function motionEffective(){return motion&&!devicePaused()&&!document.hidden;}
  function motionDescription(){
    if(reduced.matches)return 'Paused to follow your device’s reduced-motion setting.';
    if(transparency.matches||forced.matches)return 'Paused to follow your device’s display settings.';
    if(!motion)return 'Background motion is paused.';
    if(document.hidden)return 'Paused while this tab is inactive.';
    return 'Slow background flow is on.';
  }
  function render(){
    const theme=effective();root.dataset.theme=theme;root.dataset.bsTheme=theme;root.style.colorScheme=theme;
    root.dataset.motion=motionEffective()?'running':'paused';
    document.querySelectorAll('[name="appearance-theme"]').forEach(input=>input.checked=input.value===(preference||'system'));
    const select=document.getElementById('theme-preference');if(select)select.value=preference||'system';
    document.querySelectorAll('[data-motion-choice]').forEach(input=>{input.checked=devicePaused()?false:motion;input.disabled=devicePaused();});
    document.querySelectorAll('[data-motion-status]').forEach(element=>element.textContent=motionDescription());
    const description=document.getElementById('appearance-current');
    if(description)description.textContent=(preference?'Using ':'Following your device: ')+theme+' mode.';
  }
  function announce(message){const status=document.getElementById('theme-status');if(status)status.textContent=message;}
  function setPreference(value){
    preference=validTheme(value);
    try{if(preference)localStorage.setItem(themeKey,preference);else localStorage.removeItem(themeKey);}catch(_){}
    render();announce((preference?'':'Following your device. ')+(effective()==='dark'?'Dark mode enabled.':'Light mode enabled.'));
  }
  function setMotion(value){motion=value===true;try{localStorage.setItem(motionKey,motion?'on':'off');}catch(_){}render();announce(motionDescription());}
  render();
  system.addEventListener('change',render);
  [reduced,transparency,forced].forEach(query=>query.addEventListener('change',render));
  document.addEventListener('visibilitychange',render);
  window.addEventListener('storage',event=>{
    if(event.key===themeKey||event.key===null)preference=event.key===null?null:validTheme(event.newValue);
    if(event.key===motionKey||event.key===null)motion=event.key===null?true:event.newValue!=='off';
    if(event.key===themeKey||event.key===motionKey||event.key===null)render();
  });
  function positionHeaderPopup(panel,toggle){
    const viewport=window.visualViewport,offsetX=viewport?.offsetLeft||0,offsetY=viewport?.offsetTop||0;
    const availableWidth=viewport?.width||innerWidth,availableHeight=viewport?.height||innerHeight;
    const box=toggle.getBoundingClientRect(),header=document.querySelector('.app-header')?.getBoundingClientRect();
    const width=panel.getBoundingClientRect().width;
    const top=Math.max(offsetY,box.bottom,header?.bottom||0)+12;
    panel.style.left=Math.max(offsetX+18,Math.min(offsetX+availableWidth-width-18,box.right-width))+'px';
    panel.style.top=top+'px';
    panel.style.maxHeight=Math.max(44,offsetY+availableHeight-top-16)+'px';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const toggle=document.getElementById('appearance-toggle'),panel=document.getElementById('appearance-panel');
    function position(){
      if(!panel?.open||!toggle)return;
      positionHeaderPopup(panel,toggle);
    }
    function close(focus=false){if(!panel?.open)return;panel.close();toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus({preventScroll:true});}
    function open(){
      if(!panel||!toggle)return;
      window.ReFindShell?.setNavigation(false);
      panel.show();toggle.setAttribute('aria-expanded','true');position();
      panel.querySelector('input[name="appearance-theme"]:checked')?.focus({preventScroll:true});
    }
    toggle?.addEventListener('click',()=>panel.open?close(true):open());
    toggle?.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();open();}});
    panel?.addEventListener('close',()=>toggle.setAttribute('aria-expanded','false'));
    panel?.querySelector('[data-close-appearance]')?.addEventListener('click',()=>close(true));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel?.open){event.preventDefault();event.stopPropagation();close(true);}},true);
    document.addEventListener('pointerdown',event=>{if(panel?.open&&!panel.contains(event.target)&&!toggle.contains(event.target))close();});
    document.addEventListener('focusin',event=>{if(panel?.open&&!panel.contains(event.target)&&!toggle.contains(event.target))close();});
    window.addEventListener('resize',position);window.addEventListener('scroll',position,{passive:true});window.visualViewport?.addEventListener('resize',position);
    document.querySelectorAll('[name="appearance-theme"]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)setPreference(input.value);}));
    document.getElementById('theme-preference')?.addEventListener('change',event=>setPreference(event.target.value));
    document.querySelectorAll('[data-motion-choice]').forEach(input=>input.addEventListener('change',()=>setMotion(input.checked)));
    render();
  });
  window.ReFindTheme=Object.freeze({positionHeaderPopup,getPreference:()=>preference||'system',effective,setPreference,getMotion:()=>motion,motionEffective,setMotion});
})();
