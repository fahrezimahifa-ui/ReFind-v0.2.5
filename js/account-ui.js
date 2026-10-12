$(async function () {
  const app = window.ReFind;
  const shell = window.ReFindShell;
  const page = document.body.dataset.page;
  const map = {name:['#display-name','#name-error'],current_password:['#current-password','#current-password-error'],new_password:['#new-password','#new-password-error'],confirm_password:['#confirm-password','#confirm-password-error']};
  let profile = null;
  let saving = false;
  function clearFields() {
    Object.values(map).forEach(([input,error]) => { $(input).attr('aria-invalid','false'); $(error).text('').prop('hidden',true); });
  }
  function fieldError(key, message) {
    if (!map[key]) return;
    const [input,error] = map[key]; $(input).attr('aria-invalid','true'); $(error).text(message).prop('hidden',false);
  }
  function showFeedback(selector, message, success) {
    $(selector).toggleClass('success',success).attr('role',success?'status':'alert').text(message).prop('hidden',false);
  }
  function renderProfile(data) {
    profile = data;
    const role = data.role === 'BUILDING_MANAGEMENT' ? 'Building Management' : 'Student';
    $('[data-profile-name]').text(data.name);
    $('[data-profile-role]').text(role);
    $('[data-profile-initials]').text(data.name.trim().split(/\s+/u).slice(0,2).map(word=>Array.from(word)[0]||'').join('').toUpperCase());
    $('#display-name').val(data.name); $('#profile-email').val(data.email); $('#profile-role').val(role);
    $('#student-id-field').prop('hidden', data.role !== 'STUDENT');
    $('#profile-student-id').val(data.student_id || '');
  }
  async function loadAccount() {
    $('#account-load-error,#retry-account').prop('hidden',true); $('#account-loading').prop('hidden',false);
    try {
      const data = await app.request('account.php'); renderProfile(data.profile);
      $('#account-content').prop('hidden',false); $('#profile-fields,#password-fields').prop('disabled',false);
      document.body.dataset.ready = 'true';
    } catch (e) {
      if (e.status === 401) { window.location.replace(app.loginUrl()); return; }
      showFeedback('#account-load-error',e.message,false); $('#retry-account').prop('hidden',false);
    } finally { $('#account-loading').prop('hidden',true); }
  }
  function passwordPolicy() {
    const value = $('#new-password').val() || '';
    const chars = Array.from(value).length, bytes = new TextEncoder().encode(value).length;
    $('#password-policy').text(value ? chars + ' characters' + (bytes>72 ? ' · too long (emoji and accented letters count as more than one)' : chars<10 ? ' · use at least 10' : ' · OK') : 'Use at least 10 characters.').toggleClass('invalid',!!value && (chars<10||bytes>72));
  }
  async function submitFailure(e, selector) {
    if (e.status === 401) { window.location.replace(app.loginUrl()); return; }
    if (e.code === 'csrf_invalid') {
      const state = await app.session().catch(()=>null);
      if (state && !state.authenticated) { window.location.replace(app.loginUrl()); return; }
      if (state) shell.updateUser(state.user);
    }
    Object.entries(e.fields||{}).forEach(([key,message])=>fieldError(key,message));
    showFeedback(selector,e.message + (e.status===429&&e.retryAfter>0?' Try again in '+e.retryAfter+' seconds.':''),false);
    const invalid = Object.keys(e.fields||{}).find(key=>map[key]);
    if (invalid) $(map[invalid][0]).trigger('focus'); else $(selector).trigger('focus');
  }
  try {
    const state = await shell.ready;
    if (!state.authenticated) return;
    await loadAccount();
  } catch (e) {
    $('#account-loading').prop('hidden',true); showFeedback('#account-load-error',e.message,false); $('#retry-account').prop('hidden',false);
  }
  $('#retry-account').on('click', () => { if (document.body.dataset.shellReady !== 'true') window.location.reload(); else loadAccount(); });
  $('#profile-reset').on('click', () => { if (!profile || saving) return; clearFields(); $('#profile-feedback').prop('hidden',true); $('#display-name').val(profile.name).trigger('focus'); });
  $('#new-password').on('input',passwordPolicy);

  $('#profile-form').on('submit',async function(event) {
    event.preventDefault(); if (saving || !profile) return;
    clearFields(); $('#profile-feedback').prop('hidden',true);
    const name = $('#display-name').val().trim();
    if (!name || Array.from(name).length>120 || /[\x00-\x1f\x7f]/u.test(name)) {
      fieldError('name','Use a display name between 1 and 120 characters, without control characters.'); $('#display-name').trigger('focus'); return;
    }
    saving = true; $('#profile-fields').prop('disabled',true); $('[data-logout]').prop('disabled',true); $('#profile-save').text('Saving…');
    try {
      const result = await app.request('account.php',{action:'update_profile',name});
      app.state.csrf = result.csrf; shell.updateUser(result.user); renderProfile(result.profile);
      showFeedback('#profile-feedback',result.message,true); $('#profile-feedback').trigger('focus');
    } catch(e) { $('#profile-fields').prop('disabled',false); await submitFailure(e,'#profile-feedback'); }
    finally { saving=false; $('#profile-fields').prop('disabled',false); $('[data-logout]').prop('disabled',false); $('#profile-save').text('Save display name'); }
  });

  $('#password-form').on('submit',async function(event) {
    event.preventDefault(); if (saving || !profile) return;
    clearFields(); $('#password-feedback').prop('hidden',true);
    const values = {current_password:$('#current-password').val(),new_password:$('#new-password').val(),confirm_password:$('#confirm-password').val()};
    let firstError = null;
    function invalid(key,message) {fieldError(key,message);firstError ||= key;}
    const emptyMessages = {current_password:'Enter your current password.',new_password:'Enter a new password.',confirm_password:'Repeat the new password.'};
    for (const [key,value] of Object.entries(values)) {
      if (!value) invalid(key,emptyMessages[key]);
      else if (value.includes('\0') || new TextEncoder().encode(value).length>72) invalid(key,'This password is too long. Use at most 72 bytes; emoji and accented letters count as more than one.');
    }
    if (values.new_password && Array.from(values.new_password).length<10) invalid('new_password','Use at least 10 characters for the new password.');
    if (values.new_password!==values.confirm_password) invalid('confirm_password','The password confirmation does not match.');
    if (values.new_password && values.new_password===values.current_password) invalid('new_password','Choose a password different from the current password.');
    if (firstError) { $(map[firstError][0]).trigger('focus'); return; }
    saving=true; $('#password-fields').prop('disabled',true); $('[data-logout]').prop('disabled',true); $('#password-save').text('Updating…');
    try {
      const result = await app.request('account.php',{action:'change_password',...values});
      app.state.csrf=result.csrf; shell.updateUser(result.user); renderProfile(result.profile);
      $('#current-password,#new-password,#confirm-password').val(''); passwordPolicy();
      showFeedback('#password-feedback',result.message,true); $('#password-feedback').trigger('focus');
    } catch(e) { $('#password-fields').prop('disabled',false); await submitFailure(e,'#password-feedback'); }
    finally {saving=false; $('#password-fields').prop('disabled',false); $('[data-logout]').prop('disabled',false); $('#password-save').text('Update password');}
  });
});
