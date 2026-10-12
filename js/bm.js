$(async function () {
  const app = window.ReFind, U = window.StudentUI, shell = window.ReFindShell;
  const params = new URLSearchParams(location.search);
  let tab = ['claims', 'reports', 'handover'].includes(params.get('tab')) ? params.get('tab') : 'claims';
  let selected = params.get(tab === 'claims' ? 'claim' : tab === 'reports' ? 'report' : 'handover') || null;
  let pinned = Boolean(selected), initialFocus = Boolean(selected), current = null, page = 1;
  let request = 0, detailRequest = 0, saving = false, operation = null, refs, trigger = null, timer;
  const drafts = new Map();
  const labels = {approved:'Approve claim', rejected:'Reject claim', need_more_info:'Request more info', status:'Update report status', schedule:'Schedule pickup', reschedule:'Reschedule pickup', cancel_schedule:'Cancel appointment', complete:'Confirm item returned'};
  const get = (endpoint, query = {}) => app.request(endpoint + '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v !== null && v !== undefined)));
  const mobile = () => innerWidth < 1100;
  const idKey = () => tab === 'claims' ? 'claim_id' : tab === 'reports' ? 'item_id' : 'handover_id';
  const draftKey = snapshot => snapshot.kind + ':' + snapshot.id + ':' + snapshot.action;

  function feedback(message, success = false) {
    $('#bm-feedback').toggleClass('success', success).attr('role', success ? 'status' : 'alert').text(message).prop('hidden', false);
  }
  function error(e) {
    if (e.status === 401) { location.replace(app.loginUrl()); return; }
    feedback(e.message || String(e)); $('#bm-retry').prop('hidden', false); $('#bm-loading').prop('hidden', true);
  }
  const emptyDetail = (title = 'Choose a record', message = 'Select a card to see its details and next steps.') => U.empty(title, message);
  function setView(view) { $('.bm-layout').attr('data-mobile-view', view); }
  function syncUrl() {
    const query = {tab};
    if (selected) query[tab === 'claims' ? 'claim' : tab === 'reports' ? 'report' : 'handover'] = selected;
    history.replaceState(null, '', app.base + 'admin.html?' + new URLSearchParams(query));
    $('#nav-home').attr('aria-current', tab === 'handover' ? null : 'page');
    $('[data-main-nav="handover"]').attr('aria-current', tab === 'handover' ? 'page' : null);
  }
  function switchState() {
    const state = $('#bm-state').empty();
    const choices = tab === 'claims' ? [['active','Awaiting review'],['PENDING','Pending'],['NEED_MORE_INFO','Needs more info'],['APPROVED','Approved'],['REJECTED','Rejected'],['all','All claims']]
      : tab === 'handover' ? [['all','All pickups'],['PENDING','Awaiting scheduling'],['SCHEDULED','Scheduled'],['COMPLETED','Returned']]
      : [['all','All reports'], ...refs.statuses.map(s => [s.code, U.statusNames[s.code] || s.name])];
    choices.forEach(([id, name]) => state.append($('<option>').val(id).text(name)));
    $('#bm-title').text(tab === 'handover' ? 'Handover' : tab === 'reports' ? 'Report review' : 'Review Queue');
    $('#bm-intro').text(tab === 'handover' ? 'Arrange pickup, update appointments, and record the return to a verified owner.' : tab === 'reports' ? 'Check reports and choose the next available step.' : 'Compare the identifying details, then record your decision.');
    $('#queue-title').text(tab === 'claims' ? 'Claims' : tab === 'reports' ? 'Reports' : 'Pickups');
    $('[data-bm-tab]').each(function () { const active = $(this).attr('data-bm-tab') === tab; $(this).toggleClass('active', active).attr('aria-pressed', String(active)); });
  }
  function evidence(urls, title) {
    const section = $('<div>').append($('<h3>').text(title)), photos = $('<div>').addClass('bm-evidence');
    if (!urls?.length) section.append($('<p>').addClass('small muted').text('No supporting images provided.'));
    else urls.forEach((src, index) => photos.append($('<button>').attr({type:'button','aria-label':'Enlarge ' + title + ' ' + (index + 1)}).append($('<img>').attr({src, alt:title + ' ' + (index + 1), loading:'lazy'})).on('click', function () {
      trigger = this; $('#bm-evidence-title').text(title + ' ' + (index + 1)); $('#bm-evidence-image').attr({src, alt:title + ' ' + (index + 1)}); document.querySelector('#bm-evidence-dialog').showModal();
    })));
    return section.append(photos);
  }
  function block(title, text, priv = false) { return $('<div>').addClass('bm-block' + (priv ? ' private' : '')).append($('<h3>').text(title), $('<p>').text(text || 'No identifying detail recorded.')); }
  function meta(values) { const list = $('<dl>').addClass('detail-meta'); values.forEach(([title, value]) => list.append($('<div>').append($('<dt>').text(title), $('<dd>').text(value || 'Not specified')))); return list; }
  function actionStyle(action, record) {
    if (action === 'rejected') return 'btn-danger-outline';
    if (action === 'cancel_schedule') return 'btn-warning-outline';
    if (['approved','schedule','status'].includes(action) || action === 'complete' && record.handover_status === 'SCHEDULED') return 'btn-primary';
    return 'btn-outline';
  }
  function actionButton(action, snapshot) {
    return $('<button>').addClass('btn ' + actionStyle(action, snapshot.record)).attr({type:'button','data-bm-action':action}).text(labels[action]).on('click', function () {
      if (saving || !current || selected !== String(snapshot.id) || current.revision !== snapshot.revision) return;
      openOperation(action, snapshot, this);
    });
  }
  const heading = title => $('<h2>').attr('title', title).text(U.titleParts(title).display);
  function claimDetail(claim) {
    const box = $('<article>').attr('data-detail-claim-id', claim.claim_id);
    box.append(U.stateChip(claim.claim_status, U.claimNames[claim.claim_status]), U.demoChip(claim.item.title), heading(claim.item.title), meta([['Claimant',claim.claimant_name],['Submitted',U.date(claim.created_at,true)],['Location',U.locationText(claim.item)],['Related Lost',claim.lost ? U.titleParts(claim.lost.title).display : 'No linked Lost report']]));
    if (claim.item.photos.length) box.append($('<img>').addClass('bm-public-image').attr({src:claim.item.photos[0],alt:U.titleParts(claim.item.title).display}));
    box.append($('<div>').addClass('bm-compare').append(block('Claimant answer',claim.ownership_answer), block("Finder's private clue",claim.item.verification_clue,true)), evidence(claim.ownership_photos,'Private claim evidence'));
    if (claim.lost) box.append($('<section>').addClass('bm-audit').append(block('Linked Lost identifying detail',claim.lost.verification_clue,true), evidence(claim.lost.ownership_photos,'Private Lost evidence'), U.navAction('Open linked report',U.itemUrl(claim.lost.item_id))));
    if (claim.review_note) box.append($('<div>').addClass('bm-outcome').text(claim.review_note + (claim.reviewed_at ? '\nReviewed ' + U.date(claim.reviewed_at,true) : '')));
    const actions = $('<div>').addClass('bm-detail-actions');
    claim.decisions.forEach(action => actions.append(actionButton(action,{kind:'claim',id:claim.claim_id,revision:claim.revision,record:claim})));
    if (claim.handover_id) actions.append($('<a>').addClass('btn btn-primary').attr('href',app.base + 'admin.html?tab=handover&handover=' + claim.handover_id).text('Open handover'));
    if (!claim.decisions.length) box.append($('<p>').addClass('bm-locked-note').text(claim.claim_status === 'APPROVED' ? 'Ownership is approved. Continue to handover for pickup or the return record.' : 'This decision is saved. Any eligible Student resubmission will return to the review queue.'));
    return box.append(actions);
  }
  function reportDetail(report) {
    const box = $('<article>').attr('data-detail-report-id',report.item_id).append(U.chips(report), heading(report.title), meta([['Type',report.item_type],['Location',U.locationText(report)],['Event',U.eventDate(report)],['Reporter',report.reporter_name]]), block('Private verification clue',report.verification_clue,true), evidence(report.ownership_photos,'Private report evidence'));
    const actions = $('<div>').addClass('bm-detail-actions');
    if (report.allowed_statuses.length) actions.append(actionButton('status',{kind:'report',id:report.item_id,revision:report.revision,record:report}));
    else box.append($('<p>').addClass('bm-locked-note').text(['RESOLVED','UNCLAIMED_CLOSED'].includes(report.status_code) ? 'Archived report · read-only.' : 'Review the active claim or handover before changing this report.'));
    actions.append($('<a>').addClass('btn btn-outline').attr('href',U.itemUrl(report.item_id)).text('Public detail'));
    const list = $('<ol>'); report.history.forEach(event => list.append($('<li>').append($('<strong>').text(event.status), $('<p>').text(U.date(event.at,true) + ' · ' + event.note))));
    return box.append(actions,$('<section>').addClass('bm-audit').append($('<h3>').text('Status history'),list));
  }
  function localInput(value) {
    if (!value) return '';
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
    const part = name => parts.find(p => p.type === name).value;
    return part('year') + '-' + part('month') + '-' + part('day') + 'T' + part('hour') + ':' + part('minute');
  }
  function handoverDetail(record) {
    const returned = record.handover_status === 'COMPLETED';
    const box = $('<article>').attr({'data-detail-handover-id':record.handover_id,'data-handover-status':record.handover_status}).append(U.stateChip(record.handover_status,U.pickupNames[record.handover_status]),U.demoChip(record.title),heading(record.title),$('<div>').addClass('bm-pickup-meta').append(meta([['Verified claimant',record.claimant_name],['Pickup area',record.pickup_location || 'Not assigned'],...(returned ? [['Returned',U.date(record.completed_at,true)],['Appointment',record.scheduled_at ? U.date(record.scheduled_at,true) : 'Collected without a scheduled appointment']] : [['Schedule',record.scheduled_at ? U.date(record.scheduled_at,true) : 'Arrange a pickup time with the claimant']])])));
    if (record.notes) box.append($('<div>').addClass('bm-outcome').text(record.notes));
    const actions = $('<div>').addClass('bm-detail-actions');
    record.operations.forEach(action => actions.append(actionButton(action,{kind:'handover',id:record.handover_id,revision:record.revision,record})));
    box.append(actions,$('<p>').addClass('bm-locked-note').text(returned ? 'Returned record · read-only.' : 'Cancelling the appointment keeps ownership approved. You can schedule the same pickup again.'));
    const audit = $('<ol>');
    (record.audit || []).forEach(event => {
      const entry = $('<li>').append($('<strong>').text(event.title),$('<p>').text(U.date(event.at,true)));
      if (event.pickup_event) entry.append($('<p>').text(U.pickupMessage(event.pickup_event,event.at)),$('<details>').addClass('technical-audit').append($('<summary>').text('Original audit record'),$('<p>').text(event.message)));
      else entry.append($('<p>').text(event.message));
      audit.append(entry);
    });
    if (!record.audit?.length) audit.append($('<li>').text('No pickup changes recorded yet.'));
    return box.append($('<section>').addClass('bm-audit').append($('<h3>').text('Private pickup history'),audit));
  }
  async function loadDetail(focus = false) {
    const sequence = ++detailRequest, type = tab, id = selected; current = null;
    if (!id) { $('#bm-detail-content').empty().append(emptyDetail()); return; }
    $('#bm-detail-content').empty().append($('<p>').addClass('loading-note').text('Loading selected record…'));
    try {
      const data = type === 'claims' ? (await get('staff.php',{resource:'claims',id})).claim : type === 'reports' ? (await get('staff.php',{resource:'reports',id})).report : (await get('handovers.php',{id})).handovers[0];
      if (sequence !== detailRequest || tab !== type || selected !== id) return;
      current = data; $('#bm-detail-content').empty().append(type === 'claims' ? claimDetail(data) : type === 'reports' ? reportDetail(data) : handoverDetail(data));
      $('.bm-queue-card').each(function () { const active = $(this).attr('data-record-id') === selected; $(this).toggleClass('selected',active).attr('aria-pressed',String(active)); });
      syncUrl(); if (focus) { setView('detail'); U.focusRecord(document.querySelector('#bm-detail')); }
    } catch (e) {
      if (sequence !== detailRequest) return;
      if (e.status === 401) location.replace(app.loginUrl());
      else $('#bm-detail-content').empty().append(emptyDetail('Record unavailable',e.message));
    }
  }
  function resetSelection() {
    ++request; ++detailRequest; selected = null; current = null; pinned = false;
    setView('queue'); $('#bm-selection-note').prop('hidden',true); $('#bm-detail-content').empty().append(emptyDetail());
    $('.bm-queue-card').prop('disabled',true); $('#bm-loading').prop('hidden',false); syncUrl();
  }
  async function loadQueue(next = page, keepFeedback = false) {
    page = next; const sequence = ++request;
    $('#bm-loading').prop('hidden',false); $('#bm-retry').prop('hidden',true); if (!keepFeedback) $('#bm-feedback').prop('hidden',true);
    try {
      const query = {q:$('#bm-search').val().trim(),status:$('#bm-state').val(),page,limit:24};
      const data = tab === 'handover' ? await get('handovers.php',query) : await get('staff.php',{...query,resource:tab});
      if (sequence !== request) return;
      const records = tab === 'claims' ? data.claims : tab === 'reports' ? data.reports : data.handovers;
      if (!pinned && !records.some(record => String(record[idKey()]) === selected)) selected = records.length ? String(records[0][idKey()]) : null;
      const outside = Boolean(selected) && !records.some(record => String(record[idKey()]) === selected);
      $('#bm-selection-note').text('This linked or saved record is not in the results shown on this page. Back to queue returns to those results.').prop('hidden',!outside);
      const box = $('#bm-queue-list').empty(); $('#queue-count').text(data.total + ' record(s)');
      records.forEach(record => {
        const id = String(record[idKey()]), code = tab === 'claims' ? record.claim_status : tab === 'reports' ? record.status_code : record.handover_status;
        const label = tab === 'claims' ? U.claimNames[code] : tab === 'reports' ? U.statusNames[code] : U.pickupNames[code];
        const detail = tab === 'claims' ? record.claimant_name + ' · ' + record.proof_count + ' supporting image(s)' : tab === 'reports' ? U.locationText(record) : record.claimant_name + ' · ' + (code === 'COMPLETED' ? 'Returned' : record.scheduled_at ? U.date(record.scheduled_at,true) : 'Arrange pickup');
        box.append($('<button>').addClass('bm-queue-card').toggleClass('selected',id === selected).attr({type:'button','data-record-id':id,'aria-pressed':String(id === selected)}).append(U.stateChip(code,label),$('<h3>').attr('title',record.title).text(U.titleParts(record.title).display),U.demoChip(record.title),$('<p>').text(detail),$('<span>').addClass('queue-open').text('View details →')).on('click',async function () { if (saving) return; selected = id; pinned = false; $('#bm-selection-note').prop('hidden',true); setView('detail'); await loadDetail(true); }));
      });
      if (!records.length) box.append(emptyDetail('Queue is clear','No records match this view. Change the filter to revisit outcomes.'));
      const pager = $('#bm-pager').empty();
      if (data.pages > 1) pager.append($('<button>').addClass('btn btn-outline').attr('type','button').prop('disabled',page <= 1).text('Previous').on('click',() => { resetSelection(); loadQueue(page - 1); }),$('<span>').text(page + ' / ' + data.pages),$('<button>').addClass('btn btn-outline').attr('type','button').prop('disabled',page >= data.pages).text('Next').on('click',() => { resetSelection(); loadQueue(page + 1); }));
      syncUrl(); await loadDetail(initialFocus); initialFocus = false;
      if (sequence !== request) return;
      $('#bm-loading').prop('hidden',true); document.body.dataset.ready = 'true';
    } catch (e) { if (sequence === request) error(e); }
  }
  function openOperation(action, snapshot, button) {
    operation = {action,...snapshot}; trigger = button;
    const draft = drafts.get(draftKey(operation));
    $('#operation-title').text(labels[action]);
    $('#operation-record-title').text(U.titleParts(snapshot.record.item?.title || snapshot.record.title).display);
    $('#operation-record-meta').text((snapshot.record.claimant_name ? 'Claimant: ' + snapshot.record.claimant_name + ' · ' : snapshot.record.reporter_name ? 'Reporter: ' + snapshot.record.reporter_name + ' · ' : '') + (snapshot.kind === 'claim' ? 'Claim' : snapshot.kind === 'report' ? 'Report' : 'Pickup') + ' #' + snapshot.id);
    $('#operation-feedback,[data-bm-error],#operation-refresh').prop('hidden',true); $('#operation-confirm').prop('checked',false);
    $('#operation-submit').removeClass('btn-primary btn-danger btn-warning-outline').addClass(action === 'rejected' ? 'btn-danger' : action === 'cancel_schedule' ? 'btn-warning-outline' : 'btn-primary').prop('disabled',true).text(labels[action]);
    $('#operation-fields').prop('disabled',false); $('#operation-note').val(draft?.note ?? (action === 'approved' ? 'Ownership details verified by Building Management.' : '')).attr('maxlength',snapshot.kind === 'handover' ? 250 : 500);
    $('#operation-note-label').text(snapshot.kind === 'handover' ? 'Pickup note / reason (max 250 characters)' : 'Private review note (8–500 characters)');
    $('#operation-note-hint').text(snapshot.kind === 'handover' ? 'Give a reason when changing or cancelling an appointment.' : 'The claimant receives this note. It does not appear in public history.');
    $('#operation-status-field').prop('hidden',action !== 'status'); $('#operation-schedule-fields').prop('hidden',!['schedule','reschedule'].includes(action));
    if (action === 'status') { const select = $('#operation-status').empty(); snapshot.record.allowed_statuses.forEach(code => select.append($('<option>').val(code).text(U.statusNames[code]))); if (draft?.status) select.val(draft.status); }
    if (['schedule','reschedule'].includes(action)) { $('#operation-location').val(draft?.location ?? snapshot.record.pickup_location_id ?? ''); $('#operation-date').val(draft?.date ?? localInput(snapshot.record.scheduled_at || new Date(Date.now() + 86400000))); }
    $('#operation-intro').text(action === 'approved' ? 'Approval confirms ownership, creates one handover and closes competing active claims.' : action === 'complete' ? 'Confirm only after the item has been handed to this verified owner. Linked reports become Returned.' : action === 'cancel_schedule' ? 'The appointment will be cancelled. Ownership stays approved and the pickup can be scheduled again.' : 'Check the selected record and your reason before confirming.');
    $('#operation-confirm-label').text(action === 'complete' ? 'I confirm this item was physically returned to the verified claimant.' : 'I reviewed this record and confirm the decision.');
    document.querySelector('#operation-dialog').showModal(); $('#operation-note').trigger('focus');
  }
  function rememberDraft() { if (operation) drafts.set(draftKey(operation),{note:$('#operation-note').val(),location:$('#operation-location').val(),date:$('#operation-date').val(),status:$('#operation-status').val()}); }
  $('#bm-back').on('click',() => {
    setView('queue'); const previous = selected; selected = null; current = null; pinned = false; ++detailRequest; syncUrl();
    $('#bm-selection-note').prop('hidden',true);
    const card = $('.bm-queue-card').filter(function () { return $(this).attr('data-record-id') === previous; })[0];
    if (card) U.focusRecord(card); else U.focusRecord(document.querySelector('#bm-search'));
  });
  $('#operation-confirm').on('change',function () { $('#operation-submit').prop('disabled',saving || !this.checked); });
  $('[data-close-operation]').on('click',() => { if (!saving) { rememberDraft(); document.querySelector('#operation-dialog').close(); } });
  $('#operation-dialog').on('cancel',event => { if (saving) event.preventDefault(); else rememberDraft(); });
  $('dialog').on('close',() => { if (trigger && document.contains(trigger)) trigger.focus(); });
  $('#bm-evidence-close').on('click',() => document.querySelector('#bm-evidence-dialog').close());
  $('#bm-evidence-dialog').on('close',() => $('#bm-evidence-image').removeAttr('src'));
  $('#operation-refresh').on('click',async () => { rememberDraft(); document.querySelector('#operation-dialog').close(); pinned = true; await loadQueue(page); });
  $('#operation-form').on('submit',async function (event) {
    event.preventDefault(); if (saving || !operation) return;
    const note = $('#operation-note').val().trim(), required = operation.kind !== 'handover' || ['reschedule','cancel_schedule'].includes(operation.action);
    $('[data-bm-error],#operation-feedback').prop('hidden',true);
    if (required && note.length < 8) { $('[data-bm-error="note"]').text('Provide at least 8 characters.').prop('hidden',false); $('#operation-note').trigger('focus'); return; }
    if (!$('#operation-confirm').prop('checked')) return;
    const values = {id:operation.id,revision:operation.revision,note,confirm:'1'}; let endpoint = 'staff.php';
    if (operation.kind === 'claim') { values.action = 'review'; values.decision = operation.action; }
    else if (operation.kind === 'report') { values.action = 'status'; values.status = $('#operation-status').val(); }
    else { endpoint = 'handovers.php'; values.action = operation.action; if (['schedule','reschedule'].includes(operation.action)) { values.pickup_location_id = $('#operation-location').val(); values.scheduled_at = $('#operation-date').val(); } }
    saving = true; $('#operation-fields').prop('disabled',true); $('#operation-submit,[data-close-operation],[data-logout]').prop('disabled',true); $('#operation-submit').text('Saving…');
    try {
      await app.request(endpoint,values); drafts.delete(draftKey(operation)); document.querySelector('#operation-dialog').close();
      feedback(labels[operation.action] + ' saved.',true); pinned = true; await loadQueue(page,true); await shell.refreshUnread();
    } catch (e) {
      rememberDraft(); if (e.status === 401) { location.replace(app.loginUrl()); return; }
      if (e.code === 'csrf_invalid') { const state = await app.session().catch(() => null); if (state && !state.authenticated) { location.replace(app.loginUrl()); return; } }
      $('#operation-fields').prop('disabled',false); $('#operation-feedback').text(e.message).prop('hidden',false);
      for (const [key,message] of Object.entries(e.fields || {})) $('[data-bm-error="' + key + '"]').text(message).prop('hidden',false);
      $('#operation-refresh').prop('hidden',e.status !== 409); $('#operation-feedback').trigger('focus');
    } finally {
      saving = false; $('#operation-fields').prop('disabled',false); $('#operation-submit').prop('disabled',!$('#operation-confirm').prop('checked')).text(labels[operation.action]); $('[data-close-operation],[data-logout]').prop('disabled',false);
    }
  });
  try {
    const state = await shell.ready; if (!state.authenticated) return;
    refs = await app.request('references.php'); U.fillSelect('#operation-location',refs.locations,'Select pickup campus area');
    setView(selected ? 'detail' : 'queue'); switchState();
    $('#bm-search').on('input',() => { if (saving) return; clearTimeout(timer); resetSelection(); timer = setTimeout(() => loadQueue(1),200); });
    $('#bm-state').on('change',() => { if (saving) return; clearTimeout(timer); resetSelection(); loadQueue(1); });
    $('[data-bm-tab]').on('click',async function () { if (saving) return; clearTimeout(timer); resetSelection(); tab = $(this).attr('data-bm-tab'); page = 1; $('#bm-search').val(''); switchState(); syncUrl(); await loadQueue(1); });
    $('#bm-retry').on('click',() => loadQueue(page)); await loadQueue();
  } catch (e) { error(e); }
});
