import assert from 'node:assert/strict';
import {mock,test} from 'node:test';

const env={NODE_ENV:'production',FRONTEND_ORIGIN:'https://studio.example.org',OMI_SERVER_REGISTRY_ORIGIN:'https://studio.example.org',
  OMI_SERVER_REGISTRY_AUTOMATIC_DISCOVERY:true,OMI_SERVER_REGISTRY_CAPABILITIES:'web,api'};
mock.module(new URL('../server/dist/config/env.js',import.meta.url).href,{namedExports:{env}});
const observations=[]; let allowed=true;
mock.module(new URL('../server/dist/repositories/serverRegistryRepository.js',import.meta.url).href,{namedExports:{serverRegistryRepository:{observe:async(...args)=>{observations.push(args); return allowed;}}}});
const {refreshLocalRegistryEntry}=await import('../server/dist/serverRegistry/localEntry.js');

test('central entry is generated from local production identity without HTTP, DNS or operator credentials',async()=>{
  await refreshLocalRegistryEntry();
  const [origin,metadata,id,tokenHash]=observations[0];
  assert.equal(origin,env.FRONTEND_ORIGIN);
  assert.equal(metadata.hostname,'studio.example.org');
  assert.equal(metadata.name,'Open Manuscript Studio – studio.example.org');
  assert.deepEqual(metadata.capabilities,['web','api']);
  assert.match(metadata.domainChallengeHash,/^[a-f0-9]{64}$/);
  assert.match(id,/^[a-f0-9]{32}$/); assert.match(tokenHash,/^[a-f0-9]{64}$/);
  allowed=false; await assert.rejects(refreshLocalRegistryEntry(),/revoked or quarantined/);
  const before=observations.length;
  env.OMI_SERVER_REGISTRY_ORIGIN='https://different.example.org';
  await assert.rejects(refreshLocalRegistryEntry(),/Only the registry host/);
  assert.equal(observations.length,before);
});
