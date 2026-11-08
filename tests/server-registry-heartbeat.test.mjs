import assert from 'node:assert/strict';
import {mock, test} from 'node:test';

const env = {
  OMI_SERVER_REGISTRY_INSTANCE_ID: 'synthetic',
  OMI_SERVER_REGISTRY_HEARTBEAT_TOKEN: 'x'.repeat(43),
  OMI_SERVER_REGISTRY_ORIGIN: 'https://registry.example.org',
  OMI_SERVER_REGISTRY_CAPABILITIES: 'web,api',
  OMI_SERVER_REGISTRY_AUTOMATIC_DISCOVERY: true,
  NODE_ENV: 'production',
  FRONTEND_ORIGIN: 'https://synthetic.example.org',
};
mock.module(new URL('../server/dist/config/env.js',import.meta.url).href,{namedExports:{env}});
let localRefreshes=0;
mock.module(new URL('../server/dist/serverRegistry/localEntry.js',import.meta.url).href,{namedExports:{refreshLocalRegistryEntry:async()=>{localRefreshes++;}}});
const {startServerRegistryHeartbeat}=await import('../server/dist/serverRegistry/heartbeat.js');

test('heartbeat sends at startup, then daily; failures retry, recover and stop safely', async t => {
  t.after(()=>mock.restoreAll());
  const scheduled=[];
  mock.method(globalThis,'setTimeout',(callback,delay)=>{ const timer={callback,delay}; scheduled.push(timer); return timer; });
  mock.method(globalThis,'clearTimeout',timer=>{const index=scheduled.indexOf(timer); if(index>=0) scheduled.splice(index,1);});
  mock.method(Math,'random',()=>0);
  mock.method(console,'warn',()=>{});
  let ok=true, calls=0, resolvePending;
  mock.method(globalThis,'fetch',async(url,options)=>{
    calls++;
    assert.equal(url.href,'https://registry.example.org/api/v1/server-registry/instances/synthetic/heartbeat');
    assert.equal(options.headers.Authorization,`Bearer ${env.OMI_SERVER_REGISTRY_HEARTBEAT_TOKEN}`);
    assert.equal(options.redirect,'error');
    if(resolvePending===true) return new Promise(resolve=>{resolvePending=resolve;});
    return {ok,status:ok?200:503};
  });
  const run=async()=>{ scheduled.shift().callback(); await new Promise(resolve=>{setImmediate(resolve);}); };
  const stop=startServerRegistryHeartbeat();
  assert.equal(scheduled[0].delay,0);
  await run(); assert.equal(calls,1); assert.equal(scheduled[0].delay,86400_000);
  ok=false;
  await run(); assert.equal(scheduled[0].delay,60_000);
  await run(); assert.equal(scheduled[0].delay,120_000);
  for(let i=0;i<8;i++) await run();
  assert.equal(scheduled[0].delay,3600_000);
  ok=true;
  await run(); assert.equal(scheduled[0].delay,86400_000);
  ok=false;
  await run(); assert.equal(scheduled[0].delay,60_000);
  resolvePending=true;
  await run();
  stop();
  resolvePending({ok:true,status:200});
  await new Promise(resolve=>{setImmediate(resolve);});
  assert.equal(scheduled.length,0);
  env.OMI_SERVER_REGISTRY_INSTANCE_ID=undefined;
  env.OMI_SERVER_REGISTRY_HEARTBEAT_TOKEN=undefined;
  env.NODE_ENV='development';
  assert.equal(startServerRegistryHeartbeat(),null);
});

test('registry host updates its own directory entry without a network request or credentials',async t=>{
  t.after(()=>mock.restoreAll());
  env.NODE_ENV='production'; env.OMI_SERVER_REGISTRY_AUTOMATIC_DISCOVERY=true;
  env.OMI_SERVER_REGISTRY_ORIGIN=env.FRONTEND_ORIGIN;
  const scheduled=[];
  mock.method(globalThis,'setTimeout',(callback,delay)=>{const timer={callback,delay}; scheduled.push(timer); return timer;});
  mock.method(globalThis,'clearTimeout',()=>{});
  mock.method(globalThis,'fetch',async()=>{throw Error('The registry must not call itself over the network.');});
  const before=localRefreshes;
  const stop=startServerRegistryHeartbeat();
  scheduled.shift().callback(); await new Promise(resolve=>{setImmediate(resolve);});
  assert.equal(localRefreshes,before+1); assert.equal(scheduled.length,1);
  assert.ok(scheduled[0].delay>=86400_000-30_000);
  stop();
  env.OMI_SERVER_REGISTRY_ORIGIN='https://registry.example.org';
});

test('public production server announces itself without any per-instance registry settings',async t=>{
  t.after(()=>mock.restoreAll());
  env.NODE_ENV='production';
  const scheduled=[];
  mock.method(globalThis,'setTimeout',(callback,delay)=>{const timer={callback,delay}; scheduled.push(timer); return timer;});
  mock.method(globalThis,'clearTimeout',()=>{});
  let calls=0;
  mock.method(globalThis,'fetch',async(url,options)=>{
    calls++;
    assert.equal(url.href,'https://registry.example.org/api/v1/server-registry/announcements');
    assert.deepEqual(JSON.parse(options.body),{origin:'https://synthetic.example.org'});
    assert.equal(options.headers.Authorization,undefined);
    return {ok:true,status:200};
  });
  const stop=startServerRegistryHeartbeat(); assert.equal(typeof stop,'function');
  scheduled.shift().callback(); await new Promise(resolve=>{setImmediate(resolve);});
  assert.equal(calls,1);
  assert.ok(scheduled[0].delay>=86400_000-30_000 && scheduled[0].delay<=86400_000);
  stop();
  env.OMI_SERVER_REGISTRY_AUTOMATIC_DISCOVERY=false;
  assert.equal(startServerRegistryHeartbeat(),null);
});
