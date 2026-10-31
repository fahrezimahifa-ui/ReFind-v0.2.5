// Shared top navigation; permission always remains enforced by PHP.
window.ReFindShell = (() => {
  const app = window.ReFind;
  const mobile = window.matchMedia('(max-width: 1099px)');
  function updateViewport() {
    const viewport=window.visualViewport,height=viewport?.height||innerHeight,root=document.documentElement;
    root.style.setProperty('--usable-height',Math.floor(height)+'px');
    root.style.setProperty('--viewport-top',Math.floor(viewport?.offsetTop||0)+'px');
    root.classList.toggle('keyboard-open',height<innerHeight*.75&&document.activeElement?.matches('input,textarea,select'));
  }
  window.visualViewport?.addEventListener('resize',updateViewport);
  window.visualViewport?.addEventListener('scroll',updateViewport);
  window.addEventListener('resize',updateViewport);
  document.addEventListener('focusin',updateViewport);
  document.addEventListener('focusout',()=>requestAnimationFrame(updateViewport));
  updateViewport();
  const accountMenu=document.getElementById('account-menu'),accountToggle=document.getElementById('account-toggle');
  const accountSlot=document.createComment('Inline account menu position');
  accountMenu?.before(accountSlot);
  function placeAccount(){
    if(!accountMenu)return;
    const floating=!mobile.matches;
    if(floating&&accountMenu.parentElement!==document.body)document.body.append(accountMenu);
    else if(!floating&&accountMenu.previousSibling!==accountSlot)accountSlot.after(accountMenu);
    accountMenu.classList.toggle('account-menu--floating',floating);
    if(!floating){accountMenu.style.removeProperty('left');accountMenu.style.removeProperty('top');accountMenu.style.removeProperty('max-height');}
  }
  function positionAccount(){
    if(accountMenu&&!accountMenu.hidden&&!mobile.matches)window.ReFindTheme.positionHeaderPopup(accountMenu,accountToggle);
  }
  let popupFrame=0;
  function positionPopups(){
    if(popupFrame)return;
    popupFrame=requestAnimationFrame(()=>{
      popupFrame=0;positionAccount();
      const appearance=document.getElementById('appearance-panel'),toggle=document.getElementById('appearance-toggle');
      if(appearance?.open&&toggle)window.ReFindTheme.positionHeaderPopup(appearance,toggle);
    });
  }
  window.addEventListener('resize',positionPopups);
  window.addEventListener('scroll',positionPopups,{passive:true});
  window.visualViewport?.addEventListener('resize',positionPopups);
  window.visualViewport?.addEventListener('scroll',positionPopups);
  function setAccount(open, focus = false) {
    placeAccount();
    if(open&&document.getElementById('appearance-panel')?.open)document.getElementById('appearance-panel').close();
    $('#account-menu').prop('hidden', !open);
    $('#account-toggle').attr('aria-expanded', String(open));
    if(open)positionAccount();
    if (focus) accountToggle?.focus({preventScroll:true});
  }
  function setNavigation(open, focus = false) {
    $('#nav-content').prop('hidden', mobile.matches && !open);
    const unread = Number($('#menu-unread').text()) || 0;
    $('#nav-toggle').attr({'aria-expanded': String(mobile.matches && open), 'aria-label': (open ? 'Close navigation' : 'Open navigation') + (unread ? ', ' + unread + ' unread notifications' : '')});
    if (!open) setAccount(false);
    if (focus) $('#nav-toggle').trigger('focus');
  }
  const headerObserver=new ResizeObserver(entries=>{const height=entries[0].borderBoxSize?.[0]?.blockSize;if(height){document.documentElement.style.setProperty('--app-header-height',height+'px');positionPopups();}});
  const appHeader=document.querySelector('.app-header');if(appHeader)headerObserver.observe(appHeader);
  function initials(name) { return name.trim().split(/\s+/u).slice(0,2).map(part => Array.from(part)[0] || '').join('').toUpperCase(); }
  function renderAvatar(element,name,url){
    const box=$(element).empty().addClass('user-avatar').attr('aria-hidden','true').append($('<span>').text(name?initials(name):''));
    if(url)box.append($('<img>').attr({src:url,alt:'',width:70,height:70,decoding:'async'}).on('error',function(){$(this).remove();}));
  }
  function identity(name,url){return $('<span>').addClass('person-identity').append($('<span>').each(function(){renderAvatar(this,name,url);}),$('<span>').text(name));}
  function updateUser(user) {
    app.state.user = user;
    if(!user)setAccount(false);
    const bm = user?.role === 'BUILDING_MANAGEMENT';
    const home = app.base + (bm ? 'admin.html?tab=claims' : 'index.html');
    $('#nav-brand,#nav-home').attr('href', home);
    $('#nav-home').text(bm ? 'Review Queue' : 'Home');
    $('#nav-login').prop('hidden', !!user);
    $('#account-disclosure').prop('hidden', !user);
    $('#account-toggle').prop('disabled', !user);
    $('[data-auth-nav]').prop('hidden',!user);
    $('[data-student-nav]').prop('hidden',!user||bm);
    $('[data-shell-user-name]').text(user?.name || '');
    $('[data-shell-role]').text(bm ? 'Building Management' : 'Student');
    $('[data-account-initials]').each(function(){renderAvatar(this,user?.name||'',user?.avatar_url);});
    const page = document.body.dataset.page;
    $('#nav-home').attr('aria-current', page === 'home' || page === 'bm' ? 'page' : null);
    $('[data-main-nav]').each(function(){const current=$(this).attr('data-main-nav');$(this).attr('aria-current',current===page||(page==='item'||page==='claim')&&current===(page==='item'&&new URLSearchParams(location.search).get('origin')==='notifications'?'notifications':'browse')?'page':null);});
    $('[data-account-nav]').each(function () {
      const active = $(this).attr('data-account-nav') === page;
      $(this).attr('aria-current', active ? 'page' : null);
    });
  }
  function reportError(message) { $('#shell-feedback').removeClass('success').attr('role','alert').text(message).prop('hidden',false); }
  // The badge sits on the Notifications link; a copy on the Menu button keeps it visible on phones.
  function setUnread(count) {
    const value = Number(count) || 0;
    $('#nav-unread').text(value).attr('aria-label', value + ' unread').prop('hidden', value === 0);
    $('#menu-unread').text(value).prop('hidden', value === 0);
    $('#nav-toggle').attr('aria-label', ($('#nav-toggle').attr('aria-expanded') === 'true' ? 'Close navigation' : 'Open navigation') + (value ? ', ' + value + ' unread notifications' : ''));
  }
  async function refreshUnread() {
    if (!app.state.user) { setUnread(0); return; }
    try {
      const data = await app.request('notifications.php?count=1');
      setUnread(data.unread_count);
    } catch (e) {
      setUnread(0);
      if (e.status === 401 && document.body.dataset.requiresAuth === 'true') window.location.replace(app.loginUrl());
    }
  }
  const ready = new Promise((resolve, reject) => $(async function () {
    setNavigation(false);
    $('#nav-toggle').on('click', () => setNavigation($('#nav-toggle').attr('aria-expanded') !== 'true'));
    $('#account-toggle').on('click', () => setAccount($('#account-toggle').attr('aria-expanded') !== 'true'));
    $('#account-toggle').on('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setAccount(true); $('#account-menu a').first().trigger('focus'); }
      else if(event.key==='Tab'&&!event.shiftKey&&!mobile.matches&&!accountMenu.hidden){event.preventDefault();$('#account-menu a').first().trigger('focus');}
    });
    $('#account-menu').on('keydown',event=>{
      if(event.key!=='Tab'||mobile.matches)return;
      const actions=Array.from(accountMenu.querySelectorAll('a,button')).filter(e=>!e.disabled&&!e.hidden);
      if(event.shiftKey&&document.activeElement===actions[0]){event.preventDefault();accountToggle.focus({preventScroll:true});}
      else if(!event.shiftKey&&document.activeElement===actions.at(-1)){event.preventDefault();setAccount(false);document.getElementById('appearance-toggle').focus({preventScroll:true});}
    });
    $(document).on('focusin',event=>{
      if(!accountMenu.hidden&&!accountMenu.contains(event.target)&&!accountToggle.contains(event.target))setAccount(false);
    });
    $(document).on('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!$('#account-menu').prop('hidden')) { event.preventDefault(); setAccount(false, true); }
      else if (mobile.matches && !$('#nav-content').prop('hidden')) { event.preventDefault(); setNavigation(false, true); }
    });
    $(document).on('click', event => {
      if (!$(event.target).closest('#account-disclosure,#account-menu').length && !$('#account-menu').prop('hidden')) {
        setAccount(false);
      }
      if (mobile.matches && !$(event.target).closest('.app-nav').length && !$('#nav-content').prop('hidden')) setNavigation(false);
    });
    mobile.addEventListener('change', () => {
      const focused=accountMenu.contains(document.activeElement)||document.activeElement===accountToggle;
      setNavigation(false);placeAccount();
      if(focused)document.getElementById(mobile.matches?'nav-toggle':'account-toggle').focus({preventScroll:true});
    });
    $('[data-logout]').on('click', async function () {
      const buttons = $('[data-logout]').prop('disabled',true);
      $(this).text('Logging out…');
      try { const data = await app.request('auth.php',{action:'logout'}); app.state.user = null; app.state.csrf = ''; window.location.replace(data.redirect); }
      catch (e) {
        if (e.status === 401) { window.location.replace(app.base + 'login.html'); return; }
        if (e.code === 'csrf_invalid') { const state = await app.session().catch(() => null); if (state) updateUser(state.user); }
        reportError(e.message); buttons.prop('disabled',false); $('[data-logout]').text('Log out');
      }
    });
    $(window).on('pageshow', event => { if (event.originalEvent.persisted) window.location.reload(); });
    try {
      const session = await app.session(); updateUser(session.user);
      if (document.body.dataset.requiresAuth === 'true' && !session.authenticated) { window.location.replace(app.loginUrl()); resolve(session); return; }
      await refreshUnread(); document.body.dataset.shellReady = 'true';
      if (document.body.dataset.page === 'message') document.body.dataset.ready = 'true';
      resolve(session);
    } catch (e) { reportError(e.message); reject(e); }
  }));
  // Handle the rejected bootstrap even when a page has no additional controller.
  ready.catch(() => {});
  return {ready, renderAvatar, identity, updateUser, refreshUnread, setUnread, reportError, setAccount, setNavigation};
})();
