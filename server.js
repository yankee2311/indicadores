'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PUBLIC_DIR = path.join(__dirname, 'public');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(path.join(DATA_DIR, 'indicadores.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
db.exec(String.raw`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','pm','developer','security','executive','viewer')),
 display_name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS companies (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS requests (
 id INTEGER PRIMARY KEY, title TEXT NOT NULL, company_id INTEGER NOT NULL REFERENCES companies(id),
 department TEXT NOT NULL DEFAULT '', requester TEXT NOT NULL DEFAULT '',
 owner TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
 process_volume INTEGER NOT NULL DEFAULT 0, minutes_per_item REAL NOT NULL DEFAULT 0,
 expected_hours REAL NOT NULL DEFAULT 0, type TEXT NOT NULL DEFAULT 'RPA',
 approach TEXT NOT NULL DEFAULT 'low-code', status TEXT NOT NULL DEFAULT 'new',
 risk TEXT NOT NULL DEFAULT 'pending', priority INTEGER NOT NULL DEFAULT 0,
 score_impact INTEGER NOT NULL DEFAULT 1, score_time INTEGER NOT NULL DEFAULT 1,
 score_scope INTEGER NOT NULL DEFAULT 1, score_reuse INTEGER NOT NULL DEFAULT 1,
 score_complexity INTEGER NOT NULL DEFAULT 1, score_compliance INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projects (
 id INTEGER PRIMARY KEY, request_id INTEGER REFERENCES requests(id), name TEXT NOT NULL,
 company_id INTEGER NOT NULL REFERENCES companies(id), developer_id INTEGER REFERENCES users(id),
 owner TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned',
 start_date TEXT, due_date TEXT, estimated_cost REAL NOT NULL DEFAULT 0,
 target_hours REAL NOT NULL DEFAULT 0, blocker TEXT NOT NULL DEFAULT '',
 next_milestone TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
 id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id),
 title TEXT NOT NULL, assignee_id INTEGER REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'pending', priority TEXT NOT NULL DEFAULT 'medium',
 weight REAL NOT NULL DEFAULT 1, due_date TEXT, completed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS daily_updates (
 id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id),
 user_id INTEGER NOT NULL REFERENCES users(id), done TEXT NOT NULL,
 hours REAL NOT NULL DEFAULT 0, next_step TEXT NOT NULL DEFAULT '',
 commitment_date TEXT, blocker TEXT NOT NULL DEFAULT '', evidence_url TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS assets (
 id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id), name TEXT NOT NULL,
 company_id INTEGER NOT NULL REFERENCES companies(id), type TEXT NOT NULL DEFAULT 'RPA',
 owner TEXT NOT NULL, technical_owner TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'development',
 risk TEXT NOT NULL DEFAULT 'pending', data_class TEXT NOT NULL DEFAULT 'internal',
 provider TEXT NOT NULL DEFAULT '', systems TEXT NOT NULL DEFAULT '',
 hours_saved_month REAL NOT NULL DEFAULT 0, monthly_cost REAL NOT NULL DEFAULT 0,
 build_cost REAL NOT NULL DEFAULT 0, hourly_rate REAL NOT NULL DEFAULT 0,
 nHI TEXT NOT NULL DEFAULT '', pam_ok INTEGER NOT NULL DEFAULT 0,
 rotation_ok INTEGER NOT NULL DEFAULT 0, logs_ok INTEGER NOT NULL DEFAULT 0,
 kill_switch_ok INTEGER NOT NULL DEFAULT 0, rollback_ok INTEGER NOT NULL DEFAULT 0,
 manual_ok INTEGER NOT NULL DEFAULT 0, tests_ok INTEGER NOT NULL DEFAULT 0,
 docs_ok INTEGER NOT NULL DEFAULT 0, registered_ok INTEGER NOT NULL DEFAULT 0,
 production_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS risk_reviews (
 id INTEGER PRIMARY KEY, asset_id INTEGER NOT NULL REFERENCES assets(id),
 reviewer_id INTEGER NOT NULL REFERENCES users(id), level TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
 notes TEXT NOT NULL DEFAULT '', evidence_url TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS approvals (
 id INTEGER PRIMARY KEY, asset_id INTEGER NOT NULL REFERENCES assets(id),
 kind TEXT NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
 approver_id INTEGER NOT NULL REFERENCES users(id), evidence_url TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(asset_id,kind)
);
CREATE TABLE IF NOT EXISTS documents (
 id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id),
 asset_id INTEGER REFERENCES assets(id), title TEXT NOT NULL, type TEXT NOT NULL,
 version TEXT NOT NULL DEFAULT '1.0', url TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS executions (
 id INTEGER PRIMARY KEY, asset_id INTEGER NOT NULL REFERENCES assets(id),
 status TEXT NOT NULL CHECK(status IN ('success','failed')),
 duration_seconds REAL NOT NULL DEFAULT 0, transactions INTEGER NOT NULL DEFAULT 0,
 message TEXT NOT NULL DEFAULT '', executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS incidents (
 id INTEGER PRIMARY KEY, asset_id INTEGER NOT NULL REFERENCES assets(id),
 title TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'medium',
 status TEXT NOT NULL DEFAULT 'open', root_cause TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
 id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), action TEXT NOT NULL,
 entity TEXT NOT NULL, entity_id INTEGER, metadata TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_request_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_project_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_project ON daily_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_asset_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_exec_asset ON executions(asset_id);
CREATE INDEX IF NOT EXISTS idx_incident_asset ON incidents(asset_id);
`);

if (!db.prepare('SELECT id FROM companies LIMIT 1').get()) {
  const insert = db.prepare('INSERT INTO companies(name,code) VALUES(?,?)');
  ['Corporativo','Empresa A','Empresa B','Empresa C','Empresa D','Empresa E','Empresa F']
    .forEach((name, i) => insert.run(name, i === 0 ? 'CORP' : 'EMP' + i));
}

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  return s + ':' + crypto.scryptSync(password, s, 64).toString('hex');
}
function verifyPassword(password, hash) {
  const [salt, original] = hash.split(':');
  const attempt = Buffer.from(hashPassword(password, salt).split(':')[1], 'hex');
  const expected = Buffer.from(original || '', 'hex');
  return attempt.length === expected.length && crypto.timingSafeEqual(attempt, expected);
}
const bootstrap = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!db.prepare('SELECT id FROM users LIMIT 1').get() && bootstrap) {
  if (bootstrap.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD requiere mínimo 12 caracteres.');
  db.prepare('INSERT INTO users(username,password_hash,role,display_name) VALUES(?,?,?,?)')
    .run(process.env.BOOTSTRAP_ADMIN_USER || 'admin', hashPassword(bootstrap), 'admin', 'Administrador inicial');
  console.log('Administrador inicial creado. Elimine BOOTSTRAP_ADMIN_PASSWORD del entorno.');
}
function all(sql, ...args) { return db.prepare(sql).all(...args); }
function one(sql, ...args) { return db.prepare(sql).get(...args); }
function scalar(sql, ...args) { return Object.values(one(sql, ...args) || { value: 0 })[0] || 0; }
function insertRow(table, fields) {
  const keys = Object.keys(fields);
  const placeholders = keys.map(() => '?').join(',');
  return Number(db.prepare('INSERT INTO ' + table + '(' + keys.join(',') + ') VALUES(' + placeholders + ')')
    .run(...keys.map(k => fields[k])).lastInsertRowid);
}
function updateRow(table, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  db.prepare('UPDATE ' + table + ' SET ' + keys.map(k => k + '=?').join(',') + ' WHERE id=?')
    .run(...keys.map(k => fields[k]), id);
}
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
const rules = {
  requests: {
    fields: ['title','company_id','department','requester','owner','description','process_volume','minutes_per_item','expected_hours','type','approach','status','risk','score_impact','score_time','score_scope','score_reuse','score_complexity','score_compliance'],
    required: ['title','company_id'], roles: ['admin','pm','executive'],
    enums: { type:['RPA','Bot','Agent','AI','Integration','Script','Other'], approach:['no-code','low-code','traditional'], status:['new','evaluation','approved','backlog','assigned','rejected','traditional'], risk:['pending','low','medium','high','unacceptable'] }
  },
  projects: {
    fields:['request_id','name','company_id','developer_id','owner','status','start_date','due_date','estimated_cost','target_hours','blocker','next_milestone'],
    required:['name','company_id'],roles:['admin','pm'],
    enums:{ status:['planned','development','testing','blocked','done','cancelled'] }
  },
  tasks: {
    fields:['project_id','title','assignee_id','status','priority','weight','due_date','completed_at'],
    required:['project_id','title'], roles:['admin','pm','developer'],
    enums:{status:['pending','doing','blocked','done'],priority:['low','medium','high']}
  },
  daily_updates: {
    fields:['project_id','user_id','done','hours','next_step','commitment_date','blocker','evidence_url'],
    required:['project_id','done'], roles:['admin','pm','developer']
  },
  assets: {
    fields:['project_id','name','company_id','type','owner','technical_owner','status','risk','data_class','provider','systems','hours_saved_month','monthly_cost','build_cost','hourly_rate','nHI','pam_ok','rotation_ok','logs_ok','kill_switch_ok','rollback_ok','manual_ok','tests_ok','docs_ok','registered_ok'],
    required:['name','company_id','owner','technical_owner'], roles:['admin','pm','security'],
    enums:{status:['development','testing','production','maintenance','suspended','retired'],risk:['pending','low','medium','high','unacceptable'],data_class:['public','internal','confidential','restricted'],type:['RPA','Bot','Agent','AI','Integration','Script','Other']}
  },
  documents: {
    fields:['project_id','asset_id','title','type','version','url'],
    required:['title','type','url'], roles:['admin','pm','developer','security']
  },
  executions: {
    fields:['asset_id','status','duration_seconds','transactions','message','executed_at'],
    required:['asset_id','status'], roles:['admin','pm','developer'],
    enums:{status:['success','failed']}
  },
  incidents: {
    fields:['asset_id','title','severity','status','root_cause','resolved_at'],
    required:['asset_id','title'], roles:['admin','pm','developer','security'],
    enums:{severity:['low','medium','high','critical'],status:['open','investigating','resolved']}
  }
};
const numeric = new Set(['company_id','request_id','developer_id','project_id','assignee_id','asset_id','user_id',
  'process_volume','minutes_per_item','expected_hours','estimated_cost','target_hours','weight','hours','hours_saved_month',
  'monthly_cost','build_cost','hourly_rate','duration_seconds','transactions','score_impact','score_time','score_scope',
  'score_reuse','score_complexity','score_compliance','pam_ok','rotation_ok','logs_ok','kill_switch_ok','rollback_ok',
  'manual_ok','tests_ok','docs_ok','registered_ok']);
const boolFields = new Set(['pam_ok','rotation_ok','logs_ok','kill_switch_ok','rollback_ok','manual_ok','tests_ok','docs_ok','registered_ok']);
const nullableIds = new Set(['request_id','developer_id','assignee_id','project_id','asset_id']);
const links = new Set(['evidence_url','url']);
function validate(table, body, creating) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Cuerpo JSON inválido.');
  const rule = rules[table], fields = {};
  for (const [key, raw] of Object.entries(body)) {
    if (!rule.fields.includes(key)) throw httpError(400, 'Campo no permitido: ' + key);
    if (raw === null || raw === '') {
      if (nullableIds.has(key) || key.endsWith('_date') || key === 'completed_at' || key === 'resolved_at') {
        fields[key] = null; continue;
      }
      if (numeric.has(key)) { fields[key] = 0; continue; }
    }
    if (numeric.has(key)) {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || (boolFields.has(key) && ![0,1].includes(value))) throw httpError(400, 'Número inválido: ' + key);
      if (key.startsWith('score_') && (value < 1 || value > 5 || !Number.isInteger(value))) throw httpError(400,'Puntaje fuera del rango 1–5.');
      fields[key] = value;
    } else {
      if (typeof raw !== 'string' || raw.length > 3000) throw httpError(400, 'Texto inválido: ' + key);
      const value = raw.trim();
      if (rule.enums && rule.enums[key] && !rule.enums[key].includes(value)) throw httpError(400, 'Opción inválida: ' + key);
      if (links.has(key) && value) {
        try { const u = new URL(value); if (!['http:','https:'].includes(u.protocol)) throw Error(); }
        catch { throw httpError(400, 'La evidencia debe ser una URL http(s).'); }
      }
      fields[key] = value;
    }
  }
  if (creating) for (const key of rule.required) if (!fields[key]) throw httpError(400,'Falta campo obligatorio: ' + key);
  if (table === 'requests' && (fields.approach === 'traditional')) fields.status = 'traditional';
  if (table === 'daily_updates' && !fields.user_id) delete fields.user_id;
  if (table === 'tasks' && fields.status === 'done' && !fields.completed_at) fields.completed_at = new Date().toISOString();
  if (table === 'incidents' && fields.status === 'resolved' && !fields.resolved_at) fields.resolved_at = new Date().toISOString();
  return fields;
}
function score(row) {
  const v = name => Number(row['score_' + name] || 1);
  return Math.round(20 * (.20*v('impact')+.20*v('time')+.15*v('scope')+.15*v('reuse')+.10*(6-v('complexity'))+.10*v('compliance')+.10*(6-riskWeight(row.risk))));
}
function riskWeight(risk) { return ({low:1,medium:3,high:5,unacceptable:5})[risk] || 3; }
function readCookie(req, name) {
  return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length+1) || '';
}
function currentUser(req) {
  const token = readCookie(req,'session');
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return one('SELECT u.id,u.username,u.display_name,u.role,u.active FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1',
    crypto.createHash('sha256').update(token).digest('hex'), Date.now()) || null;
}
const loginAttempts = new Map();
function checkLoginRate(req) {
  const key = req.socket.remoteAddress || 'unknown', now=Date.now();
  const recent = (loginAttempts.get(key)||[]).filter(t=>now-t<60000);
  if (recent.length>=10) throw httpError(429,'Demasiados intentos. Reintente en un minuto.');
  recent.push(now); loginAttempts.set(key,recent);
  if (loginAttempts.size>1000) loginAttempts.clear();
}
function send(res, status, data, extra={}) {
  const json=JSON.stringify(data);
  res.writeHead(status, Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},extra));
  res.end(json);
}
function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw httpError(403,'No autorizado para esta operación.');
}
function audit(user,action,entity,id,extra={}) {
  db.prepare('INSERT INTO audit_log(user_id,action,entity,entity_id,metadata) VALUES(?,?,?,?,?)')
    .run(user?.id || null,action,entity,id || null,JSON.stringify(extra).slice(0,3000));
}
function approvalsFor(assetId) {
  return all("SELECT kind,decision,approver_id,evidence_url,created_at FROM approvals WHERE asset_id=?",assetId);
}
function readiness(asset) {
  const missing=[];
  const required=['owner','technical_owner','registered_ok','tests_ok','docs_ok','logs_ok','kill_switch_ok','rollback_ok','manual_ok','nHI','pam_ok','rotation_ok'];
  for (const key of required) if (!asset[key]) missing.push(key);
  if (asset.risk === 'pending' || asset.risk === 'unacceptable') missing.push('clasificación de riesgo autorizable');
  const review=one('SELECT decision,level FROM risk_reviews WHERE asset_id=? ORDER BY id DESC LIMIT 1',asset.id);
  if (!review || review.decision!=='approved' || review.level!==asset.risk) missing.push('evaluación de riesgo aprobada y vigente');
  const accepted=new Set(approvalsFor(asset.id).filter(x=>x.decision==='approved').map(x=>x.kind));
  const expected = asset.risk==='high'?['security_committee']:asset.risk==='medium'?['business','cyber']:['manager','registration'];
  expected.forEach(kind=>{if(!accepted.has(kind))missing.push('aprobación ' + kind);});
  return {ready:missing.length===0, missing, approvals:approvalsFor(asset.id)};
}
function dashboard() {
  const requests=scalar('SELECT COUNT(*) AS n FROM requests');
  const backlog=scalar("SELECT COUNT(*) AS n FROM requests WHERE status IN ('new','evaluation','backlog')");
  const projects=scalar("SELECT COUNT(*) AS n FROM projects WHERE status NOT IN ('done','cancelled')");
  const blocked=scalar("SELECT COUNT(*) AS n FROM projects WHERE status='blocked'");
  const production=scalar("SELECT COUNT(*) AS n FROM assets WHERE status='production'");
  const hours=scalar("SELECT COALESCE(SUM(hours_saved_month),0) AS n FROM assets WHERE status='production'");
  const gross=scalar("SELECT COALESCE(SUM(hours_saved_month*hourly_rate),0) AS n FROM assets WHERE status='production'");
  const ongoing=scalar("SELECT COALESCE(SUM(monthly_cost),0) AS n FROM assets WHERE status='production'");
  const totalExecutions=scalar('SELECT COUNT(*) AS n FROM executions');
  const successes=scalar("SELECT COUNT(*) AS n FROM executions WHERE status='success'");
  const tasksDue=scalar("SELECT COUNT(*) AS n FROM tasks WHERE due_date IS NOT NULL AND due_date<date('now') AND status!='done'");
  const committed=scalar("SELECT COUNT(*) AS n FROM tasks WHERE due_date IS NOT NULL AND due_date <= date('now')");
  const accepted=scalar("SELECT COUNT(*) AS n FROM tasks WHERE due_date IS NOT NULL AND status='done' AND date(completed_at)<=due_date AND due_date<=date('now')");
  return {requests,backlog,projects,blocked,production,hours,gross,netMonthly:gross-ongoing,
    totalExecutions,successRate:totalExecutions?Math.round(successes*10000/totalExecutions)/100:null,
    onTimeRate:committed?Math.round(accepted*10000/committed)/100:null,tasksDue,
    incidents:scalar("SELECT COUNT(*) AS n FROM incidents WHERE status!='resolved'"),
    byCompany:all("SELECT c.name,COUNT(a.id) AS count FROM companies c LEFT JOIN assets a ON a.company_id=c.id AND a.status='production' GROUP BY c.id"),
    byType:all("SELECT type,COUNT(*) AS count FROM assets GROUP BY type"),
    byStatus:all("SELECT status,COUNT(*) AS count FROM projects GROUP BY status"),
    activity:all("SELECT created_at,action,entity,entity_id FROM audit_log ORDER BY id DESC LIMIT 8")};
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let body='', len=0;
    req.on('data',chunk=>{len+=chunk.length; if(len>1024*1024){reject(httpError(413,'Cuerpo demasiado grande.'));req.destroy();return;}body+=chunk;});
    req.on('end',()=>{try{resolve(body?JSON.parse(body):{});}catch{reject(httpError(400,'JSON inválido.'));}});
    req.on('error',reject);
  });
}
function routeApi(req,res,url,user,body) {
  const pathname=url.pathname, method=req.method;
  if (pathname==='/api/me'&&method==='GET') return send(res,200,{user});
  if (pathname==='/api/logout'&&method==='POST') {
    const token=readCookie(req,'session');
    if (token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(token).digest('hex'));
    return send(res,200,{ok:true},{'Set-Cookie':'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});
  }
  if (pathname==='/api/meta'&&method==='GET') return send(res,200,{
    companies:all('SELECT * FROM companies ORDER BY id'),
    users:all('SELECT id,username,display_name,role,active FROM users WHERE active=1 ORDER BY display_name'),
    roles:['admin','pm','developer','security','executive','viewer']});
  if (pathname==='/api/dashboard'&&method==='GET') return send(res,200,dashboard());
  if (pathname==='/api/audit'&&method==='GET') {
    requireRole(user,['admin','security','executive']);
    return send(res,200,all("SELECT a.*,u.username FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200"));
  }
  if (pathname==='/api/onepage'&&method==='GET') {
    const id=user.role==='developer'?user.id:Number(url.searchParams.get('user_id')||user.id);
    return send(res,200,{userId:id,
      projects:all('SELECT * FROM projects WHERE developer_id=? ORDER BY id DESC',id),
      tasks:all('SELECT t.*,p.name AS project_name FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.assignee_id=? ORDER BY t.id DESC LIMIT 150',id),
      updates:all('SELECT d.*,p.name AS project_name FROM daily_updates d JOIN projects p ON p.id=d.project_id WHERE d.user_id=? ORDER BY d.id DESC LIMIT 40',id)});
  }
  if (pathname==='/api/users'&&method==='POST') {
    requireRole(user,['admin']);
    const {username,password,role,display_name}=body;
    if (!/^[a-z0-9._-]{3,40}$/i.test(username||'')||typeof password!=='string'||password.length<12||
        !['admin','pm','developer','security','executive','viewer'].includes(role)||
        typeof display_name!=='string'||!display_name.trim()) throw httpError(400,'Datos de usuario inválidos (contraseña mínimo 12).');
    const id=insertRow('users',{username,password_hash:hashPassword(password),role,display_name:display_name.trim()});
    audit(user,'created','users',id);return send(res,201,{id});
  }
  if (pathname==='/api/companies'&&method==='POST') {
    requireRole(user,['admin']);
    if (typeof body.name!=='string'||typeof body.code!=='string'||!body.name.trim()||!/^[A-Z0-9_-]{2,20}$/.test(body.code))
      throw httpError(400,'Nombre o código inválido.');
    const id=insertRow('companies',{name:body.name.trim(),code:body.code});
    audit(user,'created','companies',id);return send(res,201,{id});
  }
  if (pathname==='/api/risk-reviews'&&method==='POST') {
    requireRole(user,['admin','security']);
    const asset=one('SELECT * FROM assets WHERE id=?',Number(body.asset_id));
    if(!asset)throw httpError(404,'Automatización no encontrada.');
    if(asset.risk==='pending'||asset.risk==='unacceptable'||body.level!==asset.risk ||
       !['approved','rejected'].includes(body.decision))
       throw httpError(400,'Nivel o evaluación de riesgo inválida.');
    const id=insertRow('risk_reviews',{asset_id:asset.id,reviewer_id:user.id,level:asset.risk,decision:body.decision,
      notes:String(body.notes||'').slice(0,2000),evidence_url:String(body.evidence_url||'').slice(0,1000)});
    audit(user,'risk_reviewed','assets',asset.id,{decision:body.decision,level:asset.risk});
    return send(res,201,{id});
  }
  if (pathname==='/api/approvals'&&method==='POST') {
    const asset=one('SELECT * FROM assets WHERE id=?',Number(body.asset_id));
    if(!asset)throw httpError(404,'Automatización no encontrada.');
    const kinds={manager:['admin','pm','executive'],registration:['admin','security'],
      business:['admin','executive'],cyber:['admin','security'],security_committee:['admin','executive']};
    if(!kinds[body.kind]||!['approved','rejected'].includes(body.decision))throw httpError(400,'Aprobación inválida.');
    requireRole(user,kinds[body.kind]);
    if(typeof body.evidence_url!=='string'||!body.evidence_url.trim())throw httpError(400,'La autorización requiere evidencia URL.');
    try {const u=new URL(body.evidence_url);if(!['https:','http:'].includes(u.protocol))throw Error();}
    catch {throw httpError(400,'Evidencia debe ser URL http(s).');}
    db.prepare("INSERT INTO approvals(asset_id,kind,decision,approver_id,evidence_url) VALUES(?,?,?,?,?) ON CONFLICT(asset_id,kind) DO UPDATE SET decision=excluded.decision,approver_id=excluded.approver_id,evidence_url=excluded.evidence_url,created_at=CURRENT_TIMESTAMP")
      .run(asset.id,body.kind,body.decision,user.id,body.evidence_url);
    audit(user,'approved_review','assets',asset.id,{kind:body.kind,decision:body.decision});
    return send(res,201,{ok:true});
  }
  const ready=pathname.match(/^\/api\/assets\/(\d+)\/readiness$/);
  if(ready&&method==='GET') {
    const asset=one('SELECT * FROM assets WHERE id=?',Number(ready[1]));
    if(!asset)throw httpError(404,'Automatización no encontrada.');
    return send(res,200,readiness(asset));
  }
  const root=pathname.match(/^\/api\/(requests|projects|tasks|daily_updates|assets|documents|executions|incidents)(?:\/(\d+))?$/);
  if (!root)throw httpError(404,'Ruta no encontrada.');
  const table=root[1],id=root[2]?Number(root[2]):null,rule=rules[table];
  if(method==='GET'){
    if(id){
      const record=one('SELECT * FROM '+table+' WHERE id=?',id);
      if(!record)throw httpError(404,'Registro no encontrado.');
      return send(res,200,record);
    }
    const filters=[],values=[];
    const allowedFilters=table==='tasks'?['project_id','assignee_id','status']:
      table==='daily_updates'?['project_id','user_id']:table==='projects'?['developer_id','status','company_id']:
      table==='assets'?['status','risk','company_id']:table==='requests'?['status','company_id']:
      ['asset_id','status'];
    for(const key of allowedFilters){
      if(url.searchParams.has(key)){filters.push(key+'=?');values.push(url.searchParams.get(key));}
    }
    let q='SELECT * FROM '+table;
    if(filters.length)q+=' WHERE '+filters.join(' AND ');
    q+=' ORDER BY id DESC LIMIT 500';
    return send(res,200,all(q,...values).map(row=>
      table==='requests'?Object.assign(row,{score:score(row)}):row));
  }
  requireRole(user,rule.roles);
  if(method==='POST'&&!id){
    const fields=validate(table,body,true);
    if(table==='daily_updates')fields.user_id=user.id;
    if(table==='tasks'&&user.role==='developer'&&fields.assignee_id&&fields.assignee_id!==user.id)throw httpError(403,'No puede asignar tareas a otro usuario.');
    if(table==='assets'&&fields.status==='production')throw httpError(409,'Libere el activo mediante edición y controles de aprobación.');
    const newId=insertRow(table,fields);
    audit(user,'created',table,newId);
    return send(res,201,{id:newId});
  }
  if((method==='PATCH'||method==='PUT')&&id){
    const existing=one('SELECT * FROM '+table+' WHERE id=?',id);
    if(!existing)throw httpError(404,'Registro no encontrado.');
    if(table==='daily_updates')throw httpError(403,'La bitácora diaria es inmutable.');
    if(table==='executions')throw httpError(403,'Las ejecuciones son inmutables.');
    if(table==='tasks'&&user.role==='developer'&&existing.assignee_id!==user.id)throw httpError(403,'Solo sus propias tareas.');
    const fields=validate(table,body,false);
    if(table==='assets'){
      const next=Object.assign({},existing,fields);
      if(next.status==='production' && !readiness(next).ready)
        throw httpError(409,'Bloqueada liberación: '+readiness(next).missing.join(', '));
      if(existing.status!=='production'&&next.status==='production')fields.production_at=new Date().toISOString();
    }
    if(table==='incidents'&&fields.status==='resolved'&&!fields.resolved_at)fields.resolved_at=new Date().toISOString();
    updateRow(table,id,fields);
    audit(user,'updated',table,id,{fields:Object.keys(fields)});
    return send(res,200,one('SELECT * FROM '+table+' WHERE id=?',id));
  }
  throw httpError(405,'Método no permitido.');
}
function safeStatic(req,res,pathName){
  const names={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
  const name=names[pathName];
  if(!name)throw httpError(404,'No encontrado.');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-cache'});
  fs.createReadStream(path.join(PUBLIC_DIR,name)).pipe(res);
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  if(IS_PRODUCTION)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try {
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/api/health')return send(res,200,{ok:true,service:'indicadores',version:'1.0.0'});
    if(!u.pathname.startsWith('/api/'))return safeStatic(req,res,u.pathname);
    if(['POST','PATCH','PUT','DELETE'].includes(req.method)&&req.headers.origin){
      const host=req.headers.host, expected=process.env.APP_ORIGIN||((IS_PRODUCTION?'https://':'http://')+host);
      if(req.headers.origin!==expected)throw httpError(403,'Origen no autorizado.');
    }
    const body=['POST','PATCH','PUT'].includes(req.method)?await readBody(req):{};
    if(u.pathname==='/api/login'&&req.method==='POST'){
      checkLoginRate(req);
      const username=String(body.username||''),password=String(body.password||'');
      const row=one('SELECT * FROM users WHERE username=? AND active=1',username);
      if(!row||!verifyPassword(password,row.password_hash))throw httpError(401,'Credenciales inválidas.');
      const token=crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
        .run(crypto.createHash('sha256').update(token).digest('hex'),row.id,Date.now()+8*3600*1000);
      audit(row,'login','users',row.id);
      return send(res,200,{user:{id:row.id,username:row.username,display_name:row.display_name,role:row.role}},{
        'Set-Cookie':'session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800'+(IS_PRODUCTION?'; Secure':'')});
    }
    const user=currentUser(req);
    if(!user)throw httpError(401,'Sesión requerida.');
    return routeApi(req,res,u,user,body);
  } catch(error) {
    if(error?.code==='SQLITE_CONSTRAINT_UNIQUE')return send(res,409,{error:'Registro duplicado.'});
    if(String(error?.code||'').startsWith('SQLITE_CONSTRAINT'))return send(res,400,{error:'Relación o campo inválido.'});
    const status=error.status || 500;
    if(status>=500)console.error(error);
    if(!res.headersSent)send(res,status,{error:status>=500?'Error interno del servidor.':error.message});
  }
});
if(require.main===module)server.listen(PORT,()=>console.log('Indicadores ejecutándose en http://localhost:'+PORT));
module.exports={server,db,readiness,score};
