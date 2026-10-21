import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createHash } from 'node:crypto';
import express from '../server/node_modules/express/index.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const records = new Map();
let dns = [], auditCalls = 0, auditFails = false;
const repository = {
  findById: async id => records.get(id),
  findByOrigin: async origin => [...records.values()].find(e => e.origin === origin),
  register: async (id, data) => { records.set(id, { id, ...data, status: 'PENDING' }); return true; },
  claim: async (id, proof) => { const e = records.get(id); if (e.status !== 'PENDING' || e.registrationTokenHash !== proof || e.challengeExpiresAt <= new Date()) return false; e.status = 'VERIFYING'; return true; },
  activate: async (id, proof, token, url) => { const e = records.get(id); if(e.status !== 'VERIFYING' || e.registrationTokenHash !== proof) return false; Object.assign(e, { status:'ACTIVE', registrationTokenHash:null, challengeExpiresAt:null, heartbeatTokenHash:token, githubIssueUrl:url }); return true; },
  heartbeat: async (id, old) => records.get(id)?.status === 'ACTIVE' && records.get(id)?.heartbeatTokenHash === old,
  rotate: async (id, old, value) => { const e = records.get(id); if(e.status !== 'ACTIVE' || e.heartbeatTokenHash !== old) return false; e.heartbeatTokenHash=value; return true; },
  revoke: async (id, old) => { const e = records.get(id); if(e.status !== 'ACTIVE' || e.heartbeatTokenHash !== old) return false; e.status='REVOKED'; return true; },
  list: async () => [...records.values()].filter(e => e.status==='ACTIVE'),
};
mock.module(new URL('../server/dist/repositories/serverRegistryRepository.js', import.meta.url).href, { namedExports: { serverRegistryRepository: repository } });
mock.module('node:dns/promises', { namedExports: { resolveTxt: async () => dns } });
mock.module(new URL('../server/dist/serverRegistry/githubAudit.js', import.meta.url).href, { namedExports: { submitGithubRegistration: async () => { auditCalls++; await new Promise(r=>{setImmediate(r);}); if(auditFails) throw Error('synthetic failure'); return 'https://github.com/example/catalog/issues/1'; } } });
const { serverRegistryRouter } = await import('../server/dist/routes/serverRegistryRoutes.js');
test('v1 and legacy enforce private proof, expiry, one activation, rotation/revocation and audit quarantine', async t => {
  const app=express(); app.use(express.json()); app.use('/api/v1/server-registry',serverRegistryRouter); app.use('/api/server-registry',serverRegistryRouter);
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>{server.once('listening',r);}); t.after(()=>new Promise(r=>{server.close(r);}));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(path, body={}, token, method='POST') => { const response=await fetch(origin+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})}); return {status:response.status, body:response.status===204?{}:await response.json()}; };
  const base='/api/v1/server-registry';
  for(const bad of ['http://bad.example.org','https://127.0.0.1','https://bad.example.org/path']) assert.equal((await call(base+'/registrations',{name:'Invalid',origin:bad})).status,400);
  const registered=await call(base+'/registrations',{name:'Synthetic',origin:'https://synthetic.example.org'}); assert.equal(registered.status,201);
  const {id,registrationToken,verification}=registered.body;
  assert.equal(records.get(id).registrationTokenHash,hash(registrationToken));
  assert.equal(await call(base+`/registrations/${id}/verify`).then(r=>r.status),401);
  assert.equal(await call(`/api/server-registry/registrations/${id}/verify`,{},verification.value.padEnd(43,'x')).then(r=>r.status),401);
  dns=[[verification.value.slice(0,10),verification.value.slice(10)]];
  const results=await Promise.all([base,'/api/server-registry'].map(prefix=>call(prefix+`/registrations/${id}/verify`,{},registrationToken)));
  assert.equal(results.filter(r=>r.status===200).length,1); assert.ok(results.some(r=>[401,409].includes(r.status))); assert.equal(auditCalls,1);
  const heartbeat=results.find(r=>r.status===200).body.heartbeatToken;
  const listing=await call(base+'/servers',{},undefined,'GET'); const serialized=JSON.stringify(listing.body);
  assert.ok(!serialized.includes(heartbeat)); assert.ok(!serialized.includes(registrationToken)); assert.ok(!serialized.includes('Hash'));
  const rotated=await call(base+`/instances/${id}/rotate-token`,{},heartbeat); assert.equal(rotated.status,200);
  assert.equal((await call(base+`/instances/${id}/heartbeat`,{},heartbeat)).status,401);
  assert.equal((await call(base+`/instances/${id}`,{},rotated.body.heartbeatToken,'DELETE')).status,204);
  assert.equal((await call(base+`/instances/${id}/heartbeat`,{},rotated.body.heartbeatToken)).status,401);
  const pending=await call(base+'/registrations',{name:'Expired',origin:'https://expired.example.org'});
  records.get(pending.body.id).challengeExpiresAt=new Date(0);
  assert.equal((await call(base+`/registrations/${pending.body.id}/verify`,{},pending.body.registrationToken)).status,409);
  const unknown=await call(base+'/registrations',{name:'Unknown',origin:'https://unknown.example.org'});
  dns=[[unknown.body.verification.value]]; auditFails=true;
  assert.equal((await call(base+`/registrations/${unknown.body.id}/verify`,{},unknown.body.registrationToken)).status,503);
  assert.equal(records.get(unknown.body.id).status,'VERIFYING');
  assert.equal((await call(base+`/registrations/${unknown.body.id}/verify`,{},unknown.body.registrationToken)).status,409);
  assert.equal(auditCalls,2);
});
