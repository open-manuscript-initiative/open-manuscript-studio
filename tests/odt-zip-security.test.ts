import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import test from 'node:test';
import { OdtZip } from '../src/services/odtZip.ts';
import { crc32 } from '../src/services/simpleZip.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

function zip(entries: Array<{ name: string; text: string; deflate?: boolean; declared?: number; crc?: number; descriptor?: boolean }>): Uint8Array {
  const locals: Uint8Array[] = [], centrals: Uint8Array[] = []; let offset = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name), raw = new TextEncoder().encode(entry.text);
    const payload = entry.deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const crc = entry.crc ?? crc32(raw), size = entry.declared ?? raw.length, flags = entry.descriptor ? 8 : 0;
    const local = new Uint8Array(30 + name.length + payload.length + (flags ? 16 : 0)); const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, flags, true); lv.setUint16(8, entry.deflate ? 8 : 0, true);
    if (!flags) { lv.setUint32(14, crc, true); lv.setUint32(18, payload.length, true); lv.setUint32(22, size, true); }
    lv.setUint16(26, name.length, true); local.set(name, 30); local.set(payload, 30 + name.length);
    if (flags) { const p=30+name.length+payload.length; lv.setUint32(p,0x08074b50,true);lv.setUint32(p+4,crc,true);lv.setUint32(p+8,payload.length,true);lv.setUint32(p+12,size,true); }
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, flags, true); cv.setUint16(10, entry.deflate ? 8 : 0, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, payload.length, true); cv.setUint32(24, size, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name,46);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0); const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
  const result = new Uint8Array(offset+centralSize+22); let p=0;
  for(const part of [...locals,...centrals,end]){result.set(part,p);p+=part.length;} return result;
}
const limits = { partBytes: 1024, totalBytes: 2048, entries: 10 };
const reader = (bytes: Uint8Array) => new OdtZip(bytes.slice().buffer, limits);

test('accepts STORE, DEFLATE and data-descriptor archives and counts repeated reads only once', async () => {
  const r=reader(zip([{name:'stored',text:'Synthetic'},{name:'deflated',text:'S'.repeat(900),deflate:true,descriptor:true}]));
  assert.equal(await r.text('stored'),'Synthetic'); assert.equal((await r.data('deflated')).length,900);
  assert.equal((await r.data('deflated')).length,900);
});
test('rejects forged stored lengths and declared aggregate/entry quotas before parsing', () => {
  assert.throws(()=>reader(zip([{name:'content.xml',text:'S'.repeat(1025),declared:1}])),/stored size/);
  assert.throws(()=>reader(zip([{name:'a',text:'S'.repeat(900)},{name:'b',text:'S'.repeat(900)},{name:'c',text:'S'.repeat(900)}])),/quota/);
  assert.throws(()=>new OdtZip(zip([{name:'a',text:'A'},{name:'b',text:'B'}]).slice().buffer,{entries:1}),/quota/);
});
test('aborts forged deflate expansion using actual output bytes before full materialization', async () => {
  const r=reader(zip([{name:'content.xml',text:'S'.repeat(100_000),declared:1,deflate:true}]));
  await assert.rejects(()=>r.data('content.xml'),/actual expanded size quota/);
});
test('rejects CRC corruption, duplicate names, unsafe paths, malformed local headers and truncation', async () => {
  await assert.rejects(()=>reader(zip([{name:'a',text:'Synthetic',crc:1}])).data('a'),/CRC32/);
  assert.throws(()=>reader(zip([{name:'a',text:'A'},{name:'a',text:'B'}])),/duplicate/);
  assert.throws(()=>reader(zip([{name:'../unsafe',text:'A'}])),/Unsafe/);
  const broken=zip([{name:'a',text:'A'}]);new DataView(broken.buffer).setUint32(0,0,true);
  assert.throws(()=>reader(broken),/local header/);
  assert.throws(()=>reader(new Uint8Array([1,2,3])),/end-of-central/);
});
test('ODT reports every unsupported source link, preserves original OMI and keeps diagnostics content-free', () => {
  const m=createVersionedTestManuscript();m.sourceAttributions=[{id:'synthetic-link',sourceObjectId:m.sections[0].blocks[0].id,targetBibliographicRecordId:'synthetic-source',predicate:'prov:wasDerivedFrom',assertionStatus:'author-confirmed'}];
  m.bibliographicRecords=[{id:'synthetic-source',title:'PRIVATE-SYNTHETIC-LABEL',type:'dataset',contributors:[],identifiers:[],status:'provisional'}];
  const before=JSON.stringify(m), result=buildOdtExport(m);
  assert.equal(result.diagnostics.length,1);assert.equal(result.diagnostics[0].code,'source-attribution-not-preserved');assert.equal(result.diagnostics[0].targetId,'synthetic-link');
  assert.ok(result.warnings.some(w=>w.includes('structured OMI source-attribution')));
  assert.equal(JSON.stringify(result.diagnostics).includes('PRIVATE-SYNTHETIC-LABEL'),false);assert.equal(JSON.stringify(m),before);
});
