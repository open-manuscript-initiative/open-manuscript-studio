import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createHash } from 'node:crypto';
import express from '../server/node_modules/express/index.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const records = new Map();
let dns = [], auditCalls = 0, auditFails = false;
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, {namedExports: {env: {
  NODE_ENV:'production', FRONTEND_ORIGIN:'https://synthetic.example.org',
  OMI_SERVER_REGISTRY_AUTOMATIC_DISCOVERY:true, OMI_SERVER_REGISTRY_CAPABILITIES:'web,api',
}}});
let proofMode='valid', probes=0;
mock.module(new URL('../server/dist/cloud/security/connectionPinnedHttp.js',import.meta.url).href,{namedExports:{
  fetchPinnedPublicUrl: async(url,options)=>{
    probes++;
    assert.equal(options.redirect,'error');
    assert.equal(url.pathname,'/api/v1/server-registry/identity');
    assert.equal(options.headers.Authorization,undefined);
    if(proofMode==='network-error') throw Error('private or reserved address');
    if(proofMode==='oversized') return new Response('x'.repeat(8193));
    return Response.json({protocol:'omi-studio-directory-v1',challenge:proofMode==='wrong-nonce'?'a'.repeat(64):url.searchParams.get('challenge'),
      origin:proofMode==='wrong-origin'?'https://other.example.org':url.origin,
      name:'Public authoritative name',softwareVersion:'1.0.0',capabilities:['web','api']});
  },
}});
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
  observe: async(origin,data,id)=>{
    const existing=[...records.values()].find(e=>e.origin===origin);
    if(existing && !['ACTIVE','PENDING'].includes(existing.status)) return false;
    records.set(existing?.id??id,{id:existing?.id??id,origin,...data,status:'ACTIVE',lastHeartbeatAt:new Date(),heartbeatTokenHash:existing?.heartbeatTokenHash??'secret',registrationTokenHash:null});
    return true;
  },
};
mock.module(new URL('../server/dist/repositories/serverRegistryRepository.js', import.meta.url).href, { namedExports: { serverRegistryRepository: repository } });
mock.module('node:dns/promises', { namedExports: { resolveTxt: async () => dns } });
mock.module(new URL('../server/dist/serverRegistry/githubAudit.js', import.meta.url).href, { namedExports: { submitGithubRegistration: async () => { auditCalls++; await new Promise(r=>{setImmediate(r);}); if(auditFails) throw Error('synthetic failure'); return 'https://github.com/example/catalog/issues/1'; } } });
const { serverRegistryRouter } = await import('../server/dist/routes/serverRegistryRoutes.js');
const {apiCors}=await import('../server/dist/middleware/apiCors.js');
test('v1 and legacy enforce private proof, expiry, one activation, rotation/revocation and audit quarantine', async t => {
  const app=express(); app.use(express.json()); app.use('/api/v1/server-registry',serverRegistryRouter); app.use('/api/server-registry',serverRegistryRouter);
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>{server.once('listening',r);}); t.after(()=>new Promise(r=>{server.close(r);}));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(path, body={}, token, method='POST') => { const response=await fetch(origin+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})}); return {status:response.status, body:response.status===204?{}:await response.json()}; };
  const base='/api/v1/server-registry';
  for(const bad of ['http://bad.example.org','https://127.0.0.1','https://bad.example.org/path']) assert.equal((await call(base+'/registrations',{name:'Invalid',origin:bad})).status,400);
  const registered=await call(base+'/registrations',{name:'Synthetic',origin:'https://synthetic.example.org'}); assert.equal(registered.status,201);
  assert.equal(registered.body.heartbeatIntervalSeconds,86400);
  const {id,registrationToken,verification}=registered.body;
  assert.equal(records.get(id).registrationTokenHash,hash(registrationToken));
  assert.equal(await call(base+`/registrations/${id}/verify`).then(r=>r.status),401);
  assert.equal(await call(`/api/server-registry/registrations/${id}/verify`,{},verification.value.padEnd(43,'x')).then(r=>r.status),401);
  dns=[[verification.value.slice(0,10),verification.value.slice(10)]];
  const results=await Promise.all([base,'/api/server-registry'].map(prefix=>call(prefix+`/registrations/${id}/verify`,{},registrationToken)));
  assert.equal(results.filter(r=>r.status===200).length,1); assert.ok(results.some(r=>[401,409].includes(r.status))); assert.equal(auditCalls,1);
  const heartbeat=results.find(r=>r.status===200).body.heartbeatToken;
  assert.equal(results.find(r=>r.status===200).body.heartbeatIntervalSeconds,86400);
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

test('daily public directory includes only recent active instances, with metadata and separate cache policy', async t => {
  records.clear();
  const now=Date.parse('2026-11-08T12:00:00Z');
  const clock=mock.method(Date,'now',()=>now); t.after(()=>clock.mock.restore());
  for(const [id, age, status='ACTIVE'] of [
    ['daily',24*3600_000],['boundary',48*3600_000],['expired',48*3600_000+1],
    ['future',-1],['never',null],['pending',0,'PENDING'],['revoked',0,'REVOKED'],
  ]) records.set(id,{id,name:id,origin:`https://${id}.example.org`,status,
    softwareVersion:'test',capabilities:['web'],lastHeartbeatAt:age===null?null:new Date(now-age),heartbeatTokenHash:'secret'});
  const app=express(); app.use(apiCors(new Set(['https://studio.example.org']))); app.use('/api/v1/server-registry',serverRegistryRouter); app.use('/api/server-registry',serverRegistryRouter);
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>{server.once('listening',r);}); t.after(()=>new Promise(r=>{server.close(r);}));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const base of ['/api/v1/server-registry','/api/server-registry']) {
    const response=await fetch(origin+base+'/servers/daily',{headers:{Origin:'https://openmanuscript.org'}}); const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(response.headers.get('access-control-allow-origin'),'https://openmanuscript.org');
    assert.equal(response.headers.get('access-control-allow-credentials'),null);
    assert.equal(response.headers.get('cache-control'),'public, max-age=86400, must-revalidate');
    assert.deepEqual(body.servers.map(e=>e.id),['daily','boundary']);
    assert.equal(body.generatedAt,new Date(now).toISOString());
    assert.equal(body.refreshAfterSeconds,86400);
    assert.equal(body.heartbeatFreshForSeconds,172800);
    assert.equal(body.servers[0].lastSeenAt,new Date(now-24*3600_000).toISOString());
    assert.ok(!JSON.stringify(body).includes('secret'));
    const live=await fetch(origin+base+'/servers');
    assert.equal(live.headers.get('cache-control'),'public, max-age=60, must-revalidate');
    assert.equal((await live.json()).servers.find(e=>e.id==='expired').status,'offline');
  }
});

test('automatic announcements derive metadata from HTTPS proof without DNS, GitHub or issued secrets',async t=>{
  records.clear(); proofMode='valid'; probes=0;
  const app=express(); app.use(express.json()); app.use('/api/v1/server-registry',serverRegistryRouter);
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>{server.once('listening',r);}); t.after(()=>new Promise(r=>{server.close(r);}));
  const base=`http://127.0.0.1:${server.address().port}/api/v1/server-registry`;
  const announce=async body=>{const response=await fetch(base+'/announcements',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); return {status:response.status,body:await response.json()};};
  const auditBefore=auditCalls;
  assert.equal((await announce({origin:'https://automatic.example.org',name:'Forged name'})).status,400);
  for(const origin of ['http://bad.example.org','https://127.0.0.1','https://[::1]','https://localhost','https://bad.example.org/path']) assert.equal((await announce({origin})).status,400);
  const result=await announce({origin:'https://automatic.example.org'});
  assert.equal(result.status,200); assert.equal(result.body.heartbeatIntervalSeconds,86400);
  assert.ok(!JSON.stringify(result.body).includes('Token'));
  const record=[...records.values()][0]; assert.equal(record.name,'Public authoritative name');
  assert.equal(auditCalls,auditBefore);
  const before=record.lastHeartbeatAt;
  assert.equal((await announce({origin:record.origin})).status,202);
  assert.equal(probes,1); assert.equal(record.lastHeartbeatAt,before);
  for(const mode of ['wrong-nonce','wrong-origin','network-error','oversized']) {
    proofMode=mode;
    assert.equal((await announce({origin:`https://${mode}.example.org`})).status,503);
  }
  assert.equal(records.size,1);
  proofMode='valid'; record.status='REVOKED';
  assert.equal((await announce({origin:record.origin})).status,409);
  record.status='VERIFYING'; assert.equal((await announce({origin:record.origin})).status,409);
  record.status='PENDING';
  assert.equal((await announce({origin:record.origin})).status,200);
  const identity=await fetch(base+'/identity?challenge='+'b'.repeat(64));
  const body=await identity.json();
  assert.equal(identity.status,200); assert.equal(body.challenge,'b'.repeat(64)); assert.equal(body.origin,'https://synthetic.example.org');
  assert.equal(identity.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(base+'/identity?challenge=invalid')).status,404);
});
