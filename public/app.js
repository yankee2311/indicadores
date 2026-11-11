'use strict';
const $=s=>document.querySelector(s);
const state={user:null,meta:null,view:'dashboard',rows:[],records:{},selectedDeveloper:null};
const labels={
  dashboard:['Resumen ejecutivo','Visibilidad integral del portafolio y resultados.'],
  onepage:['Mi OnePage','Seguimiento diario, compromisos y bloqueos del equipo.'],
  requests:['Solicitudes','Captura, evaluación, priorización y clasificación de demanda.'],
  projects:['Proyectos','Planeación, asignación, hitos y entregas.'],
  tasks:['Tareas y entregables','Compromisos y avances de cada proyecto.'],
  assets:['Inventario de automatizaciones','Registro de soluciones, riesgo y preparación para producción.'],
  approvals:['Riesgo y autorizaciones','Revisiones y evidencia de las autoridades competentes.'],
  executions:['Ejecuciones','Indicadores de estabilidad y operación de los activos.'],
  incidents:['Incidencias','Seguimiento de errores, severidad y causa raíz.'],
  documents:['Documentación','Expediente funcional, técnico y evidencias asociadas.'],
  companies:['Empresas','Catálogo de entidades del grupo.'],
  users:['Usuarios','Altas y permisos corporativos.'],
  audit:['Auditoría','Registro inmutable de las principales operaciones.']
};
const schemas={
  requests:[
    ['title','Nombre de la iniciativa','text',true],['company_id','Empresa','company',true],
    ['department','Área solicitante'],['requester','Solicitante'],['owner','Responsable funcional'],
    ['description','Problema o proceso actual','textarea'],['type','Tipo de solución','choice:RPA,Bot,Agent,AI,Integration,Script,Other'],
    ['approach','Modalidad','choice:no-code,low-code,traditional'],
    ['status','Estado','choice:new,evaluation,approved,backlog,assigned,rejected,traditional'],
    ['risk','Riesgo estimado','choice:pending,low,medium,high,unacceptable'],
    ['process_volume','Volumen mensual','number'],['minutes_per_item','Minutos por operación','number'],
    ['expected_hours','Horas esperadas al mes','number'],
    ['score_impact','Impacto económico (1–5)','score'],['score_time','Ahorro tiempo (1–5)','score'],
    ['score_scope','Alcance (1–5)','score'],['score_reuse','Reutilización (1–5)','score'],
    ['score_complexity','Complejidad (1=baja,5=alta)','score'],
    ['score_compliance','Cumplimiento (1–5)','score']
  ],
  projects:[
    ['name','Nombre del proyecto','text',true],['request_id','Solicitud de origen','request'],
    ['company_id','Empresa','company',true],['developer_id','Desarrollador','user'],
    ['owner','Product Owner'],['status','Estado','choice:planned,development,testing,blocked,done,cancelled'],
    ['start_date','Inicio','date'],['due_date','Fecha compromiso','date'],
    ['estimated_cost','Costo de implementación','number'],['target_hours','Horas objetivo mensuales','number'],
    ['blocker','Bloqueo actual','textarea'],['next_milestone','Próximo hito']
  ],
  tasks:[
    ['project_id','Proyecto','project',true],['title','Entregable / tarea','text',true],
    ['assignee_id','Asignado a','user'],['status','Estado','choice:pending,doing,blocked,done'],
    ['priority','Prioridad','choice:low,medium,high'],['weight','Peso del entregable','number'],
    ['due_date','Fecha compromiso','date']
  ],
  daily_updates:[
    ['project_id','Proyecto','project',true],['done','Trabajo completado','textarea',true],
    ['hours','Horas invertidas','number'],['next_step','Próximo compromiso'],
    ['commitment_date','Fecha del siguiente compromiso','date'],
    ['blocker','Impedimento / apoyo necesario','textarea'],['evidence_url','Liga de evidencia','url']
  ],
  assets:[
    ['project_id','Proyecto de origen','project'],['name','Nombre del activo','text',true],
    ['company_id','Empresa','company',true],['type','Tecnología','choice:RPA,Bot,Agent,AI,Integration,Script,Other'],
    ['owner','Propietario funcional','text',true],['technical_owner','Responsable técnico','text',true],
    ['risk','Riesgo clasificado','choice:pending,low,medium,high,unacceptable'],
    ['status','Etapa de operación','choice:development,testing,production,maintenance,suspended,retired'],
    ['data_class','Clasificación de datos','choice:public,internal,confidential,restricted'],
    ['provider','Proveedor / plataforma'],['systems','Sistemas involucrados'],
    ['hours_saved_month','Horas netas liberadas por mes','number'],['hourly_rate','Costo por hora ($)','number'],
    ['monthly_cost','Costo mensual ($)','number'],['build_cost','Costo de implementación ($)','number'],
    ['nHI','Cuenta de servicio (identificador, nunca secreto)'],
    ['registered_ok','Registrado ante Ciberseguridad','check'],['pam_ok','Cuenta resguardada en PAM','check'],
    ['rotation_ok','Rotación vigente','check'],['logs_ok','Bitácoras / monitoreo','check'],
    ['kill_switch_ok','Suspensión inmediata','check'],['rollback_ok','Reversión documentada','check'],
    ['manual_ok','Procedimiento manual','check'],['tests_ok','Pruebas aceptadas','check'],
    ['docs_ok','Documentación vigente','check']
  ],
  executions:[
    ['asset_id','Automatización','asset',true],['status','Resultado','choice:success,failed',true],
    ['duration_seconds','Duración (segundos)','number'],['transactions','Transacciones','number'],
    ['message','Detalle de ejecución','textarea']
  ],
  incidents:[
    ['asset_id','Automatización','asset',true],['title','Descripción del incidente','text',true],
    ['severity','Severidad','choice:low,medium,high,critical'],
    ['status','Estado','choice:open,investigating,resolved'],['root_cause','Análisis de causa raíz','textarea']
  ],
  documents:[
    ['project_id','Proyecto','project'],['asset_id','Automatización','asset'],
    ['title','Nombre del documento','text',true],['type','Clasificación','choice:PDD,SDD,Manual,Pruebas,Liberación,Cambio,Otro',true],
    ['version','Versión'],['url','URL de repositorio documental','url',true]
  ],
  companies:[['name','Nombre de empresa','text',true],['code','Código único (mayúsculas)','text',true]],
  users:[['username','Usuario (login)','text',true],['display_name','Nombre visible','text',true],
    ['role','Perfil','choice:admin,pm,developer,security,executive,viewer',true],
    ['password','Contraseña temporal (mínimo 12 caracteres)','password',true]]
};
const tableCols={
  requests:[['id','ID'],['title','Iniciativa'],['company_id','Empresa'],['type','Tipo'],['status','Estado'],['risk','Riesgo'],['score','Puntaje']],
  projects:[['id','ID'],['name','Proyecto'],['company_id','Empresa'],['developer_id','Desarrollador'],['status','Estado'],['due_date','Compromiso']],
  tasks:[['id','ID'],['title','Tarea'],['project_id','Proyecto'],['assignee_id','Responsable'],['status','Estado'],['due_date','Compromiso']],
  assets:[['id','ID'],['name','Automatización'],['company_id','Empresa'],['type','Tipo'],['risk','Riesgo'],['status','Estado'],['hours_saved_month','Horas / mes']],
  executions:[['id','ID'],['asset_id','Automatización'],['status','Resultado'],['executed_at','Fecha'],['transactions','Transacciones'],['duration_seconds','Segundos']],
  incidents:[['id','ID'],['title','Incidencia'],['asset_id','Activo'],['severity','Severidad'],['status','Estado'],['created_at','Registro']],
  documents:[['id','ID'],['title','Documento'],['type','Tipo'],['version','Versión'],['project_id','Proyecto'],['asset_id','Activo'],['url','Referencia']],
  companies:[['id','ID'],['name','Empresa'],['code','Código']],
  users:[['id','ID'],['display_name','Nombre'],['username','Usuario'],['role','Perfil']],
  audit:[['created_at','Fecha'],['username','Usuario'],['action','Evento'],['entity','Entidad'],['entity_id','ID']]
};
const roleCanWrite={
 requests:['admin','pm','executive'],projects:['admin','pm'],tasks:['admin','pm','developer'],
 daily_updates:['admin','pm','developer'],assets:['admin','pm','security'],
 executions:['admin','pm','developer'],incidents:['admin','pm','developer','security'],
 documents:['admin','pm','developer','security'],companies:['admin'],users:['admin']
};
function canWrite(table){return (roleCanWrite[table]||[]).includes(state.user?.role);}
function escapeHtml(value){
 return String(value===null||value===undefined?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtN(n,d=0){return Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:d,maximumFractionDigits:d});}
function money(n){return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0});}
function nice(value){
 const map={new:'Nueva',evaluation:'Evaluación',approved:'Aprobada',backlog:'Backlog',assigned:'Asignada',
  rejected:'Rechazada',traditional:'Desarrollo tradicional',pending:'Pendiente',planned:'Planeado',
  development:'Desarrollo',testing:'Pruebas',blocked:'Bloqueado',done:'Terminado',cancelled:'Cancelado',
  production:'Producción',maintenance:'Mantenimiento',suspended:'Suspendido',retired:'Retirado',
  low:'Bajo',medium:'Medio',high:'Alto',unacceptable:'Inaceptable',internal:'Interno',
  confidential:'Confidencial',restricted:'Restringido',public:'Público',doing:'En curso',success:'Exitosa',
  failed:'Fallida',open:'Abierta',investigating:'Investigando',resolved:'Resuelta',critical:'Crítica',
  admin:'Administrador',developer:'Desarrollador',executive:'Ejecutivo',security:'Ciberseguridad',
  pm:'Coordinación',viewer:'Consulta',manager:'Jefatura',registration:'Registro de seguridad',
  business:'Dirección de negocio',cyber:'Visto bueno de Ciberseguridad',security_committee:'Comité de seguridad'};
 return map[value]||String(value??'—');
}
function chip(value){
 const cls=['production','done','success','approved','resolved','low'].includes(value)?'success':
 ['high','critical','blocked','failed','rejected','unacceptable','suspended'].includes(value)?'danger':
 ['pending','medium','testing','evaluation','investigating'].includes(value)?'alert':'';
 return '<span class="chip '+cls+'">'+escapeHtml(nice(value))+'</span>';
}
async function api(url,options={}){
 const r=await fetch(url,Object.assign({credentials:'same-origin',headers:{'Accept':'application/json'}},options));
 let data;try{data=await r.json();}catch{data={error:'Respuesta inválida del servidor.'};}
 if(!r.ok){const e=new Error(data.error||'Error '+r.status);e.status=r.status;throw e;}
 return data;
}
async function mutate(url,body,method='POST'){
 return api(url,{method,headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
}
function toast(message){
 const t=$('#toast');t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,3500);
}
function loadLogin(){
 $('#app').hidden=true;$('#login').hidden=false;
}
function setUser(user){
 state.user=user;$('#login').hidden=true;$('#app').hidden=false;
 $('#user-name').textContent=user.display_name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
 $('#user-role').textContent=nice(user.role);
 document.querySelectorAll('[data-admin-only]').forEach(x=>x.hidden=user.role!=='admin');
 document.querySelectorAll('[data-audit-only]').forEach(x=>x.hidden=!['admin','security','executive'].includes(user.role));
}
async function init(){
 try{const me=await api('/api/me');setUser(me.user);state.meta=await api('/api/meta');await show('dashboard');}
 catch(e){if(e.status===401)loadLogin();else{loadLogin();toast(e.message);}}
}
function header(view,actionLabel){
 const t=labels[view]||[view,''];$('#page-title').textContent=t[0];
 return '<section class="page-head"><div><p class="eyebrow">OPERACIÓN / '+escapeHtml(t[0].toUpperCase())+
   '</p><h1>'+escapeHtml(t[0])+'</h1><p>'+escapeHtml(t[1])+
   '</p></div>'+(actionLabel?'<button class="btn primary" data-action="new" data-table="'+escapeHtml(view)+'">＋ '+escapeHtml(actionLabel)+'</button>':'')+'</section>';
}
function empty(text){
 return '<div class="empty"><div class="empty-icon">◇</div><b>Aún no hay registros</b><span>'+escapeHtml(text||'Comienza creando el primer registro.')+'</span></div>';
}
function metric(title,value,icon,sub){
 return '<div class="metric"><span class="symbol">'+icon+'</span><p>'+escapeHtml(title)+'</p><h2>'+escapeHtml(value)+'</h2><small>'+escapeHtml(sub||'')+'</small></div>';
}
function chart(title,rows,nameKey='name'){
 const max=Math.max(1,...rows.map(x=>Number(x.count||0)));
 return '<div class="panel"><div class="panel-head"><h2>'+escapeHtml(title)+'</h2><small>Distribución del portafolio</small></div>'+
 (rows.length?rows.map(x=>'<div class="chart-row"><span title="'+escapeHtml(x[nameKey])+'">'+escapeHtml(nice(x[nameKey]))+
 '</span><div class="track"><i style="width:'+Math.round(Number(x.count||0)*100/max)+'%"></i></div><strong>'+fmtN(x.count)+'</strong></div>').join(''):empty('Sin datos para el periodo.'))+'</div>';
}
async function renderDashboard(){
 const d=await api('/api/dashboard');
 const recent=d.activity.map(x=>'<div class="timeline-item"><div class="timeline-dot"></div><div><strong>'+
   escapeHtml(nice(x.action)+' · '+x.entity+' #'+x.entity_id)+'</strong><small>'+escapeHtml(x.created_at)+'</small></div></div>').join('');
 $('#content').innerHTML=header('dashboard')+
 '<section class="metrics">'+
 metric('Solicitudes registradas',fmtN(d.requests),'◈','Backlog '+fmtN(d.backlog))+
 metric('Proyectos en curso',fmtN(d.projects),'▤','Bloqueados '+fmtN(d.blocked))+
 metric('Automatizaciones activas',fmtN(d.production),'⬡','Activos en producción')+
 metric('Horas liberadas / mes',fmtN(d.hours,1),'◷','Beneficio neto de tiempo')+
 metric('Valor neto mensual',money(d.netMonthly),'＄','Ingreso evitado estimado menos costo operativo')+
 metric('Ejecuciones exitosas',d.successRate===null?'N/D':fmtN(d.successRate,1)+'%','✓','Meta propuesta ≥98%')+
 metric('Compromisos a tiempo',d.onTimeRate===null?'N/D':fmtN(d.onTimeRate,1)+'%','◴','Meta propuesta ≥90%')+
 metric('Incidentes abiertos',fmtN(d.incidents),'⚑','Tareas vencidas '+fmtN(d.tasksDue))+
 '</section><div class="two-col"><div>'+chart('Automatizaciones por empresa',d.byCompany)+
 chart('Proyectos por estado',d.byStatus,'status')+'</div><div>'+chart('Soluciones por tecnología',d.byType,'type')+
 '<div class="panel"><div class="panel-head"><h2>Últimos movimientos</h2></div><div class="timeline">'+(recent||empty('Sin actividad todavía.'))+
 '</div></div></div></div>';
}
function valueLabel(key,value){
 if(value===null||value===undefined||value==='')return '—';
 if(key==='company_id')return state.meta?.companies.find(x=>x.id===Number(value))?.name||('#'+value);
 if(['developer_id','assignee_id','user_id'].includes(key))return state.meta?.users.find(x=>x.id===Number(value))?.display_name||('#'+value);
 if(key==='project_id')return state.records.projects?.find(x=>x.id===Number(value))?.name||('#'+value);
 if(key==='asset_id')return state.records.assets?.find(x=>x.id===Number(value))?.name||('#'+value);
 if(key==='request_id')return state.records.requests?.find(x=>x.id===Number(value))?.title||('#'+value);
 if(key==='status'||key==='severity'||key==='risk'||key==='role'||key==='decision')return chip(value);
 if(key==='url'){try{return '<a href="'+escapeHtml(value)+'" target="_blank" rel="noopener noreferrer">Abrir documento ↗</a>';}catch{return '—';}}
 if(key==='score')return '<strong>'+fmtN(value)+'</strong>';
 if(key==='hours_saved_month')return fmtN(value,1);
 return escapeHtml(String(value).length>85?String(value).slice(0,85)+'…':value);
}
async function ensureRefs(){
 for(const table of ['projects','assets','requests']){
  if(!state.records[table])state.records[table]=await api('/api/'+table);
 }
}
async function renderTable(view){
 await ensureRefs();
 const rows=view==='users'?state.meta.users:view==='companies'?state.meta.companies:await api('/api/'+view);
 state.rows=rows;
 const cols=tableCols[view];
 const th=cols.map(c=>'<th>'+escapeHtml(c[1])+'</th>').join('');
 const body=rows.map(row=>'<tr>'+cols.map((c,i)=>'<td class="'+(i===1?'main-cell':'')+'">'+valueLabel(c[0],row[c[0]])+'</td>').join('')+
 '<td>'+(canWrite(view)&&!['users','companies','audit','executions'].includes(view)?
 '<button class="link-btn" data-action="edit" data-table="'+view+'" data-id="'+row.id+'">Editar</button>':'')+
 (view==='assets'?'<button class="link-btn" data-action="readiness" data-id="'+row.id+'">Liberación</button>':'')+
 '</td></tr>').join('');
 $('#content').innerHTML=header(view,canWrite(view)?({requests:'Nueva solicitud',projects:'Nuevo proyecto',tasks:'Nueva tarea',
 assets:'Nuevo activo',executions:'Registrar ejecución',incidents:'Nueva incidencia',documents:'Añadir documento',
 users:'Nuevo usuario',companies:'Nueva empresa'}[view]||'Nuevo registro'):null)+
 '<section class="panel"><div class="table-tools"><input class="search" id="table-search" aria-label="Filtrar registros" placeholder="Buscar en la tabla...">'+
 '<div class="quick-actions"><span class="table-count">'+fmtN(rows.length)+' registros</span>'+
 '<button class="btn small" data-action="csv">↓ Exportar CSV</button></div></div>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr>'+th+'<th>Acciones</th></tr></thead><tbody id="rows">'+
 (body||'<tr><td colspan="'+(cols.length+1)+'">'+empty()+'</td></tr>')+'</tbody></table></div></section>';
 $('#table-search').addEventListener('input',ev=>{
  const text=ev.target.value.toLowerCase();
  $('#rows').querySelectorAll('tr').forEach(tr=>{tr.hidden=!tr.textContent.toLowerCase().includes(text);});
 });
}
function scoreProgress(tasks){
 const total=tasks.reduce((sum,t)=>sum+Number(t.weight||1),0);
 return total?Math.round(100*tasks.filter(t=>t.status==='done').reduce((s,t)=>s+Number(t.weight||1),0)/total):0;
}
async function renderOnepage(){
 const data=await api('/api/onepage'+(state.selectedDeveloper?'?user_id='+state.selectedDeveloper:''));
 const tasks=await api('/api/tasks');
 const projects=data.projects;
 const sel=state.user.role==='developer'?'':'<select id="onepage-user" class="search">'+state.meta.users.filter(u=>['developer','pm','admin'].includes(u.role)).map(u=>
 '<option value="'+u.id+'" '+(Number(state.selectedDeveloper||state.user.id)===u.id?'selected':'')+'>'+escapeHtml(u.display_name)+'</option>').join('')+'</select>';
 const active=projects.filter(p=>!['done','cancelled'].includes(p.status));
 $('#content').innerHTML=header('onepage',canWrite('daily_updates')?'Registrar avance':null)+
 '<div class="table-tools"><div class="quick-actions"><span class="chip">Seguimiento por responsable</span>'+sel+'</div></div>'+
 '<section class="metrics">'+metric('Proyectos asignados',active.length,'▤','En curso')+
 metric('Mis tareas abiertas',data.tasks.filter(t=>t.status!=='done').length,'☷','Entregables pendientes')+
 metric('Compromisos terminados',data.tasks.filter(t=>t.status==='done').length,'✓','Histórico')+
 metric('Impedimentos registrados',data.updates.filter(x=>x.blocker).length,'⚑','Últimos 40 registros')+'</section>'+
 '<div class="panel"><div class="panel-head"><h2>Proyectos y avance aceptado</h2><small>Calculado por peso de tareas completadas</small></div>'+
 (projects.length?projects.map(p=>{const pct=scoreProgress(tasks.filter(t=>t.project_id===p.id));return '<div class="chart-row"><span>'+escapeHtml(p.name)+
 '</span><div class="progress"><i style="width:'+pct+'%"></i></div><strong>'+pct+'%</strong></div>';}).join(''):empty('Asigna un proyecto al usuario para comenzar.'))+
 '</div><div class="panel"><div class="panel-head"><h2>Actualizaciones recientes</h2></div>'+
 (data.updates.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Proyecto</th><th>Completado</th><th>Próximo paso</th><th>Bloqueo</th></tr></thead><tbody>'+
 data.updates.map(x=>'<tr><td>'+escapeHtml(x.created_at)+'</td><td>'+escapeHtml(x.project_name)+'</td><td>'+escapeHtml(x.done)+
 '</td><td>'+escapeHtml(x.next_step)+'</td><td>'+escapeHtml(x.blocker||'—')+'</td></tr>').join('')+'</tbody></table></div>':empty('Ningún avance capturado.'))+'</div>';
 $('#onepage-user')?.addEventListener('change',async e=>{state.selectedDeveloper=e.target.value;await renderOnepage();});
}
async function renderApprovals(){
 const assets=await api('/api/assets');state.records.assets=assets;
 const rows=await Promise.all(assets.map(async a=>Object.assign({},a,{gate:await api('/api/assets/'+a.id+'/readiness')})));
 $('#content').innerHTML=header('approvals')+
 '<div class="notice">El comité de automatización prioriza el portafolio. La liberación depende de la evaluación de riesgo, los controles técnicos y las autorizaciones correspondientes. Los casos inaceptables no se pueden liberar.</div>'+
 '<div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Automatización</th><th>Riesgo</th><th>Estado</th><th>Readiness</th><th>Acciones</th></tr></thead><tbody>'+
 (rows.map(a=>'<tr><td class="main-cell">'+escapeHtml(a.name)+'</td><td>'+chip(a.risk)+'</td><td>'+chip(a.status)+
 '</td><td>'+chip(a.gate.ready?'approved':'pending')+(a.gate.ready?'':' <span class="sub">'+a.gate.missing.length+' controles faltantes</span>')+
 '</td><td><button class="link-btn" data-action="readiness" data-id="'+a.id+'">Ver controles</button>'+
 (['admin','security'].includes(state.user.role)?'<button class="link-btn" data-action="risk" data-id="'+a.id+'">Evaluar riesgo</button>':'')+
 (['admin','pm','executive','security'].includes(state.user.role)?'<button class="link-btn" data-action="approval" data-id="'+a.id+'">Autorizar</button>':'')+
 '</td></tr>').join('')||'<tr><td colspan="5">'+empty('Crea automatizaciones desde Inventario.')+'</td></tr>')+
 '</tbody></table></div></div>';
}
async function show(view){
 if(!labels[view])view='dashboard';
 state.view=view;
 document.querySelectorAll('.nav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 $('#sidebar').classList.remove('open');
 $('#content').innerHTML='<div class="panel">Cargando información…</div>';
 try{
  if(view==='dashboard')await renderDashboard();
  else if(view==='onepage')await renderOnepage();
  else if(view==='approvals')await renderApprovals();
  else if(view==='audit'){state.rows=await api('/api/audit');await renderAudit();}
  else await renderTable(view);
 }catch(e){$('#content').innerHTML=header(view)+'<div class="notice danger">'+escapeHtml(e.message)+'</div>';}
}
function renderAudit(){
 const rows=state.rows,cols=tableCols.audit;
 $('#content').innerHTML=header('audit')+'<div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr>'+
 cols.map(x=>'<th>'+escapeHtml(x[1])+'</th>').join('')+'</tr></thead><tbody>'+
 (rows.map(x=>'<tr>'+cols.map(c=>'<td>'+valueLabel(c[0],x[c[0]])+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="5">'+empty()+'</td></tr>')+
 '</tbody></table></div></div>';
}
function listOptions(type){
 const source=type==='company'?state.meta.companies:type==='user'?state.meta.users:
  type==='project'?state.records.projects:type==='request'?state.records.requests:state.records.assets;
 const field=type==='user'?'display_name':type==='company'?'name':type==='request'?'title':'name';
 return (source||[]).map(x=>[x.id,x[field]]);
}
function fieldHtml(f,row){
 const [key,label,type='text',required=false]=f;
 const value=row[key]===null||row[key]===undefined?'':row[key];
 const attr=' name="'+escapeHtml(key)+'" id="f-'+escapeHtml(key)+'"'+(required?' required':'');
 const wide=type==='textarea'?' wide':'';
 let control='';
 if(type==='textarea')control='<textarea'+attr+'>'+escapeHtml(value)+'</textarea>';
 else if(type==='check')control='<select'+attr+'><option value="0" '+(!Number(value)?'selected':'')+'>No</option><option value="1" '+(Number(value)?'selected':'')+'>Sí</option></select>';
 else if(['company','user','project','request','asset'].includes(type)||type.startsWith('choice:')||type==='score'){
  const opts=type==='score'?[1,2,3,4,5].map(x=>[x,String(x)]):type.startsWith('choice:')?
   type.slice(7).split(',').map(x=>[x,nice(x)]):listOptions(type);
  control='<select'+attr+'><option value="">Seleccionar…</option>'+opts.map(([v,n])=>
    '<option value="'+escapeHtml(v)+'" '+(String(value)===String(v)?'selected':'')+'>'+escapeHtml(n)+'</option>').join('')+'</select>';
 } else control='<input'+attr+' type="'+escapeHtml(['number','date','password','url'].includes(type)?type:'text')+
   '" '+(type==='number'?'min="0" step="any" ':'')+'value="'+escapeHtml(value)+'">';
 return '<div class="field'+wide+'"><label for="f-'+escapeHtml(key)+'">'+escapeHtml(label)+(required?' *':'')+'</label>'+control+'</div>';
}
function openDialog(title,body,footer){
 $('#modal-content').innerHTML='<header class="modal-head"><h2>'+escapeHtml(title)+'</h2><button class="btn small" type="button" data-action="close">✕</button></header>'+
 '<div class="modal-body">'+body+'</div><footer class="modal-foot">'+(footer||'<button class="btn" data-action="close">Cerrar</button>')+'</footer>';
 $('#modal').showModal();
}
async function openForm(table,id){
 await ensureRefs();
 const row=id?(state.rows.find(x=>x.id===id)||await api('/api/'+table+'/'+id)):{};
 const fields=schemas[table];
 if(!fields)return;
 let message='';
 if(table==='assets')message='<div class="notice">No capture contraseñas, tokens ni claves privadas. Los controles declarados requieren verificación documental; la liberación se valida en el servidor.</div>';
 if(table==='documents')message='<div class="notice">La PoC conserva metadatos y vínculos a documentos autorizados, no almacena archivos adjuntos.</div>';
 const body=message+'<form id="editor-form" data-table="'+escapeHtml(table)+'" data-id="'+(id||'')+'">'+
 '<div class="form-grid">'+fields.map(x=>fieldHtml(x,row)).join('')+'</div></form>';
 const foot='<button type="button" class="btn" data-action="close">Cancelar</button><button type="submit" form="editor-form" class="btn primary">Guardar registro</button>';
 openDialog((id?'Editar ':'Registrar ')+labels[table]?.[0],body,foot);
}
function getFormData(form){
 const data={};
 for(const [k,v] of new FormData(form).entries()){
  if(v==='')continue;
  data[k]=v;
 }
 return data;
}
async function saveForm(form){
 const table=form.dataset.table,id=form.dataset.id;
 const body=getFormData(form);
 try{
  await mutate('/api/'+table+(id?'/'+id:''),body,id?'PATCH':'POST');
  $('#modal').close();state.records={};state.meta=await api('/api/meta');toast('Registro guardado correctamente.');await show(state.view);
 }catch(e){toast(e.message);}
}
async function inspectReadiness(id){
 const asset=await api('/api/assets/'+id),gate=await api('/api/assets/'+id+'/readiness');
 const checks=['registered_ok','tests_ok','docs_ok','logs_ok','kill_switch_ok','rollback_ok','manual_ok','nHI','pam_ok','rotation_ok'];
 const names={registered_ok:'Registro corporativo',tests_ok:'Pruebas',docs_ok:'Documentación',logs_ok:'Bitácoras',kill_switch_ok:'Suspensión',
 rollback_ok:'Reversión',manual_ok:'Continuidad manual',nHI:'Cuenta no humana',pam_ok:'Bóveda PAM',rotation_ok:'Rotación vigente'};
 const body='<div class="notice '+(gate.ready?'':'alert')+'">'+(gate.ready?'La automatización cuenta con los prerequisitos registrados para liberación.':
 'Liberación bloqueada. '+gate.missing.length+' controles o autorizaciones pendientes.')+'</div>'+
 '<div class="check-grid">'+checks.map(k=>'<div class="check-item">'+(asset[k]?'✅':'○')+' '+escapeHtml(names[k])+'</div>').join('')+'</div>'+
 '<h3>Autorizaciones</h3><div class="timeline">'+(gate.approvals.map(x=>'<div class="timeline-item"><div class="timeline-dot"></div><div><strong>'+
 escapeHtml(nice(x.kind))+' — '+escapeHtml(nice(x.decision))+'</strong><small>'+escapeHtml(x.created_at)+'</small></div></div>').join('')||'<p class="subtle">Sin autorizaciones registradas.</p>')+'</div>'+
 (gate.missing.length?'<p class="hint"><strong>Pendiente:</strong> '+escapeHtml(gate.missing.join(' · '))+'</p>':'');
 const foot='<button class="btn" data-action="close">Cerrar</button>'+
 (gate.ready&&canWrite('assets')&&asset.status!=='production'?'<button class="btn primary" data-action="release" data-id="'+id+'">Autorizar paso a producción</button>':'');
 openDialog('Preparación · '+asset.name,body,foot);
}
function openRisk(id){
 const asset=state.records.assets?.find(x=>x.id===id);
 if(!asset)return toast('No se encontró el activo.');
 const body='<p class="hint">Clasificación actual: <strong>'+escapeHtml(nice(asset.risk))+'</strong>. La revisión debe ser realizada por Ciberseguridad.</p>'+
 '<form id="risk-form" data-id="'+id+'"><div class="form-grid">'+fieldHtml(['level','Clasificación','choice:'+asset.risk],{level:asset.risk})+
 fieldHtml(['decision','Dictamen','choice:approved,rejected',true],{})+
 fieldHtml(['notes','Justificación','textarea'],{})+
 fieldHtml(['evidence_url','Evidencia','url'],{})+'</div></form>';
 openDialog('Evaluación de riesgo',body,'<button class="btn" data-action="close">Cancelar</button><button class="btn primary" type="submit" form="risk-form">Registrar dictamen</button>');
}
function openApproval(id){
 const asset=state.records.assets?.find(x=>x.id===id);
 if(!asset)return toast('Activo no encontrado.');
 const kinds=asset.risk==='high'?['security_committee']:asset.risk==='medium'?['business','cyber']:['manager','registration'];
 const body='<p class="hint">Los aprobadores deben acreditar su competencia y adjuntar una liga a la evidencia de autorización.</p>'+
 '<form id="approval-form" data-id="'+id+'"><div class="form-grid">'+
 '<div class="field"><label for="f-kind">Tipo de autorización</label><select id="f-kind" name="kind" required>'+
 kinds.map(k=>'<option value="'+k+'">'+escapeHtml(nice(k))+'</option>').join('')+'</select></div>'+
 fieldHtml(['decision','Decisión','choice:approved,rejected',true],{})+
 fieldHtml(['evidence_url','Liga de evidencia obligatoria','url',true],{})+'</div></form>';
 openDialog('Autorización de '+asset.name,body,'<button class="btn" data-action="close">Cancelar</button><button class="btn primary" type="submit" form="approval-form">Registrar decisión</button>');
}
async function release(id){
 try{await mutate('/api/assets/'+id,{status:'production'},'PATCH');$('#modal').close();toast('Liberación registrada.');await show(state.view);}
 catch(e){toast(e.message);}
}
function exportCSV(){
 if(!state.rows.length)return toast('No hay registros para exportar.');
 const data=state.rows,keys=Object.keys(data[0]);
 function csvValue(x){
  let v=String(x===undefined||x===null?'':x);
  if(/^[=+\-@]/.test(v))v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"';
 }
 const lines=[keys.map(csvValue).join(',')].concat(data.map(x=>keys.map(k=>csvValue(x[k])).join(',')));
 const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='indicadores_'+state.view+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('#login-form').addEventListener('submit',async e=>{
 e.preventDefault();$('#login-error').textContent='';
 try{
  const form=new FormData(e.currentTarget);
  const response=await mutate('/api/login',{username:form.get('username'),password:form.get('password')});
  setUser(response.user);state.meta=await api('/api/meta');await show('dashboard');
 }catch(err){$('#login-error').textContent=err.message;}
});
$('#logout').addEventListener('click',async()=>{try{await mutate('/api/logout',{});}finally{loadLogin();}});
$('#menu-toggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
document.body.addEventListener('click',async e=>{
 const nav=e.target.closest('[data-view]');
 if(nav){await show(nav.dataset.view);return;}
 const button=e.target.closest('[data-action]');
 if(!button)return;
 try{
  const action=button.dataset.action,id=Number(button.dataset.id);
  if(action==='new')await openForm(button.dataset.table==='onepage'?'daily_updates':button.dataset.table);
  if(action==='edit')await openForm(button.dataset.table,id);
  if(action==='readiness')await inspectReadiness(id);
  if(action==='risk')openRisk(id);
  if(action==='approval')openApproval(id);
  if(action==='release')await release(id);
  if(action==='close')$('#modal').close();
  if(action==='csv')exportCSV();
 }catch(err){toast(err.message);}
});
document.body.addEventListener('submit',async e=>{
 if(!['editor-form','risk-form','approval-form'].includes(e.target.id))return;
 e.preventDefault();
 if(e.target.id==='editor-form')return saveForm(e.target);
 const data=getFormData(e.target);data.asset_id=Number(e.target.dataset.id);
 try{
  await mutate('/api/'+(e.target.id==='risk-form'?'risk-reviews':'approvals'),data);
  $('#modal').close();state.records={};toast('Decisión registrada.');await show(state.view);
 }catch(err){toast(err.message);}
});
init();
