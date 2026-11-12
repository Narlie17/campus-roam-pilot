/* Campus ROAM V14 — student app.
   Same layout and design system as V13. Adds the public Georgia Southern data from the
   earlier ROAM build (events, Eagle Engage orgs, 67 majors, dining/places hours, dates,
   resources, help lines) so the app is useful with or without Supabase. */
(async function(){
 const R=window.ROAM, $=s=>document.querySelector(s), esc=R.escape;
 const D=R.data||{campus:{interests:[],interestGroups:[],places:[],resources:[],dates:[],terms:[],transit:[],help:[],hiddenGems:[],campuses:[],meta:{sources:{}}},academics:{majors:[],colleges:[],quickLinks:[],advisingLinks:[]},events:{events:[]},orgs:{orgs:[]},news:{colleges:{}}};
 const C=D.campus, A=D.academics;
 const INTERESTS=C.interests||[];
 const IMAP=Object.fromEntries(INTERESTS.map(i=>[i.id,i]));
 const PRIVATE=new Set(INTERESTS.filter(i=>i.private).map(i=>i.id));
 const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
 const YEARS=C.years?.length?C.years:['First year','Sophomore','Junior','Senior','Graduate'];
 const CAMPUSES=C.campuses?.length?C.campuses:[{id:'statesboro',name:'Statesboro'}];
 const ENGAGE=(C.meta?.sources?.engageBase||D.orgs?.base||'').replace(/\/$/,'');
 let user=null,profile=null,classes=[],adminEvents=[],publicEvents=[],follows=[],saved=[],savedPublic=[],hidden=[],announcements=[],surveys=[],tab='today',authMode='signup',interestSet=new Set(),weather=null,browseMajor=null,recovery=false;
 const initialRecovery=/type=recovery/.test(location.hash);
 const ui={dayPage:0,org:null,filter:'all',scope:'mine',q:'',showSaved:false,orgQ:'',orgCat:'all',resQ:'',dateKind:'all',fyPage:0,open:new Set()};

 /* ---------- helpers ---------- */
 const status=(txt,kind='')=>`<div class="notice ${kind}">${esc(txt)}</div>`;
 const fmtTime=t=>{if(!t)return '';const [h,m]=t.slice(0,5).split(':').map(Number);return new Date(2026,0,1,h,m).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})};
 const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
 const hm=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
 const validURL=u=>{try{const a=new URL(u);return ['https:','http:'].includes(a.protocol)?a.href:'#'}catch{return '#'}};
 const ext=(href,label,cls='btn secondary small',attrs='')=>`<a class="${cls}" target="_blank" rel="noopener noreferrer" href="${esc(validURL(href))}" ${attrs}>${esc(label)}<svg class="exti" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`;
 const tel=p=>`<a class="btn secondary small" href="tel:${esc(String(p).replace(/[^0-9+]/g,''))}">${esc(p)}</a>`;
 const myCampus=()=>profile?.campus||CAMPUSES[0].id;
 const campusName=id=>(CAMPUSES.find(c=>c.id===id)||{}).name||'';
 const majorObj=name=>A.majors.find(m=>m.name===name)||null;
 const collegeObj=id=>A.colleges.find(c=>c.id===id)||null;
 const daysBetween=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);
 const privKey=()=>`roam-private-interests-${user?.id||'local'}`;
 const loadPrivate=()=>{try{return JSON.parse(localStorage.getItem(privKey())||'[]')}catch{return []}};
 const savePrivate=ids=>{try{localStorage.setItem(privKey(),JSON.stringify(ids))}catch{}};
 const myInterests=()=>[...new Set([...(profile?.interests||[]),...loadPrivate()])];
 const interestLabel=id=>IMAP[id]?.label||id;
 const hash=async s=>{try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('roam-local:'+s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch{return 'plain:'+s}};
 const busy=(form,on)=>form?.querySelectorAll('button[type=submit],button:not([type])').forEach(b=>b.disabled=on);

 // In-page confirm dialog (browser confirm/prompt are blocked in some hosts).
 const ask=(message,{typed=null,ok='Confirm',danger=false}={})=>new Promise(res=>{const prev=document.activeElement;const w=document.createElement('div');w.className='modalwrap';w.innerHTML=`<div class="panel modal" role="dialog" aria-modal="true" aria-label="Please confirm"><p>${esc(message)}</p>${typed?`<label class="field">Type ${esc(typed)} to confirm<input id="askInput" autocomplete="off"></label>`:''}<div class="btnrow"><button type="button" class="btn ${danger?'danger':'gold'}" data-ask="ok">${esc(ok)}</button><button type="button" class="btn secondary" data-ask="no">Cancel</button></div></div>`;document.body.appendChild(w);const inp=w.querySelector('#askInput');(inp||w.querySelector('[data-ask=ok]')).focus();w.addEventListener('click',e=>{const b=e.target.closest('[data-ask]');if(!b&&e.target!==w)return;e.stopPropagation();const yes=b?.dataset.ask==='ok'&&(!typed||inp.value.trim()===typed);if(b?.dataset.ask==='ok'&&typed&&!yes){inp.focus();inp.select();return}w.remove();try{prev&&prev.focus()}catch{};res(!!yes)});w.addEventListener('keydown',e=>{if(e.key==='Escape'){w.remove();try{prev&&prev.focus()}catch{};res(false)}if(e.key==='Enter'){e.preventDefault();w.querySelector('[data-ask=ok]').click()}})});

 /* ---------- academic calendar ---------- */
 function termStatus(day=R.localDay()){
  for(const t of C.terms||[]){
   if(day<t.classesStart||day>t.finalsEnd)continue;
   const mk=(t.makeup||[]).find(m=>m.date===day);
   if(mk)return {term:t,kind:'makeup',label:mk.label,classes:true,weekday:{Mo:'Monday',Tu:'Tuesday',We:'Wednesday',Th:'Thursday',Fr:'Friday'}[mk.follows]||null};
   const off=(t.noClass||[]).find(([a,b])=>day>=a&&day<=b);
   if(off){const d=(C.dates||[]).find(x=>x.kind==='holiday'&&x.date<=day&&(x.end||x.date)>=day);return {term:t,kind:'break',label:d?.title||'No classes today',classes:false}}
   if(day>=t.finalsStart)return {term:t,kind:'finals',label:`${t.name} final exams`,classes:false};
   if(day>t.classesEnd)return {term:t,kind:'between',label:`${t.name} classes are over — finals start ${R.prettyDate(t.finalsStart)}`,classes:false};
   return {term:t,kind:'classes',label:`${t.name} · week ${Math.floor(daysBetween(t.classesStart,day)/7)+1}`,classes:true};
  }
  const next=(C.terms||[]).find(t=>t.classesStart>day);
  return {term:next||null,kind:'off',label:next?`Between terms — ${next.name} starts ${R.prettyDate(next.classesStart)}`:'Between terms',classes:false};
 }
 const upcomingDates=(n=50)=>(C.dates||[]).filter(d=>(d.end||d.date)>=R.localDay()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,n);
 const nextDeadline=()=>upcomingDates().find(d=>d.kind==='deadline'||d.kind==='registration'||d.kind==='exam');

 /* ---------- hours ---------- */
 const DCODES=['Su','Mo','Tu','We','Th','Fr','Sa'];
 function hoursFor(place,dow){
  for(const [k,v] of Object.entries(place.hours||{})){
   const hit=k.split(',').some(part=>{const [a,b]=part.trim().split('-');const ia=DCODES.indexOf(a),ib=b?DCODES.indexOf(b):ia;if(ia<0)return false;return ia<=ib?dow>=ia&&dow<=ib:dow>=ia||dow<=ib});
   if(hit)return v.split(',').map(r=>{const [s,e]=r.split('-');return [mins(s),mins(e)]});
  }
  return null;
 }
 const todayDow=()=>DCODES.indexOf(new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:R.TZ}).format(new Date()).slice(0,2));
 function openStatus(place){
  if(!place.hours)return {known:false,text:'See hours',cls:''};
  const ranges=hoursFor(place,todayDow());const now=mins(R.nowHM());
  if(!ranges)return {known:true,open:false,text:'Closed today',cls:'redchip'};
  const cur=ranges.find(([s,e])=>now>=s&&now<e);
  if(cur)return {known:true,open:true,text:`Open until ${fmtTime(hm(cur[1]))}`,cls:'greenchip'};
  const nx=ranges.find(([s])=>s>now);
  return nx?{known:true,open:false,text:`Opens ${fmtTime(hm(nx[0]))}`,cls:'goldchip'}:{known:true,open:false,text:'Closed for today',cls:'redchip'};
 }
 const hoursText=place=>{const r=hoursFor(place,todayDow());return place.hours?(r?r.map(([s,e])=>`${fmtTime(hm(s))}–${fmtTime(hm(e))}`).join(', '):'Closed today'):'Hours vary'};
 function openDuring(place,startM,endM,need=20){const r=hoursFor(place,todayDow());if(!r)return false;return r.some(([s,e])=>Math.min(e,endM)-Math.max(s,startM)>=need)}
 const placesOn=(cat)=>(C.places||[]).filter(p=>p.category===cat&&p.campus===myCampus());

 /* ---------- events ---------- */
 const mapTags=tags=>{const out=new Set();for(const t of tags||[]){const low=String(t).toLowerCase();if(IMAP[low]){out.add(low);continue}for(const i of INTERESTS){if(i.label.toLowerCase()===low||i.label.toLowerCase().includes(low)||(i.keywords||[]).some(k=>k===low))out.add(i.id)}}return [...out]};
 const fromAdmin=e=>({id:e.id,title:e.title,start:e.starts_at,end:e.ends_at,location:e.location,url:e.link,source:'roam',tags:mapTags(e.tags),rawTags:e.tags||[],org:e.organization||'',dept:e.department||'',desc:e.description||'',campus:'',colleges:[]});
 const allEvents=()=>{const now=Date.now();return [...adminEvents.map(fromAdmin),...publicEvents].filter(e=>new Date(e.end||e.start).getTime()>now&&!hidden.includes(e.id))};
 const isSaved=e=>e.source==='roam'?saved.includes(e.id):savedPublic.includes(e.id);
 function score(e){
  let s=0;const mine=myInterests(),mj=majorObj(profile?.major);
  for(const t of e.tags||[])if(mine.includes(t))s+=3;
  if(mj&&(e.colleges||[]).includes(mj.college))s+=3;
  if(e.dept&&profile?.major&&e.dept.toLowerCase()===String(profile.major).toLowerCase())s+=3;
  if(follows.some(f=>f.kind==='organization'&&f.name===e.org))s+=4;
  if(follows.some(f=>f.kind==='department'&&f.name===e.dept))s+=4;
  if(e.campus&&e.campus!==myCampus())s-=3;
  if(e.source==='roam')s+=1;
  if(fitsGap(e))s+=2;
  return s;
 }
 function explain(e){const p=[],mine=myInterests(),mj=majorObj(profile?.major);const hit=(e.tags||[]).filter(t=>mine.includes(t));if(hit.length)p.push('matches '+hit.slice(0,2).map(interestLabel).join(', '));if(follows.some(f=>f.name===e.org||f.name===e.dept))p.push('from a group you follow');if(mj&&(e.colleges||[]).includes(mj.college))p.push('in your college');if(fitsGap(e))p.push('fits a break in your day');if(e.campus&&e.campus!==myCampus())p.push(`on the ${campusName(e.campus)} campus`);if(!p.length)p.push('upcoming on campus');return p.join(' · ')}
 const ranked=list=>[...list].sort((a,b)=>score(b)-score(a)||String(a.start).localeCompare(String(b.start)));
 const gcal=e=>{const f=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const end=e.end||new Date(new Date(e.start).getTime()+3600000).toISOString();return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(e.title)+'&dates='+f(e.start)+'/'+f(end)+'&location='+encodeURIComponent(e.location||'')+'&details='+encodeURIComponent((e.url?e.url+'\n\n':'')+'Found on Campus ROAM')};
 const srcLabel=e=>e.source==='engage'?'Eagle Engage':e.source==='calendar'?'University calendar':'ROAM team';
 function eventCard(e,compact=false){
  const sc=score(e);const sv=isSaved(e);
  return `<article class="item"><div class="row"><h4>${esc(e.title)}</h4><span>${newIds.has(e.id)?'<span class="chip greenchip">New</span>':''}<span class="chip ${sc>=3?'goldchip':''}">${sc>=3?'For you':'Campus'}</span></span></div><p>${esc(e.location||'Location TBA')} · ${esc(R.niceDate(e.start))} · ${e.allDay?'All day':esc(R.time(e.start))}${e.end&&!e.allDay?'–'+esc(R.time(e.end)):''}</p>${e._n>1?`<p class="repeat">Runs ${e._n} dates through ${esc(R.niceDate(e._last))}</p>`:''}${e.org?`<p>Hosted by ${(D.orgs?.orgs||[]).some(o=>o.name===e.org)?`<button type="button" class="orglink" data-org="${esc(e.org)}">${esc(e.org)}</button>`:esc(e.org)}</p>`:''}${!compact&&e.desc?`<p class="desc">${esc(e.desc.slice(0,260))}</p>`:''}<div class="itemmeta">${(e.tags||[]).slice(0,3).map(t=>`<span class="chip">${esc(interestLabel(t))}</span>`).join('')}<span class="chip">${esc(srcLabel(e))}</span></div><div class="sub">Why you're seeing this: ${esc(explain(e))}</div><div class="btnrow"><button class="btn small ${sv?'secondary':'gold'}" data-save="${esc(e.id)}">${sv?'✓ On my schedule':'+ Add to my schedule'}</button>${ext(gcal(e),'Add to Google Calendar','btn secondary small','data-gcal="1"')}${e.url?ext(e.url,'Event info','btn secondary small','data-eventlink="1"'):''}${compact?'':`<button class="btn secondary small" data-hide="${esc(e.id)}">Not for me</button>`}</div></article>`;
 }

 /* ---------- classes & plan ---------- */
 const dayName=()=>new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:R.TZ}).format(new Date());
 const todayClasses=()=>{const st=termStatus();if(!st.classes)return [];const wd=st.weekday||dayName();return classes.filter(x=>x.weekday===wd).sort((a,b)=>a.start_time.localeCompare(b.start_time))};
 function todayBlocks(){const day=R.localDay();const evs=[...adminEvents.map(fromAdmin),...publicEvents].filter(e=>isSaved(e)&&!e.allDay&&!hidden.includes(e.id)&&R.dayOf(e.start)===day).map(e=>({id:'ev-'+e.id,course_code:e.title,course_name:'',start_time:R.hmOf(e.start),end_time:R.hmOf(e.end||e.start),building:e.location||'Location TBA',room:'',ev:e}));return [...todayClasses(),...evs].sort((a,b)=>a.start_time.localeCompare(b.start_time))}
 function comingUp(){const day=R.localDay(),lim=new Date(Date.now()+21*864e5);const list=[...adminEvents.map(fromAdmin),...publicEvents].filter(e=>isSaved(e)&&!hidden.includes(e.id)&&new Date(e.end||e.start)>new Date()&&(R.dayOf(e.start)>day||(e.allDay&&R.dayOf(e.start)<=day))&&new Date(e.start)<=lim).sort((x,y)=>String(x.start).localeCompare(String(y.start))).slice(0,6);if(!list.length)return '';return '<div class="panel" style="margin-top:12px"><div class="section-title" style="margin:0 0 4px"><h2>Coming up on your schedule</h2><button data-goto="discover" class="btn small secondary">Find more</button></div><p class="sub" style="margin:0 0 8px">Each one moves onto My Day automatically on its date.</p>'+list.map(e=>'<div class="item row"><div><h4>'+esc(e.title)+'</h4><p>'+esc(R.niceDate(e.start))+' · '+(e.allDay?'All day':esc(R.time(e.start)))+' · '+esc(e.location||'TBA')+'</p></div><button class="btn small secondary" data-save="'+esc(e.id)+'">Remove</button></div>').join('')+'</div>'}
 function gaps(){const s=todayBlocks();const out=[];let endM=-1,prev=null;for(const b of s){const a=mins(b.start_time.slice(0,5)),z=mins(b.end_time.slice(0,5));if(prev&&a-endM>=25)out.push({start:hm(endM),end:b.start_time.slice(0,5),span:a-endM,after:prev,before:b});if(z>endM){endM=z;prev=b}}return out}
 const todaysEvents=()=>allEvents().filter(e=>R.dayOf(e.start)===R.localDay()||(new Date(e.start)<=new Date()&&new Date(e.end)>new Date()));
 function fitsGap(e){if(R.dayOf(e.start)!==R.localDay()||e.allDay)return false;const s=mins(R.hmOf(e.start)),en=mins(R.hmOf(e.end||e.start));return gaps().some(g=>Math.min(en,mins(g.end))-Math.max(s,mins(g.start))>=20)}
 function planFor(g){
  const gs=mins(g.start),ge=mins(g.end),now=mins(R.nowHM()),WALK=10;
  const lunch=Math.min(ge,14*60)-Math.max(gs,11*60)>=25,dinner=Math.min(ge,19*60+30)-Math.max(gs,17*60)>=25;
  const label=lunch?'Lunch break':dinner?'Dinner break':g.span>=90?'Long break':'Free time';
  const evs=todaysEvents().filter(e=>{if(e.allDay)return false;if(e.campus&&e.campus!==myCampus())return false;const s=mins(R.hmOf(e.start)),en=mins(R.hmOf(e.end||e.start));return Math.min(en,ge)-Math.max(s,gs)>=20}).map(e=>{const s=mins(R.hmOf(e.start)),en=mins(R.hmOf(e.end||e.start));return {e,fits:s>=gs&&en<=ge-WALK}});
  const order=ranked(evs.map(x=>x.e));evs.sort((x,y)=>(isSaved(y.e)-isSaved(x.e))||(y.fits-x.fits)||(order.indexOf(x.e)-order.indexOf(y.e)));
  const dining=placesOn('dining').filter(p=>openDuring(p,gs,ge,25));
  const study=[...placesOn('study'),...(C.resources||[]).filter(r=>/success center|writing center|tutor/i.test(r.name)).map(r=>({name:r.name,url:r.url,res:true}))];
  const gym=g.span>=75?placesOn('fitness').filter(p=>openDuring(p,gs,ge,45)):[];
  const items=[];const meal=lunch?'Lunch':'Dinner';
  if(lunch||dinner){if(dining[0]){items.push({k:'Eat',t:dining[0].name,d:meal+' · open '+hoursText(dining[0])+(dining[0].where?' · '+dining[0].where:''),link:dining[0].links?.[0]?.url});if(dining[1])items.push({k:'Eat',t:dining[1].name,d:'Also open'+(dining[1].where?' · '+dining[1].where:''),link:dining[1].links?.[0]?.url})}else items.push({k:'Eat',t:'Pack or grab '+meal.toLowerCase(),d:'No campus dining is open during this break',link:''})}
  if(evs[0]){const x=evs[0];items.push({k:'Go',t:x.e.title,d:R.time(x.e.start)+(x.e.end?'–'+R.time(x.e.end):'')+' · '+(x.e.location||'TBA')+' · '+(isSaved(x.e)?'on your schedule':x.fits?'fits this break':'overlaps part of this break'),ev:x.e})}
  if(!lunch&&!dinner&&g.span>=75&&dining[0])items.push({k:'Snack',t:dining[0].name,d:'Open '+hoursText(dining[0]),link:dining[0].links?.[0]?.url});
  if(g.span>=45&&study[0]&&items.length<4)items.push({k:'Study',t:study[0].name,d:study[0].where||'Free tutoring and quiet space',link:study[0].links?.[0]?.url||study[0].url});
  if(gym[0]&&items.length<4)items.push({k:'Move',t:gym[0].name,d:hoursText(gym[0]),link:gym[0].links?.[0]?.url});
  if(!items.length)items.push({k:'Break',t:g.span>=60?'Time to study or recharge':'Short break before your next class',d:''});
  return {items,label,more:evs.slice(1,4).map(x=>x.e),past:ge<=now,live:gs<=now&&now<ge};
 }
 function lunchNote(){const s=todayBlocks();if(!s.length)return '';const lev=s.find(b=>b.ev&&Math.min(mins(b.end_time.slice(0,5)),13*60+30)-Math.max(mins(b.start_time.slice(0,5)),11*60+30)>0);if(lev){const f=placesOn('dining')[0];return '<div class="notice">Lunch overlaps '+esc(lev.course_code)+'.'+(f?' Grab food at '+esc(f.name)+' before it starts.':' Bring something to eat.')+'</div>'}const g=gaps();if(g.some(x=>Math.min(mins(x.end),14*60)-Math.max(mins(x.start),11*60)>=25))return '';const busy=s.some(c=>Math.min(mins(c.end_time.slice(0,5)),13*60+30)-Math.max(mins(c.start_time.slice(0,5)),11*60+30)>0);if(!busy)return '';const first=s[0],last=s[s.length-1];return '<div class="notice warning">No lunch break between classes today. Eat before '+esc(fmtTime(first.start_time))+' or after '+esc(fmtTime(last.end_time))+'.</div>'}
 function addedToday(){const list=todaysEvents().filter(e=>isSaved(e)&&!e.allDay).sort((x,y)=>String(x.start).localeCompare(String(y.start)));if(!list.length)return '';return '<div class="panel" style="margin-top:12px"><div class="section-title" style="margin:0 0 10px"><h2>Added to today</h2><button data-goto="discover" class="btn small secondary">Find more</button></div>'+list.map(e=>'<div class="item row"><div><h4>'+esc(e.title)+'</h4><p>'+esc(R.time(e.start))+(e.end?' – '+esc(R.time(e.end)):'')+' · '+esc(e.location||'TBA')+'</p></div><button class="btn small secondary" data-save="'+esc(e.id)+'">Remove</button></div>').join('')+'</div>'}
 function overlaps(entry){return classes.find(c=>c.weekday===entry.weekday&&entry.start_time<c.end_time.slice(0,5)&&entry.end_time>c.start_time.slice(0,5))}

 /* ---------- data ---------- */
 const getUser=async()=>{if(R.client){const {data:{user:u},error}=await R.client.auth.getUser();if(error||!u)return null;return u}const d=R.demo.load();return d.account?{id:d.account.id,email:d.account.email}:null};
 async function getProfile(){if(R.client)return R.check(await R.client.from('profiles').select('*').eq('id',user.id).maybeSingle());return R.demo.load().profile}
 async function upsertProfile(payload){
  const priv=(payload.interests||[]).filter(i=>PRIVATE.has(i));
  if(payload.interests){savePrivate(priv);payload={...payload,interests:payload.interests.filter(i=>!PRIVATE.has(i))}}
  if(R.client)R.check(await R.client.from('profiles').update(payload).eq('id',user.id).select().single());
  else{const d=R.demo.load();d.profile={...d.profile,...payload};R.demo.save(d)}
 }
 async function loadPublicEvents(){
  publicEvents=(D.events?.events||[]).map(e=>({...e,title:noEmoji(e.title),desc:noEmoji(e.desc),source:e.source||'calendar'}));
  if(R.cfg.liveEventsUrl){try{const r=await fetch(R.cfg.liveEventsUrl,{cache:'no-store'});if(r.ok){const j=await r.json();if(Array.isArray(j.events)&&j.events.length)publicEvents=j.events}}catch(e){console.warn('Live events unavailable; using bundled events',e.message)}}
 }
 async function load(){
  if(R.client){
   const iso=new Date().toISOString();
   const res=await Promise.all([
    R.client.from('class_schedule').select('*').eq('user_id',user.id).order('start_time'),
    R.client.from('campus_events').select('*').eq('published',true).gte('ends_at',iso).order('starts_at',{ascending:true}).limit(250),
    R.client.from('follows').select('*').eq('user_id',user.id),
    R.client.from('saved_events').select('*').eq('user_id',user.id),
    R.client.from('announcements').select('*').eq('published',true).gte('ends_at',iso).order('created_at',{ascending:false}),
    R.client.from('pilot_surveys').select('phase,created_at').eq('user_id',user.id).order('created_at',{ascending:false}),
    R.client.from('saved_public_events').select('event_key').eq('user_id',user.id)
   ]);
   const [cl,ev,fo,sa,an,su]=res.slice(0,6).map(R.check);
   classes=cl||[];adminEvents=ev||[];follows=fo||[];saved=(sa||[]).map(x=>x.event_id);announcements=an||[];surveys=su||[];
   savedPublic=res[6].error?[]:(res[6].data||[]).map(x=>x.event_key); // table is new in V14; tolerate older schema
  }else{
   const d=R.demo.load();
   classes=d.schedules||[];adminEvents=(d.events||[]).filter(x=>x.published&&new Date(x.ends_at)>new Date());follows=d.follows||[];saved=d.saved||[];savedPublic=d.savedPublic||[];announcements=(d.announcements||[]).filter(x=>x.published&&new Date(x.ends_at)>new Date());surveys=(d.survey||[]).slice().reverse();
  }
  try{hidden=JSON.parse(localStorage.getItem(`roam-hidden-${user.id}`)||'[]')}catch{hidden=[]}
 }


 /* ---------- daily digest: don't miss anything ---------- */
 let newIds=new Set();
 function computeNew(){
  const k=`roam-seen-${user.id}`;let seen=null;try{seen=JSON.parse(localStorage.getItem(k)||'null')}catch{}
  const up=allEvents();const mine=up.filter(e=>score(e)>=3);
  newIds=new Set(seen?mine.filter(e=>!seen.includes(e.id)).map(e=>e.id):[]);
  try{localStorage.setItem(k,JSON.stringify(up.map(e=>e.id).slice(-800)))}catch{}
 }
 const weekAhead=()=>{const end=Date.now()+7*86400000;return ranked(allEvents().filter(e=>new Date(e.start).getTime()<=end&&R.dayOf(e.start)>R.localDay()&&score(e)>=3)).slice(0,6)};
 const dataStamp=()=>{const g=D.events?.generatedAt;if(!g)return '';const h=(Date.now()-new Date(g))/3600000;return h<24?`Campus data updated ${R.time(g)}${R.dayOf(g)===R.localDay()?' today':' yesterday'}`:`Campus data updated ${R.niceDate(g)}`};
 /* ---------- add to home screen ---------- */
 let installEvt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;if(tab==='today'&&profile?.onboarded&&!$('#app').classList.contains('hidden'))renderToday()});
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
 function installCard(){let off=false;try{off=localStorage.getItem('roam-install-dismissed')==='1'}catch{}if(standalone()||off)return '';
  const how=installEvt?`<button class="btn small gold" data-install="1">Add to Home Screen</button>`:ios()?`<span>Tap <b>Share</b> <span aria-hidden="true">⬆︎</span> then <b>Add to Home Screen</b>.</span>`:`<span>Open your browser menu <b>⋮</b> and tap <b>Add to Home screen</b> / <b>Install app</b>.</span>`;
  return `<div class="notice"><div class="row"><span><b>Put Campus Roam on your home screen</b> — opens like an app, works offline. ${installEvt?'':how}</span><span class="btnrow" style="margin:0">${installEvt?how:''}<button class="btn small secondary" data-installdismiss="1">Later</button></span></div></div>`}

 /* ---------- screens ---------- */
 const authShow=()=>{
  ['app','onboarding'].forEach(s=>$('#'+s).classList.add('hidden'));$('#auth').classList.remove('hidden');$('#logout').classList.add('hidden');
  const closed=R.cfg.closeSignupsAfterEnd&&R.pilotOver();if(closed&&authMode==='signup')authMode='signin';
  const titles={signup:'Join the 70-student pilot',signin:'Welcome back',forgot:'Reset your password',recover:'Choose a new password'};
  $('#authTitle').textContent=titles[authMode];
  $('#signupFields').classList.toggle('hidden',authMode!=='signup');
  $('#emailField').classList.toggle('hidden',authMode==='recover');
  $('#passwordField').classList.toggle('hidden',authMode==='forgot');
  $('#authForm').elements.email.required=authMode!=='recover';
  $('#authForm').elements.password.required=authMode!=='forgot';
  $('#authForm').elements.password.autocomplete=authMode==='signin'?'current-password':'new-password';
  $('#authSubmit').textContent={signup:'Create my account',signin:'Sign in',forgot:'Email me a reset link',recover:'Save new password'}[authMode];
  $('#authToggle').textContent=authMode==='signup'?'Already joined? Sign in':closed?'Sign-up closed — sign in':'New to ROAM? Create an account';
  $('#authToggle').disabled=closed&&authMode==='signin';
  $('#forgotLink').classList.toggle('hidden',authMode!=='signin');
  $('#mode').textContent='PILOT';
  let n='';
  if(R.libMissing)n=status('ROAM could not reach its sign-in service. Check your connection and reload. (Admins: the Supabase library failed to load.)','error');
  else if(!R.configured)n=status('Local mode: everything works on this device and your data stays in this browser. Use a password you don\'t use elsewhere.','warning');
  if(closed)n+=status(`The pilot ended ${R.prettyDate(R.cfg.pilotEnd)}. New sign-ups are closed.`,'');
  $('#authNotice').innerHTML=n;
  if(R.libMissing)$('#authSubmit').disabled=true;
 };
 function interestButtons(){
  const groups=C.interestGroups?.length?C.interestGroups:[...new Set(INTERESTS.map(i=>i.group))];
  return groups.map(g=>{const items=INTERESTS.filter(i=>i.group===g);if(!items.length)return '';return `<div class="pillgroup"><div class="sub"><b>${esc(g)}</b></div>${items.map(x=>`<button class="pillselect ${interestSet.has(x.id)?'selected':''}" data-interest="${esc(x.id)}" type="button" aria-pressed="${interestSet.has(x.id)}">${esc(x.label)}${x.private?' (private)':''}</button>`).join('')}</div>`}).join('')+`<p class="sub">Private interests are kept only on this device, never sent to the ROAM team.</p>`;
 }
 const majorOptions=sel=>`<option value="">Choose a major</option>${A.colleges.map(c=>{const ms=A.majors.filter(m=>m.college===c.id);return ms.length?`<optgroup label="${esc(c.short||c.name)}">${ms.map(m=>`<option ${m.name===sel?'selected':''}>${esc(m.name)}</option>`).join('')}</optgroup>`:''}).join('')}`;
 const yearOptions=sel=>`<option value="">Select</option>${YEARS.map(y=>`<option ${y===sel?'selected':''}>${esc(y)}</option>`).join('')}`;
 const campusOptions=sel=>CAMPUSES.map(c=>`<option value="${esc(c.id)}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join('');
 function onboardShow(){
  ['auth','app'].forEach(s=>$('#'+s).classList.add('hidden'));$('#onboarding').classList.remove('hidden');$('#logout').classList.remove('hidden');
  interestSet=new Set(myInterests());const f=$('#onboardForm');
  f.elements.first_name.value=profile?.first_name||'';
  f.elements.major.innerHTML=majorOptions(profile?.major);f.elements.year.innerHTML=yearOptions(profile?.year);f.elements.campus.innerHTML=campusOptions(profile?.campus||CAMPUSES[0].id);
  $('#interestChoices').innerHTML=interestButtons();
 }
 const signedOut=()=>{user=null;profile=null;R.setTracking(null,false);authShow()};
 function boot(){computeNew();['auth','onboarding'].forEach(x=>$('#'+x).classList.add('hidden'));$('#app').classList.remove('hidden');$('#logout').classList.remove('hidden');$('#mode').textContent='PILOT';R.setTracking(user.id,profile.consent);const h=location.hash.slice(1);switchTab(['today','discover','schedule','major','community','resources','dates','profile'].includes(h)?h:'today');R.track('app_open','app')}
 function switchTab(next){tab=next;document.querySelectorAll('#tabs [data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false')});try{history.replaceState(null,'','#'+tab)}catch{}render();window.scrollTo({top:0});R.track('tab_view',next)}
 const head=(label,desc,sub='Explore Georgia Southern through a schedule-first, student-powered ROAM experience.')=>`<div class="hero"><div class="eyebrow">${esc(label)}</div><h1>${esc(desc)}</h1><p>${esc(sub)}</p></div>`;
 const quickLinks=()=>A.quickLinks?.length?`<div class="qlgrid">${A.quickLinks.map(q=>`<a class="ql" target="_blank" rel="noopener noreferrer" href="${esc(validURL(q.url))}" data-resource="${esc(q.label)}"><b>${esc(q.label)}</b><span>${esc(q.sub||'')}</span></a>`).join('')}</div>`:'';
 async function loadWeather(){if(R.cfg.noNetwork){const w=$('#weatherSlot');if(w)w.innerHTML=`<div class="sub">${esc(campusName(myCampus()))} campus · ${esc(R.time(new Date()))}</div>`;return}const codes={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Cloudy',45:'Fog',48:'Fog',51:'Drizzle',53:'Drizzle',55:'Drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Snow',80:'Showers',81:'Showers',82:'Heavy showers',95:'Thunderstorms'};const loc=myCampus()==='armstrong'?[31.9785,-81.1617,'Savannah']:[32.4217,-81.7832,'Statesboro'];try{if(!weather){const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc[0]}&longitude=${loc[1]}&current=temperature_2m,weather_code&daily=precipitation_probability_max&forecast_days=1&temperature_unit=fahrenheit&timezone=America%2FNew_York`);if(!r.ok)throw Error('Unavailable');const j=await r.json();weather={...j.current,rain:j.daily?.precipitation_probability_max?.[0]}}const w=$('#weatherSlot');if(w)w.innerHTML=`<div class="metric">${Math.round(weather.temperature_2m)}°F</div><div class="sub">${esc(codes[weather.weather_code]||'')}${weather.rain!=null?` · ${weather.rain}% chance of rain today`:''}${weather.rain>=50?' — bring an umbrella between classes':''}</div><div class="sub">${loc[2]} · Open-Meteo</div>`}catch{const w=$('#weatherSlot');if(w)w.textContent='Weather unavailable — your schedule still works.'}}
 function surveyDue(){
  const has=p=>surveys.some(s=>s.phase===p);
  if(!has('baseline'))return {phase:'baseline',label:'Starting check-in (before you use ROAM much)'};
  if((R.daysLeft()<=7||R.pilotOver())&&!has('exit'))return {phase:'exit',label:'Final check-in (end of pilot)'};
  const lastW=surveys.find(s=>s.phase==='weekly'||s.phase==='baseline');
  const since=lastW?daysBetween(R.dayOf(lastW.created_at),R.localDay()):99;
  if(since>=6&&!R.pilotOver())return {phase:'weekly',label:'Weekly check-in'};
  return null;
 }

 function initPager(id='daypages',key='dayPage'){const c=document.getElementById(id);if(!c)return;const pages=[...c.children];let cur=-1;const fit=()=>{const w=c.clientWidth||1;const i=Math.max(0,Math.min(pages.length-1,Math.round(c.scrollLeft/w)));if(i!==cur){if(cur>=0){const top=c.getBoundingClientRect().top+window.scrollY-70;if(window.scrollY>top)window.scrollTo({top})}cur=i;ui[key]=i;document.querySelectorAll('[data-pagerfor="'+id+'"] button').forEach((b,j)=>b.classList.toggle('on',j===i))}c.style.height=pages[i].offsetHeight+'px'};c.scrollLeft=(ui[key]||0)*c.clientWidth;fit();let tm;c.addEventListener('scroll',()=>{clearTimeout(tm);tm=setTimeout(fit,90)},{passive:true});if(window.ResizeObserver){const ro=new ResizeObserver(()=>fit());pages.forEach(p=>ro.observe(p))}}
 function renderToday(){
  const st=termStatus(),s=todayBlocks(),g=gaps(),now=R.nowHM();
  const current=s.find(x=>x.start_time.slice(0,5)<=now&&x.end_time.slice(0,5)>now);
  const next=s.find(x=>x.start_time.slice(0,5)>now);
  const dl=nextDeadline();const dlDays=dl?daysBetween(R.localDay(),dl.date):null;
  const hr=Number(now.slice(0,2));const sv=surveyDue();
  const openFood=placesOn('dining').map(p=>({p,o:openStatus(p)})).filter(x=>x.o.open).slice(0,4);
  const later=s.length?ranked(todaysEvents().filter(e=>!e.allDay&&R.hmOf(e.start)>=s[s.length-1].end_time.slice(0,5))).slice(0,2):[];
  const todayBest=ranked(todaysEvents()).slice(0,3);
  const nextCard=current?`<div class="sub">${current.ev?'Happening now':'In class now'}</div><div class="metric" style="font-size:20px">${esc(current.course_code)}</div><div class="sub">Until ${esc(fmtTime(current.end_time))} · ${esc(current.building||'TBA')} ${esc(current.room||'')}</div>`:`<div class="sub">Next up</div><div class="metric" style="font-size:20px">${esc(next?.course_code||(st.classes?'Your time':'No classes'))}</div><div class="sub">${next?`${esc(fmtTime(next.start_time))} · ${esc(next.building||'TBA')} ${esc(next.room||'')}`:esc(st.classes?'No more classes today':st.label)}</div>`;
  $('#screen').innerHTML=`<div class="daypages" id="daypages"><section class="daypage" aria-label="My Day"><div class="studenthead">${head('Your campus, simplified',`Good ${hr<12?'morning':hr<17?'afternoon':'evening'}, ${profile.first_name||'Roamer'}`,st.label)}</div>
  ${st.kind==='makeup'?status(`Today is a ${st.label}. ROAM is showing your ${st.weekday} classes.`,'warning'):''}
  ${quickLinks()}
  <div class="cards"><div class="card"><div class="sub">Today</div><div class="metric">${esc(dayName())}</div><div class="sub">${esc(R.prettyDate(R.localDay()))}</div></div><div class="card">${nextCard}</div><div class="card"><div class="sub">${dl?'Next deadline':'Pilot countdown'}</div><div class="metric">${dl?`${dlDays===0?'Today':dlDays+' day'+(dlDays===1?'':'s')}`:R.daysLeft()+' days'}</div><div class="sub">${dl?esc(dl.title):'Through Dec 20, 2026'}</div></div></div>
  <div class="panel"><div class="section-title" style="margin:0 0 12px"><h2>Today's schedule</h2><button data-goto="schedule" class="btn small secondary">Edit</button></div>${s.length?`<div class="timeline">${s.map(c=>{const live=c===current;return `<div class="item"><h4>${esc(c.course_code)}${c.course_name?' · '+esc(c.course_name):''} ${live?'<span class="chip greenchip">Now</span>':''}${c.ev?'<span class="chip goldchip">Added</span>':''}</h4><p>${esc(fmtTime(c.start_time))} – ${esc(fmtTime(c.end_time))} · ${esc(c.building||'Building TBA')} ${esc(c.room||'')}</p></div>`}).join('')}</div>`:(st.classes?(classes.length?'<div class="empty">No classes on your schedule today. Enjoy the open day — see what\'s happening below.</div>':'<div class="empty">Add your classes to make your day useful.<br><button data-goto="schedule" class="btn small gold" style="margin-top:12px">Add first class</button></div>'):`<div class="empty">${esc(st.label)}.<br>${classes.length?'Your schedule is saved for when classes resume.':''}</div>`)}</div>${comingUp()}
  <button type="button" class="swipehint" data-daypage="1">Swipe for Right now &amp; your plan <span>→</span></button><div class="pagedots"><i class="on"></i><i></i></div></section><section class="daypage" aria-label="Right now and your plan">
  <div class="pagehead"><button type="button" class="btn secondary small" data-daypage="0">← My Day</button><div class="pagedots"><i></i><i class="on"></i></div></div>
  ${sv?`<div class="notice"><div class="row"><span>${esc(sv.label)} — 30 seconds, helps the pilot.</span><button class="btn small gold" data-goto="profile" data-focus="survey">Take it</button></div></div>`:''}
  ${installCard()}
  ${newIds.size?`<div class="section-title"><h2>${newIds.size} new for you since your last visit</h2><button class="btn secondary small" data-view="new">See all new</button></div><div class="panel">${ranked(allEvents().filter(e=>newIds.has(e.id))).slice(0,3).map(e=>eventCard(e,true)).join('')}</div>`:''}
  <div class="panel"><h3>Right now</h3><div id="weatherSlot" class="sub">Loading weather…</div><div class="separator"></div><h3>Open to eat now</h3>${openFood.length?openFood.map(x=>`<div class="item row"><div><h4>${esc(x.p.name)}</h4><p>${esc(x.p.where||'')}</p></div><span class="chip ${x.o.cls}">${esc(x.o.text)}</span></div>`).join(''):'<p class="sub">Nothing on your campus is open right now.</p>'}<button class="btn secondary small" data-goto="resources">All dining & hours</button></div>
  <div class="section-title"><h2>Gap optimizer: your plan for today</h2><small>Classes stay fixed. Meals, events and study time are fitted into your breaks.</small></div>
  <div class="panel">${lunchNote()}${g.length?g.map(x=>{const p=planFor(x);return `<div class="item ${p.past?'muted':''}"><div class="row"><b>${esc(p.label)} · ${x.span} min · ${esc(fmtTime(x.start))}–${esc(fmtTime(x.end))}</b>${p.live?'<span class="chip greenchip">Now</span>':p.past?'<span class="chip">Done</span>':''}</div><p>After ${esc(x.after.course_code)}, before ${esc(x.before.course_code)}${x.before.building?' in '+esc(x.before.building):''}</p>${p.items.map(it=>`<div class="sugg"><span class="k">${esc(it.k)}</span><div><b>${esc(it.t)}</b>${it.d?`<p>${esc(it.d)}</p>`:''}</div>${it.ev?`<button class="btn small ${isSaved(it.ev)?'secondary':'gold'}" data-save="${esc(it.ev.id)}">${isSaved(it.ev)?'✓ Added':'+ Add'}</button>`:it.link?ext(it.link,'Info'):''}</div>`).join('')}${p.more.length?`<details><summary class="sub">${p.more.length} more event${p.more.length>1?'s':''} in this break</summary>${p.more.map(e=>eventCard(e,true)).join('')}</details>`:''}</div>`}).join(''):s.length>=2?'<p class="sub">No breaks of 25+ minutes between your classes today.</p>':`<p class="sub">${st.classes?'Add two same-day classes with a break between them and ROAM will plan the gap with events, food and study spots.':'No class breaks to plan today.'}</p>`}
  ${later.length?`<div class="separator"></div><h3>After your last class</h3>${later.map(e=>eventCard(e,true)).join('')}`:''}
  <div class="separator"></div>${ext('https://georgiasouthern.passiogo.com/','Live bus map','btn secondary small','data-route="1"')} ${ext('https://www.georgiasouthern.edu/offices/parking-transportation/campus-transit','Transit info','btn secondary small','data-route="1"')}</div>
  <div class="section-title"><h2>${todayBest.length?'Happening today':'Recommended for you'}</h2><button class="btn secondary small" data-goto="discover">See all</button></div><div class="panel">${(todayBest.length?todayBest:ranked(allEvents()).slice(0,3)).map(e=>eventCard(e)).join('')||'<div class="empty">No upcoming events right now. Check For You later.</div>'}</div>
  ${weekAhead().length?`<div class="section-title"><h2>Don't miss this week</h2><small>Picked from your interests, follows and major</small></div><div class="panel">${weekAhead().map(e=>eventCard(e,true)).join('')}</div>`:''}
  <p class="sub" style="text-align:center">${esc(dataStamp())}</p>
  ${announcements.length?`<div class="section-title"><h2>Campus ROAM updates</h2></div><div class="panel">${announcements.slice(0,3).map(a=>`<div class="item"><h4>${esc(a.title)}</h4><p>${esc(a.body)}</p></div>`).join('')}</div>`:''}
  </section></div>`;
  loadWeather();initPager();
 }

 function deptMatch(e){const mj=majorObj(profile?.major);if(!mj)return false;if((e.colleges||[]).includes(mj.college))return true;if(e.dept&&follows.some(f=>f.kind==='department'&&f.name===e.dept))return true;const col=(A.colleges||[]).find(c=>c.id===mj.college);const words=[mj.name.replace(/\s*\(.*\)/,''),...((col&&col.keywords)||[])].map(w=>w.toLowerCase()).filter(w=>w.length>3);const txt=(e.title+' '+(e.org||'')+' '+(e.dept||'')).toLowerCase();return words.some(w=>txt.includes(w))}
 function noEmoji(t){return String(t||'').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍⃣]/gu,'').replace(/[ \t]{2,}/g,' ').trim()}
 function isSA(e){return /student affairs|dean of students|leadership and community|student union|counseling|university housing|fraternity and sorority|student government|programming board|multicultural|hispanic outreach|health services|campus recreation|career|first and second year|student conduct|accessibility|military & veteran|wellness|eagle essentials/i.test((e.org||'')+' '+(e.dept||''))}
 function dkey(d){return new Intl.DateTimeFormat('en-CA',{timeZone:R.TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d))}
 function weekEndKey(){const now=new Date();const dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:R.TZ}).format(now));return dkey(now.getTime()+(dow===0?7:7-dow)*864e5)}
 function mondayOf(k){const d=new Date(k+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d}
 function grp(id,title,sub,body,count,force){if(!body)return '';const open=force||ui.open.has(id);return `<details class="grp" data-grp="${esc(id)}"${force?' data-forced="1"':''}${open?' open':''}><summary><span class="gtx"><span class="gt">${esc(title)}</span>${sub?`<span class="gs">${esc(sub)}</span>`:''}</span><span class="gc">${count}</span></summary><div class="gb">${body}</div></details>`}
 function collapseRepeats(list){
  const nk=e=>noEmoji(e.title).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const groups=new Map();list.forEach(e=>{const k=nk(e);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e)});
  const keys=[...groups.keys()].sort((a,b)=>b.length-a.length);
  for(const long of keys){for(const short of [...keys].reverse()){if(short===long||short.length<12||!groups.has(short)||!groups.has(long)||!long.startsWith(short+' '))continue;const ds=new Set(groups.get(short).map(e=>dkey(e.start)));if(groups.get(long).some(e=>ds.has(dkey(e.start)))){groups.get(short).push(...groups.get(long));groups.delete(long);break}}}
  const pick=new Map();for(const g of groups.values()){const s=[...g].sort((x,y)=>String(x.start).localeCompare(String(y.start)));const r={...s[0],_n:new Set(s.map(e=>dkey(e.start))).size,_last:s[s.length-1].start};g.forEach(e=>pick.set(e.id,r))}
  const seen=new Set(),out=[];list.forEach(e=>{const r=pick.get(e.id);if(r&&!seen.has(r.id)){seen.add(r.id);out.push(r)}});return out}
 function fyPaged(data){
  const def=ui.filter==='all'&&!ui.showNew&&!ui.showSaved&&!ui.q;if(!def)return forYou(data);
  const end=weekEndKey();const wk=data.filter(e=>dkey(e.start)<=end),later=data.filter(e=>dkey(e.start)>end);
  const byDate=(x,y)=>String(x.start).localeCompare(String(y.start));
  const per={};const sa=wk.filter(isSA).sort(byDate).filter(e=>{const k=e.org||e.dept||'';per[k]=(per[k]||0)+1;return per[k]<=2}).slice(0,8);const saIds=new Set(sa.map(e=>e.id));
  const saSec='<div class="section-title"><h2>From Student Affairs</h2><small>Campus offices posting this week</small></div>'+(sa.length?sa.map(e=>eventCard(e)).join(''):'<div class="empty">No Student Affairs events posted for the rest of this week yet.</div>');
  const weeks=new Map();[...later].sort(byDate).forEach(e=>{const m=mondayOf(dkey(e.start));const k=m.toISOString().slice(0,10);if(!weeks.has(k))weeks.set(k,{m,list:[]});weeks.get(k).list.push(e)});
  const laterHtml=[...weeks.values()].map(w=>`<div class="section-title"><h2>Week of ${esc(w.m.toLocaleDateString('en-US',{month:'long',day:'numeric',timeZone:'UTC'}))}</h2><small>${w.list.length} event${w.list.length===1?'':'s'}</small></div>${w.list.slice(0,25).map(e=>eventCard(e)).join('')}${w.list.length>25?`<p class="sub">${w.list.length-25} more that week. Search or pick an interest to narrow down.</p>`:''}`).join('')||'<div class="empty">Nothing posted beyond this week yet. New events appear here automatically as they are posted.</div>';
  const pick=ui.fyPage||0;
  return `<div class="pgseg" data-pagerfor="fypages"><button type="button" class="${pick===0?'on':''}" data-fypage="0">This week <small>${wk.length}</small></button><button type="button" class="${pick===1?'on':''}" data-fypage="1">Later <small>${later.length}</small></button></div>
  <div class="daypages" id="fypages"><section class="daypage" aria-label="This week">${saSec}${wk.length?forYou(wk.filter(e=>!saIds.has(e.id))):'<div class="empty">No more events this week.</div>'}${later.length?'<button type="button" class="swipehint" data-fypage="1">Swipe for later weeks <span>→</span></button>':''}</section><section class="daypage" aria-label="Later"><div class="pagehead"><button type="button" class="btn secondary small" data-fypage="0">← This week</button></div>${laterHtml}</section></div>`;
 }
 let coursesP=null,courseT;
 function loadCourses(){if(window.ROAM_COURSES)return Promise.resolve(window.ROAM_COURSES);return coursesP||(coursesP=new Promise(res=>{const s=document.createElement('script');s.src='courses.js';s.onload=()=>res(window.ROAM_COURSES||null);s.onerror=()=>{coursesP=null;res(null)};document.head.appendChild(s)}))}
 function courseSearch(v){clearTimeout(courseT);courseT=setTimeout(async()=>{const box=document.getElementById('courseHits');if(!box)return;const q=v.trim().toLowerCase();if(q.length<2){box.innerHTML='';return}
  const cat=await loadCourses();if(!cat){box.innerHTML='<p class="sub">The course directory is not available right now. Type the code and name below.</p>';return}
  const toks=q.split(/\s+/).filter(Boolean),qc=q.replace(/\s+/g,'');const hits=[];
  for(const [c,t] of cat.courses){const code=c.toLowerCase(),title=t.toLowerCase(),flat=code.replace(' ','');const byCode=flat.startsWith(qc);if(!byCode&&!toks.every(k=>(code+' '+title).includes(k)))continue;hits.push([byCode?0:(' '+title).includes(' '+toks[0])?1:2,c,t,parseInt(c.split(' ')[1])||9999])}
  hits.sort((a,b)=>a[0]-b[0]||a[3]-b[3]||a[1].localeCompare(b[1]));
  box.innerHTML=hits.length?hits.slice(0,8).map(([,c,t])=>`<button type="button" class="coursehit" data-course="${esc(c+'|'+t)}"><b>${esc(c)}</b><span>${esc(t)}</span></button>`).join('')+(hits.length>8?`<p class="sub">${hits.length-8} more. Keep typing to narrow it down.</p>`:''):'<p class="sub">No match in the course catalog. You can still type it below.</p>'},150)}
 function pickCourse(v){const i=v.indexOf('|');const f=document.getElementById('classForm');if(!f)return;f.course_code.value=v.slice(0,i);f.course_name.value=v.slice(i+1).slice(0,100);const fi=document.getElementById('courseFind');if(fi)fi.value='';const box=document.getElementById('courseHits');if(box)box.innerHTML=`<p class="sub">Added ${esc(v.slice(0,i))}. Now choose the days, times and building.</p>`}
 function buildingOptions(){
  const B={statesboro:['Arts Building','Biological Sciences Building','Carroll Building','Carruth Building','Center for Art & Theatre','College of Business','College of Education','Engineering Building','Engineering and Research Building','Fielding D. Russell Union','Forest Drive Classroom Building','Foy Building','Hanner Complex','Herty Building','Hollis Building','Information Technology Building','Interdisciplinary Academic Building','Interior Design Complex','Jack and Ruth Hill Convocation Center','Marvin Pittman Administration Building','Math/Physics Building','Military Science Building','Natural Sciences Building','Nessmith-Lane Center','Newton Building','Nursing/Chemistry Building','Performing Arts Center','Physical Education Building','Planetarium','Recreation Activity Center','Rosenwald Building','School of Human Ecology','Williams Center','Zach S. Henderson Library'],
   armstrong:['Armstrong Center','Ashmore Hall','Burnett Hall','Fine Arts Hall','Gamble Hall','Hawes Hall','Jenkins Hall','Lane Library','Learning Commons','MCC (Memorial College Center)','Science Center','Solms Hall','Sports Center','Student Union','University Hall','Victor Hall','Waters College of Health Professions']};
  const mine=B[myCampus()]?myCampus():'statesboro',other=mine==='armstrong'?'statesboro':'armstrong';const nm=id=>(CAMPUSES.find(c=>c.id===id)||{}).name||id;const opt=n=>`<option>${esc(n)}</option>`;
  return `<option value="">Choose a building</option><optgroup label="${esc(nm(mine))} campus">${B[mine].map(opt).join('')}</optgroup><optgroup label="${esc(nm(other))} campus">${B[other].map(opt).join('')}</optgroup><optgroup label="Other">${opt('Online (Folio)')}${opt('Liberty Campus (Hinesville)')}${opt('Other / not listed')}</optgroup>`}
 /* ---------- school theme: each campus sets its colors in config.js ---------- */
 (function applyTheme(){
  let T=R.cfg.theme||null;try{if(new URLSearchParams(location.search).get('brand')==='roam')T={name:'Campus ROAM',primary:'#2f3e55',accent:'#0f766e'}}catch{}
  if(!T||!/^#?[0-9a-f]{3,6}$/i.test(String(T.primary||'')))return;
  const hex=h=>{h=String(h).replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return [n>>16&255,n>>8&255,n&255]};
  const lum=h=>{const [r,g,b]=hex(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const mix=(a,b,t)=>'#'+hex(a).map((v,i)=>Math.round(v+(hex(b)[i]-v)*t).toString(16).padStart(2,'0')).join('');
  const on=bg=>ratio(bg,'#ffffff')>=ratio(bg,'#111827')?'#ffffff':'#111827';
  const p='#'+String(T.primary).replace('#',''),a='#'+String(T.accent||T.primary).replace('#','');const s=document.documentElement.style;
  s.setProperty('--navy',p);s.setProperty('--navy2',mix(p,'#ffffff',.15));s.setProperty('--gold',a);s.setProperty('--on-navy',on(p));s.setProperty('--on-gold',ratio(a,p)>=4.5?p:on(a));
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=p;
 })();
 /* ---------- Ask ROAM: answers only from this school's published information ---------- */
 const ASK_STOP=new Set('a an the is are was were be do does did i im i\'m me my we our you your it its of to in on at for from and or what whats what\'s when where who how can could should would will there any get find tell about need want please with this that today'.split(' '));
 const ASK_SYN={food:['dining','eat','meal','pantry','lunch','breakfast','dinner','coffee'],eat:['dining','food','meal'],hungry:['dining','food','pantry'],tutor:['tutoring','academic success','writing','study'],tutoring:['academic success','writing'],job:['career','handshake','internship'],jobs:['career','handshake','internship'],internship:['career','handshake'],sick:['health','clinic'],doctor:['health','clinic'],health:['health services','clinic'],counseling:['counseling','mental'],therapy:['counseling'],stress:['counseling'],mental:['counseling'],parking:['parking','transit'],park:['parking','transit'],final:['final exam','exams'],exam:['final exam','exams'],bus:['shuttle','transit','express'],shuttle:['transit','bus','express'],gym:['recreation','fitness','rac'],workout:['recreation','fitness'],money:['financial aid','scholarship','bursar'],aid:['financial aid'],scholarship:['financial aid','scholarship'],tuition:['bursar','pay','fees'],print:['printing','library'],printing:['print','library'],wifi:['it','technology','help desk'],password:['it','help desk','mygs'],advisor:['advising'],advising:['advisor','advising'],library:['henderson','lane','library'],study:['library','study'],club:['organization'],clubs:['organization'],withdraw:['withdraw','withdrawal'],drop:['drop','withdraw']};
 let askIdx=null;
 function askIndex(){if(askIdx)return askIdx;const docs=[];const add=(type,title,text,url,extra,say)=>docs.push({type,title:String(title||''),text:String(text||''),url:url||'',extra:extra||{},say:String(say??text??'')});
  (C.help||[]).forEach(h=>add('help',h.name,h.detail,'',{phone:h.phone},h.detail));
  (C.places||[]).filter(p=>!p.campus||p.campus===myCampus()).forEach(p=>add('place',p.name,[p.category,p.where,p.note].join(' '),(p.links||[])[0]?.url,{place:p}));
  (C.resources||[]).forEach(r=>add('resource',r.name,r.category+' '+(r.desc||''),r.url,{},r.desc||''));
  (C.hiddenGems||[]).forEach(g=>add('gem',g.title,g.what,(g.links||[])[0]?.url));
  (C.transit||[]).forEach(t=>add('transit',t.name,t.detail,(t.links||[])[0]?.url));
  (A.quickLinks||[]).forEach(q=>add('link',q.label,q.sub,q.url));
  const termSrc=Object.fromEntries((C.terms||[]).map(t=>[t.id,t.source]));
  (C.dates||[]).forEach(d=>add('date',d.title,d.kind+' '+(d.kind==='exam'?'final exams finals':''),termSrc[d.term]||'',{date:d}));
  (D.orgs?.orgs||[]).forEach(o=>add('org',noEmoji(o.name),(o.cats||[]).join(' ')+' '+noEmoji(o.desc||'').slice(0,300),ENGAGE&&o.uri?`${ENGAGE}/organization/${o.uri}`:'',{org:o},noEmoji(o.desc||'Student organization on Eagle Engage')));
  return askIdx=docs}
 const ASK_LABEL={help:'Help line',place:'Hours and locations',resource:'Campus resources',gem:'Campus resources',transit:'Getting around',link:'Student portals',date:'Academic calendar',org:'Eagle Engage directory',event:'Events calendar',course:'Course catalog'};
 function askTokens(s){const base=s.toLowerCase().replace(/[^a-z0-9&' ]+/g,' ').split(/\s+/).filter(w=>w.length>1&&!ASK_STOP.has(w)).map(w=>w.length>4&&/[^s]s$/.test(w)?w.slice(0,-1):w);const out=[];base.forEach(w=>{out.push({w,weight:1});(ASK_SYN[w]||[]).forEach(x=>out.push({w:x,weight:.6}))});return out}
 const askRe=new Map();function askHas(hay,w){let r=askRe.get(w);if(!r){r=new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"(s|es|ing|ed|'s)?\\b");askRe.set(w,r)}return r.test(hay)}
 function askScore(doc,toks){const t=doc.title.toLowerCase(),x=doc.text.toLowerCase();let s=0;for(const {w,weight} of toks){if(askHas(t,w))s+=3*weight;else if(askHas(x,w))s+=1*weight}return s}
 function askEventsWindow(s){const today=R.localDay();if(/\btonight\b|\btoday\b/.test(s))return [today,today];if(/\btomorrow\b/.test(s)){const t=addDays(today,1);return [t,t]}if(/\bweekend\b/.test(s)){let d=today;while(dowOf(d)!==6&&dowOf(d)!==0)d=addDays(d,1);return [d,dowOf(d)===6?addDays(d,1):d]}if(/\bthis week\b|\bweek\b/.test(s))return [today,weekEndKey()];return [today,addDays(today,30)]}
 async function askRoam(q){
  const s=q.toLowerCase().trim();const toks=askTokens(s);const res={answer:'',items:[]};
  if(/suicid|kill myself|hurt myself|self.?harm|overdos|emergency|assault|in danger|unsafe|crisis/.test(s)){res.answer='If you are in danger or thinking about hurting yourself, reach out now. These lines answer 24/7.';res.items=(C.help||[]).slice(0,4).map(h=>({type:'help',title:h.name,line:`${h.detail} · ${h.phone}`,phone:h.phone}));return res}
  const idx=askIndex();
  if(/\b(open|opens|close|closes|closing|closed|hours)\b/.test(s)){const ps=idx.filter(d=>d.type==='place').map(d=>({d,sc:askScore(d,toks.filter(t=>!/^(open|opens|close|closes|closing|closed|hours|now)$/.test(t.w)))})).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,4);
   if(ps.length){res.items=ps.map(({d})=>{const o=openStatus(d.extra.place);return {type:'place',title:d.title,line:`${o.text}${d.extra.place.hours?' · today '+hoursText(d.extra.place):''}${d.extra.place.where?' · '+d.extra.place.where:''}`,url:d.url}});const p=ps[0].d.extra.place,o=openStatus(p);res.answer=o.known?`${p.name}: ${o.text.toLowerCase()}${p.hours?`. Today's hours: ${hoursText(p)}`:''}.`:`${p.name} doesn't publish set hours in ROAM's sources. Check the linked page.`;return res}}
  if(/\b(when|deadline|last day|drop|withdraw|finals?|exams?|break|holiday|registration|register|graduation|commencement|semester|classes (start|end|begin))\b/.test(s)){const today=R.localDay();const ds=idx.filter(d=>d.type==='date').map(d=>({d,sc:askScore(d,toks)})).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc||((a.d.extra.date.end||a.d.extra.date.date)<today)-((b.d.extra.date.end||b.d.extra.date.date)<today)).slice(0,4);
   if(ds.length){res.items=ds.map(({d})=>({type:'date',title:d.title,line:R.prettyDate(d.extra.date.date)+(d.extra.date.end?' – '+R.prettyDate(d.extra.date.end):''),url:d.url}));const first=ds[0].d.extra.date;res.answer=`${first.title}: ${R.prettyDate(first.date)}${first.end?' to '+R.prettyDate(first.end):''}.`;return res}}
  if(/\b(event|events|happening|tonight|tomorrow|weekend|this week|free food|fair|workshop|party|concert|game)\b/.test(s)){const [a,b]=askEventsWindow(s);const evTok=toks.filter(t=>!/^(event|events|happening|tonight|tomorrow|weekend|this|week|going|on)$/.test(t.w));let ev=collapseRepeats(ranked(allEvents().filter(e=>{const k=dkey(e.start);return k>=a&&k<=b})));if(evTok.length){const sc=ev.map(e=>({e,sc:askScore({title:e.title,text:[e.desc,e.org,e.location,(e.tags||[]).join(' ')].join(' ')},evTok)})).filter(x=>x.sc>0);if(sc.length)ev=sc.sort((x,y)=>y.sc-x.sc).map(x=>x.e)}
   if(ev.length){res.items=ev.slice(0,5).map(e=>({type:'event',title:e.title,line:`${R.niceDate(e.start)} · ${e.allDay?'All day':R.time(e.start)} · ${e.location||'Location TBA'}`,url:e.url}));res.answer=`${ev.length} event${ev.length===1?'':'s'} match${a===b?` on ${R.niceDate(a+'T12:00:00')}`:''}. Here are the best fits for you.`;return res}}
  const cm=/\b([a-z]{2,5})\s*-?\s*(\d{4}[a-z]?)\b/i.exec(q);if(cm||/\b(class|course)\b/.test(s)){const cat=await loadCourses();if(cat){const code=cm?`${cm[1].toUpperCase()} ${cm[2].toUpperCase()}`:'';let hits=code?cat.courses.filter(c=>c[0]===code):[];if(!hits.length){const ct=toks.filter(t=>!/^(class|course|classes|courses)$/.test(t.w)&&t.weight===1).map(t=>t.w);hits=ct.length?cat.courses.filter(c=>ct.every(w=>(c[0]+' '+c[1]).toLowerCase().includes(w))).slice(0,5):[]}
   if(hits.length){res.items=hits.slice(0,5).map(c=>({type:'course',title:`${c[0]} · ${c[1]}`,line:`${cat.catalog} catalog`,url:'https://catalog.georgiasouthern.edu/'}));res.answer=hits.length===1?`${hits[0][0]} is ${hits[0][1]}.`:`${hits.length} courses match. You can add one from the Classes tab.`;return res}}}
  if(/\bwhere\b/.test(s)){const GEN=/^(building|buildings|hall|center|campus|room|the)$/;const key=toks.filter(t=>t.weight===1&&!GEN.test(t.w)).map(t=>t.w);const names=key.length?buildingNames().map(n=>({n,c:key.filter(w=>askHas(n.toLowerCase(),w)).length})).filter(x=>x.c>0).sort((a,b)=>b.c-a.c).map(x=>x.n):[];if(names.length){res.items=names.slice(0,3).map(n=>({type:'place',title:n,line:`${campusName(myCampus())} campus`,url:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(n+' Georgia Southern University')}));res.answer=`${names[0]} is on the ${campusName(myCampus())} campus. Open it in Maps for directions.`;return res}}
  const seenT=new Set();const hits=idx.map(d=>({d,sc:askScore(d,toks)})).filter(x=>x.sc>=1.5).sort((a,b)=>b.sc-a.sc||(a.d.type==='org')-(b.d.type==='org')).filter(x=>{const k=x.d.title.toLowerCase();if(seenT.has(k))return false;seenT.add(k);return true}).slice(0,5);
  if(!hits.length){res.answer="I couldn't find that in Georgia Southern's published information. Try other words, or browse the Resources tab.";return res}
  res.items=hits.map(({d})=>({type:d.type,title:d.title,line:d.type==='place'?`${openStatus(d.extra.place).text}${d.extra.place.where?' · '+d.extra.place.where:''}`:d.type==='date'?R.prettyDate(d.extra.date.date):d.type==='help'?`${d.say} · ${d.extra.phone}`:d.say.slice(0,140),url:d.url,phone:d.extra.phone}));
  const top=hits[0].d;res.answer=top.type==='place'?`${top.title}: ${openStatus(top.extra.place).text.toLowerCase()}.`:top.type==='help'?`${top.title}: ${top.extra.phone} (${top.say}).`:`${top.title}: ${top.say.split(/(?<=\.)\s/)[0].slice(0,180)}`;return res}
 function askHtml(r){if(!r)return '';return `<div class="askanswer"><p class="asklead">${esc(r.answer)}</p>${r.items.length?`<h3 class="asksrc">From published sources</h3><ul class="asklist">${r.items.map(i=>`<li><div><strong>${esc(i.title)}</strong><span>${esc(i.line||'')}</span><small>${esc(ASK_LABEL[i.type]||'Campus information')}</small></div>${i.phone?`<a class="btn secondary small" href="tel:${esc(i.phone)}">Call</a>`:i.url?ext(i.url,'Source','btn secondary small','data-askopen="1"'):''}</li>`).join('')}</ul>`:''}</div>`}
 let askPrev=null;
 function openAsk(){if(!user){R.alert('Sign in to use Ask ROAM.');return}if(document.getElementById('askWrap'))return;askPrev=document.activeElement;const school=(R.cfg.theme&&R.cfg.theme.name)||(C.meta?.institution)||'your school';
  const w=document.createElement('div');w.className='modalwrap askwrap';w.id='askWrap';w.innerHTML=`<div class="panel modal askpanel" role="dialog" aria-modal="true" aria-labelledby="askTitle"><div class="row"><h2 id="askTitle">Ask ROAM</h2><button type="button" class="btn secondary small" data-askclose="1">Close</button></div><p class="sub">Answers come only from ${esc(school)}'s published information, with the source linked. Always check the source for anything important.</p><form id="askForm" role="search"><label class="field" for="askQ">Your question</label><div class="askrow"><input id="askQ" type="search" autocomplete="off" maxlength="200" placeholder="Is the library open?"><button class="btn gold" type="submit">Ask</button></div></form><div class="asksuggest" aria-label="Example questions">${['Is the library open?','When are finals?','Free food this week','Where can I get tutoring?','Counseling center number','What is ECON 2106?'].map(x=>`<button type="button" class="chip" data-askq="${esc(x)}">${esc(x)}</button>`).join('')}</div><div id="askOut" aria-live="polite"></div></div>`;
  document.body.appendChild(w);w.querySelector('#askQ').focus();R.track('tab_view','ask');
  w.addEventListener('click',e=>{if(e.target===w||e.target.closest('[data-askclose]'))closeAsk();const s=e.target.closest('[data-askq]');if(s){w.querySelector('#askQ').value=s.dataset.askq;runAsk()}});
  w.addEventListener('keydown',e=>{if(e.key==='Escape')closeAsk();if(e.key==='Tab'){const f=[...w.querySelectorAll('button,input,a[href]')].filter(x=>!x.disabled);if(!f.length)return;const a=f[0],z=f.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}});
  w.querySelector('#askForm').addEventListener('submit',e=>{e.preventDefault();runAsk()})}
 function closeAsk(){document.getElementById('askWrap')?.remove();try{askPrev&&askPrev.focus()}catch{}}
 async function runAsk(){const q=document.getElementById('askQ')?.value.trim();const out=document.getElementById('askOut');if(!q||!out)return;out.innerHTML='<p class="sub">Looking through published sources…</p>';try{out.innerHTML=askHtml(await askRoam(q))}catch(e){out.innerHTML=`<p class="formmsg">Something went wrong: ${esc(R.formatErr(e))}</p>`}}
 document.addEventListener('click',e=>{if(e.target.closest('#askOpen'))openAsk()});
 function forYou(data){
  const def=ui.filter==='all'&&!ui.showNew&&!ui.showSaved&&!ui.q;if(!def)return data.slice(0,60).map(e=>eventCard(e)).join('');
  const byDate=(x,y)=>String(x.start).localeCompare(String(y.start));
  const dept=data.filter(deptMatch).sort(byDate).slice(0,10);const used=new Set(dept.map(e=>e.id));
  const fol=e=>follows.some(f=>f.kind==='organization'&&f.name===e.org)?1:0;
  const orgs=data.filter(e=>!used.has(e.id)&&(e.org||e.source==='engage')).sort((x,y)=>(fol(y)-fol(x))||(score(y)-score(x))||byDate(x,y)).slice(0,14);orgs.forEach(e=>used.add(e.id));
  const rest=data.filter(e=>!used.has(e.id)).slice(0,30);
  const mj=majorObj(profile?.major);const col=mj&&(A.colleges||[]).find(c=>c.id===mj.college);
  const sec=(t,sub,list,empty)=>'<div class="section-title"><h2>'+t+'</h2><small>'+sub+'</small></div>'+(list.length?list.map(e=>eventCard(e)).join(''):'<div class="empty">'+empty+'</div>');
  return sec('From your '+('department'),'Add these to your schedule first'+(col?' · '+esc(col.short||col.name):''),dept,mj?'Nothing posted for your '+('department')+' right now.':'Choose your '+('major')+' in Profile to see department events.')+sec('What organizations are doing','Groups you follow come first',orgs,'No organization events right now.')+(rest.length?sec('More around campus','Ranked by your interests',rest,''):'');
 }
 function renderDiscover(){
  let data=allEvents();
  if(ui.scope==='mine')data=data.filter(e=>!e.campus||e.campus===myCampus());
  if(ui.filter!=='all')data=data.filter(e=>(e.tags||[]).includes(ui.filter));
  if(ui.showNew)data=data.filter(e=>newIds.has(e.id));
  if(ui.showSaved)data=[...adminEvents.map(fromAdmin),...publicEvents].filter(e=>isSaved(e)&&new Date(e.end||e.start)>new Date());
  if(ui.q){const q=ui.q.toLowerCase();data=data.filter(e=>[e.title,e.location,e.org,e.desc].join(' ').toLowerCase().includes(q))}
  data=ranked(data);if(!ui.showSaved)data=collapseRepeats(data);const mine=myInterests();
  const opts=[...INTERESTS].sort((a,b)=>(mine.includes(b.id)-mine.includes(a.id))||a.label.localeCompare(b.label));
  $('#screen').innerHTML=`${head('For You','Picked for your major and interests','Public university calendar and Eagle Engage events, plus anything the ROAM team publishes — ranked for you.')}
  <div class="section-title"><h2>${ui.showSaved?'On your schedule':ui.showNew?'New for you':'Upcoming opportunities'}</h2><small>${data.length} event${data.length===1?'':'s'} · sorted by match and date</small></div>
  <div class="panel"><div class="formgrid"><label class="field">Explore by interest<select id="eventFilter"><option value="all">All upcoming events</option>${opts.map(x=>`<option value="${esc(x.id)}" ${ui.filter===x.id?'selected':''}>${esc(x.label)}</option>`).join('')}</select></label><label class="field">Search<input id="eventSearch" type="search" placeholder="Title, place or org" value="${esc(ui.q)}"></label></div>
  <div class="btnrow"><button class="btn small ${ui.showSaved||ui.showNew?'secondary':'gold'}" data-view="all">All</button>${newIds.size?`<button class="btn small ${ui.showNew?'gold':'secondary'}" data-view="new">New (${newIds.size})</button>`:''}<button class="btn small ${ui.showSaved?'gold':'secondary'}" data-view="saved">On my schedule (${saved.length+savedPublic.length})</button><button class="btn small secondary" data-scope="${ui.scope==='mine'?'all':'mine'}">${ui.scope==='mine'?`${esc(campusName(myCampus()))} only · show both campuses`:'Both campuses · show mine only'}</button>${hidden.length?`<button class="btn small secondary" data-unhide="1">Show ${hidden.length} hidden</button>`:''}</div>
  ${data.length?fyPaged(data):`<div class="empty">${ui.showSaved?'Nothing added yet. Tap + Add to my schedule on any event.':'No upcoming events match this view. Try another interest or both campuses.'}</div>`}
  <p class="sub">Event data: university calendar and Eagle Engage${D.events?.generatedAt?`, updated ${esc(R.niceDate(D.events.generatedAt))}`:''}. New events are added automatically about four times a day. Always confirm details on the event page.</p></div>`;
  initPager('fypages','fyPage');
 }

 /* ---------- calendar files: import classes, export reminders ---------- */
 function icsEsc(t){return String(t||'').replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
 function icsUnesc(t){return String(t||'').replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1')}
 function icsFold(line){const out=[];let s=line;while(s.length>74){out.push(s.slice(0,74));s=' '+s.slice(74)}out.push(s);return out.join('\r\n')}
 function icsStamp(d){return new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}
 function icsLocal(day,hm){return day.replace(/-/g,'')+'T'+hm.replace(':','').slice(0,4)+'00'}
 const ICS_TZ=['BEGIN:VTIMEZONE','TZID:America/New_York','BEGIN:DAYLIGHT','TZOFFSETFROM:-0500','TZOFFSETTO:-0400','TZNAME:EDT','DTSTART:19700308T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','END:DAYLIGHT','BEGIN:STANDARD','TZOFFSETFROM:-0400','TZOFFSETTO:-0500','TZNAME:EST','DTSTART:19701101T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','END:STANDARD','END:VTIMEZONE'];
 function icsWrap(events){return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Campus ROAM//Student pilot//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',...ICS_TZ,...events.flat(),'END:VCALENDAR'].map(icsFold).join('\r\n')+'\r\n'}
 function addDays(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
 function dowOf(day){return new Date(day+'T12:00:00Z').getUTCDay()}
 function activeTerm(){const today=R.localDay();return (C.terms||[]).filter(t=>t.classesEnd>=today).sort((a,b)=>a.classesStart.localeCompare(b.classesStart))[0]||null}
 function classesIcs(){
  const t=activeTerm();if(!t)return null;const today=R.localDay();const from=today>t.classesStart?today:t.classesStart;
  const until=icsStamp(R.zonedToISO(t.classesEnd+'T23:59'));const stamp=icsStamp(new Date());const BY=['SU','MO','TU','WE','TH','FR','SA'];
  const evs=classes.map(c=>{const wd=DAYS.indexOf(c.weekday);if(wd<0)return null;let first=from;for(let i=0;i<7&&dowOf(first)!==wd;i++)first=addDays(first,1);if(first>t.classesEnd)return null;
   const ex=[];for(const [a,b] of t.noClass||[]){for(let d=a;d<=b;d=addDays(d,1))if(dowOf(d)===wd&&d>=first)ex.push(icsLocal(d,c.start_time))}
   const FOL={Mo:1,Tu:2,We:3,Th:4,Fr:5};const rd=[];for(const m of t.makeup||[]){if(m.date<first)continue;if(dowOf(m.date)===wd)ex.push(icsLocal(m.date,c.start_time));if(FOL[m.follows]===wd)rd.push(icsLocal(m.date,c.start_time))}
   const where=[c.building,c.room].filter(Boolean).join(' ');
   return ['BEGIN:VEVENT','UID:roam-class-'+c.id+'@campus-roam','DTSTAMP:'+stamp,'SUMMARY:'+icsEsc(c.course_code+(c.course_name?' · '+c.course_name:'')),'DTSTART;TZID=America/New_York:'+icsLocal(first,c.start_time),'DTEND;TZID=America/New_York:'+icsLocal(first,c.end_time),'RRULE:FREQ=WEEKLY;BYDAY='+BY[wd]+';UNTIL='+until,...(ex.length?['EXDATE;TZID=America/New_York:'+ex.join(',')]:[]),...(rd.length?['RDATE;TZID=America/New_York:'+rd.join(',')]:[]),...(where?['LOCATION:'+icsEsc(where)]:[]),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(c.course_code+' starts in 15 minutes'),'TRIGGER:-PT15M','END:VALARM','END:VEVENT']}).filter(Boolean);
  return evs.length?icsWrap(evs):null}
 function savedUpcoming(){return [...adminEvents.map(fromAdmin),...publicEvents].filter(e=>isSaved(e)&&new Date(e.end||e.start)>new Date())}
 function eventsIcs(){const stamp=icsStamp(new Date());const evs=savedUpcoming().map(e=>{const end=e.end||new Date(new Date(e.start).getTime()+36e5).toISOString();return ['BEGIN:VEVENT','UID:roam-event-'+String(e.id).replace(/[^A-Za-z0-9_-]/g,'')+'@campus-roam','DTSTAMP:'+stamp,'SUMMARY:'+icsEsc(e.title),'DTSTART:'+icsStamp(e.start),'DTEND:'+icsStamp(end),...(e.location?['LOCATION:'+icsEsc(e.location)]:[]),...(e.url?['URL:'+e.url]:[]),'DESCRIPTION:'+icsEsc((e.url?e.url+'\n':'')+'Saved on Campus ROAM'),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(e.title+' starts in 30 minutes'),'TRIGGER:-PT30M','END:VALARM','END:VEVENT']});return evs.length?icsWrap(evs):null}
 function downloadIcs(text,name){const blob=new Blob([text],{type:'text/calendar;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)}
 function parseIcs(text){
  const lines=String(text).replace(/\r?\n[ \t]/g,'').split(/\r?\n/);const out=[];let cur=null;
  for(const ln of lines){if(ln==='BEGIN:VEVENT'){cur={};continue}if(ln==='END:VEVENT'){if(cur)out.push(cur);cur=null;continue}if(!cur)continue;const i=ln.indexOf(':');if(i<0)continue;const [name,...ps]=ln.slice(0,i).split(';');const P={};ps.forEach(p=>{const [k,v]=p.split('=');P[String(k).toUpperCase()]=v});const N=name.toUpperCase(),v=ln.slice(i+1);
   if(['SUMMARY','LOCATION','RRULE','STATUS'].includes(N))cur[N]=icsUnesc(v);if(N==='DTSTART'||N==='DTEND')cur[N]={v,date:P.VALUE==='DATE'||/^\d{8}$/.test(v)}}
  return out}
 function icsWhen(x){const m=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(x.v);if(!m)return null;if(/Z$/.test(x.v)){const iso=`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`;return {day:R.dayOf(iso),hm:R.hmOf(iso)}}return {day:`${m[1]}-${m[2]}-${m[3]}`,hm:`${m[4]}:${m[5]}`}}
 function buildingNames(){return [...buildingOptions().matchAll(/<option>([^<]+)<\/option>/g)].map(m=>m[1].replace(/&amp;/g,'&'))}
 function matchPlace(loc){const L=String(loc||'').toLowerCase();if(!L)return {building:'',room:''};const names=buildingNames();let b=names.find(n=>L.includes(n.toLowerCase()))||names.find(n=>{const w=n.toLowerCase().split(/[\s/]+/)[0];return w.length>3&&L.split(/[\s,]+/).includes(w)})||'';const r=(/\b(\d{3,4}[A-Z]?)\b/.exec(String(loc))||[])[1]||'';return {building:b||String(loc).slice(0,120),room:r}}
 function icsToClasses(text){
  const evs=parseIcs(text).filter(e=>e.DTSTART&&!e.DTSTART.date&&e.DTEND&&e.STATUS!=='CANCELLED');const BY={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};const groups=new Map();
  const add=(e,weekdays,count)=>{const s=icsWhen(e.DTSTART),en=icsWhen(e.DTEND);if(!s||!en||en.hm<=s.hm)return;const sum=(e.SUMMARY||'Class').trim();const up=sum.toUpperCase();const cm=/\b([A-Z]{2,5})\s*-?\s*(\d{4}[A-Z]?)\b/.exec(up);const code=cm?`${cm[1]} ${cm[2]}`:sum.slice(0,30);let name=cm?sum.slice(cm.index+cm[0].length).replace(/^[\s\-–—:·|]+/,'').replace(/\s*[-–—]\s*(lecture|lab|lec|section|sec)\b.*$/i,'').trim():'';
   if(!name&&window.ROAM_COURSES){const hit=window.ROAM_COURSES.courses.find(c=>c[0]===code);if(hit)name=hit[1]}
   const pl=matchPlace(e.LOCATION);const key=[code,s.hm,en.hm,pl.building].join('|');const g=groups.get(key)||{key,code,name:name.slice(0,100),start:s.hm,end:en.hm,...pl,days:new Set(),hits:0};weekdays.forEach(w=>g.days.add(DAYS[w]));g.hits+=count;groups.set(key,g)};
  for(const e of evs){const rr=e.RRULE||'';if(/FREQ=WEEKLY/i.test(rr)){const by=(/BYDAY=([A-Z,0-9+-]+)/i.exec(rr)||[])[1];const s=icsWhen(e.DTSTART);const ws=by?by.split(',').map(x=>BY[x.slice(-2).toUpperCase()]).filter(x=>x!=null):(s?[dowOf(s.day)]:[]);add(e,ws,5)}else{const s=icsWhen(e.DTSTART);if(s)add(e,[dowOf(s.day)],1)}}
  return [...groups.values()].filter(g=>g.hits>=3).map(g=>({...g,days:DAYS.filter(d=>g.days.has(d)),pick:true}))}
 function icsPreviewHtml(){const L=ui.ics;if(!L)return '';if(!L.length)return '<p class="formmsg">No weekly classes found in that file. Make sure it is your class schedule, not a single event.</p>';
  return `<p class="sub">Found ${L.length} class${L.length===1?'':'es'}. Uncheck any you don't want.</p>${L.map((g,i)=>{const clash=g.days.map(d=>overlaps({weekday:d,start_time:g.start,end_time:g.end})).find(Boolean);return `<label class="icsrow"><input type="checkbox" data-icspick="${i}" ${g.pick?'checked':''}><span><b>${esc(g.code)}</b>${g.name?' · '+esc(g.name):''}<br><small>${g.days.map(d=>d.slice(0,3)).join(', ')} · ${esc(fmtTime(g.start))}–${esc(fmtTime(g.end))}${g.building?' · '+esc(g.building)+(g.room?' '+esc(g.room):''):''}${clash?` · <strong class="warn">overlaps ${esc(clash.course_code)}</strong>`:''}</small></span></label>`}).join('')}<div class="btnrow"><button type="button" class="btn gold small" data-icsadd="1">Add selected classes</button><button type="button" class="btn secondary small" data-icscancel="1">Cancel</button></div>`}
 async function importIcsClasses(){const picked=(ui.ics||[]).filter(g=>g.pick);let rows=[];let skipped=0;
  for(const g of picked)for(const d of g.days){const e={user_id:user.id,course_code:g.code,course_name:g.name,weekday:d,start_time:g.start,end_time:g.end,building:g.building,room:g.room};if(overlaps(e)||rows.some(r=>r.weekday===d&&r.start_time<e.end_time&&r.end_time>e.start_time)){skipped++;continue}rows.push(e)}
  if(!rows.length){R.alert(skipped?'Those classes overlap ones you already have.':'Nothing selected.');return}
  if(R.client)R.check(await R.client.from('class_schedule').insert(rows));else{const d=R.demo.load();d.schedules.push(...rows.map(x=>({...x,id:crypto.randomUUID()})));R.demo.save(d)}
  ui.ics=null;await R.track('schedule_add','ics_import');await refresh();R.alert(`Added ${rows.length} class meeting${rows.length===1?'':'s'}${skipped?` · skipped ${skipped} that overlapped`:''}.`)}
 /* in-app class alerts while ROAM is open */
 function alertsOn(){try{return localStorage.getItem('roam-class-alerts')==='1'}catch{return false}}
 function alertsNote(){if(!('Notification' in window))return 'This browser can\'t show notifications. Use "Add my classes" above instead.';if(Notification.permission==='denied')return 'Notifications are blocked for ROAM in your phone settings.';const ios=/iPhone|iPad/.test(navigator.userAgent)&&!window.matchMedia('(display-mode: standalone)').matches;return ios?'On iPhone, add ROAM to your Home Screen first, then turn this on.':'Works while ROAM is open or in the background. Your calendar alerts work even when it is closed.'}
 const alerted=new Set();
 function checkClassAlerts(){if(!alertsOn()||!user||!('Notification' in window)||Notification.permission!=='granted')return;const now=R.nowHM();const [h,m]=now.split(':').map(Number);const mins=h*60+m;
  for(const c of todayClasses()){const [ch,cm]=c.start_time.split(':').map(Number);const diff=ch*60+cm-mins;const k=R.localDay()+c.id;if(diff>0&&diff<=10&&!alerted.has(k)){alerted.add(k);const body=`${fmtTime(c.start_time)}${c.building?' · '+c.building+(c.room?' '+c.room:''):''}`;const title=`${c.course_code} starts in ${diff} min`;
   (navigator.serviceWorker?.ready||Promise.reject()).then(r=>r.showNotification(title,{body,icon:'icons/icon-192.png',tag:k})).catch(()=>{try{new Notification(title,{body,icon:'icons/icon-192.png'})}catch{}})}}}
 setInterval(checkClassAlerts,30000);
 function scheduleExtras(all){const sv=savedUpcoming().length;const on=alertsOn()&&('Notification' in window)&&Notification.permission==='granted';
  return `<div class="twocol" style="margin-top:14px"><div class="panel"><h3>Import from a calendar file</h3><p class="sub">Export your schedule as a calendar file (.ics) from your registration portal, Google Calendar or Outlook, then choose it here. You'll check the classes before anything is added.</p><label class="field">Calendar file (.ics)<input type="file" id="icsFile" accept=".ics,text/calendar"></label><div id="icsPreview" aria-live="polite">${icsPreviewHtml()}</div></div>
  <div class="panel"><h3>Reminders</h3><p class="sub">Add your classes and saved events to your phone's calendar with an alert before each one. Your phone reminds you even when ROAM is closed.</p><div class="btnrow"><button type="button" class="btn gold small" data-ics="classes" ${all.length?'':'disabled'}>Add my classes to my calendar</button><button type="button" class="btn secondary small" data-ics="events" ${sv?'':'disabled'}>Add ${sv} saved event${sv===1?'':'s'}</button></div><label class="checkline"><input type="checkbox" id="classAlerts" ${on?'checked':''}> Notify me 10 minutes before each class</label><p class="sub" id="alertNote">${esc(alertsNote())}</p></div></div>`}
 function renderSchedule(){
  const all=[...classes].sort((a,b)=>DAYS.indexOf(a.weekday)-DAYS.indexOf(b.weekday)||a.start_time.localeCompare(b.start_time));
  const st=termStatus();
  $('#screen').innerHTML=`${head('Class-first planning','Your semester, organized',st.label)}<div class="twocol" style="margin-top:18px"><div class="panel"><h3>Add a class</h3><form id="classForm"><label class="field coursefind">Find your course<input id="courseFind" type="search" autocomplete="off" placeholder="Type a class name or code, e.g. Microeconomics"></label><div id="courseHits" class="coursehits" aria-live="polite"></div><div class="formgrid"><label class="field">Course code<input name="course_code" placeholder="ECON 2106" maxlength="30" required></label><label class="field">Course name<input name="course_name" maxlength="100" placeholder="Microeconomics"></label></div><div class="field">Meets on</div><div class="daypick">${DAYS.slice(1,6).map(d=>`<label><input type="checkbox" name="days" value="${d}"> ${d.slice(0,3)}</label>`).join('')}<label><input type="checkbox" name="days" value="Saturday"> Sat</label></div><div class="formgrid"><label class="field">Start time<input type="time" name="start_time" value="09:00" required></label><label class="field">End time<input type="time" name="end_time" value="10:15" required></label><label class="field">Building<select name="building">${buildingOptions()}</select></label><label class="field">Room<input name="room" maxlength="40" placeholder="1112"></label></div><button class="btn gold" type="submit">Add class</button></form><p class="sub">Pick every day the class meets (e.g. Mon + Wed). ROAM blocks overlapping times. Your class data is private to your account.</p></div><div class="panel"><h3>Your weekly schedule</h3>${all.length?all.map(c=>`<div class="item"><div class="row"><h4>${esc(c.course_code)} · ${esc(c.weekday)}</h4><button data-deleteclass="${esc(c.id)}" class="btn danger small">Remove</button></div><p>${c.course_name?esc(c.course_name)+' · ':''}${esc(fmtTime(c.start_time))} – ${esc(fmtTime(c.end_time))}</p><p>${esc(c.building||'')} ${esc(c.room||'')}</p></div>`).join(''):'<div class="empty">Nothing added yet.</div>'}</div></div>${scheduleExtras(all)}`;
 }

 function renderMajor(){
  const mj=majorObj(browseMajor||profile.major)||A.majors[0];if(!mj){$('#screen').innerHTML=head('Major','Major home','Major data is unavailable.');return}
  const col=collegeObj(mj.college)||{};const dept=(col.departments||[]).find(d=>d.id===mj.dept);const adv=col.advising;
  const armstrong=myCampus()==='armstrong'&&A.advisingArmstrong;
  const evs=ranked(allEvents().filter(e=>(e.colleges||[]).includes(mj.college))).slice(0,5);
  const news=(D.news?.colleges||{})[mj.college]||[];
  const own=mj.name===profile.major;
  $('#screen').innerHTML=`${head('Major home',mj.name,col.name||'')}
  <div class="panel" style="margin-top:18px"><div class="formgrid"><label class="field">Browse any major<select id="majorPick">${majorOptions(mj.name)}</select></label><div class="field"><span>&nbsp;</span>${own?'<span class="chip greenchip">Your major</span>':`<button class="btn small gold" data-setmajor="${esc(mj.name)}">Make this my major</button>`}</div></div></div>
  <div class="twocol" style="margin-top:16px"><div class="panel"><h3>Advising</h3>${adv?`<div class="item"><h4>${esc(adv.name)}</h4><p>${esc(adv.where||'')}</p><div class="btnrow">${adv.phone?tel(adv.phone):''}${adv.email?`<a class="btn secondary small" href="mailto:${esc(adv.email)}">${esc(adv.email)}</a>`:''}${adv.url?ext(adv.url,'Office page'):''}</div></div>`:''}${armstrong?`<div class="item"><h4>${esc(A.advisingArmstrong.name)}</h4><p>${esc(A.advisingArmstrong.where)}</p><div class="btnrow">${tel(A.advisingArmstrong.phone)}${ext(A.advisingArmstrong.url,'Office page')}</div></div>`:''}<div class="itemmeta">${(A.advisingLinks||[]).map(l=>ext(l.url,l.label)).join('')}</div>
  <div class="separator"></div><h3>Your program</h3><div class="btnrow">${ext(mj.url,'Degree page')}${dept?ext(dept.url,dept.name):''}${col.home?ext(col.home,'College home'):''}</div>${(col.resources||[]).length?`<div class="itemmeta">${col.resources.map(r=>ext(r.url,r.label)).join('')}</div>`:''}
  ${(col.departments||[]).length?`<div class="separator"></div><h3>All departments in ${esc(col.short||'this college')}</h3>${col.departments.map(d=>`<div class="item row"><div><h4>${esc(d.name)}</h4></div><div class="btnrow">${ext(d.url,'Visit')}<button data-follow="department|${esc(d.name)}" class="btn small ${follows.some(f=>f.kind==='department'&&f.name===d.name)?'secondary':'gold'}">${follows.some(f=>f.kind==='department'&&f.name===d.name)?'✓ Following':'+ Follow'}</button></div></div>`).join('')}`:''}</div>
  <div class="panel"><h3>Events in ${esc(col.short||'your college')}</h3>${evs.length?evs.map(e=>eventCard(e,true)).join(''):'<p class="sub">No upcoming college events listed right now.</p>'}<div class="separator"></div><h3>Latest college news</h3>${news.length?news.slice(0,5).map(n=>`<div class="item"><h4><a href="${esc(validURL(n.url))}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a></h4><p>${esc(n.date?R.prettyDate(n.date):'')}</p></div>`).join(''):`<p class="sub">No recent news cached.</p>`}${col.newsPage?ext(col.newsPage,'More news'):''}</div></div>`;
  R.track('major_view','major');
 }

 function renderOrgPage(name){
  const o=(D.orgs?.orgs||[]).find(x=>x.name===name);if(!o){ui.org=null;return renderCommunity()}
  const on=follows.some(f=>f.kind==='organization'&&f.name===o.name);const cats=(o.cats||[]).filter(c=>!/Campus$/.test(c));
  const evs=[...adminEvents.map(fromAdmin),...publicEvents].filter(e=>e.org===o.name&&new Date(e.end||e.start)>new Date()&&!hidden.includes(e.id)).sort((a,b)=>String(a.start).localeCompare(String(b.start))).slice(0,10);
  const bio=noEmoji(o.desc);
  $('#screen').innerHTML=`<div class="pagehead"><button type="button" class="btn secondary small" data-orgback="1">← All organizations</button></div>
  <div class="hero"><div class="eyebrow">Student organization</div><h1>${esc(o.name)}</h1><p>${esc(cats.slice(0,3).join(' · ')||'Campus organization')}${o.members?` · ${o.members} members`:''}</p></div>
  <div class="btnrow" style="margin:12px 0"><button data-follow="organization|${esc(o.name)}" class="btn small ${on?'secondary':'gold'}">${on?'✓ Following':'+ Follow'}</button>${ENGAGE&&o.uri?ext(`${ENGAGE}/organization/${o.uri}`,'Full page','btn secondary small'):''}</div>
  <div class="panel"><h3>About</h3><p>${bio?esc(bio):'This organization has not added a bio yet.'}</p>${o.meets?`<div class="separator"></div><h3>Meetings</h3><p>${esc(o.meets)}</p>`:''}</div>
  <div class="section-title"><h2>Upcoming events</h2><small>${evs.length?'Add one and it appears on My Day that day':''}</small></div><div class="panel">${evs.length?evs.map(e=>eventCard(e,true)).join(''):'<div class="empty">No upcoming events posted.</div>'}</div>
  <div class="section-title"><h2>Posts from ${esc(o.name)}</h2></div><div class="panel"><div class="empty">Coming soon: officers will post updates, meeting changes and events here from their own organization console.</div></div>`;
 }
 function renderCommunity(){if(ui.org)return renderOrgPage(ui.org);
  const mine=myInterests();const cats=[...new Set(INTERESTS.filter(i=>mine.includes(i.id)).flatMap(i=>i.orgCats||[]))];
  const kw=INTERESTS.filter(i=>mine.includes(i.id)).flatMap(i=>i.keywords||[]);
  const all=D.orgs?.orgs||[];const isDept=o=>(o.cats||[]).includes('Campus Department');const ACAD=/\b(Department|College|School) of\b|\bProgram\b|\bStudies\b|\bSciences\b/;
  const orgs=all.filter(o=>!isDept(o)),offices=all.filter(o=>isDept(o)&&!ACAD.test(o.name)),acad=all.filter(o=>isDept(o)&&ACAD.test(o.name));
  const orgScore=o=>(follows.some(f=>f.kind==='organization'&&f.name===o.name)?10:0)+((o.cats||[]).some(c=>cats.includes(c))?4:0)+(kw.some(k=>o.name.toLowerCase().includes(k))?3:0)+(o.upcoming?1:0);
  const byName=(a,b)=>a.name.localeCompare(b.name),byScore=(a,b)=>orgScore(b)-orgScore(a)||byName(a,b);
  const mj=majorObj(profile.major);const col=collegeObj(mj?.college)||{};const depts=(col.departments||[]).map(d=>d.name);
  const btn=(kind,name)=>{const on=follows.some(f=>f.kind===kind&&f.name===name);return `<button data-follow="${esc(kind)}|${esc(name)}" class="btn small ${on?'secondary':'gold'}">${on?'Following':'Follow'}</button>`};
  const kindOf=o=>isDept(o)?(ACAD.test(o.name)?'Academic department':'Campus office'):((o.cats||[]).filter(c=>!/Campus$/.test(c)).slice(0,2).join(' · ')||'Student organization');
  const orgRow=o=>`<div class="item row"><div><h4><button type="button" class="orglink" data-org="${esc(o.name)}">${esc(noEmoji(o.name))}</button></h4><p>${esc(kindOf(o))}${o.members?` · ${o.members} members`:''}${o.upcoming?` · ${o.upcoming} upcoming`:''}</p></div><div class="btnrow">${btn('organization',o.name)}</div></div>`;
  const deptRow=n=>`<div class="item row"><div><h4>${esc(n)}</h4><p>Department updates and opportunities</p></div><div class="btnrow">${btn('department',n)}</div></div>`;
  const q=(ui.orgQ||'').trim().toLowerCase(),S=!!q;let body,count=0;
  if(S){const L=all.filter(o=>(o.name+' '+(o.desc||'')+' '+(o.cats||[]).join(' ')).toLowerCase().includes(q)).sort(byScore);const dl=depts.filter(n=>n.toLowerCase().includes(q)&&!all.some(o=>o.name===n));count=L.length+dl.length;
   body=`<div class="panel">${L.slice(0,60).map(orgRow).join('')}${dl.map(deptRow).join('')}${count?'':'<div class="empty">No groups match. Try a topic like engineering, dance or volunteer.</div>'}${L.length>60?`<p class="sub">Showing 60 of ${L.length}. Keep typing to narrow down.</p>`:''}</div>`}
  else{const G=[];
   if(follows.length)G.push(['following','Following','Groups you follow',follows.map(f=>{const o=all.find(x=>x.name===f.name);return o?orgRow(o):deptRow(f.name)})]);
   const sug=orgs.filter(o=>orgScore(o)>=3&&!follows.some(f=>f.name===o.name)).sort(byScore).slice(0,10);
   G.push(['suggested','Suggested for you',mine.length?'Based on your interests':'Add interests in Profile for better picks',sug.map(orgRow)]);
   G.push(['offices','Student Affairs & campus offices','Dean of Students, Housing, Counseling, Recreation and more',[...offices].sort(byName).map(orgRow)]);
   G.push(['depts','Academic departments',col.short?`${col.short} departments first`:'Choose a major in Profile to see yours first',[...depts.map(n=>{const o=all.find(x=>x.name===n);return o?orgRow(o):deptRow(n)}),...acad.filter(o=>!depts.includes(o.name)).sort(byName).map(orgRow)]]);
   const prim=o=>(o.cats||[]).filter(c=>!/Campus$/.test(c))[0]||'Other';const by=new Map();orgs.forEach(o=>{const c=prim(o);if(!by.has(c))by.set(c,[]);by.get(c).push(o)});
   [...by.keys()].sort((a,b)=>(a==='Other')-(b==='Other')||a.localeCompare(b)).forEach(c=>G.push(['cat-'+c,c,'',by.get(c).sort(byScore).map(orgRow)]));
   body=`<div class="grps">${G.filter(g=>g[3].length).map(g=>grp('com-'+g[0],g[1],g[2],g[3].join(''),g[3].length,false)).join('')}</div>`}
  $('#screen').innerHTML=`${head('Find your people','Community, without the noise',`${orgs.length} student organizations plus ${offices.length+acad.length} campus offices and departments from Eagle Engage. Follow any to boost their events in your feed.`)}
  <div class="panel searchpanel"><label class="field">Search<input id="orgSearch" type="search" value="${esc(ui.orgQ)}" placeholder="Club, office, department or topic" autocomplete="off"></label><div class="sub">${S?`${count} result${count===1?'':'s'}`:'Grouped by type · tap a group to open'}</div></div>${body}
  <div class="notice">Organization list comes from Eagle Engage's public directory. Following is a ROAM feature, not an official membership.</div>`;
 }

 function renderResources(){
  const q=(ui.resQ||'').trim().toLowerCase(),S=!!q;const hit=(...p)=>!S||p.filter(Boolean).join(' ').toLowerCase().includes(q);
  const placeRow=p=>{const o=openStatus(p);return `<div class="item"><div class="row"><h4>${esc(p.name)}</h4><span class="chip ${o.cls}">${esc(o.text)}</span></div><p>${esc(p.where||'')}${p.hours?' · Today: '+esc(hoursText(p)):''}</p>${p.note?`<p>${esc(p.note)}</p>`:''}<div class="btnrow">${p.phone?tel(p.phone):''}${(p.links||[]).slice(0,3).map(l=>ext(l.url,l.label,'btn secondary small',`data-resource="${esc(p.name)}"`)).join('')}</div></div>`};
  const resRow=r=>`<div class="item row"><div><h4>${esc(r.name)}</h4><p>${esc(r.desc||'')}</p></div>${ext(r.url,'Visit','btn secondary small',`data-resource="${esc(r.name)}"`)}</div>`;
  const linkRow=(t,d,links,attr)=>`<div class="item"><h4>${esc(t)}</h4><p>${esc(d||'')}</p><div class="btnrow">${(links||[]).map(l=>ext(l.url,l.label,'btn secondary small',attr||`data-resource="${esc(t)}"`)).join('')}</div></div>`;
  const openN=ps=>ps.filter(p=>openStatus(p).open).length;
  const places=(c,k)=>placesOn(c).filter(p=>hit(p.name,p.where,p.note,k));
  const dining=placesOn('dining').map(p=>({p,o:openStatus(p)})).sort((a,b)=>(b.o.open-a.o.open)||a.p.name.localeCompare(b.p.name)).map(x=>x.p).filter(p=>hit(p.name,p.where,p.note,'dining food eat meal lunch coffee'));
  const G=new Map();const add=(id,title,sub,rows)=>{if(rows.length)G.set(id,{id,title,sub,rows})};
  add('portals','Student portals','MyGS, Folio, email and more',(A.quickLinks||[]).filter(x=>hit(x.label,x.sub,'portal login')).map(x=>`<div class="item row"><div><h4>${esc(x.label)}</h4><p>${esc(x.sub||'')}</p></div>${ext(x.url,'Open','btn secondary small',`data-resource="${esc(x.label)}"`)}</div>`));
  add('dining','Dining',dining.length?`${openN(dining)} open now`:'',dining.map(placeRow));
  const study=places('study','study library quiet');add('study','Study spaces',study.length?`${openN(study)} open now`:'',study.map(placeRow));
  const transit=(C.transit||[]).filter(t=>hit(t.name,t.detail,'bus shuttle transit parking ride')).map(t=>linkRow(t.name,t.detail,t.links,'data-route="1"'));
  const extra={'Health & wellness':places('health','health clinic doctor medical').map(placeRow),'Getting around':transit};
  const cats=[...new Set((C.resources||[]).map(r=>r.category))];
  cats.forEach(c=>add('rc-'+c,c,'',[...(extra[c]||[]),...(C.resources||[]).filter(r=>r.category===c&&hit(r.name,r.desc,r.category)).map(resRow)]));
  Object.keys(extra).filter(c=>!cats.includes(c)).forEach(c=>add('rc-'+c,c,'',extra[c]));
  const fit=places('fitness','gym fitness recreation workout');add('fitness','Fitness & recreation',fit.length?`${openN(fit)} open now`:'',fit.map(placeRow));
  add('support','Support offices','',places('support','support help office').map(placeRow));
  add('gems','Free help most students miss','Food pantry, free tutoring and more',(C.hiddenGems||[]).filter(g=>hit(g.title,g.what)).map(g=>linkRow(g.title,g.what,g.links)));
  const order=['portals','dining','study','rc-Academic help','rc-Career','rc-Health & wellness','fitness','rc-Basic needs','rc-Money','support','rc-Campus life','rc-Getting around','rc-Safety','gems'];
  const list=[...order.filter(k=>G.has(k)).map(k=>G.get(k)),...[...G.values()].filter(g=>!order.includes(g.id))];
  const total=list.reduce((n,g)=>n+g.rows.length,0);
  $('#screen').innerHTML=`${head('Made for in-between moments','Resources for your campus day',`${campusName(myCampus())} campus · hours shown in real time from published schedules`)}
  <div class="panel searchpanel"><label class="field">Search resources<input id="resSearch" type="search" value="${esc(ui.resQ)}" placeholder="Tutoring, financial aid, parking, food…" autocomplete="off"></label><div class="sub">${S?`${total} result${total===1?'':'s'}`:`${list.length} categories · tap one to open`}</div></div>
  <div class="panel helpnow"><h3>Get help now</h3><div class="btnrow">${(C.help||[]).map(h=>`<a class="btn ${h.phone==='911'||h.phone==='988'?'danger':'secondary'} small" href="tel:${esc(h.phone)}" title="${esc(h.detail)}">${esc(h.name)} · ${esc(h.phone)}</a>`).join('')}</div></div>
  <div class="grps">${list.map(g=>grp('res-'+g.id,g.title,g.sub,g.rows.join(''),g.rows.length,S)).join('')||'<div class="empty">No resources match. Try another word, like tutoring or food.</div>'}</div>
  <div class="notice warning">ROAM uses publicly published Georgia Southern information and is not connected to university systems. Confirm hours and policies on the linked official pages.</div>`;
 }

 function renderDates(){
  const kinds={all:'All',deadline:'Deadlines',registration:'Registration',exam:'Exams',holiday:'Holidays & breaks',term:'Term',campus:'Campus'};
  let list=upcomingDates(80);if(ui.dateKind!=='all')list=list.filter(d=>d.kind===ui.dateKind);
  const term=termStatus().term;
  $('#screen').innerHTML=`${head('Academic calendar','Dates that matter','From the Registrar\'s published Fall 2026 and Spring 2027 calendars.')}<div class="panel" style="margin-top:18px"><div class="btnrow">${Object.entries(kinds).map(([k,l])=>`<button class="btn small ${ui.dateKind===k?'gold':'secondary'}" data-datekind="${k}">${esc(l)}</button>`).join('')}</div>${list.length?list.map(d=>{const n=daysBetween(R.localDay(),d.date);const on=d.date<=R.localDay()&&(d.end||d.date)>=R.localDay();return `<div class="item row"><div><h4>${esc(d.title)}</h4><p>${esc(R.prettyDate(d.date))}${d.end&&d.end!==d.date?' – '+esc(R.prettyDate(d.end)):''} · ${esc(kinds[d.kind]||d.kind)}</p></div><span class="chip ${on?'greenchip':n<=7?'goldchip':''}">${on?'Now':n===1?'Tomorrow':`In ${n} days`}</span></div>`}).join(''):'<div class="empty">No upcoming dates in this category.</div>'}${term?.source?`<div class="separator"></div>${ext(term.source,`${term.name} official calendar`)}`:''}</div>`;
 }

 function renderProfile(){
  interestSet=new Set(myInterests());const sv=surveyDue();
  const contact=R.cfg.contactEmail;
  $('#screen').innerHTML=`${head('Your ROAM profile','Built around your day')}<div class="twocol" style="margin-top:18px"><div class="panel"><h3>Personalize your feed</h3><form id="profileForm"><label class="field">First name<input name="first_name" value="${esc(profile.first_name||'')}" maxlength="80" required></label><div class="formgrid"><label class="field">Campus<select name="campus">${campusOptions(myCampus())}</select></label><label class="field">Year<select name="year">${yearOptions(profile.year)}</select></label></div><label class="field">Major<select name="major">${majorOptions(profile.major)}</select></label><div class="field">Interests</div><div id="editInterests">${interestButtons()}</div><label class="checkline"><input name="consent" type="checkbox" ${profile.consent?'checked':''}> Opt in to limited usage analytics for pilot evaluation</label><button class="btn gold" type="submit">Save changes</button></form><p class="sub">${esc(user.email||'')} · Pilot participant · ${R.configured?'Synced to your account':'Saved on this device'}</p></div>
  <div class="panel"><h3 id="survey">Two-minute pilot check-in</h3>${sv?`<p class="sub">${esc(sv.label)}</p><form id="surveyForm"><input type="hidden" name="phase" value="${sv.phase}"><label class="field">How easily do you discover relevant campus opportunities?<select name="discovery" required><option value="">Choose</option><option value="1">1 — Very difficult</option><option value="2">2 — Difficult</option><option value="3">3 — Neutral</option><option value="4">4 — Easy</option><option value="5">5 — Very easy</option></select></label><label class="field">${sv.phase==='baseline'?'How useful are the campus tools you use today?':'How useful was ROAM this week?'}<select name="usefulness" required><option value="">Choose</option><option value="1">1 — Not useful</option><option value="2">2 — Slightly</option><option value="3">3 — Moderately</option><option value="4">4 — Useful</option><option value="5">5 — Extremely</option></select></label><button class="btn gold" type="submit">Submit check-in</button></form>`:`<p class="sub">✓ You're all caught up. ${surveys.length?`Last check-in ${esc(R.niceDate(surveys[0].created_at))}.`:''} The next one appears here when it's due.</p>`}
  <div class="separator"></div><h3>Help us improve ROAM</h3><p class="sub">Your opinions help prioritize what we build next. Please avoid entering sensitive personal details.</p><form id="feedbackForm"><label class="field">What worked or needs improvement?<textarea name="message" maxlength="1500" required></textarea></label><label class="field">Overall experience (1 to 5)<select name="rating"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Okay</option><option value="2">2 — Difficult</option><option value="1">1 — Poor</option></select></label><button class="btn" type="submit">Send feedback</button></form></div></div>
  <div class="panel" style="margin-top:16px"><h3>Privacy and pilot consent</h3><p class="sub">Usage events include your participant ID, timestamp, feature, and action. We do not record passwords, precise location, or the contents of your class schedule as analytics events. Interests marked private never leave this device. You may disable optional usage metrics at any time. This is an independent pilot, not a university-sponsored system.${contact?` Questions or withdrawal: <a href="mailto:${esc(contact)}">${esc(contact)}</a>.`:''}</p><div class="btnrow"><button id="deleteRequest" class="btn secondary small" type="button">How to withdraw</button><button id="deleteAccount" class="btn danger small" type="button">Delete my account & data</button></div><p class="sub">Run a campus office or student organization? <a href="admin.html">Post events on Campus ROAM</a>.</p></div>`;
  try{if(sessionStorage.getItem('roam-focus')==='survey'){sessionStorage.removeItem('roam-focus');$('#survey')?.scrollIntoView({behavior:(matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth')})}}catch{}
 }
 const render=()=>({today:renderToday,discover:renderDiscover,schedule:renderSchedule,major:renderMajor,community:renderCommunity,resources:renderResources,dates:renderDates,profile:renderProfile}[tab]||renderToday)();
 const refresh=async()=>{await load();render()};

 /* ---------- events: auth ---------- */
 $('#authToggle').addEventListener('click',()=>{authMode=authMode==='signup'?'signin':'signup';authShow()});
 $('#forgotLink').addEventListener('click',()=>{authMode='forgot';authShow()});
 $('#privacyOpen').addEventListener('click',()=>R.alert(`Pilot participation is voluntary. Only limited usage event counts are logged when you consent. The pilot team may access profile information for pilot operations.${R.cfg.contactEmail?' Contact '+R.cfg.contactEmail+' to withdraw.':' Contact the team to withdraw.'}`));
 $('#authForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target,f=new FormData(form),email=String(f.get('email')||'').trim().toLowerCase(),password=String(f.get('password')||'');busy(form,true);
  try{
   if(authMode==='forgot'){
    if(R.client){R.check(await R.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}));$('#authNotice').innerHTML=status('If that email has a ROAM account, a reset link is on its way.','success')}
    else $('#authNotice').innerHTML=status('Local mode has no email reset. Your account lives only in this browser — clear site data to start over.','warning');
    return;
   }
   if(authMode==='recover'){if(password.length<8)throw Error('Use at least 8 characters.');R.check(await R.client.auth.updateUser({password}));recovery=false;authMode='signin';R.alert('Password updated.')}
   else if(authMode==='signup'){
    if(!email.endsWith('@georgiasouthern.edu')&&!email.endsWith('@eagles.georgiasouthern.edu'))throw Error('Use your Georgia Southern email address.');
    if(R.client){const {data,error}=await R.client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname,data:{first_name:String(f.get('name')||'').trim().slice(0,80),consent:!!f.get('consent')}}});if(error)throw error;if(!data.session){$('#authNotice').innerHTML=status('Check your school email to confirm your account, then sign in here.','success');authMode='signin';$('#authTitle').textContent='Welcome back';$('#signupFields').classList.add('hidden');$('#authSubmit').textContent='Sign in';return}}
    else{const d=R.demo.load();if(d.account)throw Error('This device already has a ROAM account. Sign in instead.');const id=crypto.randomUUID();d.account={id,email,pw:await hash(password)};d.profile={id,first_name:String(f.get('name')||''),consent:!!f.get('consent'),interests:[],major:'',year:'',campus:CAMPUSES[0].id,onboarded:false,created_at:new Date().toISOString()};R.demo.save(d)}
   }else{
    if(R.client)R.check(await R.client.auth.signInWithPassword({email,password}));
    else{const d=R.demo.load();const ok=d.account?.email===email&&(d.account.pw===await hash(password)||d.account.password===password);if(!ok)throw Error('Email or password doesn\'t match the account on this device.')}
   }
   user=await getUser();profile=user?await getProfile():null;
   if(!user||!profile)throw Error('Account profile not available. Contact the pilot administrator.');
   if(!profile.onboarded)onboardShow();else{await load();boot()}
  }catch(ex){$('#authNotice').innerHTML=status(R.formatErr(ex),'error')}finally{busy(form,false)}
 });

 /* ---------- events: app ---------- */
 let searchT;
 document.addEventListener('input',e=>{const id=e.target?.id;if(!['eventSearch','orgSearch','resSearch'].includes(id))return;clearTimeout(searchT);searchT=setTimeout(()=>{const pos=e.target.selectionStart;if(id==='eventSearch')ui.q=e.target.value;if(id==='orgSearch')ui.orgQ=e.target.value;if(id==='resSearch')ui.resQ=e.target.value;render();const el=$('#'+id);if(el){el.focus();try{el.setSelectionRange(pos,pos)}catch{}}},250)});
 document.addEventListener('input',e=>{if(e.target?.id==='courseFind')courseSearch(e.target.value)});
 document.addEventListener('toggle',e=>{const d=e.target;if(d?.dataset?.grp&&!d.dataset.forced){d.open?ui.open.add(d.dataset.grp):ui.open.delete(d.dataset.grp)}},true);
 document.addEventListener('change',async e=>{const t=e.target;try{
  if(t.id==='icsFile'&&t.files&&t.files[0]){const f=t.files[0];if(f.size>2e6){R.alert('That file is too large to be a class schedule.');return}const text=await f.text();if(!/BEGIN:VCALENDAR/.test(text)){R.alert('That is not a calendar (.ics) file.');return}try{await loadCourses()}catch{}ui.ics=icsToClasses(text);const p=document.getElementById('icsPreview');if(p)p.innerHTML=icsPreviewHtml();return}
  if(t.dataset&&t.dataset.icspick!=null&&ui.ics){ui.ics[Number(t.dataset.icspick)].pick=t.checked;return}
  if(t.id==='classAlerts'){if(t.checked){if(!('Notification' in window)){t.checked=false;R.alert(alertsNote());return}const p=await Notification.requestPermission();if(p!=='granted'){t.checked=false;R.alert('Notifications were not allowed.');return}}try{localStorage.setItem('roam-class-alerts',t.checked?'1':'0')}catch{}const n=document.getElementById('alertNote');if(n)n.textContent=alertsNote();if(t.checked)R.alert('You will get a heads-up 10 minutes before each class.')}
 }catch(err){R.alert(R.formatErr(err))}});
 document.addEventListener('change',e=>{const id=e.target?.id;if(id==='eventFilter'){ui.filter=e.target.value;ui.showSaved=false;renderDiscover()}if(id==='orgCat'){ui.orgCat=e.target.value;renderCommunity()}if(id==='majorPick'){browseMajor=e.target.value||null;renderMajor()}});
 document.addEventListener('click',async e=>{
  const btn=e.target.closest('button,a');if(!btn)return;const ds=btn.dataset;
  try{
   if(ds.fypage!=null){const c=document.getElementById('fypages');if(c)c.scrollTo({left:Number(ds.fypage)*c.clientWidth,behavior:(matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth')})}if(ds.course!=null){pickCourse(ds.course);return}if(ds.ics){const t=ds.ics==='classes'?classesIcs():eventsIcs();if(!t){R.alert(ds.ics==='classes'?'Add your classes first, or this term has ended.':'Save an event first.');return}downloadIcs(t,ds.ics==='classes'?'roam-classes.ics':'roam-saved-events.ics');R.track('calendar_add',ds.ics==='classes'?'ics_classes':'ics_events');R.alert('Open the downloaded file to add it to your calendar.');return}if(ds.icsadd){await importIcsClasses();return}if(ds.icscancel){ui.ics=null;const p=document.getElementById('icsPreview');if(p)p.innerHTML='';const fi=document.getElementById('icsFile');if(fi)fi.value='';return}if(ds.daypage!=null){const c=document.getElementById('daypages');if(c)c.scrollTo({left:Number(ds.daypage)*c.clientWidth,behavior:(matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth')})}
    if(ds.org){ui.org=ds.org;switchTab('community');return}
    if(ds.orgback){ui.org=null;renderCommunity();window.scrollTo({top:0});return}
    if(ds.tab){ui.org=null;switchTab(ds.tab)}
   if(ds.goto){if(ds.focus)try{sessionStorage.setItem('roam-focus',ds.focus)}catch{}switchTab(ds.goto)}
   if(ds.interest){const v=ds.interest;interestSet.has(v)?interestSet.delete(v):interestSet.add(v);document.querySelectorAll('[data-interest]').forEach(x=>{x.classList.toggle('selected',interestSet.has(x.dataset.interest));x.setAttribute('aria-pressed',interestSet.has(x.dataset.interest))})}
   if(ds.view){ui.showSaved=ds.view==='saved';ui.showNew=ds.view==='new';if(tab!=='discover')switchTab('discover');else renderDiscover()}
   if(ds.install&&installEvt){installEvt.prompt();try{await installEvt.userChoice}catch{}installEvt=null;render()}
   if(ds.installdismiss){try{localStorage.setItem('roam-install-dismissed','1')}catch{}render()}
   if(ds.scope){ui.scope=ds.scope;renderDiscover()}
   if(ds.datekind){ui.dateKind=ds.datekind;renderDates()}
   if(ds.unhide){hidden=[];try{localStorage.removeItem(`roam-hidden-${user.id}`)}catch{}renderDiscover()}
   if(ds.hide){hidden.push(ds.hide);try{localStorage.setItem(`roam-hidden-${user.id}`,JSON.stringify(hidden))}catch{}render();R.alert('Hidden. Use "Show hidden" in Discover to undo.')}
   if(ds.setmajor){await upsertProfile({major:ds.setmajor});profile=await getProfile();browseMajor=null;await R.track('profile_update','major');renderMajor();R.alert('Major updated')}
   if(ds.gcal)R.track('calendar_add','discover');
   if(ds.eventlink)R.track('event_view','discover');
   if(ds.save){
    const id=ds.save;const isAdmin=adminEvents.some(x=>x.id===id);const was=isAdmin?saved.includes(id):savedPublic.includes(id);btn.disabled=true;
    if(R.client){
     if(isAdmin){if(was)R.check(await R.client.from('saved_events').delete().eq('user_id',user.id).eq('event_id',id));else R.check(await R.client.from('saved_events').insert({user_id:user.id,event_id:id}))}
     else{if(was)R.check(await R.client.from('saved_public_events').delete().eq('user_id',user.id).eq('event_key',id));else R.check(await R.client.from('saved_public_events').insert({user_id:user.id,event_key:id}))}
    }else{const d=R.demo.load();const k=isAdmin?'saved':'savedPublic';d[k]=d[k]||[];d[k]=was?d[k].filter(x=>x!==id):[...d[k],id];R.demo.save(d)}
    await R.track(was?'event_unsave':'event_save',tab);await refresh();
   }
   if(ds.deleteclass){if(!await ask('Remove this class from your schedule?',{ok:'Remove',danger:true}))return;const id=ds.deleteclass;if(R.client)R.check(await R.client.from('class_schedule').delete().eq('id',id).eq('user_id',user.id));else{const d=R.demo.load();d.schedules=d.schedules.filter(x=>x.id!==id);R.demo.save(d)}await R.track('schedule_delete','schedule');await refresh()}
   if(ds.follow){const i=ds.follow.indexOf('|');const kind=ds.follow.slice(0,i),name=ds.follow.slice(i+1);const old=follows.find(f=>f.kind===kind&&f.name===name);btn.disabled=true;if(R.client){if(old)R.check(await R.client.from('follows').delete().eq('id',old.id));else R.check(await R.client.from('follows').insert({user_id:user.id,kind,name}))}else{const d=R.demo.load();d.follows=old?d.follows.filter(x=>x.id!==old.id):[...d.follows,{id:crypto.randomUUID(),user_id:user.id,kind,name}];R.demo.save(d)}await R.track(old?'unfollow':'follow','community');await refresh()}
   if(ds.resource)R.track('resource_open','resources');
   if(ds.route)R.track('route_open','transit');
   if(btn.id==='deleteRequest')R.alert(`To withdraw: turn off usage analytics above, then use "Delete my account & data" or ${R.cfg.contactEmail?'email '+R.cfg.contactEmail:'contact the pilot team'} to request deletion.`);
   if(btn.id==='deleteAccount'){
    if(!await ask('This permanently deletes your ROAM account, classes, saves, follows, feedback and check-ins.',{typed:'DELETE',ok:'Delete everything',danger:true}))return;
    if(R.client){R.check(await R.client.rpc('delete_my_account'));await R.client.auth.signOut()}else R.demo.reset();
    try{localStorage.removeItem(privKey());localStorage.removeItem(`roam-hidden-${user.id}`)}catch{}authMode='signup';signedOut();R.alert('Your account and data were deleted.');
   }
  }catch(ex){R.alert(R.formatErr(ex));btn.disabled=false}
 });
 $('#onboardForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.target,f=new FormData(form);if(!interestSet.size){R.alert('Choose at least one interest');return}busy(form,true);try{await upsertProfile({first_name:String(f.get('first_name')).trim(),major:f.get('major'),year:f.get('year'),campus:f.get('campus'),interests:[...interestSet],onboarded:true});profile=await getProfile();await load();boot()}catch(ex){R.alert(R.formatErr(ex))}finally{busy(form,false)}});
 document.addEventListener('submit',async e=>{
  if(!['classForm','profileForm','feedbackForm','surveyForm'].includes(e.target.id))return;e.preventDefault();const form=e.target,f=new FormData(form);let msg='Saved';busy(form,true);
  try{
   if(form.id==='classForm'){
    const start=f.get('start_time'),end=f.get('end_time'),days=f.getAll('days');
    if(!days.length)throw Error('Pick at least one day the class meets.');if(start>=end)throw Error('End time must be after start time.');
    const base={user_id:user.id,course_code:String(f.get('course_code')).trim(),course_name:String(f.get('course_name')||'').trim(),start_time:start,end_time:end,building:String(f.get('building')||'').trim(),room:String(f.get('room')||'').trim()};
    const entries=days.map(weekday=>({...base,weekday}));
    const clash=entries.map(overlaps).find(Boolean);if(clash)throw Error(`That overlaps ${clash.course_code} on ${clash.weekday} (${fmtTime(clash.start_time)}–${fmtTime(clash.end_time)}).`);
    if(R.client)R.check(await R.client.from('class_schedule').insert(entries));else{const d=R.demo.load();d.schedules.push(...entries.map(x=>({...x,id:crypto.randomUUID()})));R.demo.save(d)}
    await R.track('schedule_add','schedule');msg=`Added ${base.course_code} on ${days.map(d=>d.slice(0,3)).join(', ')}`;
   }
   if(form.id==='profileForm'){await upsertProfile({first_name:String(f.get('first_name')).trim(),major:f.get('major'),year:f.get('year'),campus:f.get('campus'),interests:[...interestSet],consent:!!f.get('consent')});profile=await getProfile();weather=null;R.setTracking(user.id,profile.consent);await R.track('profile_update','profile');msg='Profile saved'}
   if(form.id==='feedbackForm'){const entry={user_id:user.id,message:String(f.get('message')).trim(),rating:Number(f.get('rating'))};if(R.client)R.check(await R.client.from('pilot_feedback').insert(entry));else{const d=R.demo.load();d.feedback.push({...entry,id:crypto.randomUUID(),created_at:new Date().toISOString()});R.demo.save(d)}await R.track('feedback_submit','feedback');msg='Thanks — feedback sent'}
   if(form.id==='surveyForm'){const entry={user_id:user.id,phase:f.get('phase'),discovery:Number(f.get('discovery')),usefulness:Number(f.get('usefulness'))};if(R.client)R.check(await R.client.from('pilot_surveys').insert(entry));else{const d=R.demo.load();d.survey.push({...entry,id:crypto.randomUUID(),created_at:new Date().toISOString()});R.demo.save(d)}await R.track('survey_submit','survey');msg='Thanks — check-in recorded'}
   await refresh();R.alert(msg);
  }catch(ex){R.alert(/duplicate key|unique/i.test(R.formatErr(ex))?'You already submitted that check-in.':R.formatErr(ex))}finally{busy(form,false)}
 });
 $('#logout').addEventListener('click',async()=>{if(R.client)await R.client.auth.signOut();authMode='signin';signedOut()});
 let hiddenAt=0;window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')hiddenAt=Date.now();else if(hiddenAt&&Date.now()-hiddenAt>3*3600000&&navigator.onLine){location.reload()}});
 window.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&user&&profile?.onboarded&&!$('#app').classList.contains('hidden')){try{await refresh()}catch(ex){console.warn(ex)}}});
 let day=R.localDay(),minute=R.nowHM();
 setInterval(async()=>{if(!user||$('#app').classList.contains('hidden'))return;const typing=document.activeElement?.matches?.('input,textarea,select');if(day!==R.localDay()){day=R.localDay();weather=null;if(navigator.onLine&&!typing){location.reload();return}try{await refresh()}catch(ex){console.warn(ex)}}else if(tab==='today'&&!typing&&R.nowHM().slice(0,4)!==minute.slice(0,4)){minute=R.nowHM();renderToday()}},60000);

 /* ---------- start ---------- */
 await loadPublicEvents();
 if(R.client)R.client.auth.onAuthStateChange(evt=>{if(evt==='PASSWORD_RECOVERY'){recovery=true;authMode='recover';authShow()}});
 if(initialRecovery){recovery=true;authMode='recover'}
 user=await getUser();
 if(recovery){authShow();return}
 if(!user){if(R.demo.load().account&&!R.client)authMode='signin';authShow();return}
 try{profile=await getProfile();if(!profile){authMode='signin';signedOut();return}if(!profile.onboarded)onboardShow();else{await load();boot()}}catch(ex){authShow();$('#authNotice').innerHTML=status(R.formatErr(ex),'error')}
})();
