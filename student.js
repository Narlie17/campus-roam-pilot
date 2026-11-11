/* Campus Roam Pilot Run — student app, class-first.
   Tabs: My Day (classes + gap plan) · For You (interest matches) · Major (field hub) · Campus (activities + orgs).
   Settings (gear) holds profile, interests, check-ins, feedback, quick links, help and privacy. */
(async function(){
 const R=window.ROAM,$=s=>document.querySelector(s),esc=R.escape;
 const D=R.data||{campus:{interests:[],interestGroups:[],places:[],resources:[],dates:[],terms:[],transit:[],help:[],hiddenGems:[],campuses:[],meta:{sources:{}}},academics:{majors:[],colleges:[],quickLinks:[],advisingLinks:[]},events:{events:[]},orgs:{orgs:[]},news:{colleges:{}}};
 const C=D.campus,A=D.academics;
 const INTERESTS=C.interests||[];const IMAP=Object.fromEntries(INTERESTS.map(i=>[i.id,i]));const PRIVATE=new Set(INTERESTS.filter(i=>i.private).map(i=>i.id));
 const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];const DC=['Su','Mo','Tu','We','Th','Fr','Sa'];
 const YEARS=C.years?.length?C.years:['First year','Sophomore','Junior','Senior','Graduate'];
 const CAMPUSES=C.campuses?.length?C.campuses:[{id:'statesboro',name:'Statesboro'}];
 const ENGAGE=(C.meta?.sources?.engageBase||D.orgs?.base||'').replace(/\/$/,'');
 let user=null,profile=null,classes=[],adminEvents=[],publicEvents=[],follows=[],saved=[],savedPublic=[],hidden=[],announcements=[],surveys=[],tab='today',authMode='signup',interestSet=new Set(),browseMajor=null,recovery=false,newIds=new Set(),installEvt=null;
 const initialRecovery=/type=recovery/.test(location.hash);
 const ui={day:null,fy:'all',camp:'events',campWhen:'week',campCat:'all',q:'',orgQ:'',manage:false};

 /* ---------- helpers ---------- */
 const status=(t,k='')=>`<div class="notice ${k}">${esc(t)}</div>`;
 const fmtTime=t=>{if(!t)return '';const [h,m]=t.slice(0,5).split(':').map(Number);return new Date(2026,0,1,h,m).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})};
 const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
 const hm=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
 const dur=m=>m>=60?`${Math.floor(m/60)}h${m%60?` ${m%60}m`:''}`:`${m}m`;
 const validURL=u=>{try{const a=new URL(u);return ['https:','http:'].includes(a.protocol)?a.href:'#'}catch{return '#'}};
 const ext=(h,l,c='btn ghost sm',a='')=>`<a class="${c}" target="_blank" rel="noopener noreferrer" href="${esc(validURL(h))}" ${a}>${esc(l)} ↗</a>`;
 const myCampus=()=>profile?.campus||CAMPUSES[0].id;
 const campusName=id=>(CAMPUSES.find(c=>c.id===id)||{}).name||'';
 const majorObj=n=>A.majors.find(m=>m.name===n)||null;
 const collegeObj=id=>A.colleges.find(c=>c.id===id)||null;
 const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
 const daysBetween=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);
 const dowOf=d=>new Date(d+'T12:00:00').getDay();
 const today=()=>R.localDay();
 const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};
 const privKey=()=>`roam-private-interests-${user?.id||'local'}`;
 const myInterests=()=>[...new Set([...(profile?.interests||[]),...ls.get(privKey(),[])])];
 const iLabel=id=>IMAP[id]?.label||id;
 const hash=async s=>{try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('roam-local:'+s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch{return 'plain:'+s}};
 const busy=(f,on)=>f?.querySelectorAll('button[type=submit],button:not([type])').forEach(b=>b.disabled=on);
 const ask=(message,{typed=null,ok='Confirm',danger=false}={})=>new Promise(res=>{const w=document.createElement('div');w.className='modalwrap';w.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><p>${esc(message)}</p>${typed?`<label class="field">Type ${esc(typed)} to confirm<input id="askInput" autocomplete="off"></label>`:''}<div class="btns"><button type="button" class="btn ${danger?'danger':''}" data-ask="ok">${esc(ok)}</button><button type="button" class="btn ghost" data-ask="no">Cancel</button></div></div>`;document.body.appendChild(w);const inp=w.querySelector('#askInput');(inp||w.querySelector('[data-ask=ok]')).focus();w.addEventListener('click',e=>{const b=e.target.closest('[data-ask]');if(!b&&e.target!==w)return;e.stopPropagation();const yes=b?.dataset.ask==='ok'&&(!typed||inp.value.trim()===typed);if(b?.dataset.ask==='ok'&&typed&&!yes){inp.focus();return}w.remove();res(!!yes)})});

 /* ---------- calendar ---------- */
 function termStatus(day){
  for(const t of C.terms||[]){
   if(day<t.classesStart||day>t.finalsEnd)continue;
   const mk=(t.makeup||[]).find(m=>m.date===day);
   if(mk)return {term:t,kind:'makeup',label:mk.label,classes:true,weekday:{Mo:'Monday',Tu:'Tuesday',We:'Wednesday',Th:'Thursday',Fr:'Friday'}[mk.follows]||null};
   const off=(t.noClass||[]).find(([a,b])=>day>=a&&day<=b);
   if(off){const d=(C.dates||[]).find(x=>x.kind==='holiday'&&x.date<=day&&(x.end||x.date)>=day);return {term:t,kind:'break',label:d?.title||'No classes',classes:false}}
   if(day>=t.finalsStart)return {term:t,kind:'finals',label:`${t.name} finals week`,classes:false};
   if(day>t.classesEnd)return {term:t,kind:'between',label:`Classes are over — finals start ${R.prettyDate(t.finalsStart)}`,classes:false};
   return {term:t,kind:'classes',label:`${t.name} · week ${Math.floor(daysBetween(t.classesStart,day)/7)+1}`,classes:true};
  }
  const next=(C.terms||[]).find(t=>t.classesStart>day);
  return {term:next,kind:'off',label:next?`Between terms — ${next.name} starts ${R.prettyDate(next.classesStart)}`:'Between terms',classes:false};
 }
 /* ---------- hours ---------- */
 function hoursFor(p,dow){for(const [k,v] of Object.entries(p.hours||{})){const hit=k.split(',').some(part=>{const [a,b]=part.trim().split('-');const ia=DC.indexOf(a),ib=b?DC.indexOf(b):ia;if(ia<0)return false;return ia<=ib?dow>=ia&&dow<=ib:dow>=ia||dow<=ib});if(hit)return v.split(',').map(r=>{const [s,e]=r.split('-');return [mins(s),mins(e)]})}return null}
 const openDuring=(p,dow,s,e,need=20)=>{const r=hoursFor(p,dow);return !!r&&r.some(([a,b])=>Math.min(b,e)-Math.max(a,s)>=need)};
 const hoursText=(p,dow)=>{const r=hoursFor(p,dow);return r?r.map(([s,e])=>`${fmtTime(hm(s))}–${fmtTime(hm(e))}`).join(', '):'Closed'};
 const placesOn=cat=>(C.places||[]).filter(p=>p.category===cat&&p.campus===myCampus());

 /* ---------- events ---------- */
 const mapTags=tags=>{const out=new Set();for(const t of tags||[]){const low=String(t).toLowerCase();if(IMAP[low]){out.add(low);continue}for(const i of INTERESTS){if(i.label.toLowerCase()===low||i.label.toLowerCase().includes(low)||(i.keywords||[]).includes(low))out.add(i.id)}}return [...out]};
 const fromAdmin=e=>({id:e.id,title:e.title,start:e.starts_at,end:e.ends_at,location:e.location,url:e.link,source:'roam',tags:mapTags(e.tags),org:e.organization||'',dept:e.department||'',desc:e.description||'',campus:'',colleges:[]});
 const allEvents=()=>{const now=Date.now();return [...adminEvents.map(fromAdmin),...publicEvents].filter(e=>new Date(e.end||e.start).getTime()>now&&!hidden.includes(e.id))};
 const isSaved=e=>e.source==='roam'?saved.includes(e.id):savedPublic.includes(e.id);
 const mj=()=>majorObj(profile?.major);
 const fieldMatch=e=>{const m=mj();if(!m)return false;if((e.colleges||[]).includes(m.college))return true;const col=collegeObj(m.college);const words=[m.name.replace(/\s*\(.*\)/,'').toLowerCase(),...(col?.keywords||[]).map(k=>k.toLowerCase())];const txt=(e.title+' '+(e.org||'')+' '+(e.dept||'')).toLowerCase();return words.some(w=>w.length>3&&txt.includes(w))};
 const interestHits=e=>(e.tags||[]).filter(t=>myInterests().includes(t));
 function score(e){let s=interestHits(e).length*3;if(fieldMatch(e))s+=3;if(follows.some(f=>f.kind==='organization'&&f.name===e.org))s+=4;if(follows.some(f=>f.kind==='department'&&f.name===e.dept))s+=4;if(e.campus&&e.campus!==myCampus())s-=3;if(e.source==='roam')s+=1;return s}
 const ranked=l=>[...l].sort((a,b)=>score(b)-score(a)||String(a.start).localeCompare(String(b.start)));
 const whyText=e=>{const p=[];const h=interestHits(e);if(h.length)p.push(`matches <b>${h.slice(0,2).map(iLabel).map(esc).join(', ')}</b>`);if(fieldMatch(e))p.push('in your field');if(follows.some(f=>f.name===e.org))p.push(`you follow <b>${esc(e.org)}</b>`);if(fitsAGap(e))p.push('fits a break in your classes');return p.join(' · ')};
 const gcal=e=>{const f=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const end=e.end||new Date(new Date(e.start).getTime()+3600000).toISOString();return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(e.title)+'&dates='+f(e.start)+'/'+f(end)+'&location='+encodeURIComponent(e.location||'')+'&details='+encodeURIComponent((e.url?e.url+'\n\n':'')+'Found on Campus Roam')};
 const whenText=e=>{const d=R.dayOf(e.start);const n=daysBetween(today(),d);const lbl=n===0?'Today':n===1?'Tomorrow':R.niceDate(e.start);return `${lbl} · ${e.allDay?'All day':R.time(e.start)}`};
 function evCard(e,{why=true,hide=true}={}){const sv=isSaved(e);const w=why?whyText(e):'';return `<article class="ev"><div class="when">${esc(whenText(e))}${newIds.has(e.id)?' · <span style="color:var(--green)">NEW</span>':''}</div><h3>${esc(e.title)}</h3><div class="where">${esc(e.location||'Location TBA')}${e.org?' · '+esc(e.org):''}</div>${w?`<div class="why">Why it's here: ${w}</div>`:''}<div class="row"><div>${(e.tags||[]).slice(0,2).map(t=>`<span class="pill">${esc(iLabel(t))}</span>`).join('')}</div><div class="acts"><button class="mini ${sv?'on':''}" data-save="${esc(e.id)}" aria-label="${sv?'Saved':'Save'}">${sv?'★':'☆'}</button><a class="mini" href="${esc(gcal(e))}" target="_blank" rel="noopener noreferrer" data-gcal="1" aria-label="Add to Google Calendar">📅</a>${e.url?`<a class="mini" href="${esc(validURL(e.url))}" target="_blank" rel="noopener noreferrer" data-eventlink="1" aria-label="Event page">↗</a>`:''}${hide?`<button class="mini" data-hide="${esc(e.id)}" aria-label="Not for me">✕</button>`:''}</div></div></article>`}

 /* ---------- classes & plan ---------- */
 const classesOn=day=>{const st=termStatus(day);if(!st.classes)return [];const wd=st.weekday||DAYS[dowOf(day)];return classes.filter(c=>c.weekday===wd).sort((a,b)=>a.start_time.localeCompare(b.start_time))};
 const gapsOn=day=>{const s=classesOn(day),out=[];for(let i=0;i<s.length-1;i++){const span=mins(s[i+1].start_time)-mins(s[i].end_time);if(span>=25)out.push({start:s[i].end_time.slice(0,5),end:s[i+1].start_time.slice(0,5),span,after:s[i],before:s[i+1]})}return out};
 const eventsOn=day=>allEvents().filter(e=>R.dayOf(e.start)===day&&!e.allDay&&(!e.campus||e.campus===myCampus()));
 const overlapMins=(e,s,en)=>Math.min(mins(R.hmOf(e.end||e.start)),en)-Math.max(mins(R.hmOf(e.start)),s);
 function fitsAGap(e){const d=R.dayOf(e.start);if(daysBetween(today(),d)<0||daysBetween(today(),d)>6||e.allDay)return false;return gapsOn(d).some(g=>overlapMins(e,mins(g.start),mins(g.end))>=20)}
 function planFor(g,day){
  const gs=mins(g.start),ge=mins(g.end),dow=dowOf(day);
  const evs=ranked(eventsOn(day).filter(e=>overlapMins(e,gs,ge)>=20));
  const meal=(gs<=13*60+30&&ge>=11*60)||(gs<=19*60&&ge>=17*60)||g.span>=75;
  const dining=placesOn('dining').filter(p=>openDuring(p,dow,gs,ge,25));
  const study=[...placesOn('study'),...(C.resources||[]).filter(r=>/success center|writing center/i.test(r.name)).map(r=>({name:r.name,url:r.url}))];
  const picks=[];
  if(evs[0])picks.push({k:'GO',cls:'',t:evs[0].title,d:`${R.time(evs[0].start)} · ${evs[0].location||'TBA'}`,ev:evs[0]});
  if(meal&&dining[0])picks.push({k:'EAT',cls:'eat',t:dining[0].name,d:`${dining[0].where||''} · ${hoursText(dining[0],dow)}`,link:dining[0].links?.[0]?.url});
  if(g.span>=45&&study[0])picks.push({k:'STUDY',cls:'study',t:study[0].name,d:study[0].where||'Quiet space & free tutoring',link:study[0].links?.[0]?.url||study[0].url});
  if(!picks.length)picks.push({k:'BREAK',cls:'study',t:g.span>=60?'Recharge, eat or study':'Short break before your next class',d:''});
  return {picks,more:evs.slice(1,4)};
 }
 const pickRow=p=>`<div class="pick"><span class="k ${p.cls}">${p.k}</span><div><b>${esc(p.t)}</b>${p.d?`<span>${esc(p.d)}</span>`:''}</div>${p.ev?`<button class="mini ${isSaved(p.ev)?'on':''}" data-save="${esc(p.ev.id)}">${isSaved(p.ev)?'★':'☆'}</button>`:p.link?`<a class="mini" href="${esc(validURL(p.link))}" target="_blank" rel="noopener noreferrer">↗</a>`:''}</div>`;
 const overlaps=en=>classes.find(c=>c.weekday===en.weekday&&en.start_time<c.end_time.slice(0,5)&&en.end_time>c.start_time.slice(0,5));

 /* ---------- data ---------- */
 const getUser=async()=>{if(R.client){const {data:{user:u},error}=await R.client.auth.getUser();return error||!u?null:u}const d=R.demo.load();return d.account?{id:d.account.id,email:d.account.email}:null};
 async function getProfile(){if(R.client)return R.check(await R.client.from('profiles').select('*').eq('id',user.id).maybeSingle());return R.demo.load().profile}
 async function upsertProfile(p){if(p.interests){ls.set(privKey(),p.interests.filter(i=>PRIVATE.has(i)));p={...p,interests:p.interests.filter(i=>!PRIVATE.has(i))}}if(R.client)R.check(await R.client.from('profiles').update(p).eq('id',user.id).select().single());else{const d=R.demo.load();d.profile={...d.profile,...p};R.demo.save(d)}}
 async function loadPublicEvents(){publicEvents=(D.events?.events||[]).map(e=>({...e,source:e.source||'calendar'}));if(R.cfg.liveEventsUrl){try{const r=await fetch(R.cfg.liveEventsUrl,{cache:'no-store'});if(r.ok){const j=await r.json();if(Array.isArray(j.events)&&j.events.length)publicEvents=j.events}}catch{}}}
 async function load(){
  if(R.client){const iso=new Date().toISOString();const res=await Promise.all([R.client.from('class_schedule').select('*').eq('user_id',user.id).order('start_time'),R.client.from('campus_events').select('*').eq('published',true).gte('ends_at',iso).order('starts_at').limit(250),R.client.from('follows').select('*').eq('user_id',user.id),R.client.from('saved_events').select('*').eq('user_id',user.id),R.client.from('announcements').select('*').eq('published',true).gte('ends_at',iso).order('created_at',{ascending:false}),R.client.from('pilot_surveys').select('phase,created_at').eq('user_id',user.id).order('created_at',{ascending:false}),R.client.from('saved_public_events').select('event_key').eq('user_id',user.id)]);const [cl,ev,fo,sa,an,su]=res.slice(0,6).map(R.check);classes=cl||[];adminEvents=ev||[];follows=fo||[];saved=(sa||[]).map(x=>x.event_id);announcements=an||[];surveys=su||[];savedPublic=res[6].error?[]:(res[6].data||[]).map(x=>x.event_key)}
  else{const d=R.demo.load();classes=d.schedules||[];adminEvents=(d.events||[]).filter(x=>x.published&&new Date(x.ends_at)>new Date());follows=d.follows||[];saved=d.saved||[];savedPublic=d.savedPublic||[];announcements=(d.announcements||[]).filter(x=>x.published&&new Date(x.ends_at)>new Date());surveys=(d.survey||[]).slice().reverse()}
  hidden=ls.get(`roam-hidden-${user.id}`,[]);
 }
 function computeNew(){const k=`roam-seen-${user.id}`;const seen=ls.get(k,null);const up=allEvents();newIds=new Set(seen?up.filter(e=>score(e)>=3&&!seen.includes(e.id)).map(e=>e.id):[]);ls.set(k,up.map(e=>e.id).slice(-800))}
 function surveyDue(){const has=p=>surveys.some(s=>s.phase===p);if(!has('baseline'))return {phase:'baseline',label:'Starting check-in'};if((R.daysLeft()<=7||R.pilotOver())&&!has('exit'))return {phase:'exit',label:'Final check-in'};const last=surveys.find(s=>s.phase==='weekly'||s.phase==='baseline');const since=last?daysBetween(R.dayOf(last.created_at),today()):99;return since>=6&&!R.pilotOver()?{phase:'weekly',label:'Weekly check-in'}:null}

 /* ---------- auth & onboarding ---------- */
 function authShow(){
  ['app','onboarding','nav'].forEach(s=>$('#'+s).classList.add('hidden'));$('#auth').classList.remove('hidden');
  const closed=R.cfg.closeSignupsAfterEnd&&R.pilotOver();if(closed&&authMode==='signup')authMode='signin';
  $('#authTitle').textContent={signup:'Join the pilot',signin:'Welcome back',forgot:'Reset your password',recover:'Choose a new password'}[authMode];
  $('#signupFields').classList.toggle('hidden',authMode!=='signup');$('#emailField').classList.toggle('hidden',authMode==='recover');$('#passwordField').classList.toggle('hidden',authMode==='forgot');
  const f=$('#authForm');f.elements.email.required=authMode!=='recover';f.elements.password.required=authMode!=='forgot';f.elements.password.autocomplete=authMode==='signin'?'current-password':'new-password';
  $('#authSubmit').textContent={signup:'Create my account',signin:'Sign in',forgot:'Email me a reset link',recover:'Save new password'}[authMode];
  $('#authToggle').textContent=authMode==='signup'?'Already joined? Sign in':'New here? Create an account';$('#authToggle').classList.toggle('hidden',closed&&authMode==='signin');$('#forgotLink').classList.toggle('hidden',authMode!=='signin');
  let n='';if(R.libMissing)n=status('Roam could not reach its sign-in service. Check your connection and reload.','error');else if(!R.configured)n=status('Your account and schedule are saved on this phone. Use a password you don\'t use elsewhere.','warning');if(closed)n+=status(`The pilot ended ${R.prettyDate(R.cfg.pilotEnd)}. New sign-ups are closed.`);$('#authNotice').innerHTML=n;if(R.libMissing)$('#authSubmit').disabled=true;
 }
 function interestButtons(){const groups=C.interestGroups?.length?C.interestGroups:[...new Set(INTERESTS.map(i=>i.group))];return groups.map(g=>{const it=INTERESTS.filter(i=>i.group===g);return it.length?`<div class="pillgroup"><div class="sub">${esc(g)}</div>${it.map(x=>`<button class="pillselect ${interestSet.has(x.id)?'selected':''}" data-interest="${esc(x.id)}" type="button" aria-pressed="${interestSet.has(x.id)}">${esc(x.label)}${x.private?' 🔒':''}</button>`).join('')}</div>`:''}).join('')+`<p class="sub">🔒 stays only on this phone.</p>`}
 const majorOptions=sel=>`<option value="">Choose a major</option>${A.colleges.map(c=>{const ms=A.majors.filter(m=>m.college===c.id);return ms.length?`<optgroup label="${esc(c.short||c.name)}">${ms.map(m=>`<option ${m.name===sel?'selected':''}>${esc(m.name)}</option>`).join('')}</optgroup>`:''}).join('')}`;
 const yearOptions=sel=>`<option value="">Select</option>${YEARS.map(y=>`<option ${y===sel?'selected':''}>${esc(y)}</option>`).join('')}`;
 const campusOptions=sel=>CAMPUSES.map(c=>`<option value="${esc(c.id)}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join('');
 function onboardShow(){['auth','app','nav'].forEach(s=>$('#'+s).classList.add('hidden'));$('#onboarding').classList.remove('hidden');interestSet=new Set(myInterests());const f=$('#onboardForm');f.elements.first_name.value=profile?.first_name||'';f.elements.major.innerHTML=majorOptions(profile?.major);f.elements.year.innerHTML=yearOptions(profile?.year);f.elements.campus.innerHTML=campusOptions(profile?.campus||CAMPUSES[0].id);$('#interestChoices').innerHTML=interestButtons()}
 const signedOut=()=>{user=null;profile=null;R.setTracking(null,false);authShow()};
 function boot(){['auth','onboarding'].forEach(x=>$('#'+x).classList.add('hidden'));$('#app').classList.remove('hidden');$('#nav').classList.remove('hidden');R.setTracking(user.id,profile.consent);computeNew();const h=location.hash.slice(1);switchTab(['today','foryou','major','campus','settings'].includes(h)?h:'today');R.track('app_open','app')}
 function switchTab(next){tab=next;document.querySelectorAll('#tabs [data-tab]').forEach(b=>{b.classList.toggle('on',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false')});try{history.replaceState(null,'','#'+tab)}catch{}render();window.scrollTo({top:0});R.track('tab_view',next)}

 /* ---------- My Day ---------- */
 function renderToday(){
  const day=ui.day||today();const isToday=day===today();const st=termStatus(day);const s=classesOn(day);const g=gapsOn(day);const now=R.nowHM();
  const hr=Number(now.slice(0,2));$('#topTitle').textContent='ROAM';
  if(ui.manage)return renderManage();
  // status hero (today only)
  let hero='';
  if(isToday){
   const cur=s.find(c=>c.start_time.slice(0,5)<=now&&c.end_time.slice(0,5)>now);const nxt=s.find(c=>c.start_time.slice(0,5)>now);const gap=g.find(x=>x.start<=now&&now<x.end);
   let k,big,sub;
   if(cur){k='In class now';big=`${cur.course_code} until ${fmtTime(cur.end_time)}`;sub=cur.building?`${cur.building} ${cur.room||''}`:''}
   else if(gap){const left=mins(gap.end)-mins(now);k='Free right now';big=`You're free for ${dur(left)}.`;sub='Roam keeps time to get to your next class.'}
   else if(nxt){const left=mins(nxt.start_time)-mins(now);k='Before your first class';big=left<=90?`${nxt.course_code} in ${dur(left)}.`:`First class at ${fmtTime(nxt.start_time)}.`;sub=''}
   else if(s.length){k='Classes done';big='You\'re done for today.';sub='See what\'s on after class below.'}
   else{k=st.classes?'No classes today':st.label;big=classes.length?'Open day.':'Add your classes.';sub=classes.length?'Nothing fixed today — check For You for what\'s on.':'Your schedule is the core of Roam.'}
   hero=`<div class="status"><div class="kicker">${esc(k)}</div><div class="big">${esc(big)}</div>${sub?`<div class="sub">${esc(sub)}</div>`:''}${nxt&&!cur?'':nxt?`<div class="next"><div><span class="sub">Next class</span><b>${esc(nxt.course_code)}${nxt.course_name?' · '+esc(nxt.course_name):''}</b><span class="sub">${esc(fmtTime(nxt.start_time))} · ${esc(nxt.building||'TBA')} ${esc(nxt.room||'')}</span></div></div>`:''}${!cur&&nxt?`<div class="next"><div><span class="sub">Next class</span><b>${esc(nxt.course_code)}${nxt.course_name?' · '+esc(nxt.course_name):''}</b><span class="sub">${esc(fmtTime(nxt.start_time))} · ${esc(nxt.building||'TBA')} ${esc(nxt.room||'')}</span></div></div>`:''}</div>`;
  }
  // day picker (7 days)
  const picker=`<div class="days">${[0,1,2,3,4,5,6].map(i=>{const d=addDays(today(),i);const lbl=i===0?'Today':new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'});const n=classesOn(d).length;return `<button class="daybtn ${d===day?'on':''}" data-day="${d}">${lbl}${n?`<i>${n}</i>`:''}</button>`}).join('')}</div>`;
  // timeline
  let tl='';
  if(!st.classes){tl=`<div class="empty">${esc(st.label)}.${classes.length?'<br>Your schedule is saved for when classes resume.':''}</div>`}
  else if(!s.length){tl=classes.length?`<div class="empty">No classes ${isToday?'today':'this day'}.</div>`:`<div class="empty">Add your weekly classes and Roam plans the time between them.<div class="btns" style="justify-content:center"><button class="btn" data-manage="1">Add my classes</button></div></div>`}
  else{
   const items=[];s.forEach((c,i)=>{const live=isToday&&c.start_time.slice(0,5)<=now&&c.end_time.slice(0,5)>now;items.push(`<div class="tli class ${live?'now':''}"><div class="t"><b>${esc(fmtTime(c.start_time))}</b>${esc(fmtTime(c.end_time))}</div><div class="pin"></div><div class="cls"><h4>${esc(c.course_code)}${c.course_name?' · '+esc(c.course_name):''}</h4><p>${esc(c.building||'Building TBA')} ${esc(c.room||'')}</p><span class="tag ${live?'green':''}">${live?'Now':'Class · fixed'}</span></div></div>`);
    const gp=g.find(x=>x.after===c);if(gp){const p=planFor(gp,day);const past=isToday&&gp.end<=now;const nowGap=isToday&&gp.start<=now&&now<gp.end;items.push(`<div class="tli gap ${nowGap?'now':''}"><div class="t"><b>${esc(fmtTime(gp.start))}</b>${esc(fmtTime(gp.end))}</div><div class="pin"></div><div class="win ${past?'past':''}"><div class="wk">${dur(gp.span)} free${nowGap?' · now':''}</div><h4>Before ${esc(gp.before.course_code)}${gp.before.building?' in '+esc(gp.before.building):''}</h4>${p.picks.map(pickRow).join('')}${p.more.length?`<details class="more"><summary>+ ${p.more.length} more that fit this window</summary>${p.more.map(e=>pickRow({k:'GO',cls:'',t:e.title,d:`${R.time(e.start)} · ${e.location||'TBA'}`,ev:e})).join('')}</details>`:''}</div></div>`)}});
   const last=s[s.length-1];const after=ranked(eventsOn(day).filter(e=>R.hmOf(e.start)>=last.end_time.slice(0,5))).slice(0,3);
   if(after.length)items.push(`<div class="tli gap"><div class="t"><b>After</b>${esc(fmtTime(last.end_time))}</div><div class="pin"></div><div class="win"><div class="wk">After classes</div>${after.map(e=>pickRow({k:'GO',cls:'',t:e.title,d:`${R.time(e.start)} · ${e.location||'TBA'}`,ev:e})).join('')}</div></div>`);
   tl=`<div class="tl">${items.join('')}</div>`;
  }
  const dayLbl=isToday?'Today':new Date(day+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  $('#screen').innerHTML=`<div class="page"><div class="greet"><h1>Good ${hr<12?'morning':hr<17?'afternoon':'evening'}, ${esc(profile.first_name||'there')}.</h1><p>${esc(new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}))} · ${esc(termStatus(today()).label)}</p></div>
  ${termStatus(day).kind==='makeup'?status(`${termStatus(day).label}: follow your ${termStatus(day).weekday} schedule.`,'warning'):''}
  ${hero}${picker}
  <div class="h2row"><h2>${esc(dayLbl)}</h2><button class="link" data-manage="1">Edit classes</button></div>
  ${tl}
  ${s.length>=2&&!g.length?'<p class="sub">No breaks of 25+ minutes between classes this day.</p>':''}</div>`;
 }
 function renderManage(){
  const all=[...classes].sort((a,b)=>DAYS.indexOf(a.weekday)-DAYS.indexOf(b.weekday)||a.start_time.localeCompare(b.start_time));
  $('#screen').innerHTML=`<div class="page"><div class="h2row" style="margin-top:4px"><h2>My classes</h2><button class="link" data-manage="0">Done</button></div>
  <div class="card"><form id="classForm"><div class="grid2"><label class="field">Course code<input name="course_code" placeholder="ECON 2106" maxlength="30" required></label><label class="field">Name (optional)<input name="course_name" maxlength="100" placeholder="Microeconomics"></label></div><div class="field">Meets on<div class="daypick">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d=>`<label><input type="checkbox" name="days" value="${d}">${d.slice(0,3)}</label>`).join('')}</div></div><div class="grid2"><label class="field">Start<input type="time" name="start_time" value="09:00" required></label><label class="field">End<input type="time" name="end_time" value="10:15" required></label><label class="field">Building<input name="building" maxlength="120" placeholder="Newton" list="bl"></label><label class="field">Room<input name="room" maxlength="40" placeholder="1112"></label></div><datalist id="bl">${[...new Set((C.places||[]).filter(p=>p.campus===myCampus()).map(p=>p.name))].map(n=>`<option value="${esc(n)}">`).join('')}</datalist><button class="btn block" type="submit">Add class</button></form></div>
  <div class="card">${all.length?all.map(c=>`<div class="li"><div><b>${esc(c.course_code)} · ${esc(c.weekday.slice(0,3))}</b><span>${esc(fmtTime(c.start_time))}–${esc(fmtTime(c.end_time))} · ${esc(c.building||'TBA')} ${esc(c.room||'')}</span></div><button class="btn danger sm" data-deleteclass="${esc(c.id)}">Remove</button></div>`).join(''):'<div class="sub">No classes yet. Pick every day a class meets (e.g. Mon + Wed).</div>'}</div><p class="sub">Your classes are private to you.</p></div>`;
 }

 /* ---------- For You ---------- */
 function renderForYou(){
  $('#topTitle').textContent='For You';
  const mine=myInterests();let list=allEvents().filter(e=>!e.campus||e.campus===myCampus());
  const matches=list.filter(e=>interestHits(e).length||follows.some(f=>f.name===e.org));
  let data;const t=today();
  if(ui.fy==='new')data=matches.filter(e=>newIds.has(e.id));
  else if(ui.fy==='today')data=matches.filter(e=>R.dayOf(e.start)===t);
  else if(ui.fy==='week')data=matches.filter(e=>daysBetween(t,R.dayOf(e.start))<=7);
  else if(ui.fy==='saved')data=[...adminEvents.map(fromAdmin),...publicEvents].filter(e=>isSaved(e)&&new Date(e.end||e.start)>new Date());
  else if(mine.includes(ui.fy))data=list.filter(e=>(e.tags||[]).includes(ui.fy));
  else data=matches;
  data=ranked(data);
  const sorted=ui.fy==='saved'||ui.fy==='today'||ui.fy==='week'?[...data].sort((a,b)=>a.start.localeCompare(b.start)):data;
  let off=false;try{off=localStorage.getItem('roam-install-dismissed')==='1'}catch{}const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const install=standalone||off?'':`<div class="notice"><b>📲 Add Roam to your home screen.</b> ${installEvt?'':/iphone|ipad/i.test(navigator.userAgent)?'Tap Share ⬆︎ → Add to Home Screen.':'Browser menu ⋮ → Add to Home screen.'}<div class="btns">${installEvt?'<button class="btn sm" data-install="1">Add now</button>':''}<button class="btn ghost sm" data-installdismiss="1">Got it</button></div></div>`;
  const chip=(id,l)=>`<button class="chip ${ui.fy===id?'on':''}" data-fy="${esc(id)}">${esc(l)}</button>`;
  $('#screen').innerHTML=`<div class="page"><div class="greet"><h1>Your campus, filtered.</h1><p>Only what matches your interests${follows.length?' and the groups you follow':''}.</p></div>
  <div class="chips">${chip('all','All matches')}${newIds.size?chip('new',`🆕 New (${newIds.size})`):''}${chip('today','Today')}${chip('week','This week')}${chip('saved',`★ Saved`)}${mine.map(i=>chip(i,iLabel(i))).join('')}</div>
  ${install}
  <div class="h2row"><h2>${sorted.length} ${sorted.length===1?'match':'matches'}</h2><button class="link" data-tab="settings" data-focus="interests">Tune interests</button></div>
  ${sorted.slice(0,40).map(e=>evCard(e)).join('')||`<div class="empty">${ui.fy==='saved'?'Nothing saved yet — tap ☆ on any event.':'Nothing matches right now. Try another filter or add interests.'}</div>`}</div>`;
 }

 /* ---------- Major hub ---------- */
 function renderMajor(){
  $('#topTitle').textContent='My Major';
  const m=majorObj(browseMajor||profile.major)||A.majors[0];if(!m){$('#screen').innerHTML='<div class="page"><div class="empty">Choose a major in settings.</div></div>';return}
  const col=collegeObj(m.college)||{};const dept=(col.departments||[]).find(d=>d.id===m.dept);const adv=myCampus()==='armstrong'&&A.advisingArmstrong?A.advisingArmstrong:col.advising;const own=m.name===profile.major;
  const news=(D.news?.colleges||{})[m.college]||[];
  const evs=allEvents().filter(e=>(e.colleges||[]).includes(m.college)||(()=>{const words=[m.name.replace(/\s*\(.*\)/,'').toLowerCase(),...(col.keywords||[]).map(k=>k.toLowerCase())];const txt=(e.title+' '+(e.org||'')).toLowerCase();return words.some(w=>w.length>3&&txt.includes(w))})()).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,6);
  const kws=[...(col.keywords||[]),m.name.replace(/\s*\(.*\)/,'')].map(k=>k.toLowerCase()).filter(k=>k.length>3);
  const orgs=(D.orgs?.orgs||[]).filter(o=>!(o.cats||[]).includes('Campus Department')&&kws.some(k=>o.name.toLowerCase().includes(k))).slice(0,6);
  const fb=(kind,name)=>{const on=follows.some(f=>f.kind===kind&&f.name===name);return `<button class="btn ${on?'ghost':''} sm" data-follow="${esc(kind)}|${esc(name)}">${on?'✓ Following':'+ Follow'}</button>`};
  $('#screen').innerHTML=`<div class="page">
  <div class="status"><div class="kicker">${esc(col.short||col.name||'')}</div><div class="big">${esc(m.name)}</div><div class="sub">${esc(dept?.name||col.name||'')}</div><div class="btns">${ext(m.url,'Degree page','btn sm')}${col.home?ext(col.home,'College'):''}${own?'<span class="pill green" style="align-self:center">Your major</span>':`<button class="btn ghost sm" data-setmajor="${esc(m.name)}">Make this my major</button>`}</div></div>
  <label class="field">Browse another major<select id="majorPick">${majorOptions(m.name)}</select></label>
  <div class="h2row"><h2>News in your field</h2>${col.newsPage?`<a class="link" href="${esc(validURL(col.newsPage))}" target="_blank" rel="noopener noreferrer">More ↗</a>`:''}</div>
  <div class="card">${news.length?news.slice(0,5).map(n=>`<div class="li news"><div><a href="${esc(validURL(n.url))}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a><span>${esc(n.date?R.prettyDate(n.date):'')}</span></div></div>`).join(''):'<div class="sub">No recent college news.</div>'}</div>
  <div class="h2row"><h2>Happening in your field</h2></div>
  ${evs.length?evs.map(e=>evCard(e,{why:false,hide:false})).join(''):'<div class="empty">No upcoming events in your field right now.</div>'}
  <div class="h2row"><h2>Your advising</h2></div>
  <div class="card">${adv?`<b>${esc(adv.name)}</b><div class="contact">${adv.email?`<div><small>Email</small><a href="mailto:${esc(adv.email)}">${esc(adv.email)}</a></div>`:''}${adv.phone?`<div><small>Phone</small><a href="tel:${esc(String(adv.phone).replace(/[^0-9+]/g,''))}">${esc(adv.phone)}</a></div>`:''}${adv.where?`<div style="grid-column:1/-1"><small>Where</small><span>${esc(adv.where)}</span></div>`:''}</div><div class="btns">${adv.url?ext(adv.url,'Office page'):''}${(A.advisingLinks||[])[0]?ext(A.advisingLinks[0].url,'Book advising'):''}</div>`:'<div class="sub">Advising info unavailable.</div>'}</div>
  ${orgs.length?`<div class="h2row"><h2>Groups in your field</h2></div><div class="card">${orgs.map(o=>`<div class="li"><div><b>${esc(o.name)}</b><span>${o.members?o.members+' members':'Student organization'}</span></div>${fb('organization',o.name)}</div>`).join('')}</div>`:''}
  ${(col.departments||[]).length?`<div class="h2row"><h2>Departments</h2></div><div class="card">${col.departments.map(d=>`<div class="li"><div><b>${esc(d.name)}</b></div>${fb('department',d.name)}</div>`).join('')}</div>`:''}</div>`;
  R.track('major_view','major');
 }

 /* ---------- Campus ---------- */
 function renderCampus(){
  $('#topTitle').textContent='Campus';
  const t=today();let body='';
  if(ui.camp==='events'){
   let list=allEvents().filter(e=>!e.campus||e.campus===myCampus());
   if(ui.campWhen==='today')list=list.filter(e=>R.dayOf(e.start)===t);else if(ui.campWhen==='week')list=list.filter(e=>daysBetween(t,R.dayOf(e.start))<=7);
   if(ui.campCat!=='all')list=list.filter(e=>(e.tags||[]).includes(ui.campCat));
   if(ui.q){const q=ui.q.toLowerCase();list=list.filter(e=>[e.title,e.location,e.org].join(' ').toLowerCase().includes(q))}
   list.sort((a,b)=>a.start.localeCompare(b.start));
   const cats=[...new Set(allEvents().flatMap(e=>e.tags||[]))].filter(id=>IMAP[id]).sort((a,b)=>iLabel(a).localeCompare(iLabel(b)));
   const groups={};for(const e of list.slice(0,60)){const d=R.dayOf(e.start);(groups[d]=groups[d]||[]).push(e)}
   body=`<div class="chips">${[['today','Today'],['week','This week'],['all','Everything']].map(([k,l])=>`<button class="chip ${ui.campWhen===k?'on':''}" data-when="${k}">${l}</button>`).join('')}<span style="width:6px"></span><button class="chip ${ui.campCat==='all'?'on':''}" data-cat="all">All types</button>${cats.map(c=>`<button class="chip ${ui.campCat===c?'on':''}" data-cat="${esc(c)}">${esc(iLabel(c))}</button>`).join('')}</div>
   <label class="field"><input id="campSearch" type="search" placeholder="Search events, places, groups" value="${esc(ui.q)}"></label>
   ${Object.keys(groups).length?Object.entries(groups).map(([d,es])=>{const n=daysBetween(t,d);return `<div class="h2row"><h2>${n===0?'Today':n===1?'Tomorrow':esc(new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}))}</h2><small>${es.length}</small></div>${es.map(e=>evCard(e,{why:false})).join('')}`}).join(''):'<div class="empty">No events match.</div>'}
   <p class="sub">From the university calendar and Eagle Engage${D.events?.generatedAt?`, updated ${esc(R.niceDate(D.events.generatedAt))} ${esc(R.time(D.events.generatedAt))}`:''}.</p>`;
  }else{
   const mine=myInterests();const cats=[...new Set(INTERESTS.filter(i=>mine.includes(i.id)).flatMap(i=>i.orgCats||[]))];const kw=INTERESTS.filter(i=>mine.includes(i.id)).flatMap(i=>i.keywords||[]);
   const orgs=(D.orgs?.orgs||[]).filter(o=>!(o.cats||[]).includes('Campus Department'));
   const sc=o=>(follows.some(f=>f.kind==='organization'&&f.name===o.name)?10:0)+((o.cats||[]).some(c=>cats.includes(c))?4:0)+(kw.some(k=>o.name.toLowerCase().includes(k))?3:0)+(o.upcoming?1:0);
   let list=orgs;if(ui.orgQ){const q=ui.orgQ.toLowerCase();list=list.filter(o=>(o.name+' '+(o.cats||[]).join(' ')).toLowerCase().includes(q))}
   list=[...list].sort((a,b)=>sc(b)-sc(a)||a.name.localeCompare(b.name));
   body=`<label class="field"><input id="orgSearch" type="search" placeholder="Search ${orgs.length} organizations" value="${esc(ui.orgQ)}"></label><div class="card">${list.slice(0,40).map(o=>{const on=follows.some(f=>f.kind==='organization'&&f.name===o.name);return `<div class="li"><div><b>${esc(o.name)}</b><span>${esc((o.cats||[]).filter(c=>!/Campus$/.test(c)).slice(0,2).join(' · ')||'Student organization')}${o.upcoming?` · ${o.upcoming} upcoming`:''}</span></div><div style="display:flex;gap:6px">${ENGAGE&&o.uri?`<a class="mini" href="${esc(validURL(ENGAGE+'/organization/'+o.uri))}" target="_blank" rel="noopener noreferrer">↗</a>`:''}<button class="btn ${on?'ghost':''} sm" data-follow="organization|${esc(o.name)}">${on?'✓':'+ Follow'}</button></div></div>`}).join('')||'<div class="sub">No organizations match.</div>'}</div><p class="sub">Following boosts a group's events in For You.</p>`;
  }
  $('#screen').innerHTML=`<div class="page"><div class="greet"><h1>Campus activities.</h1><p>Everything happening at Georgia Southern${myCampus()==='armstrong'?' Armstrong':' Statesboro'}.</p></div><div class="seg"><button class="${ui.camp==='events'?'on':''}" data-camp="events">Events</button><button class="${ui.camp==='orgs'?'on':''}" data-camp="orgs">Organizations</button></div>${body}</div>`;
 }

 /* ---------- Settings ---------- */
 function renderSettings(){
  $('#topTitle').textContent='Settings';document.querySelectorAll('#tabs [data-tab]').forEach(b=>b.classList.remove('on'));
  interestSet=new Set(myInterests());const sv=surveyDue();const contact=R.cfg.contactEmail;
  $('#screen').innerHTML=`<div class="page">
  ${sv?`<div class="card" id="survey"><div class="kicker">${esc(sv.label)} · 30 seconds</div><form id="surveyForm"><input type="hidden" name="phase" value="${sv.phase}"><label class="field">How easily do you find campus opportunities that fit you?<select name="discovery" required><option value="">Choose</option><option value="1">1 — Very hard</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 — Very easy</option></select></label><label class="field">${sv.phase==='baseline'?'How useful are the campus tools you use now?':'How useful was Roam this week?'}<select name="usefulness" required><option value="">Choose</option><option value="1">1 — Not useful</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 — Extremely</option></select></label><button class="btn block" type="submit">Submit</button></form></div>`:''}
  <div class="h2row"><h2>Profile</h2></div><div class="card"><form id="profileForm"><label class="field">First name<input name="first_name" value="${esc(profile.first_name||'')}" maxlength="80" required></label><label class="field">Major<select name="major">${majorOptions(profile.major)}</select></label><div class="grid2"><label class="field">Campus<select name="campus">${campusOptions(myCampus())}</select></label><label class="field">Year<select name="year">${yearOptions(profile.year)}</select></label></div><div class="field" id="interests">Interests (power For You)</div><div>${interestButtons()}</div><label class="check"><input name="consent" type="checkbox" ${profile.consent?'checked':''}> Share anonymous usage counts with the pilot team</label><button class="btn block" type="submit">Save</button></form><p class="sub">${esc(user.email||'')}</p></div>
  <div class="h2row"><h2>Quick links</h2></div><div class="card">${(A.quickLinks||[]).map(q=>`<div class="li"><div><b>${esc(q.label)}</b><span>${esc(q.sub||'')}</span></div><a class="mini" href="${esc(validURL(q.url))}" target="_blank" rel="noopener noreferrer" data-resource="${esc(q.label)}">↗</a></div>`).join('')}</div>
  <div class="h2row"><h2>Get help</h2></div><div class="card">${(C.help||[]).map(h=>`<div class="li"><div><b>${esc(h.name)}</b><span>${esc(h.detail)}</span></div><a class="btn ${h.phone==='911'||h.phone==='988'?'danger':'ghost'} sm" href="tel:${esc(h.phone)}">${esc(h.phone)}</a></div>`).join('')}</div>
  <div class="h2row"><h2>Feedback</h2></div><div class="card"><form id="feedbackForm"><label class="field">What works or needs fixing?<textarea name="message" maxlength="1500" required></textarea></label><label class="field">Overall<select name="rating"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Okay</option><option value="2">2 — Difficult</option><option value="1">1 — Poor</option></select></label><button class="btn ghost block" type="submit">Send feedback</button></form></div>
  <div class="h2row"><h2>Privacy</h2></div><div class="card"><p class="sub" style="margin:0">Usage counts (if you opt in) include a random ID, the feature and the time — never your schedule, location or password. Interests marked 🔒 never leave this phone. Independent pilot, not a university service.${contact?` Questions or withdrawal: <a href="mailto:${esc(contact)}">${esc(contact)}</a>.`:''}</p><div class="btns"><button id="logoutBtn" class="btn ghost sm" type="button">Sign out</button><button id="deleteAccount" class="btn danger sm" type="button">Delete my account & data</button></div></div></div>`;
  try{if(sessionStorage.getItem('roam-focus')){const id=sessionStorage.getItem('roam-focus');sessionStorage.removeItem('roam-focus');document.getElementById(id)?.scrollIntoView({behavior:'smooth'})}}catch{}
 }
 const render=()=>{$('#setDot').classList.toggle('hidden',!surveyDue());({today:renderToday,foryou:renderForYou,major:renderMajor,campus:renderCampus,settings:renderSettings}[tab]||renderToday)()};
 const refresh=async()=>{await load();render()};

 /* ---------- auth events ---------- */
 $('#authToggle').addEventListener('click',()=>{authMode=authMode==='signup'?'signin':'signup';authShow()});
 $('#forgotLink').addEventListener('click',()=>{authMode='forgot';authShow()});
 $('#privacyOpen').addEventListener('click',()=>R.alert(`Voluntary pilot. Only limited usage counts are logged if you agree.${R.cfg.contactEmail?' Questions: '+R.cfg.contactEmail:''}`));
 $('#authForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target,f=new FormData(form),email=String(f.get('email')||'').trim().toLowerCase(),password=String(f.get('password')||'');busy(form,true);
  try{
   if(authMode==='forgot'){if(R.client){R.check(await R.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}));$('#authNotice').innerHTML=status('If that email has an account, a reset link is on its way.','success')}else $('#authNotice').innerHTML=status('Accounts on this phone can\'t be reset by email. Clear site data to start over.','warning');return}
   if(authMode==='recover'){if(password.length<8)throw Error('Use at least 8 characters.');R.check(await R.client.auth.updateUser({password}));recovery=false;authMode='signin';R.alert('Password updated.')}
   else if(authMode==='signup'){
    if(!email.endsWith('@georgiasouthern.edu')&&!email.endsWith('@eagles.georgiasouthern.edu'))throw Error('Use your Georgia Southern email address.');
    if(R.client){const {data,error}=await R.client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname,data:{first_name:String(f.get('name')||'').trim().slice(0,80),consent:!!f.get('consent')}}});if(error)throw error;if(!data.session){authMode='signin';authShow();$('#authNotice').innerHTML=status('Check your school email to confirm, then sign in.','success');return}}
    else{const d=R.demo.load();if(d.account)throw Error('This phone already has a Roam account. Sign in instead.');const id=crypto.randomUUID();d.account={id,email,pw:await hash(password)};d.profile={id,first_name:String(f.get('name')||''),consent:!!f.get('consent'),interests:[],major:'',year:'',campus:CAMPUSES[0].id,onboarded:false,created_at:new Date().toISOString()};R.demo.save(d)}
   }else{
    if(R.client)R.check(await R.client.auth.signInWithPassword({email,password}));
    else{const d=R.demo.load();const ok=d.account?.email===email&&(d.account.pw===await hash(password)||d.account.password===password);if(!ok)throw Error('Email or password doesn\'t match the account on this phone.')}
   }
   user=await getUser();profile=user?await getProfile():null;if(!user||!profile)throw Error('Account not available. Contact the pilot team.');
   if(!profile.onboarded)onboardShow();else{await load();boot()}
  }catch(ex){$('#authNotice').innerHTML=status(R.formatErr(ex),'error')}finally{busy(form,false)}
 });

 /* ---------- app events ---------- */
 let st;
 document.addEventListener('input',e=>{const id=e.target?.id;if(!['campSearch','orgSearch'].includes(id))return;clearTimeout(st);st=setTimeout(()=>{const pos=e.target.selectionStart;if(id==='campSearch')ui.q=e.target.value;else ui.orgQ=e.target.value;render();const el=$('#'+id);if(el){el.focus();try{el.setSelectionRange(pos,pos)}catch{}}},250)});
 document.addEventListener('change',e=>{if(e.target?.id==='majorPick'){browseMajor=e.target.value||null;renderMajor()}});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;if(tab==='foryou'&&profile?.onboarded)renderForYou()});
 document.addEventListener('click',async e=>{
  const btn=e.target.closest('button,a');if(!btn)return;const ds=btn.dataset;
  try{
   if(ds.tab){if(ds.focus)try{sessionStorage.setItem('roam-focus',ds.focus)}catch{};ui.manage=false;switchTab(ds.tab)}
   if(ds.interest){const v=ds.interest;interestSet.has(v)?interestSet.delete(v):interestSet.add(v);document.querySelectorAll('[data-interest]').forEach(x=>{x.classList.toggle('selected',interestSet.has(x.dataset.interest));x.setAttribute('aria-pressed',interestSet.has(x.dataset.interest))})}
   if(ds.day){ui.day=ds.day;renderToday();R.track('plan_view','today')}
   if(ds.manage){ui.manage=ds.manage==='1';renderToday();window.scrollTo({top:0})}
   if(ds.fy){ui.fy=ds.fy;renderForYou()}
   if(ds.camp){ui.camp=ds.camp;renderCampus()}
   if(ds.when){ui.campWhen=ds.when;renderCampus()}
   if(ds.cat){ui.campCat=ds.cat;renderCampus()}
   if(ds.install&&installEvt){installEvt.prompt();try{await installEvt.userChoice}catch{}installEvt=null;render()}
   if(ds.installdismiss){try{localStorage.setItem('roam-install-dismissed','1')}catch{}render()}
   if(ds.hide){hidden.push(ds.hide);ls.set(`roam-hidden-${user.id}`,hidden);render();R.alert('Hidden — you won\'t see that one again.')}
   if(ds.setmajor){await upsertProfile({major:ds.setmajor});profile=await getProfile();browseMajor=null;await R.track('profile_update','major');renderMajor();R.alert('Major updated')}
   if(ds.gcal)R.track('calendar_add',tab);
   if(ds.eventlink)R.track('event_view',tab);
   if(ds.resource)R.track('resource_open','settings');
   if(ds.save){const id=ds.save;const isA=adminEvents.some(x=>x.id===id);const was=isA?saved.includes(id):savedPublic.includes(id);btn.disabled=true;
    if(R.client){if(isA){if(was)R.check(await R.client.from('saved_events').delete().eq('user_id',user.id).eq('event_id',id));else R.check(await R.client.from('saved_events').insert({user_id:user.id,event_id:id}))}else{if(was)R.check(await R.client.from('saved_public_events').delete().eq('user_id',user.id).eq('event_key',id));else R.check(await R.client.from('saved_public_events').insert({user_id:user.id,event_key:id}))}}
    else{const d=R.demo.load();const k=isA?'saved':'savedPublic';d[k]=d[k]||[];d[k]=was?d[k].filter(x=>x!==id):[...d[k],id];R.demo.save(d)}
    await R.track(was?'event_unsave':'event_save',tab);await refresh()}
   if(ds.deleteclass){if(!await ask('Remove this class?',{ok:'Remove',danger:true}))return;const id=ds.deleteclass;if(R.client)R.check(await R.client.from('class_schedule').delete().eq('id',id).eq('user_id',user.id));else{const d=R.demo.load();d.schedules=d.schedules.filter(x=>x.id!==id);R.demo.save(d)}await R.track('schedule_delete','schedule');await refresh()}
   if(ds.follow){const i=ds.follow.indexOf('|');const kind=ds.follow.slice(0,i),name=ds.follow.slice(i+1);const old=follows.find(f=>f.kind===kind&&f.name===name);btn.disabled=true;if(R.client){if(old)R.check(await R.client.from('follows').delete().eq('id',old.id));else R.check(await R.client.from('follows').insert({user_id:user.id,kind,name}))}else{const d=R.demo.load();d.follows=old?d.follows.filter(x=>x.id!==old.id):[...d.follows,{id:crypto.randomUUID(),user_id:user.id,kind,name}];R.demo.save(d)}await R.track(old?'unfollow':'follow',tab);await refresh()}
   if(btn.id==='logoutBtn'){if(R.client)await R.client.auth.signOut();authMode='signin';signedOut()}
   if(btn.id==='deleteAccount'){if(!await ask('This permanently deletes your Roam account, classes, saves, follows, feedback and check-ins.',{typed:'DELETE',ok:'Delete everything',danger:true}))return;if(R.client){R.check(await R.client.rpc('delete_my_account'));await R.client.auth.signOut()}else R.demo.reset();ls.del(privKey());ls.del(`roam-hidden-${user.id}`);authMode='signup';signedOut();R.alert('Your account and data were deleted.')}
  }catch(ex){R.alert(R.formatErr(ex));btn.disabled=false}
 });
 $('#onboardForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.target,f=new FormData(form);if(!interestSet.size){R.alert('Pick at least one interest');return}busy(form,true);try{await upsertProfile({first_name:String(f.get('first_name')).trim(),major:f.get('major'),year:f.get('year'),campus:f.get('campus'),interests:[...interestSet],onboarded:true});profile=await getProfile();await load();boot()}catch(ex){R.alert(R.formatErr(ex))}finally{busy(form,false)}});
 document.addEventListener('submit',async e=>{
  if(!['classForm','profileForm','feedbackForm','surveyForm'].includes(e.target.id))return;e.preventDefault();const form=e.target,f=new FormData(form);let msg='Saved';busy(form,true);
  try{
   if(form.id==='classForm'){const start=f.get('start_time'),end=f.get('end_time'),days=f.getAll('days');if(!days.length)throw Error('Pick at least one day.');if(start>=end)throw Error('End time must be after start time.');const base={user_id:user.id,course_code:String(f.get('course_code')).trim(),course_name:String(f.get('course_name')||'').trim(),start_time:start,end_time:end,building:String(f.get('building')||'').trim(),room:String(f.get('room')||'').trim()};const entries=days.map(weekday=>({...base,weekday}));const clash=entries.map(overlaps).find(Boolean);if(clash)throw Error(`Overlaps ${clash.course_code} on ${clash.weekday} (${fmtTime(clash.start_time)}–${fmtTime(clash.end_time)}).`);if(R.client)R.check(await R.client.from('class_schedule').insert(entries));else{const d=R.demo.load();d.schedules.push(...entries.map(x=>({...x,id:crypto.randomUUID()})));R.demo.save(d)}await R.track('schedule_add','schedule');msg=`Added ${base.course_code} · ${days.map(d=>d.slice(0,3)).join(', ')}`}
   if(form.id==='profileForm'){await upsertProfile({first_name:String(f.get('first_name')).trim(),major:f.get('major'),year:f.get('year'),campus:f.get('campus'),interests:[...interestSet],consent:!!f.get('consent')});profile=await getProfile();R.setTracking(user.id,profile.consent);await R.track('profile_update','profile');msg='Profile saved'}
   if(form.id==='feedbackForm'){const en={user_id:user.id,message:String(f.get('message')).trim(),rating:Number(f.get('rating'))};if(R.client)R.check(await R.client.from('pilot_feedback').insert(en));else{const d=R.demo.load();d.feedback.push({...en,id:crypto.randomUUID(),created_at:new Date().toISOString()});R.demo.save(d)}await R.track('feedback_submit','feedback');msg='Thanks — feedback sent'}
   if(form.id==='surveyForm'){const en={user_id:user.id,phase:f.get('phase'),discovery:Number(f.get('discovery')),usefulness:Number(f.get('usefulness'))};if(R.client)R.check(await R.client.from('pilot_surveys').insert(en));else{const d=R.demo.load();d.survey.push({...en,id:crypto.randomUUID(),created_at:new Date().toISOString()});R.demo.save(d)}await R.track('survey_submit','survey');msg='Thanks — check-in recorded'}
   await refresh();R.alert(msg);
  }catch(ex){R.alert(/duplicate key|unique/i.test(R.formatErr(ex))?'You already submitted that check-in.':R.formatErr(ex))}finally{busy(form,false)}
 });
 let hiddenAt=0;window.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='hidden'){hiddenAt=Date.now();return}if(hiddenAt&&Date.now()-hiddenAt>3*3600000&&navigator.onLine){location.reload();return}if(user&&profile?.onboarded&&!$('#app').classList.contains('hidden')){try{await refresh()}catch{}}});
 let day0=today(),min0=R.nowHM();
 setInterval(async()=>{if(!user||$('#app').classList.contains('hidden'))return;const typing=document.activeElement?.matches?.('input,textarea,select');if(day0!==today()){day0=today();ui.day=null;if(navigator.onLine&&!typing){location.reload();return}try{await refresh()}catch{}}else if(tab==='today'&&!ui.manage&&!typing&&R.nowHM().slice(0,4)!==min0.slice(0,4)){min0=R.nowHM();renderToday()}},60000);

 /* ---------- start ---------- */
 await loadPublicEvents();
 if(R.client)R.client.auth.onAuthStateChange(evt=>{if(evt==='PASSWORD_RECOVERY'){recovery=true;authMode='recover';authShow()}});
 if(initialRecovery){recovery=true;authMode='recover'}
 user=await getUser();
 if(recovery){authShow();return}
 if(!user){if(R.demo.load().account&&!R.client)authMode='signin';authShow();return}
 try{profile=await getProfile();if(!profile){authMode='signin';signedOut();return}if(!profile.onboarded)onboardShow();else{await load();boot()}}catch(ex){authShow();$('#authNotice').innerHTML=status(R.formatErr(ex),'error')}
})();
