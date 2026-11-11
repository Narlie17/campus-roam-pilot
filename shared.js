(function(){
 const cfg=window.ROAM_CONFIG||{};
 const TZ=cfg.timeZone||'America/New_York';
 const hasKeys=!!(cfg.supabaseUrl&&cfg.supabaseAnonKey);
 // V14: if keys are set but the Supabase library failed to load, do NOT fall back to
 // local mode silently (students would create accounts that only exist on one phone).
 const libMissing=hasKeys&&!window.supabase;
 const configured=hasKeys&&!!window.supabase;
 const client=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
 const key='campus-roam-v14-local';
 const initial={account:null,profile:null,schedules:[],events:[],follows:[],saved:[],hidden:[],feedback:[],activity:[],announcements:[],survey:[],plan:{},admin:false};
 const demo={load(){try{const v=JSON.parse(localStorage.getItem(key)||'{}');return {...structuredClone(initial),...v}}catch{return structuredClone(initial)}},save(v){try{localStorage.setItem(key,JSON.stringify(v))}catch(e){console.warn('Storage unavailable',e)}window.dispatchEvent(new Event('roam-change'))},reset(){localStorage.removeItem(key)}};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const parts=(d,opts)=>{const o={};new Intl.DateTimeFormat('en-CA',{timeZone:TZ,hourCycle:'h23',...opts}).formatToParts(d).forEach(p=>o[p.type]=p.value);return o};
 const date=d=>new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
 const dayOf=d=>{const o=parts(new Date(d),{year:'numeric',month:'2-digit',day:'2-digit'});return `${o.year}-${o.month}-${o.day}`};
 const localDay=()=>dayOf(new Date());
 const nowHM=()=>{const o=parts(new Date(),{hour:'2-digit',minute:'2-digit'});return `${o.hour}:${o.minute}`};
 const hmOf=d=>{const o=parts(new Date(d),{hour:'2-digit',minute:'2-digit'});return `${o.hour}:${o.minute}`};
 const time=d=>new Date(d).toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'});
 const niceDate=d=>new Date(d).toLocaleDateString('en-US',{timeZone:TZ,weekday:'short',month:'short',day:'numeric'});
 const prettyDate=d=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
 // Convert a <input type=datetime-local> value, meant as campus time, to an ISO string.
 const zonedToISO=v=>{if(!v)return null;const guess=new Date(v+':00Z');const o=parts(guess,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});const asUTC=Date.UTC(+o.year,+o.month-1,+o.day,+o.hour,+o.minute,+o.second);return new Date(guess.getTime()-(asUTC-guess.getTime())).toISOString()};
 // Inverse: ISO -> value for datetime-local in campus time.
 const isoToLocalInput=iso=>{const o=parts(new Date(iso),{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`};
 const daysLeft=()=>Math.max(0,Math.ceil((new Date((cfg.pilotEnd||'2026-12-20')+'T23:59:59-05:00')-new Date())/86400000));
 const pilotOver=()=>localDay()>(cfg.pilotEnd||'2026-12-20');
 const alert=(message)=>{document.querySelectorAll('.alertbox').forEach(x=>x.remove());const el=document.createElement('div');el.className='alertbox';el.setAttribute('role','status');el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),4500)};
 const check=res=>{if(res.error)throw res.error;return res.data};
 const currentSession=async()=>client?check(await client.auth.getSession()).session:null;
 // V14: the app tells the tracker who is signed in and whether they consented,
 // so tracking no longer makes an extra auth request per action or sends rows RLS will reject.
 let trackUser=null,trackConsent=false;
 const setTracking=(userId,consent)=>{trackUser=userId||null;trackConsent=!!consent};
 const ACTIONS=['app_open','tab_view','schedule_add','schedule_delete','event_view','event_save','event_unsave','resource_open','follow','unfollow','feedback_submit','profile_update','survey_submit','route_open','plan_view','calendar_add','major_view'];
 const track=async(action,feature='app')=>{if(!ACTIONS.includes(action)||!trackUser||!trackConsent)return;if(client){try{const r=await client.from('activity_events').insert({user_id:trackUser,action,feature:String(feature).slice(0,40)});if(r.error)console.warn('Tracking unavailable',r.error.message)}catch(e){console.warn('Tracking unavailable',e.message)}}else{const d=demo.load();if(!d.profile?.consent)return;d.activity.push({user_id:d.profile.id,action,feature,created_at:new Date().toISOString()});if(d.activity.length>2000)d.activity=d.activity.slice(-2000);demo.save(d)}};
 const formatErr=e=>e?.message||String(e);
 // Spreadsheet formula-injection guard for CSV exports.
 const csvCell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 window.ROAM={cfg,TZ,client,configured,libMissing,demo,escape,date,dayOf,localDay,nowHM,hmOf,time,niceDate,prettyDate,zonedToISO,isoToLocalInput,daysLeft,pilotOver,alert,check,currentSession,setTracking,track,formatErr,csvCell,data:window.ROAM_DATA||null};
})();
