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
 const ask=(message,{typed=null,ok='Confirm',danger=false}={})=>new Promise(res=>{const w=document.createElement('div');w.className='modalwrap';w.innerHTML=`<div class="panel modal" role="dialog" aria-modal="true"><p>${esc(message)}</p>${typed?`<label class="field">Type ${esc(typed)} to confirm<input id="askInput" autocomplete="off"></label>`:''}<div class="btnrow"><button type="button" class="btn ${danger?'danger':'gold'}" data-ask="ok">${esc(ok)}</button><button type="button" class="btn secondary" data-ask="no">Cancel</button></div></div>`;document.body.appendChild(w);const inp=w.querySelector('#askInput');(inp||w.querySelector('[data-ask=ok]')).focus();w.addEventListener('click',e=>{const b=e.target.closest('[data-ask]');if(!b&&e.target!==w)return;e.stopPropagation();const yes=b?.dataset.ask==='ok'&&(!typed||inp.value.trim()===typed);if(b?.dataset.ask==='ok'&&typed&&!yes){inp.focus();inp.select();return}w.remove();res(!!yes)});w.addEventListener('keydown',e=>{if(e.key==='Escape'){w.remove();res(false)}if(e.key==='Enter'){e.preventDefault();w.querySelector('[data-ask=ok]').click()}})});

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
  return `<article class="item"><div class="row"><h4>${esc(e.title)}</h4><span>${newIds.has(e.id)?'<span class="chip greenchip">New</span>':''}<span class="chip ${sc>=3?'goldchip':''}">${sc>=3?'For you':'Campus'}</span></span></div><p>${esc(e.location||'Location TBA')} · ${esc(R.niceDate(e.start))} · ${e.allDay?'All day':esc(R.time(e.start))}${e.end&&!e.allDay?'–'+esc(R.time(e.end)):''}</p>${e.org?`<p>Hosted by ${(D.orgs?.orgs||[]).some(o=>o.name===e.org)?`<button type="button" class="orglink" data-org="${esc(e.org)}">${esc(e.org)}</button>`:esc(e.org)}</p>`:''}${!compact&&e.desc?`<p>${esc(e.desc.slice(0,260))}</p>`:''}<div class="itemmeta">${(e.tags||[]).slice(0,3).map(t=>`<span class="chip">${esc(interestLabel(t))}</span>`).join('')}<span class="chip">${esc(srcLabel(e))}</span></div><div class="sub">Why you're seeing this: ${esc(explain(e))}</div><div class="btnrow"><button class="btn small ${sv?'secondary':'gold'}" data-save="${esc(e.id)}">${sv?'✓ On my schedule':'+ Add to my schedule'}</button>${ext(gcal(e),'Add to Google Calendar','btn secondary small','data-gcal="1"')}${e.url?ext(e.url,'Event info','btn secondary small','data-eventlink="1"'):''}${compact?'':`<button class="btn secondary small" data-hide="${esc(e.id)}">Not for me</button>`}</div></article>`;
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
  data=ranked(data);const mine=myInterests();
  const opts=[...INTERESTS].sort((a,b)=>(mine.includes(b.id)-mine.includes(a.id))||a.label.localeCompare(b.label));
  $('#screen').innerHTML=`${head('For You','Picked for your major and interests','Public university calendar and Eagle Engage events, plus anything the ROAM team publishes — ranked for you.')}
  <div class="section-title"><h2>${ui.showSaved?'On your schedule':ui.showNew?'New for you':'Upcoming opportunities'}</h2><small>${data.length} event${data.length===1?'':'s'} · sorted by match and date</small></div>
  <div class="panel"><div class="formgrid"><label class="field">Explore by interest<select id="eventFilter"><option value="all">All upcoming events</option>${opts.map(x=>`<option value="${esc(x.id)}" ${ui.filter===x.id?'selected':''}>${esc(x.label)}</option>`).join('')}</select></label><label class="field">Search<input id="eventSearch" type="search" placeholder="Title, place or org" value="${esc(ui.q)}"></label></div>
  <div class="btnrow"><button class="btn small ${ui.showSaved||ui.showNew?'secondary':'gold'}" data-view="all">All</button>${newIds.size?`<button class="btn small ${ui.showNew?'gold':'secondary'}" data-view="new">New (${newIds.size})</button>`:''}<button class="btn small ${ui.showSaved?'gold':'secondary'}" data-view="saved">On my schedule (${saved.length+savedPublic.length})</button><button class="btn small secondary" data-scope="${ui.scope==='mine'?'all':'mine'}">${ui.scope==='mine'?`${esc(campusName(myCampus()))} only · show both campuses`:'Both campuses · show mine only'}</button>${hidden.length?`<button class="btn small secondary" data-unhide="1">Show ${hidden.length} hidden</button>`:''}</div>
  ${data.length?fyPaged(data):`<div class="empty">${ui.showSaved?'Nothing added yet. Tap + Add to my schedule on any event.':'No upcoming events match this view. Try another interest or both campuses.'}</div>`}
  <p class="sub">Event data: university calendar and Eagle Engage${D.events?.generatedAt?`, updated ${esc(R.niceDate(D.events.generatedAt))}`:''}. New events are added automatically about four times a day. Always confirm details on the event page.</p></div>`;
  initPager('fypages','fyPage');
 }

 function renderSchedule(){
  const all=[...classes].sort((a,b)=>DAYS.indexOf(a.weekday)-DAYS.indexOf(b.weekday)||a.start_time.localeCompare(b.start_time));
  const st=termStatus();
  $('#screen').innerHTML=`${head('Class-first planning','Your semester, organized',st.label)}<div class="twocol" style="margin-top:18px"><div class="panel"><h3>Add a class</h3><form id="classForm"><label class="field coursefind">Find your course<input id="courseFind" type="search" autocomplete="off" placeholder="Type a class name or code, e.g. Microeconomics"></label><div id="courseHits" class="coursehits" aria-live="polite"></div><div class="formgrid"><label class="field">Course code<input name="course_code" placeholder="ECON 2106" maxlength="30" required></label><label class="field">Course name<input name="course_name" maxlength="100" placeholder="Microeconomics"></label></div><div class="field">Meets on</div><div class="daypick">${DAYS.slice(1,6).map(d=>`<label><input type="checkbox" name="days" value="${d}"> ${d.slice(0,3)}</label>`).join('')}<label><input type="checkbox" name="days" value="Saturday"> Sat</label></div><div class="formgrid"><label class="field">Start time<input type="time" name="start_time" value="09:00" required></label><label class="field">End time<input type="time" name="end_time" value="10:15" required></label><label class="field">Building<select name="building">${buildingOptions()}</select></label><label class="field">Room<input name="room" maxlength="40" placeholder="1112"></label></div><button class="btn gold" type="submit">Add class</button></form><p class="sub">Pick every day the class meets (e.g. Mon + Wed). ROAM blocks overlapping times. Your class data is private to your account.</p></div><div class="panel"><h3>Your weekly schedule</h3>${all.length?all.map(c=>`<div class="item"><div class="row"><h4>${esc(c.course_code)} · ${esc(c.weekday)}</h4><button data-deleteclass="${esc(c.id)}" class="btn danger small">Remove</button></div><p>${c.course_name?esc(c.course_name)+' · ':''}${esc(fmtTime(c.start_time))} – ${esc(fmtTime(c.end_time))}</p><p>${esc(c.building||'')} ${esc(c.room||'')}</p></div>`).join(''):'<div class="empty">Nothing added yet.</div>'}</div></div>`;
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
  <div class="panel" style="margin-top:16px"><h3>Privacy and pilot consent</h3><p class="sub">Usage events include your participant ID, timestamp, feature, and action. We do not record passwords, precise location, or the contents of your class schedule as analytics events. Interests marked private never leave this device. You may disable optional usage metrics at any time. This is an independent pilot, not a university-sponsored system.${contact?` Questions or withdrawal: <a href="mailto:${esc(contact)}">${esc(contact)}</a>.`:''}</p><div class="btnrow"><button id="deleteRequest" class="btn secondary small" type="button">How to withdraw</button><button id="deleteAccount" class="btn danger small" type="button">Delete my account & data</button></div></div>`;
  try{if(sessionStorage.getItem('roam-focus')==='survey'){sessionStorage.removeItem('roam-focus');$('#survey')?.scrollIntoView({behavior:'smooth'})}}catch{}
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
 document.addEventListener('change',e=>{const id=e.target?.id;if(id==='eventFilter'){ui.filter=e.target.value;ui.showSaved=false;renderDiscover()}if(id==='orgCat'){ui.orgCat=e.target.value;renderCommunity()}if(id==='majorPick'){browseMajor=e.target.value||null;renderMajor()}});
 document.addEventListener('click',async e=>{
  const btn=e.target.closest('button,a');if(!btn)return;const ds=btn.dataset;
  try{
   if(ds.fypage!=null){const c=document.getElementById('fypages');if(c)c.scrollTo({left:Number(ds.fypage)*c.clientWidth,behavior:'smooth'})}if(ds.course!=null){pickCourse(ds.course);return}if(ds.daypage!=null){const c=document.getElementById('daypages');if(c)c.scrollTo({left:Number(ds.daypage)*c.clientWidth,behavior:'smooth'})}
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
