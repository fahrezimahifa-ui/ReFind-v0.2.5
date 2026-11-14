$(async function(){
  const app=window.ReFind,U=window.StudentUI,shell=window.ReFindShell,page=document.body.dataset.page;
  const params=U.urlParams();let refs,visualEnabled=false;
  const get=(endpoint,query={})=>app.request(endpoint+'?'+new URLSearchParams(Object.entries(query).filter(([,v])=>v!==''&&v!==null&&v!==undefined)).toString());
  const query=values=>new URLSearchParams(Object.entries(values).filter(([,v])=>v!==''&&v!==null&&v!==undefined)).toString();
  const validId=value=>/^[1-9][0-9]{0,9}$/.test(value||'');
  const validPage=value=>{const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=100000?n:1;};
  const fromNotifications=page==='item'&&params.get('origin')==='notifications';
  const notificationPage=validPage(params.get('notification_page'));
  const notificationId=validId(params.get('notification'))?params.get('notification'):null;
  const backHref=fromNotifications?app.base+'notifications.html?'+new URLSearchParams({page:notificationPage,...(notificationId?{notification:notificationId}:{})}):app.base+'browse.html';
  const backLabel=fromNotifications?'Back to Notifications':'Back to Explore';
  if(page==='item')$('#item-back').attr('href',backHref).find('span').text(backLabel);
  // First load shows skeleton cards in an empty results grid; the status text stays for screen readers.
  function loading(value){const note=$('#page-loading').prop('hidden',!value),grid=note.nextAll('.discovery-grid').first();$('.skeleton-card').remove();note.removeClass('has-skeleton');if(value&&grid.length&&!grid.children().length){grid.append(U.skeleton(innerWidth>=1280?8:innerWidth>=680?6:2));note.addClass('has-skeleton');}}
  function bindRetry(load){$('#retry-page').off('click.student').on('click.student',()=>load());}
  // A missing or deleted record cannot be fixed by retrying, so offer a way out instead.
  function showMissing(title='Report not found',detail='It may have been deleted, or the link is incomplete.'){loading(false);$('#retry-page,#page-feedback').prop('hidden',true);$('#page-missing').remove();$('<div>').attr('id','page-missing').append(U.empty(title,detail,backHref,fromNotifications?backLabel:'Go to Explore')).insertAfter('#page-feedback');document.body.dataset.ready='true';}
  function failed(e){if(e.status===404||e.code==='invalid_id'){showMissing();return;}U.showError(e);$('#retry-page').prop('hidden',false);loading(false);}
  function clearPage(){ $('#page-feedback,#retry-page').prop('hidden',true); }
  function showList(selector,items,emptyTitle,emptyDetail){const box=$(selector).empty();if(!items.length)box.append(U.empty(emptyTitle,emptyDetail));else items.forEach(item=>box.append(U.card(item)));}
  function tabState(selector,attr,value){$(selector).each(function(){const active=$(this).attr(attr)===value;$(this).toggleClass('active',active).attr('aria-pressed',String(active));});}
  let deleteId=null,deleteLoad=null,dialogTrigger=null;
  $('[data-close-dialog]').on('click',function(){this.closest('dialog').close();});
  $('dialog').on('close',()=>{if(dialogTrigger&&document.contains(dialogTrigger))dialogTrigger.focus();});
  function requestDelete(id,load,trigger){deleteId=id;deleteLoad=load;dialogTrigger=trigger;document.querySelector('#confirm-dialog').showModal();}
  $('#confirm-delete').on('click',async function(){if(!deleteId)return;const button=$(this).prop('disabled',true).text('Deleting…');try{await app.request('items.php',{action:'delete',id:deleteId});document.querySelector('#confirm-dialog').close();if(page==='item'){U.flash('Report deleted.');location.assign(app.base+'my-reports.html');}else{await deleteLoad();U.notify('Report deleted.');}await shell.refreshUnread();}catch(e){U.showError(e);document.querySelector('#confirm-dialog').close();}finally{button.prop('disabled',false).text('Delete report');}});
  let withdrawTarget=null;
  function requestWithdraw(itemId,after,trigger){withdrawTarget={itemId,after};dialogTrigger=trigger;document.querySelector('#withdraw-dialog').showModal();}
  $('#confirm-withdraw').on('click',async function(){if(!withdrawTarget)return;const button=$(this).prop('disabled',true).text('Withdrawing…');try{await app.request('claims.php',{action:'withdraw',itemId:withdrawTarget.itemId});document.querySelector('#withdraw-dialog').close();await withdrawTarget.after();U.notify('Claim withdrawn. You can send a new claim for this item later.');await shell.refreshUnread();}catch(e){document.querySelector('#withdraw-dialog').close();U.showError(e);}finally{button.prop('disabled',false).text('Withdraw claim');}});

  function bindVisualSearch(filters){
    if(!visualEnabled)return ()=>{};
    const toggle=$('#visual-toggle').prop('hidden',false),form=$('#visual-search'),outcome=$('#visual-outcome');
    const results=$('#visual-results'),status=$('#visual-status'),submit=$('#visual-submit'),input=$('#visual-photo');
    const heading=$('#visual-heading,#visual-hint');
    let sequence=0,busy=false;
    const updateButton=()=>submit.prop('disabled',busy||upload.busy||upload.files.length!==1);
    const upload=new PhotoUpload('#visual-upload',1,updateButton,true);
    function reset(message=''){
      sequence++;
      results.empty();
      heading.prop('hidden',true);
      status.text(message);
      outcome.prop('hidden',!message).attr('aria-busy','false');
    }
    toggle.on('click',()=>{
      const opening=form.prop('hidden');
      form.prop('hidden',!opening);
      toggle.attr('aria-expanded',String(opening));
      if(opening)input.trigger('focus');
      else reset();
    });
    form.on('click','[data-remove-upload]',()=>{reset();updateButton();});
    $('#visual-clear').on('click',()=>{
      if(upload.busy)return;
      upload.clear();reset();updateButton();input.trigger('focus');
    });
    form.on('submit',async event=>{
      event.preventDefault();
      if(submit.prop('disabled'))return;
      reset('Searching for visually similar reports…');
      const current=sequence,body=new FormData();
      upload.append(body,'photo');
      for(const [key,value] of Object.entries(filters()))if(value)body.append(key,value);
      busy=true;updateButton();outcome.attr('aria-busy','true');
      try{
        const response=await app.request('visual-search.php',body);
        if(current!==sequence)return;
        if(response.state==='matches'){
          heading.prop('hidden',false);
          status.text(response.items.length+' possible visual match(es).');
          response.items.forEach(item=>results.append(U.card(item)));
        }else status.text(response.state==='no_match'?'No sufficiently similar matches.':'No indexed photos for these filters yet.');
      }catch(error){
        if(current===sequence)status.text(error.message);
      }finally{
        busy=false;updateButton();
        if(current===sequence)outcome.attr('aria-busy','false');
      }
    });
    return ()=>{if(!outcome.prop('hidden'))reset('Filters changed. Search by photo again to apply them.');};
  }
  async function discovery(){
    const statusCodes=refs.statuses.map(s=>s.code),categoryIds=refs.filter_categories.map(c=>String(c.id)),locationIds=refs.filter_locations.map(l=>String(l.id));
    let type=(params.get('type')||'').toUpperCase(),currentPage=validPage(params.get('page')),request=0,timer;
    if(!['LOST','FOUND'].includes(type))type='';
    U.fillSelect('#filter-category',refs.filter_categories,'All categories');U.fillSelect('#filter-location',refs.filter_locations,'All campus areas');U.fillSelect('#filter-status',refs.statuses,'Active reports','code','name');
    // Unknown URL values are dropped instead of being written back as "null".
    const status=(params.get('status')||'').toUpperCase(),date=params.get('date')||'';
    $('#filter-q').val(params.get('q')||'');$('#filter-category').val(categoryIds.includes(params.get('category_id'))?params.get('category_id'):'');$('#filter-location').val(locationIds.includes(params.get('location_id'))?params.get('location_id'):'');$('#filter-status').val(statusCodes.includes(status)?status:'');$('#filter-date').val(/^\d{4}-\d{2}-\d{2}$/.test(date)?date:'');
    const structured=()=>({type,category_id:$('#filter-category').val()||'',location_id:$('#filter-location').val()||'',status:$('#filter-status').val()||'',date:$('#filter-date').val()||''});
    const resetVisual=bindVisualSearch(structured);
    function filterCount(){return ['#filter-category','#filter-location','#filter-status','#filter-date'].filter(s=>$(s).val()).length;}
    function syncFilterButton(){const n=filterCount();$('#filter-toggle').text(n?'Filters · '+n:'Filters');}
    if(filterCount()){$('#advanced-filters').prop('hidden',false);$('#filter-toggle').attr('aria-expanded','true');}
    // An unsuccessful search should lead somewhere: Students can report the item, keeping their words, so ReFind can notify them about later matches.
    function noResults(values){
      const filtered=values.category_id||values.location_id||values.status||values.date;
      const hint=(values.q?'Check the spelling or try fewer words':'Try another search')+(filtered?', or clear filters.':'.');
      const historyLink=values.status?null:$('<p>').append($('<a>').addClass('text-link').attr('href',app.base+'history.html'+(values.q?'?'+query({q:values.q}):'')).text('Search returned and closed reports in History'));
      if(app.state.user?.role!=='STUDENT')return U.empty('No matching reports',hint).append(historyLink);
      const found=values.type==='LOST';
      return U.empty('No matching reports',hint+(found?' If you found this item, report it so its owner can find it.':' Lost it? Report it and ReFind will notify you when a possibly matching Found report is added.'),app.base+'report.html?'+query({type:found?'found':'lost',q:values.q.slice(0,120)}),found?'Report it as found':'Report it as lost').append(historyLink);
    }
    async function load(next=currentPage){currentPage=next;const seq=++request;clearPage();loading(true);tabState('[data-filter-type]','data-filter-type',type);syncFilterButton();const values={q:$('#filter-q').val().trim(),...structured(),page:currentPage};
      try{const data=await get('items.php',{...values,active:values.status?'':'1'});if(seq!==request)return;
        if(data.total&&currentPage>data.pages)return load(data.pages);
        $('#result-count').text(U.plural(data.total,{LOST:'lost report',FOUND:'found report'}[type]||'report')+' · '+(values.status?'':'active · ')+'newest first');if(data.items.length)showList('#browse-results',data.items);else $('#browse-results').empty().append(noResults(values));U.pager(data,next=>load(next),'#result-count');history.replaceState(null,'',app.base+'browse.html?'+query(values));loading(false);document.body.dataset.ready='true';}catch(e){if(seq===request)failed(e);}}
    $('#filter-toggle').on('click',()=>{const open=$('#advanced-filters').prop('hidden');$('#advanced-filters').prop('hidden',!open);$('#filter-toggle').attr('aria-expanded',String(open));});
    $('#filter-q').on('input',()=>{clearTimeout(timer);timer=setTimeout(()=>load(1),200);});$('#filter-category,#filter-location,#filter-status,#filter-date').on('change',()=>{resetVisual();load(1);});
    $('[data-filter-type]').on('click',function(){type=$(this).attr('data-filter-type');resetVisual();load(1);});$('#clear-filters').on('click',()=>{$('#filter-q,#filter-category,#filter-location,#filter-status,#filter-date').val('');type='';resetVisual();load(1);});bindRetry(load);await load();
  }
  // Report journey: five steps derived from the status contract, plus a newest-first history log.
  const journeySteps=[{label:'Reported',codes:['OPEN','UNDER_REVIEW']},{label:'Possible match',codes:['POTENTIAL_MATCH']},{label:'Claim review',codes:['VERIFICATION']},{label:'Ready for pickup',codes:['HANDOVER']},{label:'Returned',codes:['RESOLVED','UNCLAIMED_CLOSED']}];
  const actorNames={you:'You',building_management:'Building Management',reporter:'Reporter',student:'A student',system:'ReFind'};
  const stepOf=code=>Math.max(0,journeySteps.findIndex(step=>step.codes.includes(code)));
  function relativeTime(value){const seconds=(new Date(value)-Date.now())/1000,format=new Intl.RelativeTimeFormat('en',{numeric:'auto'});if(Math.abs(seconds)<45)return 'Just now';for(const [limit,unit,size] of [[3600,'minute',60],[86400,'hour',3600],[604800,'day',86400],[2629800,'week',604800],[31557600,'month',2629800]])if(Math.abs(seconds)<limit)return format.format(Math.round(seconds/size),unit).replace(/^./,c=>c.toUpperCase());return format.format(Math.round(seconds/31557600),'year').replace(/^./,c=>c.toUpperCase());}
  function renderJourney(item){
    const current=stepOf(item.status_code),closed=item.status_code==='UNCLAIMED_CLOSED',visited=new Set([0,...item.history.map(event=>stepOf(event.status_code))]);
    const steps=$('#item-journey').empty();
    journeySteps.forEach((step,index)=>{
      const state=index===current?'current':index<current?(visited.has(index)?'done':'skipped'):'upcoming';
      const label=index===4&&closed?'Never retrieved':step.label;
      const entry=$('<li>').addClass('journey-step is-'+state).toggleClass('is-closed',closed&&index===4).append($('<span>').addClass('journey-dot').attr('aria-hidden','true'),$('<span>').addClass('journey-label').text(label),$('<span>').addClass('visually-hidden').text(' · '+{current:'current step',done:'completed',skipped:'skipped',upcoming:'not reached yet'}[state]));
      if(state==='current')entry.attr('aria-current','step').append($('<span>').addClass('journey-now').attr('aria-hidden','true').text('Now'));
      steps.append(entry);
    });
    const step=journeyNext(item);
    $('#journey-note').text(step?.text||'').prop('hidden',!step);
    if(step?.href)$('#journey-note').append(' ',$('<a>').addClass('text-link').attr('href',step.href).text(step.label));
    const log=$('#item-history').empty();
    [...item.history].reverse().forEach(event=>{const exact=U.date(event.at,true),time=$('<time>').attr({datetime:event.at,title:exact}).text(relativeTime(event.at)).append($('<span>').addClass('visually-hidden').text(' · '+exact));
      const meta=$('<span>').addClass('history-meta').append(time,event.actor?' · '+(actorNames[event.actor]||'ReFind'):'');
      log.append($('<li>').addClass('history-entry').append($('<div>').addClass('history-head').append(U.stateChip(event.status_code,event.status_name),meta),event.note?$('<p>').addClass('history-note').text(event.note):null));});
    if(!item.history.length)log.append($('<li>').addClass('history-entry').text('No history events recorded.'));
  }
  // One plain next step for the current status, written for whoever is viewing (reporter, claimant or other student).
  function journeyNext(item){
    const own=String(item.reporter_user_id)===String(app.state.user?.id),lost=item.item_type==='LOST',claim=item.own_claim?.claim_status;
    const invite=item.can_claim?'If this is yours, choose “I think this is mine” to send private ownership details.':item.can_report_found?'If you found this item, choose “I found this item” to report it.':'';
    switch(item.status_code){
      case 'OPEN':return own?{text:lost?'No possible matches yet. ReFind notifies you when a similar Found report is added.':'ReFind suggests this report to students with similar Lost reports. Building Management verifies any claim before the item is returned.'}:invite?{text:invite}:null;
      case 'UNDER_REVIEW':return {text:'Building Management is reviewing this report.'};
      case 'POTENTIAL_MATCH':if(own&&lost)return item.matches.length?{text:'Compare the related reports. If one is yours, open it and choose “I think this is mine”.',href:'#match-section',label:'Compare matches'}:{text:'A possible match was suggested. Open the related report to compare the details.'};
        return own?{text:'Similar Lost reports exist. Building Management verifies any claim before the item is returned.'}:invite?{text:invite}:null;
      case 'VERIFICATION':return claim==='NEED_MORE_INFO'?{text:'Building Management asked for more details. Choose “Update my claim” to reply.'}:claim==='PENDING'?{text:'Your claim is being reviewed. You will get a notification with the decision.'}:{text:'Building Management is reviewing a claim. Ownership has not been decided yet.'};
      case 'HANDOVER':return claim==='APPROVED'?{text:'Your claim was approved. Building Management arranges the pickup time and place with you; see “Follow my claim”.'}:{text:'Ownership is verified. Building Management arranges pickup with the verified owner.'};
      case 'RESOLVED':return {text:'This report is closed as returned.'};
      case 'UNCLAIMED_CLOSED':return {text:'Building Management archived this report as never retrieved.'};
      default:return null;
    }
  }
  async function itemDetail(){
    const id=params.get('id');let item,photoIndex=0;
    if(!validId(id)){showMissing();return;}
    function showPhoto(){const photo=item.photos[photoIndex];$('#gallery-image').attr({src:photo||'',alt:item.title}).prop('hidden',!photo);$('#gallery-empty').prop('hidden',!!photo);$('#gallery-open').prop('disabled',!photo);$('#gallery-thumbs button').attr('aria-pressed','false').eq(photoIndex).attr('aria-pressed','true');}
    async function load(){clearPage();loading(true);try{item=(await get('items.php',{id})).item;document.title=U.titleParts(item.title).display+' · ReFind';$('#item-title').text(U.titleParts(item.title).display).attr('title',item.title);$('#item-description').text(item.description);$('#item-category').text(item.category_name);$('#item-location').text(U.locationText(item));$('#item-event').text(U.eventDate(item));$('#item-location-label').text(item.item_type==='FOUND'?'Found at':'Last seen at');$('#item-event-label').text(item.item_type==='FOUND'?'Date found':'Date lost');$('#item-reporter').empty().append(shell.identity(item.reporter_name,item.reporter_avatar_url));$('#item-chips').empty().append(U.chips(item).children());
      $('#gallery-thumbs').empty();item.photos.forEach((photo,index)=>$('#gallery-thumbs').append($('<button>').attr({type:'button','aria-label':'Public photo '+(index+1),'aria-pressed':String(index===0)}).append($('<img>').attr({src:U.thumbUrl(photo),alt:'',width:60,height:60})).on('click',()=>{photoIndex=index;showPhoto();})));photoIndex=0;showPhoto();
      const actions=$('#item-actions').empty(),notice=$('#item-notice').prop('hidden',true).empty(),note=text=>notice.append($('<p>').text(text)).prop('hidden',false);
      if(item.can_claim)actions.append($('<a>').addClass('btn btn-primary').attr('href',U.claimUrl(id)).text(item.own_claim?'Update my claim':'I think this is mine'));
      if(item.can_report_found)actions.append(U.navAction('I found this item',app.base+'report.html?type=found&from='+encodeURIComponent(id)));
      // The notice is built from parts so a linked pair never hides the claimant's own claim status.
      if(item.own_claim){const own=item.own_claim;note('Your claim: '+U.claimNames[own.claim_status]+(own.review_note?' · '+own.review_note:''));if(own.claim_status==='REJECTED')note('A rejected claim is final for this item.');if(own.claim_status==='APPROVED')note('Your pickup details are in My Activity.');actions.append($('<a>').addClass('btn btn-outline').attr('href',app.base+'my-reports.html?tab=claims&claim='+own.claim_id).text('Follow my claim'));}
      // A Found report does not prove where the item is now; only the verified owner receives pickup details.
      if(item.item_type==='FOUND'&&app.state.user?.role==='STUDENT'&&['OPEN','UNDER_REVIEW','POTENTIAL_MATCH','VERIFICATION'].includes(item.status_code)){
        if(String(item.reporter_user_id)===String(app.state.user.id)){note('If you still have this item, contact Building Management to ask how to hand it in. They verify any claim before it is returned.');notice.append(U.deskCard(refs.pickup_desk));}
        else note('Found items are returned only after Building Management verifies an ownership claim. The pickup time and place are shared with the verified owner.');
      }
      if(item.can_edit)actions.append($('<a>').addClass('btn btn-outline').attr('href',app.base+'report.html?edit='+id).text('Edit report'),$('<button>').addClass('btn btn-danger-outline btn-report-delete').attr({type:'button',id:'delete-report'}).text('Delete report').on('click',function(){requestDelete(id,load,this);}));
      else if(item.edit_locked_reason)note(item.edit_locked_reason);
      if(app.state.user?.role==='BUILDING_MANAGEMENT')actions.append(U.navAction('Open in Review Queue',app.base+'admin.html?tab=reports&report='+encodeURIComponent(id)));
      if(item.matched_item_id){notice.append($('<p>').text('Verified report pair.'),U.navAction('Open linked report',U.itemUrl(item.matched_item_id))).prop('hidden',false);}
      if(['RESOLVED','UNCLAIMED_CLOSED'].includes(item.status_code))note('This report is read-only and no longer receives claims.');
      renderJourney(item);
      $('#match-section')[String(item.reporter_user_id)===String(app.state.user?.id)&&item.item_type==='LOST'&&item.matches.length?'insertBefore':'insertAfter']('.journey-section').prop('hidden',!item.matches.length);$('#item-matches').empty();const sameScore=new Set(item.matches.map(match=>match.match_score)).size<=1;item.matches.forEach(match=>$('#item-matches').append(U.card(match,{showScore:!sameScore})));$('#item-content').prop('hidden',false);loading(false);document.body.dataset.ready='true';}catch(e){failed(e);}}
    $('#gallery-open').on('click',function(){if(!item?.photos.length)return;dialogTrigger=this;$('#enlarged-photo').attr({src:item.photos[photoIndex],alt:item.title});document.querySelector('#photo-dialog').showModal();});bindRetry(load);await load();
  }
  async function reportForm(){
    const edit=params.get('edit'),from=params.get('from');
    if(edit!==null&&!validId(edit)){showMissing();return;}
    let existing=null;
    if(edit){try{existing=(await get('items.php',{id:edit,editable:'1'})).item;}catch(e){if(e.status===409||e.status===403){loading(false);$('#page-feedback').prop('hidden',true);$('<div>').attr('id','page-missing').append(U.empty('This report cannot be edited',e.status===409?'A claim or review is in progress, so the report is locked.':e.message,U.itemUrl(edit),'Back to report')).insertAfter('#page-feedback');document.body.dataset.ready='true';return;}throw e;}}
    let type=existing?.item_type||((params.get('type')||'').toUpperCase()==='FOUND'||validId(from)?'FOUND':'LOST'),sending=false;
    U.fillSelect('#r-category',refs.categories,'Select category');U.fillSelect('#r-location',refs.locations,'Select campus area');
    $('#r-date').attr('max',refs.campus_today);$('#found-next').append(U.deskCard(refs.pickup_desk));
    $('#visual-report-consent').prop('hidden',!visualEnabled);
    let keepPublic=existing?(existing.photo_ids||[]).map(String):[],savedProof=existing?(existing.ownership_photo_ids||[]).map(String):[];
    const busy=()=>$('#report-submit').prop('disabled',sending||publicUpload.busy||proofUpload.busy);
    const publicUpload=new PhotoUpload('#public-upload',()=>4-keepPublic.length,busy),proofUpload=new PhotoUpload('#proof-upload',()=>2-($('#keep-proof').prop('checked')?savedProof.length:0),busy);
    function updateReportMode(){const lost=type==='LOST';tabState('[data-report-type]','data-report-type',type);$('#lost-evidence').prop('hidden',!lost);$('#report-heading').text((existing?'Edit ':'Report a ')+(lost?'Lost':'Found')+' item');
      $('#report-intro').text(lost?'Describe the item and where you last saw it. Photos help others recognize it; ownership details stay private.':'Describe the item and where you found it. Photos help the owner recognize it; your check detail stays private.');$('#found-next').prop('hidden',lost||!!existing);
      $('#r-location-label').text(lost?'Last seen campus area *':'Found campus area *');$('#r-date-label').text(lost?'Date lost *':'Date found *');
      $('#private-heading').text(lost?'4 · Ownership details for Building Management':"4 · Finder's check for Building Management");
      $('#private-intro').text(lost?'This helps Building Management verify that you are the owner and never appears on the public report. Supporting photos are visible to Building Management only.':'Note one detail that only the real owner would know, such as a mark or something inside. Building Management uses it to check claims; it never appears publicly.');
      $('#r-clue-label').text(lost?'A detail only the owner would know *':'A detail the owner should be able to describe *');
      if(!existing)history.replaceState(null,'',app.base+'report.html?'+query({type:type.toLowerCase(),from:validId(from)?from:''}));}
    if(existing){$('#r-title').val(existing.title);$('#r-description').val(existing.description);$('#r-category').val(existing.category_id);$('#r-location').val(existing.location_id);$('#r-detail').val(existing.location_detail||'');$('#r-date').val(existing.event_date);$('#r-time').val(existing.event_time?existing.event_time.slice(0,5):'');$('#r-clue').val(existing.private_clue);$('#report-submit').text('Save report changes');$('[data-report-type]').prop('disabled',true);$('#report-cancel').attr('href',U.itemUrl(edit));
      if(!$('#r-category').val())$('[data-error="category_id"]').text('The previous category is no longer offered. Choose a current one.').prop('hidden',false);
      existing.photos.forEach((photo,index)=>$('#saved-public').append($('<div>').addClass('upload-preview').append($('<img>').attr({src:photo,alt:'Saved public photo '+(index+1)}),$('<button>').attr({type:'button','aria-label':'Remove saved public photo '+(index+1)}).text('Remove saved').on('click',function(){keepPublic=keepPublic.filter(id=>id!==String(existing.photo_ids[index]));$(this).parent().remove();}))));
      $('#saved-proof-count').text(savedProof.length+' private photos are saved for Building Management review.').prop('hidden',!savedProof.length);$('#saved-proof-choice').prop('hidden',!savedProof.length);if(existing.photos.length)$('#public-upload').closest('details').prop('open',true);if(savedProof.length)$('#proof-upload').closest('details').prop('open',true);
    }else{$('#r-date').val(refs.campus_today);
      // Words from an unsuccessful Explore search become the starting item name; a linked Lost report below takes precedence.
      const searched=(params.get('q')||'').trim().slice(0,120);if(searched)$('#r-title').val(searched);
      // Prefill identifying context; the Found report keeps today's event date.
      if(validId(from)){try{const source=(await get('items.php',{id:from})).item;if(source.item_type==='LOST'&&source.can_report_found){$('#r-category').val(refs.categories.some(c=>String(c.id)===String(source.category_id))?source.category_id:'');$('#r-location').val(refs.locations.some(l=>String(l.id)===String(source.location_id))?source.location_id:'');$('#r-title').val(U.titleParts(source.title).display);$('#report-context').text('You are reporting that you found: '+U.titleParts(source.title).display+'. Describe what you actually found; the owner will be told about a possible match.').prop('hidden',false);}}catch{}}
    }
    $('#keep-proof').on('change',function(){if(this.checked&&savedProof.length+proofUpload.files.length>2){this.checked=false;proofUpload.status('Remove new images before restoring saved proof.',true);}});
    $('[data-report-type]').on('click',function(){
      if(existing)return;
      type=$(this).attr('data-report-type');
      if(type==='FOUND')proofUpload.clear();
      updateReportMode();
    });
    updateReportMode();
    const fields={title:'#r-title',description:'#r-description',category_id:'#r-category',location_id:'#r-location',date:'#r-date',clue:'#r-clue',time:'#r-time',location_detail:'#r-detail',photos:'#r-photos',ownershipPhotos:'#r-proof'};
    function fieldError(key,message){$('[data-error="'+key+'"]').text(message).prop('hidden',false);$(fields[key]).attr('aria-invalid','true');}
    function validateReport(){
      U.clearErrors();
      if(!U.required({title:fields.title,description:fields.description,category_id:fields.category_id,location_id:fields.location_id,date:fields.date,clue:fields.clue}))return false;
      let firstInvalidField=null;
      const check=(ok,key,message)=>{
        if(!ok){
          fieldError(key,message);
          firstInvalidField||=key;
        }
      };
      // Count Unicode characters, and focus the first error in the existing field order.
      check(Array.from($('#r-title').val().trim()).length>=3,'title','Use at least 3 characters for the item name.');
      check($('#r-date').val()<=refs.campus_today,'date','The event date cannot be in the future.');
      check(Array.from($('#r-clue').val().trim()).length>=8,'clue','Give at least 8 characters so Building Management can verify the owner.');
      if(firstInvalidField)U.revealField(fields[firstInvalidField]);
      return !firstInvalidField;
    }
    function buildReportForm(){
      const form=new FormData();
      const values={
        action:existing?'update':'create',
        ...(existing?{id:edit}:{}),
        type,
        title:$('#r-title').val().trim(),
        description:$('#r-description').val().trim(),
        category_id:$('#r-category').val(),
        location_id:$('#r-location').val(),
        location_detail:$('#r-detail').val().trim(),
        date:$('#r-date').val(),
        time:$('#r-time').val(),
        clue:$('#r-clue').val().trim(),
        keep_photo_ids:JSON.stringify(keepPublic),
        keep_ownership_ids:JSON.stringify(type==='LOST'&&$('#keep-proof').prop('checked')?savedProof:[])
      };
      if(visualEnabled&&publicUpload.files.length&&$('#visual-report-opt-in').prop('checked'))form.append('visual_opt_in','1');
      Object.entries(values).forEach(([key,value])=>form.append(key,value));
      publicUpload.append(form,'photos');
      if(type==='LOST')proofUpload.append(form,'ownershipPhotos');
      return form;
    }
    $('#report-form').on('submit',async function(event){
      event.preventDefault();
      if(sending||publicUpload.busy||proofUpload.busy)return;
      if(!validateReport())return;
      const form=buildReportForm();
      sending=true;
      $('#report-fields').prop('disabled',true);
      busy();
      $('#report-submit').text('Saving…');
      try{
        const result=await app.request('items.php',form);
        U.flash(existing?'Report changes saved.':type==='FOUND'?'Report submitted. ReFind suggests it to students with similar Lost reports.':'Report submitted. We will notify you about possible matches.');
        location.assign(U.itemUrl(result.id));
      }catch(e){
        $('#report-fields').prop('disabled',false);
        await U.formError(e,fields);
      }finally{
        sending=false;
        $('#report-fields').prop('disabled',false);
        busy();
        $('#report-submit').text(existing?'Save report changes':'Submit report');
      }
    });
    $('#report-form').prop('hidden',false);
    loading(false);
    document.body.dataset.ready='true';
  }
  async function loadLinkableLostReports(itemId){
    const busyLost=new Set(),lostReports=[];
    let batchPage=1,data;
    // Keep the two paginated reads sequential: eligibility depends on all active claims.
    do{
      data=await get('claims.php',{page:batchPage,limit:48});
      data.claims
        .filter(claim=>['PENDING','NEED_MORE_INFO'].includes(claim.claim_status)&&claim.item_id!==String(itemId)&&claim.related_lost_item_id)
        .forEach(claim=>busyLost.add(claim.related_lost_item_id));
      batchPage++;
    }while(batchPage<=data.pages);
    batchPage=1;
    do{
      data=await get('items.php',{mine:'1',type:'LOST',limit:'48',page:batchPage});
      lostReports.push(...data.items.filter(report=>
        !['RESOLVED','UNCLAIMED_CLOSED','HANDOVER'].includes(report.status_code)&&
        !report.matched_item_id&&!busyLost.has(report.item_id)
      ));
      batchPage++;
    }while(batchPage<=data.pages);
    return lostReports;
  }
  async function claimForm(){
    const id=params.get('id');
    if(!validId(id)){showMissing();return;}
    let item;try{item=(await get('items.php',{id})).item;}catch(e){failed(e);return;}
    $('#back-to-item').attr('href',U.itemUrl(id));
    const unavailable=(detail,extra)=>{$('#claim-unavailable').empty().append(U.empty('Claim unavailable',detail,U.itemUrl(id),'Back to item'));if(extra)$('#claim-unavailable').append(extra);$('#claim-unavailable').prop('hidden',false);loading(false);document.body.dataset.ready='true';};
    if(!item.can_claim){
      const own=item.own_claim,mine=String(item.reporter_user_id)===String(app.state.user?.id);
      let detail;
      if(own){
        detail={
          PENDING:'Your claim is waiting for review by Building Management.',
          APPROVED:'Your claim was approved. Pickup details are in My Activity.',
          REJECTED:'Your claim was rejected. A rejection is final for this item.'
        }[own.claim_status]||U.claimNames[own.claim_status];
      }else if(mine){
        detail='This is your own report, so you cannot claim it.';
      }else if(item.item_type!=='FOUND'){
        detail='Only Found reports can be claimed.';
      }else{
        detail='This item is already assigned or closed, so it cannot be claimed.';
      }
      const extra=own&&own.claim_status==='PENDING'?$('<button>').addClass('btn btn-danger-outline').attr('type','button').text('Withdraw claim').on('click',function(){requestWithdraw(id,async()=>{U.flash('Claim withdrawn. You can send a new claim for this item later.');location.reload();},this);}):null;
      unavailable(detail,extra);return;}
    const own=(await get('claims.php',{itemId:id})).claims[0]||null;
    const lost=await loadLinkableLostReports(id);
    U.fillSelect('#c-lost',lost.map(r=>({id:r.item_id,name:U.titleParts(r.title).display+' · '+r.location_name})),'No linked Lost report');$('#claim-target').append($('<h2>').attr('title',item.title).text(U.titleParts(item.title).display),U.demoChip(item.title),$('<p>').text(U.locationText(item)));let kept=(own?.ownership_photo_ids||[]).map(String),sending=false;
    const submitLabel=own?'Resubmit for review':'Submit claim';
    const upload=new PhotoUpload('#claim-upload',()=>2-($('#keep-claim-proof').prop('checked')?kept.length:0),()=>$('#claim-submit').prop('disabled',sending||upload.busy));
    if(own){$('#claim-heading').text('Update your claim');$('#c-answer').val(own.ownership_answer);$('#c-lost').val(lost.some(r=>r.item_id===own.related_lost_item_id)?own.related_lost_item_id:'');
      const asked=own.claim_status==='WITHDRAWN'?'You withdrew this claim earlier. Check the details and send it again.':own.review_note||'Add more identifying detail before submitting again.';
      $('#claim-review-note').empty().append($('<strong>').text(own.claim_status==='WITHDRAWN'?'Withdrawn claim':'Building Management asked:'),$('<p>').text(asked)).prop('hidden',false);
      $('#saved-claim-count').text(kept.length+' private supporting photos already saved.').prop('hidden',!kept.length);$('#saved-claim-choice').prop('hidden',!kept.length);if(kept.length)$('#claim-upload').closest('details').prop('open',true);
      if(own.can_withdraw)$('#claim-withdraw').prop('hidden',false).on('click',function(){requestWithdraw(id,async()=>{U.flash('Claim withdrawn.');location.assign(app.base+'my-reports.html?tab=claims');},this);});}
    else{const best=item.matches.find(m=>lost.some(r=>r.item_id===m.item_id));if(best){$('#c-lost').val(best.item_id);$('#linked-suggestion').text('Suggested because your Lost report "'+U.titleParts(best.title).display+'" looks similar. Change it if needed.').prop('hidden',false);}}
    $('#claim-submit').text(submitLabel);
    $('#keep-claim-proof').on('change',function(){if(this.checked&&kept.length+upload.files.length>2){this.checked=false;upload.status('Remove new images before restoring saved evidence.',true);}});
    $('#c-lost').on('change',()=>{const linked=lost.find(r=>r.item_id===$('#c-lost').val());$('#linked-evidence-note').text(linked?.ownership_photo_count?U.plural(linked.ownership_photo_count,'private Lost photo')+' available to Building Management through this link.':'');}).trigger('change');
    $('#claim-form').on('submit',async function(event){
      event.preventDefault();
      if(sending||upload.busy)return;
      U.clearErrors();
      const answer=$('#c-answer').val().trim();
      if(Array.from(answer).length<8){
        $('[data-error="answer"]').text('Provide at least 8 characters of identifying detail.').prop('hidden',false);
        $('#c-answer').attr('aria-invalid','true').trigger('focus');
        return;
      }
      const form=new FormData();
      const values={
        action:own?'resubmit':'submit',
        itemId:id,
        lostItemId:$('#c-lost').val(),
        answer,
        keep_photo_ids:JSON.stringify($('#keep-claim-proof').prop('checked')?kept:[])
      };
      Object.entries(values).forEach(([key,value])=>form.append(key,value));
      upload.append(form,'ownershipPhotos');
      sending=true;
      $('#claim-fields').prop('disabled',true);
      $('#claim-submit').prop('disabled',true).text('Submitting…');
      try{
        const result=await app.request('claims.php',form);
        U.flash(own?'Claim resubmitted for review. You will get a notification when Building Management decides.':'Claim submitted. You will get a notification when Building Management decides.');
        location.assign(app.base+'my-reports.html?tab=claims&claim='+result.id);
      }catch(e){
        $('#claim-fields').prop('disabled',false);
        await U.formError(e,{answer:'#c-answer',lostItemId:'#c-lost',ownershipPhotos:'#c-proof'});
      }finally{
        sending=false;
        $('#claim-fields').prop('disabled',false);
        $('#claim-submit').prop('disabled',false).text(submitLabel);
      }
    });
    $('#claim-form').prop('hidden',false);
    loading(false);
    document.body.dataset.ready='true';
  }
  async function activity(){
    let tab=['reports','claims','closed'].includes(params.get('tab'))?params.get('tab'):'reports',currentPage=1;
    // The deep-linked claim is shown once; later tab or page changes do not bring it back.
    let highlight=tab==='claims'&&validId(params.get('claim'))?params.get('claim'):null;
    function claimActivityCard(claim,pickup){
      const returned=pickup?.handover_status==='COMPLETED';
      const card=$('<article>').addClass('activity-card').attr('data-claim-id',claim.claim_id).append(
        U.stateChip(returned?'COMPLETED':claim.claim_status,returned?'Returned':U.claimNames[claim.claim_status]),
        $('<h2>').attr('title',claim.title).text(U.titleParts(claim.title).display),
        U.demoChip(claim.title),
        $('<p>').text('Submitted '+U.date(claim.created_at,true))
      );
      if(returned){
        card.append($('<p>').addClass('context-note pickup-summary').text('Returned'+(pickup.completed_at?' · '+U.date(pickup.completed_at,true):'')+(pickup.pickup_location?' · '+pickup.pickup_location:'')));
      }else if(pickup){
        // Only a scheduled appointment names a pickup place. Before that, the stored area is just where the item was
        // found, so it is not presented as a pickup location. The desk card is help/contact information only.
        const scheduled=pickup.handover_status==='SCHEDULED',late=U.pickupPastDue(pickup);
        card.append($('<p>').addClass('context-note pickup-summary').text(scheduled?'Your pickup · '+U.date(pickup.scheduled_at,true)+(pickup.pickup_location?' · '+pickup.pickup_location:''):'Approved. Building Management will arrange a pickup time and place with you. They appear here once scheduled.'));
        if(late)card.append($('<p>').addClass('past-due-note').text('This pickup time has passed. If you have not collected the item yet, contact Building Management to arrange a new time.'));
        card.append($('<div>').addClass('pickup-help').append($('<p>').text(scheduled?'Questions or need a different time? Contact Building Management:':'Questions about your pickup? Contact Building Management:'),U.deskCard(refs.pickup_desk)));
      }
      if(claim.claim_status==='REJECTED')card.append($('<p>').addClass('context-note').text('A rejected claim is final for this item.'));
      if(claim.review_note)card.append($('<details>').addClass('review-history').append($('<summary>').text('Review note'),$('<p>').text(claim.review_note)).prop('open',!returned));
      card.append($('<p>').text(U.plural(claim.ownership_photo_count,'private supporting photo')+' saved for Building Management.'));
      const actions=$('<div>').addClass('claim-actions').append(
        $('<a>').addClass('btn '+(claim.can_resubmit?'btn-primary':'btn-outline'))
          .attr('href',claim.can_resubmit?U.claimUrl(claim.item_id):U.itemUrl(claim.item_id))
          .text(claim.can_resubmit?(claim.claim_status==='WITHDRAWN'?'Claim again':'Update / resubmit claim'):returned?'View returned item':'View item')
      );
      if(claim.can_withdraw){
        actions.append($('<button>').addClass('text-button danger-text').attr('type','button').text('Withdraw claim').on('click',function(){
          requestWithdraw(claim.item_id,()=>load(currentPage),this);
        }));
      }
      return card.append(actions);
    }
    // The next thing a reporter can do for an active report, using data already in the list.
    function activityNext(item){
      const lost=item.item_type==='LOST',claimsTab=app.base+'my-reports.html?tab=claims';
      if(item.status_code==='HANDOVER')return lost?{text:'Ownership verified.',href:claimsTab,label:'See pickup details'}:{text:'Ownership verified. Building Management arranges the return with the owner.'};
      // An own Lost report that cannot be edited while Open/Possible match is linked to an active claim.
      if(lost&&!item.can_edit&&!item.matched_item_id&&['OPEN','POTENTIAL_MATCH'].includes(item.status_code))return {text:'',href:claimsTab,label:'Follow my claim'};
      if(item.status_code==='POTENTIAL_MATCH')return {text:lost?'A Found report may match yours.':'A Lost report may match. Building Management verifies any claim.',href:U.itemUrl(item.item_id)+'#match-section',label:lost?'Compare matches':'See similar reports'};
      if(item.status_code==='OPEN')return {text:lost?'No possible matches yet. You will get a notification when one is suggested.':'No possible matches yet.'};
      return null;
    }
    async function load(next=currentPage){currentPage=next;clearPage();loading(true);tabState('[data-activity]','data-activity',tab);const box=$('#activity-results').empty().toggleClass('activity-claims',tab==='claims');try{
      let focusTarget=null;const claimTarget=tab==='claims'?highlight:null;
      if(tab==='claims'){const data=await get('claims.php',{page:currentPage,limit:24}),handover=[];let pickupPage=1,pickups;do{pickups=await get('handovers.php',{page:pickupPage,limit:48});handover.push(...pickups.handovers);pickupPage++;}while(pickupPage<=pickups.pages);if(claimTarget&&!data.claims.some(c=>c.claim_id===claimTarget)){try{const specific=await get('claims.php',{id:claimTarget});data.claims.unshift(...specific.claims);}catch{}}
        if(data.total&&currentPage>data.pages)return load(data.pages);
        data.claims.forEach(claim=>{
          const pickup=handover.find(h=>h.claim_id===claim.claim_id);
          box.append(claimActivityCard(claim,pickup));
        });if(!data.claims.length)box.append(U.empty('No claims yet','Open an eligible Found report to submit ownership details.',app.base+'browse.html?type=FOUND','Explore Found reports'));$('#activity-count').text(U.plural(data.total,'claim'));U.pager(data,next=>{highlight=null;return load(next);},'#activity-count');
      }else{const data=await get('items.php',{mine:1,page:currentPage,limit:24,...(tab==='closed'?{closed:1}:{active:1})});
        if(data.total&&currentPage>data.pages)return load(data.pages);
        data.items.forEach(item=>{const card=U.card(item),step=tab==='reports'?activityNext(item):null;
          const index=item.visual_index;if(index&&(index.ready||index.pending||index.failed))card.find('.discovery-body').append($('<p>').addClass('card-meta visual-index-status').text('Photo indexing · '+index.ready+' searchable · '+index.pending+' pending · '+index.failed+' failed'));
          if(step){const line=$('<p>').addClass('card-next').text(step.text);if(step.href)line.append(step.text?' ':'',$('<a>').addClass('text-link').attr('href',step.href).text(step.label));card.find('.discovery-body').append(line);}
          // Delete stays available (with its confirmation) but no longer competes visually with Edit.
          if(item.can_edit)card.append($('<div>').addClass('own-report-actions').append(U.navAction('Edit report',app.base+'report.html?edit='+item.item_id),$('<button>').addClass('text-button danger-text btn-report-delete record-delete').attr('type','button').text('Delete').on('click',function(){requestDelete(item.item_id,()=>load(currentPage),this);})));else if(item.edit_locked_reason)card.find('.discovery-body').append($('<p>').addClass('small muted').text(item.edit_locked_reason));box.append(card);});if(!data.items.length)box.append(U.empty(tab==='closed'?'No closed reports':'No active reports','Your own reports appear here.',app.base+'report.html','Report an item'));$('#activity-count').text(U.plural(data.total,(tab==='closed'?'closed':'active')+' report'));U.pager(data,next=>load(next),'#activity-count');}
      history.replaceState(null,'',app.base+'my-reports.html?tab='+tab+(claimTarget?'&claim='+encodeURIComponent(claimTarget):''));
      if(claimTarget){const target=box.find('[data-claim-id]').filter(function(){return $(this).attr('data-claim-id')===claimTarget;});target.addClass('selected-claim').attr('tabindex','-1');focusTarget=target[0];}
      loading(false);document.body.dataset.ready='true';if(focusTarget)U.focusRecord(focusTarget);}catch(e){failed(e);}}
    $('[data-activity]').on('click',function(){tab=$(this).attr('data-activity');highlight=null;load(1);});bindRetry(load);await load();
  }
  async function notifications(){
    let currentPage=validPage(params.get('page')),restore=validId(params.get('notification'))?params.get('notification'):null,filter=params.get('filter')==='unread'?'unread':'';
    async function load(next=currentPage){currentPage=next;clearPage();loading(true);tabState('[data-note-filter]','data-note-filter',filter);
      try{const data=await get('notifications.php',{page:currentPage,limit:24,...(filter?{unread:'1'}:{})}),box=$('#notification-results').empty();let lastGroup='';
        if(data.total&&currentPage>data.pages)return load(data.pages);
        $('#mark-all-read').prop('hidden',!data.unread_count);
        let groupSection=null,groupIndex=0;
        for(const note of data.notifications){
          const group=U.campusDay(note.created_at)===U.campusDay()?'Today':'Earlier';
          if(group!==lastGroup){
            const groupId='notification-group-'+(++groupIndex);
            groupSection=$('<section>').addClass('notification-group').attr('aria-labelledby',groupId).append($('<h2>').addClass('notification-group-title').attr('id',groupId).text(group));
            box.append(groupSection);lastGroup=group;
          }
          const heading=$('<h3>').addClass('notification-title').attr({id:'notification-title-'+note.notification_id,tabindex:'-1'}).text(note.title);
          const titleLine=$('<div>').addClass('notification-title-line').append(heading);
          if(!Number(note.is_read))titleLine.append($('<span>').addClass('notification-unread').text('Unread'));
          const content=$('<div>').addClass('notification-content').append(titleLine);
          if(note.item_title){
            const context=$('<div>').addClass('notification-context').append($('<p>').addClass('notification-item').text(U.titleParts(note.item_title).display));
            const demo=U.titleParts(note.item_title).demo;if(demo)context.append($('<span>').addClass('notification-demo').text(demo));
            content.append(context);
          }
          content.append($('<p>').addClass('notification-message').text(note.pickup_event?U.pickupMessage(note.pickup_event,note.created_at):note.message));
          const card=$('<article>').addClass('notification-card').toggleClass('unread',!Number(note.is_read)).attr({'data-notification-id':note.notification_id,'aria-labelledby':heading.attr('id')}).append(content,$('<time>').addClass('notification-time').text(U.date(note.created_at,true)));
          const actions=$('<div>').addClass('notification-actions');
          const mark=async()=>{const result=await app.request('notifications.php',{id:note.notification_id});shell.setUnread(result.unread_count);note.is_read=1;card.removeClass('unread');card.find('.mark-read,.notification-unread').remove();$('#mark-all-read').prop('hidden',!result.unread_count);};
          if(!Number(note.is_read))actions.append($('<button>').addClass('text-button mark-read').attr('type','button').text('Mark as read').on('click',async function(){const button=$(this).prop('disabled',true);try{await mark();const destination=card.find('a.notification-destination').first();(destination.length?destination:heading).trigger('focus');}catch(e){U.showError(e);button.prop('disabled',false);}}));
          let target=null,label='View item';
          if(note.claim_id){if(app.state.user.role==='STUDENT'){target=app.base+'my-reports.html?tab=claims&claim='+note.claim_id;label=note.pickup_event?'View my pickup':'View my claim';}else if(note.notification_type?.startsWith('HANDOVER_')&&note.handover_id){target=app.base+'admin.html?tab=handover&handover='+note.handover_id;label='View handover';}else{target=app.base+'admin.html?tab=claims&claim='+note.claim_id;label='Review claim';}}
          else if(note.item_id)target=U.itemUrl(note.item_id)+'&'+new URLSearchParams({origin:'notifications',notification_page:currentPage,notification:note.notification_id});
          // Following an unread link marks it read first; modified clicks (new tab) stay native.
          if(target)actions.prepend($('<a>').addClass('text-link notification-destination').attr('href',target).text(label).on('click',async function(e){if(Number(note.is_read))return;if(e.ctrlKey||e.metaKey||e.shiftKey||e.button===1){mark().catch(()=>{});return;}e.preventDefault();try{await mark();}catch{}location.assign(target);}).on('auxclick',function(e){if(e.button===1&&!Number(note.is_read))mark().catch(()=>{});}));
          if(actions.children().length)card.append(actions);
          groupSection.append(card);
        }
        if(!data.notifications.length)box.append(filter?U.empty('No unread updates','You have read everything. Choose All to see earlier updates.'):U.empty('You are all caught up','Report and claim updates will appear here.'));
        const locationQuery=new URLSearchParams({...(filter?{filter}:{}),...((currentPage>1||restore)?{page:currentPage}:{}),...(restore?{notification:restore}:{})});
        history.replaceState(history.state,'',app.base+'notifications.html'+(locationQuery.size?'?'+locationQuery:''));
        U.pager(data,next=>load(next),'#notification-results');loading(false);document.body.dataset.ready='true';
        if(restore){U.focusRecord(box.find('[data-notification-id="'+restore+'"] .notification-title')[0]||box[0]);restore=null;}
      }catch(e){failed(e);}
    }
    $('#mark-all-read').on('click',async function(){const button=$(this).prop('disabled',true);try{const result=await app.request('notifications.php',{action:'read_all'});shell.setUnread(result.unread_count);await load(currentPage);U.notify('All notifications are marked as read.');$('#shell-feedback').trigger('focus');}catch(e){U.showError(e);}finally{button.prop('disabled',false);}});
    $('[data-note-filter]').on('click',function(){filter=$(this).attr('data-note-filter');restore=null;load(1);});
    bindRetry(load);await load();
  }
  async function historyPage(){
    // History is the archive of closed reports; active reports live in Explore.
    const views=['all','returned','unclaimed','lost','found'];let tab=views.includes(params.get('view'))?params.get('view'):'all',currentPage=validPage(params.get('page')),timer;
    $('#history-q').val(params.get('q')||'');
    async function load(next=currentPage){currentPage=next;clearPage();loading(true);tabState('[data-history]','data-history',tab);const values={q:$('#history-q').val().trim(),view:tab==='all'?'':tab,page:currentPage};
      try{const data=await get('items.php',{q:values.q,page:currentPage,closed:'1',...(['lost','found'].includes(tab)?{type:tab.toUpperCase()}:{}),...(tab==='returned'?{status:'RESOLVED'}:{}),...(tab==='unclaimed'?{status:'UNCLAIMED_CLOSED'}:{})});
        if(data.total&&currentPage>data.pages)return load(data.pages);
        $('#result-count').text(U.plural(data.total,'closed report'));showList('#history-results',data.items,'No history results','Try another view or search. Active reports are in Explore.');U.pager(data,next=>load(next),'#result-count');history.replaceState(null,'',app.base+'history.html'+(query(values)?'?'+query(values):''));loading(false);document.body.dataset.ready='true';}catch(e){failed(e);}}
    $('[data-history]').on('click',function(){tab=$(this).attr('data-history');load(1);});$('#history-q').on('input',()=>{clearTimeout(timer);timer=setTimeout(()=>load(1),200);});bindRetry(load);await load();}
  async function homeDiscovery(){if(app.state.user?.role!=='STUDENT')return;try{const data=await get('items.php',{limit:4,active:'1'});showList('#home-reports',data.items,'No reports yet','Create a Lost or Found report to get started.');}catch(e){$('#home-reports').empty().append(U.empty('Recent reports could not load','Refresh the page to try again.'));}$('#home-discovery').prop('hidden',false);document.body.dataset.studentReady='true';}
  try{const state=await shell.ready;U.showFlash();$('[data-student-only]').prop('hidden',state.user?.role!=='STUDENT');if(page==='home'){await homeDiscovery();return;}if(!state.authenticated)return;visualEnabled=state.visual_search_enabled===true;refs=await app.request('references.php');const controllers={browse:discovery,item:itemDetail,report:reportForm,claim:claimForm,'my-reports':activity,notifications,history:historyPage};if(controllers[page])await controllers[page]();}catch(e){failed(e);$('#retry-page').off('click.student').on('click.student',()=>location.reload());}
});
