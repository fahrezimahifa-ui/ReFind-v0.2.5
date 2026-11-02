$(async function () {
  const app = window.ReFind;
  const form = $('#register-form');
  const button = $('#register-submit');
  const feedback = $('#register-feedback');
  const fields = {name: ['#full-name', '#name-error'], email: ['#email', '#email-error'], password: ['#password', '#password-error'], confirm_password: ['#confirm-password', '#confirm-password-error']};
  let sending = false;
  let available = false;
  let retryAt = 0;
  function clearErrors() {
    feedback.prop('hidden', true);
    Object.values(fields).forEach(([input, error]) => { $(input).attr('aria-invalid', 'false'); $(error).text('').prop('hidden', true); });
  }
  function showError(message) { feedback.text(message).prop('hidden', false).trigger('focus'); }
  function fieldError(key, message) {
    if (!fields[key]) return;
    const [input, error] = fields[key];
    $(input).attr('aria-invalid', 'true'); $(error).text(message).prop('hidden', false);
  }
  function firstInvalid() { form.find('[aria-invalid="true"]').first().trigger('focus'); }
  function clearPasswords() {
    $('#password,#confirm-password').val('').attr('type', 'password');
    $('[data-password-toggle]').attr('aria-pressed', 'false').text('Show').each(function () {
      this.setAttribute('aria-label', this.dataset.passwordToggle === 'password' ? 'Show password' : 'Show confirm password');
    });
  }
  function refreshButton() {
    const wait = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    button.prop('disabled', sending || !available || wait > 0).text(sending ? 'Creating account…' : wait > 0 ? 'Try again in ' + wait + 's' : available ? 'Create account' : 'Account creation unavailable');
    if (wait > 0) window.setTimeout(refreshButton, 1000);
  }
  function redirect(user) { window.location.replace(app.base + (user.role === 'BUILDING_MANAGEMENT' ? 'admin.html' : 'index.html')); }
  $('[data-password-toggle]').on('click', function () {
    const input = document.getElementById(this.dataset.passwordToggle);
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    this.setAttribute('aria-pressed', String(visible));
    this.setAttribute('aria-label', (visible ? 'Hide ' : 'Show ') + (input.id === 'password' ? 'password' : 'confirm password'));
    this.textContent = visible ? 'Hide' : 'Show';
  });
  try {
    const session = await window.ReFindShell.ready;
    if (session.authenticated) { redirect(session.user); return; }
    available = session.registration_enabled === true;
    refreshButton();
    if (!available) showError('Account creation is currently unavailable. Please use the Log in link.');
    document.body.dataset.ready = 'true';
  } catch (e) { showError(e.message); button.text('Reload to try again'); return; }

  form.on('submit', async function (event) {
    event.preventDefault();
    if (sending || !available || Date.now() < retryAt) return;
    clearErrors();
    const name = $('#full-name').val().trim(), email = $('#email').val().trim();
    const password = $('#password').val(), confirm = $('#confirm-password').val();
    if (!name || Array.from(name).length > 120 || /[\u0000-\u001f\u007f]/u.test(name)) fieldError('name', 'Use a full name between 1 and 120 characters, without control characters.');
    if (!email || !$('#email')[0].validity.valid || email.length > 150) fieldError('email', 'Enter a valid email address of at most 150 characters.');
    if (Array.from(password).length < 10 || new TextEncoder().encode(password).length > 72 || password.includes('\0')) fieldError('password', 'Use at least 10 characters and at most 72 bytes.');
    if (!confirm || password !== confirm) fieldError('confirm_password', 'The password confirmation does not match.');
    if (form.find('[aria-invalid="true"]').length) { firstInvalid(); return; }
    sending = true; form.attr('aria-busy', 'true');
    form.find('input').prop('readOnly', true); $('[data-password-toggle]').prop('disabled', true);
    $('#register-status').text('Creating your account.'); refreshButton();
    try {
      const result = await app.request('register.php', {name, email, password, confirm_password: confirm});
      if (result.authenticated !== true || result.user?.role !== 'STUDENT' || typeof result.csrf !== 'string' || result.redirect !== app.base + 'index.html') {
        throw Object.assign(new Error('The server did not confirm account creation.'), {status: 201});
      }
      app.state.csrf = result.csrf; app.state.user = result.user;
      clearPasswords(); window.location.assign(result.redirect);
    } catch (e) {
      clearPasswords();
      const uncertain = !e.code || e.status >= 500;
      if (uncertain || e.code === 'already_authenticated') {
        try { const session = await app.session(); if (session.authenticated) { redirect(session.user); return; } }
        catch { /* An unavailable session endpoint cannot justify replaying a registration. */ }
      }
      Object.entries(e.fields || {}).forEach(([key, message]) => fieldError(key, message));
      showError(uncertain ? 'We could not confirm account creation. Try logging in, or try again if no account was created.' : e.message);
      if (e.code === 'csrf_invalid') await app.session().catch(() => {});
      if (e.code === 'registration_disabled') available = false;
      if (e.status === 429 && e.retryAfter > 0) {
        retryAt = Date.now() + e.retryAfter * 1000;
        showError(e.message + ' Retry in ' + e.retryAfter + ' seconds.');
      }
      firstInvalid();
    } finally {
      sending = false; form.attr('aria-busy', 'false');
      form.find('input').prop('readOnly', false); $('[data-password-toggle]').prop('disabled', false);
      $('#register-status').text(''); refreshButton();
    }
  });
});
