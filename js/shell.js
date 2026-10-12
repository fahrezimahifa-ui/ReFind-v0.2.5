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
  function setAccount(open, focus = false) {
    $('#account-menu').prop('hidden', !open);
    $('#account-toggle').attr('aria-expanded', String(open));
    if (focus) $('#account-toggle').trigger('focus');
  }
  function setNavigation(open, focus = false) {
    $('#nav-content').prop('hidden', mobile.matches && !open);
    const unread = Number($('#menu-unread').text()) || 0;
    $('#nav-toggle').attr({'aria-expanded': String(mobile.matches && open), 'aria-label': (open ? 'Close navigation' : 'Open navigation') + (unread ? ', ' + unread + ' unread notifications' : '')});
    if (!open) setAccount(false);
    if (focus) $('#nav-toggle').trigger('focus');
  }
  function initials(name) { return name.trim().split(/\s+/u).slice(0,2).map(part => Array.from(part)[0] || '').join('').toUpperCase(); }
  function updateUser(user) {
    app.state.user = user;
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
    $('[data-account-initials]').text(user ? initials(user.name) : '');
    const page = document.body.dataset.page;
    $('#nav-home').attr('aria-current', page === 'home' || page === 'bm' ? 'page' : null);
    $('[data-main-nav]').each(function(){const current=$(this).attr('data-main-nav');$(this).attr('aria-current',current===page||(page==='item'||page==='claim')&&current==='browse'?'page':null);});
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
    });
    $(document).on('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!$('#account-menu').prop('hidden')) { event.preventDefault(); setAccount(false, true); }
      else if (mobile.matches && !$('#nav-content').prop('hidden')) { event.preventDefault(); setNavigation(false, true); }
    });
    $(document).on('click', event => {
      if (!$(event.target).closest('#account-disclosure').length && !$('#account-menu').prop('hidden')) {
        const focused = $('#account-menu')[0]?.contains(document.activeElement);
        setAccount(false, focused);
      }
      if (mobile.matches && !$(event.target).closest('.app-nav').length && !$('#nav-content').prop('hidden')) setNavigation(false);
    });
    mobile.addEventListener('change', () => setNavigation(false));
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
  return {ready, updateUser, refreshUnread, setUnread, reportError, setAccount, setNavigation};
})();
