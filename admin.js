/* Campus ROAM admin: offices and clubs post events; admins also post announcements,
   grant posting access and read pilot stats. Every permission is enforced in the
   database (row-level security); this page only shows what the account may do. */
(function(){
 const R=window.ROAM,esc=R.escape,D=R.data||{},C=D.campus||{};
 const $=s=>document.querySelector(s);
 const screen=$('#screen');
 const ORGS=[...new Set((D.orgs?.orgs||[]).map(o=>o.name))].sort((a,b)=>a.localeCompare(b));
 const INTERESTS=(C.interests||[]).map(i=>({id:i.id,label:i.label}));
 let user=null,isAdmin=false,myOrgs=[],tab='post',editing=null,editingAnn=null,armed=null,busy=false;

 const fmt=iso=>iso?`${R.niceDate(iso)} · ${R.time(iso)}`:'';
 const status=e=>{if(!e.published)return ['Draft','draftchip'];if(new Date(e.ends_at)<new Date())return ['Ended','endedchip'];return ['Live','livechip']};
 const say=(msg,kind='')=>{const n=$('#formMsg');if(n){n.textContent=msg;n.className='formmsg '+kind}else R.alert(msg)};
 const safeLink=v=>{v=(v||'').trim();if(!v)return null;if(!/^https:\/\/[^\s]+$/i.test(v))throw new Error('Links must start with https://');return v.slice(0,500)};

 function shell(inner){
  const tabs=[['post',editing?'Edit post':'New post'],['posts',isAdmin?'All posts':'My posts']];
  if(isAdmin)tabs.push(['ann','Announcements'],['access','Posting access'],['stats','Pilot stats']);
  screen.innerHTML=`<div class="adminhead"><h1>${isAdmin?'Admin':'Post to Campus ROAM'}</h1><p class="sub">Signed in as ${esc(user.email)}${isAdmin?' · admin':` · posting for ${myOrgs.map(esc).join(', ')}`}</p></div>
  <nav class="admintabs" aria-label="Admin sections">${tabs.map(([id,l])=>`<button type="button" data-tab="${id}" aria-current="${tab===id?'page':'false'}" class="${tab===id?'on':''}">${l}</button>`).join('')}</nav>
  <div id="pane">${inner}</div>`;
 }

 /* ---------- sign in ---------- */
 function renderSignIn(err=''){
  $('#signOut').hidden=true;
  screen.innerHTML=`<div class="panel narrow"><h1>Sign in to post</h1><p class="sub">Use the same email and password as your Campus ROAM account. Posting access is given by the ROAM team.</p>
  <form id="signin" novalidate><label class="field">School email<input name="email" type="email" autocomplete="username" required></label>
  <label class="field">Password<input name="password" type="password" autocomplete="current-password" required minlength="8"></label>
  <p id="formMsg" class="formmsg error" role="alert">${esc(err)}</p>
  <div class="btnrow"><button class="btn" type="submit">Sign in</button><a class="btn secondary" href="./">No account? Sign up in the app</a></div></form></div>`;
 }

 async function boot(){
  if(!R.client){screen.innerHTML=`<div class="panel narrow"><h1>Admin is not connected</h1><p class="sub">${R.libMissing?'The database library did not load. Check your connection and reload.':'This copy of Campus ROAM runs in local mode, so there is nothing to administer.'}</p></div>`;return}
  const s=await R.currentSession();
  if(!s){renderSignIn();return}
  user=s.user;$('#signOut').hidden=false;
  const [a,p]=await Promise.all([R.client.rpc('is_admin'),R.client.from('org_posters').select('organization').eq('user_id',user.id)]);
  isAdmin=!!a.data;myOrgs=(p.data||[]).map(x=>x.organization).sort();
  if(!isAdmin&&!myOrgs.length){screen.innerHTML=`<div class="panel narrow"><h1>No posting access yet</h1><p class="sub">You're signed in as <strong>${esc(user.email)}</strong>, but this account can't post yet.</p><p>Send this email address and the name of your office or organization to <strong>${esc(R.cfg.contactEmail||'the ROAM team')}</strong>. Once access is granted, reload this page.</p><div class="btnrow"><a class="btn secondary" href="./">Back to the app</a></div></div>`;return}
  render();
 }

 /* ---------- event form ---------- */
 function orgField(v){
  if(isAdmin)return `<label class="field">Posting as<input name="organization" list="orgList" required maxlength="200" value="${esc(v||'')}" placeholder="Office or organization name"><datalist id="orgList"><option value="Campus ROAM team">${ORGS.map(o=>`<option value="${esc(o)}">`).join('')}</datalist></label>`;
  return `<label class="field">Posting as<select name="organization" required>${myOrgs.map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;
 }
 async function renderPost(){
  let e={published:true,tags:[]};
  if(editing){const r=await R.client.from('campus_events').select('*').eq('id',editing).maybeSingle();if(r.data)e=r.data;else editing=null}
  shell(`<form id="eventForm" class="panel" novalidate>
   <h2>${editing?'Edit post':'Post an event or opportunity'}</h2>
   <p class="sub">It shows in students' For You feed, ranked by their major and interests. Saved events land on their day automatically.</p>
   ${orgField(e.organization||(isAdmin?'':myOrgs[0]))}
   <label class="field">Title<input name="title" required maxlength="200" value="${esc(e.title||'')}"></label>
   <div class="formgrid"><label class="field">Starts<input name="starts" type="datetime-local" required value="${e.starts_at?R.isoToLocalInput(e.starts_at):''}"></label>
   <label class="field">Ends<input name="ends" type="datetime-local" required value="${e.ends_at?R.isoToLocalInput(e.ends_at):''}"></label></div>
   <div class="formgrid"><label class="field">Location<input name="location" maxlength="200" value="${esc(e.location||'')}" placeholder="Russell Union 2084"></label>
   <label class="field">Link (optional)<input name="link" type="url" inputmode="url" maxlength="500" value="${esc(e.link||'')}" placeholder="https://"></label></div>
   <label class="field">Department (optional)<input name="department" maxlength="200" value="${esc(e.department||'')}" placeholder="Matches students in that department first"></label>
   <label class="field">Description<textarea name="description" rows="4" maxlength="1500">${esc(e.description||'')}</textarea></label>
   <details class="tagbox" ${(e.tags||[]).length?'open':''}><summary>Who is it for? <span>${(e.tags||[]).length?esc((e.tags||[]).map(t=>(INTERESTS.find(i=>i.id===t)||{}).label||t).join(', ')):'Pick up to 3 interests (optional)'}</span></summary><fieldset class="tagset"><legend class="sr">Interests</legend>${INTERESTS.map(i=>`<label class="tagpick"><input type="checkbox" name="tags" value="${esc(i.id)}" ${(e.tags||[]).includes(i.id)?'checked':''}> ${esc(i.label)}</label>`).join('')}</fieldset></details>
   <label class="check"><input type="checkbox" name="published" ${e.published?'checked':''}> Publish now (leave unchecked to save as a draft)</label>
   <p id="formMsg" class="formmsg" role="status"></p>
   <div class="btnrow"><button class="btn" type="submit">${editing?'Save changes':'Post it'}</button>${editing?'<button type="button" class="btn secondary" data-cancel="1">Cancel</button>':''}</div>
  </form>`);
 }
 async function saveEvent(f){
  const tags=[...f.querySelectorAll('[name=tags]:checked')].map(x=>x.value);
  if(tags.length>3)throw new Error('Pick up to 3 interests.');
  const starts=R.zonedToISO(f.starts.value),ends=R.zonedToISO(f.ends.value);
  if(!f.title.value.trim())throw new Error('Add a title.');
  if(!starts||!ends)throw new Error('Add a start and end time.');
  if(new Date(ends)<new Date(starts))throw new Error('The end time is before the start time.');
  const row={title:f.title.value.trim(),organization:f.organization.value.trim(),starts_at:starts,ends_at:ends,location:f.location.value.trim()||null,link:safeLink(f.link.value),department:f.department.value.trim()||null,description:f.description.value.trim()||null,tags,published:f.published.checked};
  if(!row.organization)throw new Error('Choose who you are posting as.');
  if(editing){R.check(await R.client.from('campus_events').update(row).eq('id',editing))}
  else{R.check(await R.client.from('campus_events').insert({...row,created_by:user.id}))}
  const was=!!editing;editing=null;tab='posts';await render();R.alert(was?'Changes saved.':row.published?'Posted. Students will see it in For You.':'Saved as a draft.');
 }

 /* ---------- posts list ---------- */
 async function renderPosts(){
  let q=R.client.from('campus_events').select('*').order('starts_at',{ascending:false}).limit(300);
  if(!isAdmin)q=q.eq('created_by',user.id);
  const list=R.check(await q)||[];
  shell(`<div class="panel"><h2>${isAdmin?'All posts':'My posts'}</h2>${list.length?list.map(e=>{const [t,c]=status(e);return `<div class="item row postrow"><div><h3>${esc(e.title)}</h3><p>${esc(e.organization||'')} · ${esc(fmt(e.starts_at))}${e.location?' · '+esc(e.location):''}</p></div><div class="btnrow"><span class="chip ${c}">${t}</span><button type="button" class="btn secondary small" data-edit="${e.id}">Edit</button><button type="button" class="btn secondary small" data-pub="${e.id}" data-to="${e.published?'0':'1'}">${e.published?'Unpublish':'Publish'}</button><button type="button" class="btn danger small" data-del="${e.id}">${armed===e.id?'Tap again to delete':'Delete'}</button></div></div>`}).join(''):'<div class="empty">Nothing posted yet. Your first post takes about a minute.</div>'}</div>`);
 }

 /* ---------- announcements (admin) ---------- */
 async function renderAnn(){
  const list=R.check(await R.client.from('announcements').select('*').order('created_at',{ascending:false}).limit(100))||[];
  let a={published:true};if(editingAnn)a=list.find(x=>x.id===editingAnn)||a;
  const endDefault=new Date(Date.now()+7*864e5).toISOString();
  shell(`<form id="annForm" class="panel" novalidate><h2>${editingAnn?'Edit announcement':'New announcement'}</h2><p class="sub">Shown at the top of every student's My Day until it expires. Keep it to one or two sentences.</p>
   <label class="field">Title<input name="title" required maxlength="200" value="${esc(a.title||'')}"></label>
   <label class="field">Message<textarea name="body" rows="3" maxlength="600">${esc(a.body||'')}</textarea></label>
   <div class="formgrid"><label class="field">Link (optional)<input name="link" type="url" maxlength="500" value="${esc(a.link||'')}" placeholder="https://"></label>
   <label class="field">Show until<input name="ends" type="datetime-local" required value="${R.isoToLocalInput(a.ends_at||endDefault)}"></label></div>
   <label class="check"><input type="checkbox" name="published" ${a.published?'checked':''}> Publish now</label>
   <p id="formMsg" class="formmsg" role="status"></p>
   <div class="btnrow"><button class="btn" type="submit">${editingAnn?'Save':'Publish announcement'}</button>${editingAnn?'<button type="button" class="btn secondary" data-cancelann="1">Cancel</button>':''}</div></form>
   <div class="panel"><h2>Announcements</h2>${list.length?list.map(x=>{const [t,c]=status(x);return `<div class="item row postrow"><div><h3>${esc(x.title)}</h3><p>Until ${esc(fmt(x.ends_at))}</p></div><div class="btnrow"><span class="chip ${c}">${t}</span><button type="button" class="btn secondary small" data-editann="${x.id}">Edit</button><button type="button" class="btn danger small" data-delann="${x.id}">${armed===x.id?'Tap again to delete':'Delete'}</button></div></div>`}).join(''):'<div class="empty">No announcements yet.</div>'}</div>`);
 }
 async function saveAnn(f){
  const ends=R.zonedToISO(f.ends.value);if(!f.title.value.trim())throw new Error('Add a title.');if(!ends)throw new Error('Choose when it stops showing.');
  const row={title:f.title.value.trim(),body:f.body.value.trim()||null,link:safeLink(f.link.value),ends_at:ends,published:f.published.checked};
  if(editingAnn)R.check(await R.client.from('announcements').update(row).eq('id',editingAnn));else R.check(await R.client.from('announcements').insert({...row,created_by:user.id}));
  editingAnn=null;await render();R.alert('Announcement saved.');
 }

 /* ---------- posting access (admin) ---------- */
 async function renderAccess(){
  const r=await R.client.rpc('list_posters');const list=R.check(r)||[];
  shell(`<form id="grantForm" class="panel" novalidate><h2>Give an office or club posting access</h2><p class="sub">They sign up in the student app first with their school email. Then add them here. They can post only for the organization you choose, and only edit their own posts.</p>
   <div class="formgrid"><label class="field">Their ROAM account email<input name="email" type="email" required autocomplete="off"></label>
   <label class="field">Organization or office<input name="org" list="orgList2" required maxlength="200"><datalist id="orgList2">${ORGS.map(o=>`<option value="${esc(o)}">`).join('')}</datalist></label></div>
   <p id="formMsg" class="formmsg" role="status"></p><div class="btnrow"><button class="btn" type="submit">Give access</button></div></form>
   <div class="panel"><h2>Who can post</h2>${list.length?list.map(p=>`<div class="item row postrow"><div><h3>${esc(p.organization)}</h3><p>${esc(p.email)}</p></div><div class="btnrow"><button type="button" class="btn danger small" data-revoke="${p.id}">${armed===p.id?'Tap again to remove':'Remove access'}</button></div></div>`).join(''):'<div class="empty">Only admins can post right now.</div>'}</div>`);
 }

 /* ---------- pilot stats (admin) ---------- */
 async function renderStats(){
  const since=new Date(Date.now()-7*864e5).toISOString();
  const [pr,ac,fb,sv,ev]=await Promise.all([
   R.client.from('profiles').select('id,onboarded,consent,created_at'),
   R.client.from('activity_events').select('user_id,action,feature,created_at').gte('created_at',new Date(Date.now()-30*864e5).toISOString()).limit(20000),
   R.client.from('pilot_feedback').select('message,rating,created_at').order('created_at',{ascending:false}).limit(30),
   R.client.from('pilot_surveys').select('phase,discovery,usefulness,created_at'),
   R.client.from('campus_events').select('id',{count:'exact',head:true}).eq('published',true)]);
  const P=R.check(pr)||[],A=R.check(ac)||[],F=R.check(fb)||[],S=R.check(sv)||[];
  const wk=A.filter(a=>a.created_at>=since);const active=new Set(wk.map(a=>a.user_id)).size;
  const byAction={};A.forEach(a=>byAction[a.action]=(byAction[a.action]||0)+1);
  const byFeature={};A.forEach(a=>{if(a.action==='tab_view')byFeature[a.feature]=(byFeature[a.feature]||0)+1});
  const avg=k=>{const v=S.map(s=>s[k]).filter(Number.isFinite);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):'–'};
  const target=R.cfg.target||70;
  const bar=(obj)=>{const e=Object.entries(obj).sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...e.map(x=>x[1]));return e.length?`<table class="stat"><tbody>${e.map(([k,v])=>`<tr><th scope="row">${esc(k.replace(/_/g,' '))}</th><td><span class="barfill" style="width:${Math.round(v/max*100)}%"></span></td><td class="num">${v}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No activity yet.</div>'};
  window.__roamCsv=[['metric','value'],['registered',P.length],['onboarded',P.filter(p=>p.onboarded).length],['consented',P.filter(p=>p.consent).length],['active_last_7_days',active],...Object.entries(byAction).map(([k,v])=>['action_30d:'+k,v]),['survey_discovery_avg',avg('discovery')],['survey_usefulness_avg',avg('usefulness')]];
  shell(`<div class="kpis">
   <div class="panel kpi"><span>Signed up</span><strong>${P.length}</strong><small>of ${target} target</small></div>
   <div class="panel kpi"><span>Finished setup</span><strong>${P.filter(p=>p.onboarded).length}</strong><small>chose major and interests</small></div>
   <div class="panel kpi"><span>Active this week</span><strong>${active}</strong><small>used the app in the last 7 days</small></div>
   <div class="panel kpi"><span>Live posts</span><strong>${ev.count??0}</strong><small>published by staff and clubs</small></div></div>
   <div class="panel"><h2>Most used screens <small class="sub">last 30 days</small></h2>${bar(byFeature)}</div>
   <div class="panel"><h2>Actions <small class="sub">last 30 days</small></h2>${bar(byAction)}</div>
   <div class="panel"><h2>Surveys</h2><p>${S.length} responses · finding things ${avg('discovery')}/5 · usefulness ${avg('usefulness')}/5</p></div>
   <div class="panel"><h2>Latest feedback</h2>${F.length?F.map(f=>`<div class="item"><p>${esc(f.message)}</p><p class="sub">${f.rating?f.rating+'/5 · ':''}${esc(R.niceDate(f.created_at))}</p></div>`).join(''):'<div class="empty">No feedback yet.</div>'}</div>
   <div class="btnrow"><button type="button" class="btn secondary" data-csv="1">Download summary (CSV)</button></div>
   <p class="sub">Usage is counted only for students who consented. Numbers are feature counts, never message contents or locations.</p>`);
 }

 async function render(){
  try{
   if(tab==='post')await renderPost();else if(tab==='posts')await renderPosts();
   else if(isAdmin&&tab==='ann')await renderAnn();else if(isAdmin&&tab==='access')await renderAccess();else if(isAdmin&&tab==='stats')await renderStats();
   else{tab='post';await renderPost()}
  }catch(e){shell(`<div class="panel"><p class="formmsg error" role="alert">Couldn't load this section: ${esc(R.formatErr(e))}</p></div>`)}
 }

 /* ---------- events ---------- */
 document.addEventListener('submit',async ev=>{
  const f=ev.target;if(!['signin','eventForm','annForm','grantForm'].includes(f.id))return;ev.preventDefault();if(busy)return;busy=true;
  const btn=f.querySelector('[type=submit]');if(btn)btn.disabled=true;
  try{
   if(f.id==='signin'){const r=await R.client.auth.signInWithPassword({email:f.email.value.trim(),password:f.password.value});if(r.error)throw r.error;await boot()}
   else if(f.id==='eventForm')await saveEvent(f);
   else if(f.id==='annForm')await saveAnn(f);
   else if(f.id==='grantForm'){R.check(await R.client.rpc('grant_poster',{p_email:f.email.value,p_org:f.org.value}));await render();R.alert('Access given. They can post after reloading the admin page.')}
  }catch(e){say(R.formatErr(e),'error')}
  finally{busy=false;if(btn&&document.body.contains(btn))btn.disabled=false}
 });
 document.addEventListener('click',async ev=>{
  const b=ev.target.closest('button,[data-tab]');if(!b)return;const d=b.dataset;
  try{
   if(b.id==='signOut'){await R.client.auth.signOut();user=null;renderSignIn();return}
   if(d.tab){tab=d.tab;editing=null;editingAnn=null;armed=null;await render();return}
   if(d.cancel){editing=null;tab='posts';await render();return}
   if(d.cancelann){editingAnn=null;await render();return}
   if(d.edit){editing=d.edit;tab='post';await render();return}
   if(d.editann){editingAnn=d.editann;await render();return}
   if(d.pub){R.check(await R.client.from('campus_events').update({published:d.to==='1'}).eq('id',d.pub));await render();return}
   const del=d.del||d.delann||d.revoke;
   if(del){if(armed!==del){armed=del;await render();return}armed=null;
    if(d.del)R.check(await R.client.from('campus_events').delete().eq('id',del));
    if(d.delann)R.check(await R.client.from('announcements').delete().eq('id',del));
    if(d.revoke)R.check(await R.client.from('org_posters').delete().eq('id',del));
    await render();R.alert('Removed.');return}
   if(d.csv){const csv=(window.__roamCsv||[]).map(r=>r.map(R.csvCell).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`roam-pilot-summary-${R.localDay()}.csv`;document.body.appendChild(a);a.click();a.remove();return}
  }catch(e){R.alert(R.formatErr(e))}
 });
 document.addEventListener('change',ev=>{if(ev.target.name==='tags'){const f=ev.target.form;const n=f.querySelectorAll('[name=tags]:checked').length;if(n>3){ev.target.checked=false;say('Pick up to 3 interests.','error')}}});
 if(R.client)R.client.auth.onAuthStateChange(e=>{if(e==='SIGNED_OUT'){user=null;renderSignIn()}});
 boot();
})();
