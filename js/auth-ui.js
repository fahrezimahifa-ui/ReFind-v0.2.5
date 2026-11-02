$(async function () {
  const app = window.ReFind;
  const page = document.body.dataset.page;
  const feedback = page === 'login' ? $('#login-feedback') : $('#page-feedback');
  function error(message) { feedback.text(message).prop('hidden', false); }
  try {
    const session = await window.ReFindShell.ready;
    if (document.body.dataset.requiresAuth === 'true' && !session.authenticated) { window.location.replace(app.loginUrl()); return; }
    if (page === 'login' && session.authenticated) { window.location.replace(app.base + (session.user.role === 'BUILDING_MANAGEMENT' ? 'admin.html' : 'index.html')); return; }
    $('[data-user-name]').text(session.user?.name || '');
    $('#registration-link').prop('hidden', !session.registration_enabled);
    $('#guest-home').prop('hidden', session.authenticated);
    $('#member-home').prop('hidden', !session.authenticated);
    $('#login-submit').prop('disabled', false).text('Log in');
    document.body.dataset.ready = 'true';
  } catch (e) { error(e.message); $('#login-submit').text('Reload to try again'); return; }

  $('#login-form').on('submit', async function (event) {
    event.preventDefault();
    feedback.prop('hidden', true);
    const email = $('#email')[0]; const password = $('#password')[0];
    $('#email-error').prop('hidden', true); email.setAttribute('aria-invalid', 'false');
    if (!email.validity.valid) {
      $('#email-error').text('Enter a valid account email.').prop('hidden', false); email.setAttribute('aria-invalid', 'true'); email.focus(); return;
    }
    if (!password.value) { error('Enter your password.'); password.focus(); return; }
    const button = $('#login-submit').prop('disabled', true).text('Signing in…');
    try {
      const result = await app.request('auth.php', {action: 'login', email: email.value.trim(), password: password.value, return: new URLSearchParams(window.location.search).get('return') || ''});
      app.state.csrf = result.csrf;
      window.location.assign(result.redirect);
    } catch (e) {
      password.value = ''; error(e.message);
      if (e.code === 'csrf_invalid') await app.session().catch(() => {});
      if (e.status === 429 && e.retryAfter > 0) {
        error(e.message + ' Retry in ' + e.retryAfter + ' seconds.');
        window.setTimeout(() => { button.prop('disabled', false).text('Log in'); }, Math.min(e.retryAfter, 900) * 1000);
      } else { button.prop('disabled', false).text('Log in'); }
      feedback.trigger('focus');
    }
  });
});
