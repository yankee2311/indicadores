'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'indicadores-test-'));
const port = 28000 + Math.floor(Math.random()*15000);
const origin = 'http://127.0.0.1:' + port;
const password = 'Testing2026!StrongPass';
let processHandle, cookie = '';

async function request(route, method='GET', data=null, sessionCookie=cookie) {
  const options = {method,headers:{}};
  if(data!==null){options.headers['content-type']='application/json';options.body=JSON.stringify(data);}
  if(sessionCookie)options.headers.cookie=sessionCookie;
  const response=await fetch(origin+route,options);
  const value=await response.json();
  return {status:response.status,data:value,cookie:response.headers.get('set-cookie')};
}
async function waitForServer(){
  for(let i=0;i<80;i++){
    if(processHandle.exitCode!==null)throw Error('Servidor finalizó prematuramente.');
    try{const r=await fetch(origin+'/api/health');if(r.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,70));
  }
  throw Error('Servidor no respondió.');
}

test('Flujo integral: API, permisos, inventario, riesgos, producción y KPIs',async()=>{
  processHandle=spawn(process.execPath,['server.js'],{
    cwd:path.join(__dirname,'..'),
    env:{...process.env,DATA_DIR:temp,PORT:String(port),BOOTSTRAP_ADMIN_PASSWORD:password}
  });
  processHandle.stderr.on('data',chunk=>console.error(chunk.toString()));
  try{
    await waitForServer();
    let r=await request('/api/health');
    assert.equal(r.status,200);
    r=await request('/api/dashboard');
    assert.equal(r.status,401,'Sin sesión no se permite acceder a métricas.');

    r=await request('/api/login','POST',{username:'admin',password:'incorrecta'});
    assert.equal(r.status,401);
    r=await request('/api/login','POST',{username:'admin',password});
    assert.equal(r.status,200);
    cookie=r.cookie.split(';')[0];
    assert.match(cookie,/^session=/);
    r=await request('/api/meta');
    assert.equal(r.status,200);
    assert.ok(r.data.companies.length>=1);

    r=await request('/api/requests','POST',{
      title:'Validación de facturas (demo)',company_id:1,owner:'Responsable de proceso',
      type:'RPA',approach:'low-code',risk:'medium',process_volume:300,minutes_per_item:4,
      score_impact:4,score_time:5,score_scope:3,score_reuse:3,score_complexity:2,score_compliance:3
    });
    assert.equal(r.status,201);
    const requestId=r.data.id;
    r=await request('/api/requests');
    assert.equal(r.status,200);
    assert.ok(r.data.find(x=>x.id===requestId).score>0);

    r=await request('/api/projects','POST',{
      name:'Automatización de facturas',company_id:1,request_id:requestId,status:'development',target_hours:20
    });
    assert.equal(r.status,201);
    const projectId=r.data.id;
    r=await request('/api/tasks','POST',{project_id:projectId,title:'Definir PDD',weight:2,due_date:'2026-12-20'});
    assert.equal(r.status,201);
    r=await request('/api/tasks/'+r.data.id,'PATCH',{status:'done'});
    assert.equal(r.status,200);
    assert.ok(r.data.completed_at);

    r=await request('/api/daily_updates','POST',{project_id:projectId,done:'Flujo documentado',hours:3,next_step:'Pruebas'});
    assert.equal(r.status,201);
    r=await request('/api/onepage');
    assert.equal(r.status,200);
    assert.equal(r.data.updates[0].done,'Flujo documentado');

    r=await request('/api/assets','POST',{
      project_id:projectId,name:'Bot facturas de prueba',company_id:1,type:'RPA',owner:'Propietario demo',
      technical_owner:'Equipo TI',risk:'medium',status:'testing',nHI:'bot-demo-facturas',
      registered_ok:1,pam_ok:1,rotation_ok:1,logs_ok:1,kill_switch_ok:1,
      rollback_ok:1,manual_ok:1,tests_ok:1,docs_ok:1,
      hours_saved_month:50,hourly_rate:200,monthly_cost:1500,build_cost:12000
    });
    assert.equal(r.status,201);
    const assetId=r.data.id;
    r=await request('/api/assets/'+assetId,'PATCH',{status:'production'});
    assert.equal(r.status,409,'No se permite liberar sin riesgo y autorizaciones.');
    r=await request('/api/risk-reviews','POST',{asset_id:assetId,level:'medium',decision:'approved',notes:'Riesgo controlado'});
    assert.equal(r.status,201);
    r=await request('/api/approvals','POST',{asset_id:assetId,kind:'business',decision:'approved',evidence_url:'https://example.com/decision-business'});
    assert.equal(r.status,201);
    r=await request('/api/approvals','POST',{asset_id:assetId,kind:'cyber',decision:'approved',evidence_url:'https://example.com/decision-cyber'});
    assert.equal(r.status,201);
    r=await request('/api/assets/'+assetId+'/readiness');
    assert.equal(r.status,200);
    assert.equal(r.data.ready,true);
    r=await request('/api/assets/'+assetId,'PATCH',{status:'production'});
    assert.equal(r.status,200);

    r=await request('/api/documents','POST',{asset_id:assetId,title:'PDD',type:'PDD',url:'javascript:alert(1)'});
    assert.equal(r.status,400,'Se bloquean esquemas inseguros de URLs.');
    r=await request('/api/documents','POST',{asset_id:assetId,title:'PDD',type:'PDD',url:'https://example.com/pdd'});
    assert.equal(r.status,201);
    r=await request('/api/executions','POST',{asset_id:assetId,status:'success',duration_seconds:12,transactions:42});
    assert.equal(r.status,201);
    r=await request('/api/incidents','POST',{asset_id:assetId,title:'Timeout de prueba',severity:'medium'});
    assert.equal(r.status,201);
    r=await request('/api/dashboard');
    assert.equal(r.status,200);
    assert.equal(r.data.production,1);
    assert.equal(r.data.hours,50);
    assert.equal(r.data.netMonthly,8500);
    assert.equal(r.data.successRate,100);
    assert.equal(r.data.incidents,1);

    r=await request('/api/users','POST',{
      username:'viewer-test',password:'View2026!StrongPass',role:'viewer',display_name:'Lector de prueba'});
    assert.equal(r.status,201);
    const viewerLogin=await request('/api/login','POST',{username:'viewer-test',password:'View2026!StrongPass'});
    assert.equal(viewerLogin.status,200);
    const viewerCookie=viewerLogin.cookie.split(';')[0];
    r=await request('/api/projects','POST',{name:'No permitido',company_id:1},viewerCookie);
    assert.equal(r.status,403,'Un perfil de consulta no puede escribir.');
    r=await request('/api/dashboard','GET',null,viewerCookie);
    assert.equal(r.status,200,'Un perfil de consulta sí puede ver el resumen.');
    r=await request('/api/audit');
    assert.equal(r.status,200);
    assert.ok(r.data.some(x=>x.action==='risk_reviewed'));
  }finally{
    if(processHandle){processHandle.kill('SIGTERM');await new Promise(resolve=>processHandle.once('close',resolve));}
    fs.rmSync(temp,{recursive:true,force:true});
  }
},{timeout:30000});
