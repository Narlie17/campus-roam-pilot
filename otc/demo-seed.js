/* Loads a sample OTC student so the demo opens straight into a filled-in day.
   "Reset demo" clears it and loads the sample again. */
(function(){
 var KEY='campus-roam-otc-demo';
 function seed(){
  var id='demo-jordan',now=new Date().toISOString();
  var c=function(code,name,day,s,e,b,r){return {id:'c-'+code.replace(/\s/g,'')+'-'+day,user_id:id,course_code:code,course_name:name,weekday:day,start_time:s,end_time:e,building:b,room:r}};
  var JEK='Joseph E. Kennedy';
  var schedules=[];
  ['Monday','Wednesday'].forEach(function(d){schedules.push(c('EMPL 1000','Interpersonal Relations & Prof. Development',d,'08:00','09:15',JEK,'Classroom'),c('WELD 1030','Blueprint Reading for Welding Technicians',d,'10:30','11:45',JEK,'Classroom'),c('WELD 1000','Introduction to Welding Technology',d,'13:00','15:30',JEK,'Welding lab'))});
  ['Tuesday','Thursday'].forEach(function(d){schedules.push(c('MATH 1012','Foundations of Mathematics',d,'09:00','10:15',JEK,'Classroom'),c('ENGL 1010','Fundamentals of English I',d,'12:00','13:15',JEK,'Classroom'),c('WELD 1010','Oxyfuel Cutting',d,'14:30','16:45',JEK,'Welding lab'))});
  var d={account:{id:id,email:'jordan.demo@ogeecheetech.edu',pw:'demo'},
   profile:{id:id,first_name:'Jordan',consent:false,interests:['engineering','career','food','leadership','service','gaming'],major:'Welding and Joining Technology',year:'Second semester',campus:'statesboro',onboarded:true,created_at:now},
   schedules:schedules,events:[],follows:[{id:'f1',user_id:id,kind:'organization',name:'SkillsUSA'},{id:'f2',user_id:id,kind:'organization',name:'Student Leadership Council (SLC)'}],
   saved:[],savedPublic:[],hidden:[],feedback:[],activity:[],announcements:[],survey:[{id:'s1',user_id:id,phase:'baseline',discovery:3,usefulness:3,created_at:now}],plan:{},admin:false};
  try{localStorage.setItem(KEY,JSON.stringify(d));localStorage.setItem('roam-install-dismissed','1')}catch(e){}
 }
 try{if(!localStorage.getItem(KEY)||/[?&]reset/.test(location.search))seed()}catch(e){}
 window.ROAM_DEMO_RESET=function(){try{localStorage.removeItem(KEY)}catch(e){}location.href=location.pathname+'#today'};
})();
