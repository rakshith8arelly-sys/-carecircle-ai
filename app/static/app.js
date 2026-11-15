/* CareCircle AI — no framework or CDN required; accessible, responsive browser UI. */
const state = {
  token: sessionStorage.getItem('carecircle_token') || '', user: null,
  config: {demo_enabled:false,mail_mode:'Demo (no external emails)'},
  patients: [], current: sessionStorage.getItem('carecircle_patient') || '',
  overview:null, page:'dashboard', mode:'login', modal:null, code:null, busy:false, largeText:localStorage.getItem('carecircle_large_text')==='1'
};
const $ = (selector, root=document) => root.querySelector(selector);
const esc = (value='') => String(value ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const nice = v => (v || '').trim();
const first = name => nice(name).split(' ')[0] || 'friend';
const initials = name => nice(name).split(/\s+/).slice(0,2).map(a=>a[0]||'').join('').toUpperCase();
const dayName = day => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'});
const prettyDate = day => {if(!day)return '';const p=day.substring(0,10);return new Date(`${p}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});};
const friendlyTime = time => {const [hh,mm]=time.slice(0,5).split(':').map(Number);return `${hh%12||12}:${String(mm).padStart(2,'0')} ${hh<12?'AM':'PM'}`;};
const plusDays = (day,n) => {const dt=new Date(`${day}T12:00:00Z`);dt.setUTCDate(dt.getUTCDate()+n);return dt.toISOString().slice(0,10);};
const svgPaths = {
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/><path d="M3.6 12h4l2-3 3.3 6 1.8-3h5.7"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/>',
  pill:'<path d="m10.5 20.2 9.7-9.7a5.3 5.3 0 0 0-7.5-7.5L3 12.7a5.3 5.3 0 0 0 7.5 7.5z"/><path d="m8 8 8 8"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l-2 2a1.8 1.8 0 0 0-2-.36l-.6.3v2.1h-3v-2.1l-.8-.3a1.8 1.8 0 0 0-2 .36l-2-2a1.8 1.8 0 0 0 .36-2l-.3-.6H5v-3h2.1l.3-.8a1.8 1.8 0 0 0-.36-2l2-2a1.8 1.8 0 0 0 2 .36l.6-.3V4h3v2.1l.8.3a1.8 1.8 0 0 0 2-.36l2 2a1.8 1.8 0 0 0-.36 2l.3.6H21v3h-2.1z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',chevron:'<path d="m9 18 6-6-6-6"/>',down:'<path d="m6 9 6 6 6-6"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  spark:'<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
  chart:'<path d="M3 3v18h18M7 15l4-4 3 3 6-7"/>',message:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 8 10-8"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  alert:'<path d="m12 3 10 18H2L12 3zM12 9v5M12 18h.01"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2"/>',
  smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>'
};
const icon=(name,size=20)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgPaths[name]||svgPaths.heart}</svg>`;
const brand=()=>`<div class="brand"><div class="brand-logo">${icon('heart',23)}</div><span>care<em>circle</em></span></div>`;
const btn=(text,action,cls='btn',attrs='')=>`<button class="${cls}" data-action="${action}" ${attrs}>${text}</button>`;
function toast(text,error=false){const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=text;$('#toast-area').appendChild(el);setTimeout(()=>el.remove(),4000);}
async function api(url, options={}){
 const headers={'Content-Type':'application/json',...(state.token?{Authorization:`Bearer ${state.token}`}:{})};
 const res=await fetch('/api'+url,{...options,headers:{...headers,...options.headers}});
 let data={};try{data=await res.json();}catch{}
 if(!res.ok){if(res.status===401 && !url.startsWith('/auth/')){state.token='';state.user=null;sessionStorage.removeItem('carecircle_token');render();}throw new Error(typeof data.detail==='string'?data.detail:'Request failed');}
 return data;
}
function send(method,url,obj){return api(url,{method,body:JSON.stringify(obj)});}
async function refreshPatients(select=null){
 state.patients=await api('/patients');
 if(select)state.current=select;
 if(!state.patients.some(p=>p.id===state.current))state.current=state.patients[0]?.id||'';
 sessionStorage.setItem('carecircle_patient',state.current);
 state.overview=state.current?await api(`/patients/${state.current}/overview`):null;
}
async function load(){
 try{state.config=await api('/config');if(state.token){state.user=await api('/me');await refreshPatients();}}
 catch(e){state.token='';state.user=null;sessionStorage.removeItem('carecircle_token');}
 render();
}
function layout(content){
 const menus=[['dashboard','home','Overview'],['medications','pill','Medications'],['appointments','calendar','Appointments'],['circle','users','Care circle'],['activity','bell','Activity'],['settings','settings','Settings']];
 return `<div class="app-shell"><aside class="sidebar" aria-label="Main navigation">${brand()}<div class="sidebar-tag">Your workspace</div><nav class="nav-list">${menus.map(([id,sym,label])=>`<button class="nav ${state.page===id?'active':''}" data-action="nav" data-page="${id}" aria-current="${state.page===id?'page':'false'}">${icon(sym)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-foot"><div class="support-card">${icon('heart')}<h4>Better together.</h4><p>Care is lighter when you share it with those you trust.</p></div><div class="user-chip"><div class="avatar sm">${esc(initials(state.user?.name))}</div><div class="info"><b>${esc(state.user?.name)}</b><small>${esc(state.user?.email)}</small></div><button class="icon-btn" data-action="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button></div></div></aside><main class="main"><header class="topbar"><span class="topbar-date">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</span><div class="topbar-right"><button class="btn btn-outline btn-small" data-action="text-size" title="Toggle large text" aria-label="Toggle large text">Aa</button><button class="btn btn-outline btn-small" data-action="join">${icon('link',15)} Join a circle</button>${state.patients.length?`<label class="profile-select">${icon('users',16)}<span class="sr-only">Choose care profile</span><select id="profile-choice">${state.patients.map(p=>`<option value="${p.id}" ${p.id===state.current?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`:''}<button class="icon-btn mobile-menu" data-action="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button></div></header>${content}<p class="footer-note">CareCircle supports care coordination, not diagnosis or medical instructions. Always follow the prescribing clinician's advice.</p></main></div>${modalHtml()}`;
}
function authView(){
 const signup=state.mode==='signup';
 return `<div class="auth-shell"><section class="auth-left">${brand()}<div><div class="eyebrow">Your health. Your people. Your way.</div><h1>Care feels better <span>together.</span></h1><p>A simpler way to manage daily medications, keep up with appointments, and stay close to the people who care.</p></div><div class="auth-statement"><div class="auth-avatars"><div class="auth-avatar">M</div><div class="auth-avatar">A</div><div class="auth-avatar">R</div></div><strong>A little reassurance goes a long way.</strong><small>One shared space. Thoughtful reminders. More peace of mind for everyone.</small></div></section><section class="auth-right"><div class="auth-form-wrap"><div class="eyebrow">WELCOME TO CARECIRCLE</div><h2>${signup?"Let's get started.":'Good to see you.'}</h2><p class="sub">${signup?'Create your secure account to begin caring together.':'Sign in to your personal care dashboard.'}</p><form data-form="auth">${signup?`<div class="field"><label for="signup-name">Your name</label><input id="signup-name" name="name" required minlength="2" maxlength="80" autocomplete="name" placeholder="Alex Morgan"></div>`:''}<div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div><div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" required ${signup?'minlength="10" autocomplete="new-password"':'autocomplete="current-password"'} placeholder="${signup?'At least 10 characters':'Enter your password'}"></div><button class="btn btn-wide" type="submit">${signup?'Create my account':'Sign in'} ${icon('arrow',17)}</button></form><p class="auth-toggle">${signup?'Already have an account?':'New to CareCircle?'} <button class="text-btn" data-action="toggle-auth">${signup?'Sign in':'Create an account'}</button></p>${state.config.demo_enabled?`<div class="demo-cta"><p><b>Explore the live demo</b> — meet Meera and view her sample care dashboard.</p>${btn('Try demo account','demo-login','btn btn-outline btn-wide')}</div>`:''}<p class="footer-note">Private by design. You control who joins your circle.</p></div></section></div>`;
}
function onboard(){return `<section class="onboard"><div class="card onboard-card"><div class="big-icon">${icon('heart',34)}</div><div class="eyebrow">FIRST THINGS FIRST</div><h1>Who are we caring for?</h1><p class="sub">Create a care profile for yourself or someone you support. You can invite trusted family or caregivers after setup.</p><form data-form="patient-create"><div class="field"><label>Person's name</label><input name="name" placeholder="e.g. Meera Sharma" required minlength="2" maxlength="80"></div><div class="form-grid"><div class="field"><label>Age</label><input name="age" type="number" min="1" max="120" placeholder="72" required></div><div class="field"><label>Time zone</label><select name="timezone"><option value="Asia/Kolkata">India (IST)</option><option value="UTC">UTC</option><option value="Europe/London">London</option><option value="America/New_York">New York</option><option value="Asia/Dubai">Dubai</option><option value="Asia/Singapore">Singapore</option></select></div></div><div class="field"><label>Emergency contact (optional)</label><input name="emergency_contact" maxlength="120" placeholder="Name and phone number"></div><button class="btn btn-wide" type="submit">Create care circle ${icon('arrow')}</button></form><p class="help-note" style="margin-top:16px">The creator is the profile owner and controls access, sharing, and alerts. For another person's profile, obtain their consent first.</p></div></section>`;}
function pageHead(title,sub,actions=''){return `<div class="page-head"><div><div class="eyebrow">${esc(state.overview.patient.name)}'S CARE SPACE</div><h1>${title}</h1><p>${sub}</p></div><div class="page-actions">${actions}</div></div>`;}
function stats(){
 const o=state.overview,active=o.medications.filter(m=>m.active),dates=Array.from({length:7},(_,i)=>plusDays(o.today,i-6));
 const records=new Map(o.doses.map(d=>[d.id,d]));
 const series=dates.map(day=>{
   let due=0,taken=0;
   for(const med of active)for(const hhmm of med.times){if(med.effective_from&&day<med.effective_from)continue;if(day===o.today && hhmm>o.now_hhmm)continue;due++;if(records.get(`${med.id}:${day}:${hhmm}`)?.status==='taken')taken++;}
   return {day,due,taken,percent:due?Math.round(taken/due*100):0};
 });
 const last=series.reduce((x,d)=>({taken:x.taken+d.taken,due:x.due+d.due}),{taken:0,due:0});
 const todayDoses=active.flatMap((med,index)=>med.times.map(time=>({med,time,idx:index,record:records.get(`${med.id}:${o.today}:${time}`)}))).sort((a,b)=>a.time.localeCompare(b.time));
 const completed=todayDoses.filter(d=>d.record?.status==='taken').length;
 const upcoming=o.appointments.filter(a=>!a.cancelled&&a.at>=`${o.today}T${o.now_hhmm}`).sort((a,b)=>a.at.localeCompare(b.at));
 return {active,series,last,todayDoses,completed,upcoming,adherence:last.due?Math.round(100*last.taken/last.due):0};
}
function dashboard(){
 const o=state.overview,p=o.patient,s=stats(),appt=s.upcoming[0];
 const insight = !s.last.due?'Add a medication to start your 7-day adherence insights.': s.adherence>=85?'Great consistency this week. Continue checking off doses after they are taken.':'Some recent scheduled doses have not been marked as taken. A gentle check-in can help clarify what happened.';
 return `${pageHead(`Good ${greeting()}, ${esc(first(state.user.name))}.`,`Here's how things are looking for ${esc(first(p.name))} today.`,btn(`${icon('mic',17)} Read my day`,'speak','btn btn-outline'))}
 <div class="dashboard-grid"><div class="welcome card"><div><div class="eyebrow">A CARING REMINDER</div><h2>Every small step<br>is a step forward.</h2><p>Stay on track with your health, one day at a time. We're right here with you.</p>${btn(`View medications ${icon('arrow',16)}`,'goto-meds')}</div><div class="welcome-art" aria-hidden="true"><div class="art-blob"></div><div class="art-circle">${icon('heart',70)}</div><div class="art-pill"></div></div></div><div class="next-appt card"><div><div class="appointment-icon">${icon('calendar')}</div><div class="eyebrow">YOUR NEXT APPOINTMENT</div>${appt?`<h3>${esc(appt.title)}</h3><div class="light">${icon('calendar')} ${prettyDate(appt.at)} at ${friendlyTime(appt.at.slice(11,16))}</div><div class="light">${icon('pin')} ${esc(appt.location||'Location not specified')}</div>`:`<h3>All clear for now</h3><p class="sub">No upcoming appointments scheduled.</p>`}</div>${btn(appt?'View all appointments':'Add an appointment','goto-appointments','btn btn-outline btn-small')}</div></div>
 <div class="metric-grid"><div class="metric card"><div class="metric-top"><span>TODAY'S DOSES</span><div class="metric-icon">${icon('pill')}</div></div><div class="metric-value">${s.todayDoses.length}</div><div class="metric-foot">Across ${s.active.length} active medications</div></div><div class="metric card"><div class="metric-top"><span>MARKED TAKEN</span><div class="metric-icon">${icon('check')}</div></div><div class="metric-value">${s.completed}<span style="font-size:19px;color:#9ca99d">/${s.todayDoses.length}</span></div><div class="metric-foot">Confirm after taking a dose</div></div><div class="metric card"><div class="metric-top"><span>WEEKLY ADHERENCE</span><div class="metric-icon">${icon('chart')}</div></div><div class="metric-value">${s.adherence}%</div><div class="metric-foot">Marked taken in past 7 days</div></div><div class="metric card"><div class="metric-top"><span>CARE CIRCLE</span><div class="metric-icon">${icon('users')}</div></div><div class="metric-value">${o.members.length}</div><div class="metric-foot">Trusted members with access</div></div></div>
 <div class="lower-grid"><div class="list-card card"><div class="card-head"><div><h3>Today's medication plan</h3><p>Tap “Taken” only after a dose has been taken.</p></div>${btn('See all','goto-meds','btn btn-outline btn-small')}</div><div class="dose-list">${s.todayDoses.length?s.todayDoses.map(d=>doseRow(d,o.today)).join(''):`<div class="empty"><div class="empty-icon">${icon('pill',27)}</div><h3>Your day is looking clear</h3><p>Add a medication schedule to see today's doses here.</p>${btn('Add medication','add-med','btn btn-small')}</div>`}</div></div><div class="card list-card"><div class="card-head"><div><h3>Your progress</h3><p>Last 7 days, based on confirmed doses</p></div></div><div class="chart-area"><div class="chart-head"><span class="eyebrow">ADHERENCE OVERVIEW</span><strong>${s.adherence}%</strong></div><div class="bar-chart" role="img" aria-label="Daily adherence: ${s.series.map(v=>`${dayName(v.day)} ${v.percent}%`).join(', ')}">${s.series.map(v=>`<div class="bar-col"><div class="bar-track"><div class="bar-fill" style="height:${v.percent}%"></div></div><small>${dayName(v.day)}</small></div>`).join('')}</div><div class="chart-end"><span class="pill green">${icon('check',11)} Taken: ${s.last.taken} of ${s.last.due}</span></div><div class="insight">${icon('spark')}<p><b>Care insight</b><br>${esc(insight)}</p></div></div></div></div>`;
}
function greeting(){const h=new Date().getHours();return h<12?'morning':h<17?'afternoon':'evening';}
function doseRow(d,day){const status=d.record?.status;const pill=status==='taken'?'<span class="pill green">Taken</span>':status==='skipped'?'<span class="pill amber">Skipped</span>':'<span class="pill gray">Not confirmed</span>';return `<div class="dose-row"><div class="time-block">${friendlyTime(d.time).replace(' ','<br><small>')}</small></div><div class="med-icon ${d.idx%3===1?'orange':d.idx%3===2?'lilac':''}">${icon('pill')}</div><div class="dose-name"><b>${esc(d.med.name)}</b><small>${esc(d.med.dosage)}</small></div><div class="dose-actions">${pill}${state.overview.my_role!=='viewer'?(status?btn('Undo','dose','btn btn-outline btn-small',`data-mid="${d.med.id}" data-day="${day}" data-time="${d.time}" data-status="pending"`):`${btn('Taken','dose','btn btn-soft btn-small',`data-mid="${d.med.id}" data-day="${day}" data-time="${d.time}" data-status="taken"`)}${btn('Skip','dose','btn btn-outline btn-small',`data-mid="${d.med.id}" data-day="${day}" data-time="${d.time}" data-status="skipped"`)}`):''}</div></div>`;}
function medications(){const o=state.overview,s=stats();return `${pageHead('Medication management','A clear schedule, with everyone on the same page.',o.my_role==='viewer'?'':btn(`${icon('plus')} Add medication`,'add-med'))}<div class="section-head"><div><h3>Active schedules</h3><p class="sub">Medication schedules are entered by an authorized person, not prescribed by CareCircle.</p></div><span class="pill green">${s.active.length} active</span></div><div class="data-list">${o.medications.filter(m=>m.active).map((med,i)=>`<div class="card data-card"><div class="data-left"><div class="med-icon ${i%3===1?'orange':''}">${icon('pill',24)}</div><div><h3>${esc(med.name)}</h3><p>${esc(med.dosage)}${med.instructions?` · ${esc(med.instructions)}`:''}</p><div class="time-tags">${med.times.map(t=>`<span class="time-tag">${icon('clock',12)} ${friendlyTime(t)}</span>`).join('')}</div></div></div><div class="data-right">${o.my_role==='viewer'?'':`${btn(`${icon('edit',15)} Edit`,'edit-med','btn btn-outline btn-small',`data-id="${med.id}"`)}${btn(`${icon('trash',15)}`,'archive-med','btn btn-danger btn-small',`data-id="${med.id}" aria-label="Archive ${esc(med.name)}"`)}`}</div></div>`).join('')||emptyCard('pill','No medications yet','Start with a medication name, dosage, and schedule.',o.my_role==='viewer'?'':btn('Add a medication','add-med','btn btn-small'))}</div><div class="section"><h3 style="margin-bottom:13px">Today's confirmations</h3><div class="card pad">${s.todayDoses.length?s.todayDoses.map(d=>doseRow(d,o.today)).join(''):'<p class="no-items">No active doses have been scheduled for today.</p>'}</div></div><p class="help-note" style="margin-top:15px">If a dose is late or skipped, follow the prescription or ask a clinician what to do next. Never automatically double a dose.</p>`;}
function appointments(){const o=state.overview;const upcoming=o.appointments.filter(a=>!a.cancelled&&a.at>=`${o.today}T${o.now_hhmm}`),past=o.appointments.filter(a=>!a.cancelled&&a.at<`${o.today}T${o.now_hhmm}`);const row=a=>`<div class="card data-card"><div class="data-left"><div class="appointment-date"><strong>${a.at.slice(8,10)}</strong><small>${new Date(`${a.at.slice(0,10)}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})}</small></div><div><h3>${esc(a.title)}</h3><p>${icon('clock',12)} ${friendlyTime(a.at.slice(11,16))}${a.doctor?` · ${esc(a.doctor)}`:''}</p><p>${icon('pin',12)} ${esc(a.location||'Location not specified')}</p>${a.notes?`<small>${esc(a.notes)}</small>`:''}</div></div><div class="data-right">${o.my_role==='viewer'?'':`${btn(`${icon('edit',15)} Edit`,'edit-appt','btn btn-outline btn-small',`data-id="${a.id}"`)}${btn(`${icon('x',15)}`,'cancel-appt','btn btn-danger btn-small',`data-id="${a.id}" aria-label="Cancel ${esc(a.title)}"`)}`}</div></div>`;return `${pageHead('Appointments','Plan ahead and keep every visit on the calendar.',o.my_role==='viewer'?'':btn(`${icon('plus')} Add appointment`,'add-appt'))}<section><div class="section-head"><h3>Upcoming visits</h3><span class="pill violet">${upcoming.length} upcoming</span></div><div class="data-list">${upcoming.length?upcoming.map(row).join(''):emptyCard('calendar','No upcoming appointments','Schedule your next visit and we will keep it in view.',o.my_role==='viewer'?'':btn('Add appointment','add-appt','btn btn-small'))}</div></section>${past.length?`<section class="section"><h3 style="margin-bottom:15px">Previous appointments</h3><div class="data-list">${past.map(row).join('')}</div></section>`:''}`;}
function circle(){const o=state.overview;const transfer=o.ownership_transfer;const eligible=o.members.filter(m=>m.role!=='owner');return `${pageHead('Your care circle','The people you trust, all in one place.',o.my_role==='owner'?btn(`${icon('plus')} Invite someone`,'invite'):'' )}<div class="card pad" style="display:flex;gap:17px;align-items:flex-start;background:#e7f3e7;margin-bottom:25px"><div class="med-icon" style="background:#d0e9d3;color:#2b855c">${icon('shield',25)}</div><div><h3>You're in control of your circle.</h3><p class="sub">Invites are single-use and expire after 24 hours. Each person signs in to their own account. The owner decides who has access and can remove members.</p></div></div>${transfer?`<div class="card pad" style="margin-bottom:20px;border-color:#c9e1cf"><h3>Ownership transfer requested</h3><p class="sub">${transfer.to_user_id===state.user.id?'Someone has invited you to become the care profile owner. Accept only if this is your profile.':'Waiting for the selected member to accept profile ownership.'}</p><div class="page-actions" style="margin-top:12px">${transfer.to_user_id===state.user.id?btn('Accept ownership','accept-owner','btn btn-small'):''}${o.my_role==='owner'?btn('Cancel request','cancel-owner','btn btn-outline btn-small'):''}</div></div>`:''}<div class="section-head"><h3>Circle members</h3><span class="pill green">${o.members.length} members</span></div><div class="data-list">${o.members.map(m=>`<div class="card data-card"><div class="data-left"><div class="avatar md">${esc(initials(m.name))}</div><div><h3>${esc(m.name)}</h3><p>${esc(m.email)}</p><span class="member-role">${esc(m.role)}${m.role==='viewer'?' · View-only':''}</span></div></div><div class="data-right">${m.role==='owner'?'<span class="pill green">Profile owner</span>':(o.my_role==='owner'||m.user_id===state.user.id)?btn('Remove access','remove-member','btn btn-danger btn-small',`data-id="${m.user_id}"`):'<span class="pill gray">Member</span>'}</div></div>`).join('')}</div>${o.my_role==='owner'&&eligible.length?`<div class="card pad section" style="display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap"><div><h3>Keep the person at the center</h3><p class="sub">Transfer profile ownership to the elderly person if a family member set it up.</p></div>${btn('Transfer ownership','transfer-owner','btn btn-outline btn-small')}</div>`:''}<div class="card pad section"><h3>Role permissions</h3><p class="sub" style="margin-top:9px"><b>Owner</b> — controls profile settings, access, medications and appointments.<br><b>Family / Caregiver</b> — can manage schedules and confirm medications.<br><b>Viewer</b> — can see the shared plan, but cannot make changes.</p></div>`;}
function activity(){const o=state.overview;return `${pageHead('Notifications & activity','A transparent history of reminders and care updates.',o.my_role==='owner'&&state.config.demo_enabled?btn(`${icon('spark')} Preview alert`,'demo-alert','btn btn-soft'):btn(`${icon('download')} Export CSV`,'export','btn btn-outline'))}<div class="card pad" style="margin-bottom:22px"><div class="section-head" style="margin-bottom:8px"><h3>Email delivery</h3><span class="pill ${state.config.mail_mode.startsWith('Demo')?'amber':'green'}">${esc(state.config.mail_mode)}</span></div><p class="sub">${state.config.mail_mode.startsWith('Demo')?'Email provider is not configured. Scheduled alerts will be recorded as demo notifications rather than sent externally. Configure SendGrid or SMTP to enable actual delivery.':'An email provider is configured. Actual delivery depends on the provider and the scheduler running regularly.'}</p></div><div class="section-head"><h3>Reminder history</h3><span class="pill gray">${o.alerts.length} recent</span></div><div class="data-list">${o.alerts.length?o.alerts.map(a=>`<div class="card alert-card"><div class="bubble">${icon(a.kind==='appointment'?'calendar':'bell',19)}</div><div style="min-width:0;flex:1"><h3>${esc(a.title)}</h3><p>${esc(a.body)}<br><span style="font-weight:700">To: ${esc(a.email)}</span></p><small>${new Date(a.at).toLocaleString()}</small></div><span class="pill ${a.state==='sent'?'green':a.state==='failed'?'amber':'gray'}">${esc(a.state)}</span></div>`).join(''):emptyCard('bell','No reminders yet','Reminders will appear after the scheduler processes due events.','')}</div><div class="card pad section"><h3>Care activity log</h3><div class="audit-list">${o.audit.map(a=>`<div class="audit-row"><div class="med-icon" style="width:31px;height:31px">${icon('check',15)}</div><span><b>${esc(a.action.replaceAll('.',' · '))}</b> ${esc(a.detail||'')}</span><small>${prettyDate(a.at)}</small></div>`).join('')}</div></div>`;}
function settings(){const o=state.overview,p=o.patient,owner=o.my_role==='owner';return `${pageHead('Care preferences','Personalized routines and alerts, designed around your needs.')}${!owner?'<div class="card pad">Only the profile owner can change these preferences. You can still view the shared care plan.</div>':`<form data-form="settings"><div class="settings-grid"><div class="card settings-card"><h3>Personal details</h3><div class="field"><label>Name</label><input name="name" value="${esc(p.name)}" minlength="2" maxlength="80" required></div><div class="field"><label>Age</label><input name="age" type="number" min="1" max="120" value="${p.age}" required></div><div class="field"><label>Emergency contact</label><input name="emergency_contact" value="${esc(p.emergency_contact)}" maxlength="120" placeholder="Name and phone"></div><div class="field"><label>Time zone</label><select name="timezone">${['Asia/Kolkata','UTC','Europe/London','America/New_York','Asia/Dubai','Asia/Singapore','Australia/Sydney'].map(t=>`<option value="${t}" ${p.timezone===t?'selected':''}>${t}</option>`).join('')}</select></div></div><div class="card settings-card"><h3>Reminder preferences</h3><div class="field"><label>Upcoming dose reminder</label><select name="reminder_minutes">${[5,10,15,20,30,60].map(x=>`<option value="${x}" ${p.reminder_minutes===x?'selected':''}>${x} minutes before</option>`).join('')}</select></div><div class="field"><label>Caregiver check-in after</label><select name="grace_minutes">${[5,15,30,45,60,90,120,240].map(x=>`<option value="${x}" ${p.grace_minutes===x?'selected':''}>${x} minutes unconfirmed</option>`).join('')}</select><p class="field-hint">Alerts mean “not confirmed”, not “definitely missed”.</p></div><label class="toggle"><input type="checkbox" name="notify_caregivers" ${p.notify_caregivers?'checked':''}> Notify caregivers when a dose is unconfirmed</label><p class="help-note">Reminders run through a background scheduler, not merely while this page is open.</p></div></div><div class="setting-footer section"><p class="help-note">Changes affect future notifications. Time zone is used for schedule calculations.</p><button type="submit" class="btn">${icon('check')} Save preferences</button></div></form>`}`;}
function emptyCard(ic,title,descr,action){return `<div class="card empty"><div class="empty-icon">${icon(ic,27)}</div><h3>${title}</h3><p>${descr}</p>${action}</div>`;}
function render(){
 document.documentElement.classList.toggle('large-text',state.largeText);
 let html='';if(!state.user)html=authView();else if(!state.current)html=layout(onboard());else {const views={dashboard,medications,appointments,circle,activity,settings};html=layout((views[state.page]||dashboard)());}
 $('#app').innerHTML=html;
}
function modalHtml(){if(!state.modal)return '';const kind=state.modal.type,med=state.overview?.medications.find(m=>m.id===state.modal.id),appt=state.overview?.appointments.find(a=>a.id===state.modal.id);
 let title='',body='';
 if(kind==='med'){
 title=med?'Edit medication':'Add a medication';body=`<form data-form="med"><div class="field"><label>Medication name</label><input name="name" placeholder="e.g. Daily vitamin" value="${esc(med?.name||'')}" required minlength="2" maxlength="100"></div><div class="field"><label>Dosage / quantity</label><input name="dosage" placeholder="e.g. 1 tablet, as prescribed" value="${esc(med?.dosage||'')}" required maxlength="80"></div><div class="field"><label>Times (24-hour, separated by commas)</label><input name="times" placeholder="08:00, 20:00" value="${esc(med?.times.join(', ')||'08:00')}" required><p class="field-hint">Example: 08:00, 13:00, 20:00. These times repeat daily.</p></div><div class="field"><label>Instructions from the prescription (optional)</label><textarea name="instructions" maxlength="250" placeholder="e.g. Take with food">${esc(med?.instructions||'')}</textarea></div><label class="toggle"><input type="checkbox" name="active" ${med?.active!==false?'checked':''}> Schedule active</label><div class="modal-footer">${btn('Cancel','close','btn btn-outline')}<button class="btn" type="submit">${med?'Save changes':'Add medication'}</button></div></form>`;
 }else if(kind==='appt'){
 title=appt?'Edit appointment':'New appointment';body=`<form data-form="appt"><div class="field"><label>Appointment title</label><input name="title" required minlength="2" maxlength="120" placeholder="Routine check-up" value="${esc(appt?.title||'')}"></div><div class="field"><label>Date and time</label><input name="at" type="datetime-local" required value="${esc(appt?.at||'')}"></div><div class="field"><label>Doctor / specialist</label><input name="doctor" maxlength="120" placeholder="Dr. Smith" value="${esc(appt?.doctor||'')}"></div><div class="field"><label>Location</label><input name="location" maxlength="150" placeholder="Clinic or hospital" value="${esc(appt?.location||'')}"></div><div class="field"><label>Notes</label><textarea name="notes" maxlength="250" placeholder="Anything to prepare or bring">${esc(appt?.notes||'')}</textarea></div><div class="modal-footer">${btn('Cancel','close','btn btn-outline')}<button class="btn" type="submit">${appt?'Save appointment':'Add appointment'}</button></div></form>`;
 }else if(kind==='invite'){
 title='Invite someone you trust';body=`<p class="sub">Invite a family member, caregiver, or viewer. They need their own CareCircle account to join. Codes expire after 24 hours and can be used once.</p><form data-form="invite"><div class="field"><label>Access level</label><select name="role"><option value="family">Family — view and manage care</option><option value="caregiver">Caregiver — view and manage care</option><option value="viewer">Viewer — view-only access</option></select></div><div class="modal-footer">${btn('Cancel','close','btn btn-outline')}<button class="btn" type="submit">Generate invite code</button></div></form>`;
 }else if(kind==='invite-result'){
 title='Your invitation is ready';body=`<p class="sub">Share this code privately with one trusted person. They can sign up or sign in and choose “Join a circle.”</p><div class="code-display">${esc(state.code?.code||'')}</div><p class="help-note">${esc(state.code?.note||'')}</p><div class="modal-footer">${btn(`${icon('copy')} Copy code`,'copy-code','btn btn-outline')}${btn('Done','close')}</div>`;
 }else if(kind==='join'){
 title='Join a care circle';body=`<p class="sub">Enter the one-time invitation code shared by the profile owner. You'll get access according to the permission they selected.</p><form data-form="join"><div class="field"><label>Invite code</label><input name="code" required minlength="12" maxlength="20" placeholder="ABCD-EFGH-JKLM" style="font-family:monospace;text-transform:uppercase;letter-spacing:.08em"></div><div class="modal-footer">${btn('Cancel','close','btn btn-outline')}<button class="btn" type="submit">Join circle</button></div></form>`;
 }else if(kind==='transfer'){
 title='Transfer profile ownership';body=`<p class="sub">The selected member must sign in and accept within 24 hours. They will control the care profile and your role will become family.</p><form data-form="transfer"><div class="field"><label>New owner</label><select name="to_user_id">${state.overview.members.filter(m=>m.role!=='owner').map(m=>`<option value="${m.user_id}">${esc(m.name)} (${esc(m.email)})</option>`).join('')}</select></div><div class="modal-footer">${btn('Cancel','close','btn btn-outline')}<button class="btn" type="submit">Request transfer</button></div></form>`;
 }else if(kind==='new-patient'){
 title='New care profile';body=`<form data-form="patient-create"><div class="field"><label>Person's name</label><input name="name" required minlength="2" maxlength="80" placeholder="Name"></div><div class="form-grid"><div class="field"><label>Age</label><input type="number" min="1" max="120" name="age" required></div><div class="field"><label>Time zone</label><select name="timezone"><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option><option value="Europe/London">London</option></select></div></div><div class="field"><label>Emergency contact</label><input name="emergency_contact" maxlength="120"></div><div class="modal-footer"><button class="btn" type="submit">Create profile</button></div></form>`;
 }
 return `<div class="overlay" id="modal-overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2>${btn(icon('x'),'close','icon-btn','aria-label="Close dialog"')}</div><div class="modal-body">${body}</div></div></div>`;
}
async function submitForm(e){
 const form=e.target.closest('form[data-form]');if(!form)return;
 e.preventDefault();if(state.busy)return;state.busy=true;
 const which=form.dataset.form, f=Object.fromEntries(new FormData(form));
 const submit=$('[type="submit"]',form);if(submit)submit.disabled=true;
 try{
  if(which==='auth'){
   const data=await send('POST',state.mode==='signup'?'/auth/signup':'/auth/login',f);state.token=data.token;state.user=data.user;sessionStorage.setItem('carecircle_token',state.token);state.modal=null;state.page='dashboard';await refreshPatients();toast(`Welcome${state.mode==='signup'?' to CareCircle':''}, ${first(state.user.name)}!`);
  }else if(which==='patient-create'){
   const p=await send('POST','/patients',{...f,age:Number(f.age)});state.modal=null;await refreshPatients(p.id);toast('Care profile created');
  }else if(which==='med'){
   const d={name:f.name,dosage:f.dosage,instructions:f.instructions||'',times:f.times.split(',').map(v=>v.trim()),active:Boolean(f.active)};
   // Use a fixed-key object to avoid accidentally persisting arbitrary form fields.
   d.active=Boolean(f.active);
   const id=state.modal.id;
   await send(id?'PATCH':'POST',`/patients/${state.current}/medications${id?'/'+id:''}`,d);state.modal=null;await refreshPatients();toast(id?'Medication updated':'Medication added');
  }else if(which==='appt'){
   const id=state.modal.id;
   await send(id?'PATCH':'POST',`/patients/${state.current}/appointments${id?'/'+id:''}`,{title:f.title,doctor:f.doctor||'',location:f.location||'',notes:f.notes||'',at:f.at,cancelled:false});state.modal=null;await refreshPatients();toast(id?'Appointment updated':'Appointment added');
  }else if(which==='settings'){
   await send('PATCH',`/patients/${state.current}`,{name:f.name,age:Number(f.age),timezone:f.timezone,emergency_contact:f.emergency_contact||'',reminder_minutes:Number(f.reminder_minutes),grace_minutes:Number(f.grace_minutes),notify_caregivers:Boolean(f.notify_caregivers)});await refreshPatients();toast('Care preferences saved');
  }else if(which==='invite'){
   state.code=await send('POST',`/patients/${state.current}/invitations`,{role:f.role});state.modal={type:'invite-result'};toast('Invite code created');
  }else if(which==='transfer'){
   await send('POST',`/patients/${state.current}/ownership/request`,{to_user_id:f.to_user_id});state.modal=null;await refreshPatients();toast('Ownership transfer requested');
  }else if(which==='join'){
   const result=await send('POST','/invitations/redeem',{code:f.code});state.modal=null;state.page='dashboard';await refreshPatients(result.patient_id);toast(`You joined ${result.name}'s circle`);
  }
  render();
 }catch(err){toast(err.message,true);}finally{state.busy=false;if(submit)submit.disabled=false;}
}
async function doAction(el){
 const a=el.dataset.action,id=el.dataset.id, role=state.overview?.my_role;
 try{
  if(a==='text-size'){state.largeText=!state.largeText;localStorage.setItem('carecircle_large_text',state.largeText?'1':'0');render();return toast(state.largeText?'Large text enabled':'Standard text enabled');}
  if(a==='toggle-auth'){state.mode=state.mode==='login'?'signup':'login';return render();}
  if(a==='demo-login'){const v=await send('POST','/auth/login',{email:'demo@carecircle.app',password:'Demo@12345'});state.token=v.token;state.user=v.user;sessionStorage.setItem('carecircle_token',v.token);await refreshPatients();state.page='dashboard';return render();}
  if(a==='logout'){sessionStorage.removeItem('carecircle_token');sessionStorage.removeItem('carecircle_patient');state.token='';state.user=null;state.overview=null;state.modal=null;state.current='';return render();}
  if(a==='nav'){state.page=el.dataset.page;return render();}
  if(a==='goto-meds'){state.page='medications';return render();}
  if(a==='goto-appointments'){state.page='appointments';return render();}
  if(a==='add-med'){state.modal={type:'med'};return render();}
  if(a==='edit-med'){state.modal={type:'med',id};return render();}
  if(a==='add-appt'){state.modal={type:'appt'};return render();}
  if(a==='edit-appt'){state.modal={type:'appt',id};return render();}
  if(a==='join'){state.modal={type:'join'};return render();}
  if(a==='transfer-owner'){state.modal={type:'transfer'};return render();}
  if(a==='accept-owner'){await send('POST',`/patients/${state.current}/ownership/accept`,{});await refreshPatients();render();return toast('You now control this care profile');}
  if(a==='cancel-owner'){await api(`/patients/${state.current}/ownership/request`,{method:'DELETE'});await refreshPatients();render();return toast('Transfer request cancelled');}
  if(a==='invite'){state.modal={type:'invite'};return render();}
  if(a==='close'){state.modal=null;return render();}
  if(a==='copy-code'){await navigator.clipboard.writeText(state.code.code);return toast('Invite code copied');}
  if(a==='dose'){
   const {mid,day,time,status}=el.dataset;
   if(status==='skipped'&&!confirm('Mark this dose as skipped? This will not change any prescribed instructions.'))return;
   await send('PUT',`/patients/${state.current}/doses/${mid}/${day}/${time}`,{status});await refreshPatients();render();return toast(status==='pending'?'Confirmation cleared':status==='taken'?'Marked as taken':'Marked as skipped');
  }
  if(a==='archive-med'){
   if(!confirm('Archive this medication schedule? Past confirmations remain in the history.'))return;
   await api(`/patients/${state.current}/medications/${id}`,{method:'DELETE'});await refreshPatients();render();return toast('Medication archived');
  }
  if(a==='cancel-appt'){
   if(!confirm('Cancel this appointment?'))return;
   await api(`/patients/${state.current}/appointments/${id}`,{method:'DELETE'});await refreshPatients();render();return toast('Appointment cancelled');
  }
  if(a==='remove-member'){
   if(!confirm('Remove this person from the care circle? Their access will be revoked.'))return;
   await api(`/patients/${state.current}/members/${id}`,{method:'DELETE'});await refreshPatients();render();return toast('Access removed');
  }
  if(a==='demo-alert'){
   await send('POST',`/patients/${state.current}/demo-alert`,{});await refreshPatients();render();return toast('Preview notification created; no email sent');
  }
  if(a==='speak'){
   if(!('speechSynthesis' in window))return toast('Voice reading is not available in this browser',true);
   window.speechSynthesis.cancel();const s=stats();
   const words=`Hello ${first(state.overview.patient.name)}. Today you have ${s.todayDoses.length} scheduled doses, and ${s.completed} have been marked as taken. ${s.upcoming.length?'Your next appointment is '+s.upcoming[0].title+' on '+prettyDate(s.upcoming[0].at)+'.':'There are no upcoming appointments.'} Please follow your care plan and confirm doses after taking them.`;
   const u=new SpeechSynthesisUtterance(words);u.rate=.85;u.lang='en-IN';window.speechSynthesis.speak(u);return toast('Reading your daily care briefing');
  }
  if(a==='export')return downloadCsv();
 }catch(err){toast(err.message,true);}
}
function downloadCsv(){
 const o=state.overview,lines=[['Date','Time','Medication','Dose','Status','Recorded by']];
 for(const d of o.doses){const med=o.medications.find(m=>m.id===d.medication_id);lines.push([d.date,d.time,med?.name||'Archived medication',med?.dosage||'',d.status,d.recorded_by]);}
 const csv=lines.map(row=>row.map(v=>`"${String(v??'').replace(/^[=+@-]/,"'").replaceAll('"','""')}"`).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`carecircle-${o.today}-adherence.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);toast('Adherence CSV downloaded');
}
document.addEventListener('submit',submitForm);
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el)doAction(el);else if(e.target.id==='modal-overlay'){state.modal=null;render();}});
document.addEventListener('change',async e=>{if(e.target.id==='profile-choice'){try{await refreshPatients(e.target.value);state.page='dashboard';render();}catch(err){toast(err.message,true);}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.modal){state.modal=null;render();}});
load();
