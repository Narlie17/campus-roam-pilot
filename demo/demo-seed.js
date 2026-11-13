/* Loads a sample Georgia Southern student so the demo opens straight into a filled-in day.
   Everything stays in this browser; open demo/?reset to start over. */
(function(){
 var KEY='campus-roam-v14-local';
 function seed(){
  var id='demo-jordan',now=new Date().toISOString();
  var c=function(code,name,day,s,e,b,r){return {id:'c-'+code.replace(/\s/g,'')+'-'+day,user_id:id,course_code:code,course_name:name,weekday:day,start_time:s,end_time:e,building:b,room:r}};
  var schedules=[];
  ['Monday','Wednesday','Friday'].forEach(function(d){schedules.push(c('MKTG 3131','Principles of Marketing',d,'09:00','09:50','College of Business','1124'),c('COMM 2332','Public Speaking',d,'13:25','14:15','Carroll Building','1020'))});
  ['Tuesday','Thursday'].forEach(function(d){schedules.push(c('ECON 2106','Principles of Microeconomics',d,'09:30','10:45','Nursing/Chemistry Building','2005'),c('MGNT 3130','Management and Organizational Behavior',d,'12:30','13:45','College of Business','2230'),c('POLS 1101','American Government',d,'15:30','16:45','Interdisciplinary Academic Building','1001'))});
  var d={account:{id:id,email:'jordan.demo@georgiasouthern.edu',pw:'demo'},
   profile:{id:id,first_name:'Jordan',consent:false,interests:['career','business','food','service','arts'],major:'Marketing (BBA)',year:'Junior',campus:'statesboro',onboarded:true,created_at:now},
   schedules:schedules,events:[],follows:[{id:'f1',user_id:id,kind:'organization',name:'Serve912'},{id:'f2',user_id:id,kind:'department',name:'Marketing'}],
   saved:[],savedPublic:[],hidden:[],feedback:[],activity:[],announcements:[],survey:[{id:'s1',user_id:id,phase:'baseline',discovery:3,usefulness:3,created_at:now}],plan:{},admin:false};
  try{localStorage.setItem(KEY,JSON.stringify(d));localStorage.setItem('roam-install-dismissed','1');localStorage.removeItem('roam-path-'+id);localStorage.setItem('roam-groups-'+id,'["new","transfer"]')}catch(e){}
 }
 try{var cur=JSON.parse(localStorage.getItem(KEY)||'null');if(!cur||!cur.account||/[?&]reset/.test(location.search))seed()}catch(e){seed()}
 try{if(localStorage.getItem('roam-groups-demo-jordan')===null)localStorage.setItem('roam-groups-demo-jordan','["new","transfer"]')}catch(e){}
})();
