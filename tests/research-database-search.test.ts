import assert from 'node:assert/strict';
import test from 'node:test';
import { searchResearchDatabase } from '../server/src/integrations/researchDatabases/search.ts';
import { isResearchDatabaseRecord } from '../src/modules/research-databases/searchApi.ts';
const response=(body:unknown)=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
test('ERIC encodes the query, maps education records, and paginates safely',async()=>{
 const urls:URL[]=[];
 const page=await searchResearchDatabase({provider:'eric',query:'inclusive & STEM',fetchImpl:async input=>{const u=new URL(String(input));urls.push(u);return response({response:{numFound:11,docs:[{id:'EJ123456',title:'Inclusive STEM education',author:['A. Researcher'],publicationdateyear:'2025',description:'A study',fulltext:'true'}]}});}});
 assert.equal(urls[0].hostname,'api.ies.ed.gov');assert.equal(urls[0].searchParams.get('search'),'inclusive & STEM');assert.equal(page.items[0].url,'https://eric.ed.gov/?id=EJ123456');assert.equal(page.items[0].authors[0],'A. Researcher');
});
test('INSPIRE-HEP returns bounded literature metadata and record links',async()=>{
 const page=await searchResearchDatabase({provider:'inspire-hep',query:'quantum field theory',fetchImpl:async input=>{const u=new URL(String(input));assert.equal(u.hostname,'inspirehep.net');assert.equal(u.searchParams.get('size'),'10');return response({hits:{total:{value:1},hits:[{id:'123456',metadata:{titles:[{title:'Quantum field theory'}],authors:[{full_name:'A. Physicist'}],publication_info:[{year:2024}],abstract:{value:'Research abstract'}}}]}});}});
 assert.equal(page.items[0].url,'https://inspirehep.net/literature/123456');assert.equal(page.items[0].year,'2024');assert.equal(page.items[0].authors[0],'A. Physicist');
});
test('PubChem maps compound properties and paginates result identifiers',async()=>{
 const page=await searchResearchDatabase({provider:'pubchem',query:'aspirin',fetchImpl:async input=>{const u=new URL(String(input));assert.equal(u.hostname,'pubchem.ncbi.nlm.nih.gov');return u.pathname.endsWith('/cids/JSON')?response({IdentifierList:{CID:[2244]}}):response({PropertyTable:{Properties:[{CID:2244,IUPACName:'2-acetoxybenzoic acid',MolecularFormula:'C9H8O4',MolecularWeight:180.16}]}});}});
 assert.equal(page.items[0].title,'2-acetoxybenzoic acid');assert.match(page.items[0].description,/C9H8O4/);assert.equal(page.items[0].url,'https://pubchem.ncbi.nlm.nih.gov/compound/2244');
});
test('GBIF maps occurrence records and preserves licence only when supplied',async()=>{
 const page=await searchResearchDatabase({provider:'gbif',query:'Quercus robur',fetchImpl:async input=>{const u=new URL(String(input));assert.equal(u.pathname,'/v1/occurrence/search');return response({count:1,results:[{key:987654,scientificName:'Quercus robur',country:'Hungary',eventDate:'2024-04-01',basisOfRecord:'HUMAN_OBSERVATION',license:'CC_BY_4_0',decimalLatitude:48.1,decimalLongitude:21.3}]});}});
 assert.equal(page.items[0].url,'https://www.gbif.org/occurrence/987654');assert.match(page.items[0].description,/Hungary/);assert.equal(page.items[0].rights,'CC_BY_4_0');
});
test('OpenAlex searches scholarly works and maps author and year metadata',async()=>{
 const urls:URL[]=[];
 const page=await searchResearchDatabase({provider:'openalex',query:'philosophy of science',fetchImpl:async input=>{const u=new URL(String(input));urls.push(u);return response({meta:{count:1},results:[{id:'https://openalex.org/W123456',title:'Philosophy of science',publication_year:2025,doi:'https://doi.org/10.1234/example',authorships:[{author:{display_name:'A. Scholar'}}]}]});}});
 assert.equal(urls[0].hostname,'api.openalex.org');assert.equal(urls[0].searchParams.get('search'),'philosophy of science');assert.equal(page.items[0].url,'https://openalex.org/W123456');assert.equal(page.items[0].authors[0],'A. Scholar');assert.equal(page.items[0].year,'2025');
});
test('ScienceBase searches USGS records and maps catalog item links',async()=>{
 const page=await searchResearchDatabase({provider:'sciencebase',query:'volcanic ash',fetchImpl:async input=>{const u=new URL(String(input));assert.equal(u.hostname,'www.sciencebase.gov');assert.equal(u.pathname,'/catalog/items');assert.equal(u.searchParams.get('format'),'json');return response({total:1,items:[{id:'65abc123',title:'Volcanic ash data',summary:'Geological dataset',dateCreated:'2025-01-01'}]});}});
 assert.equal(page.items[0].url,'https://www.sciencebase.gov/catalog/item/65abc123');assert.equal(page.items[0].description,'Geological dataset');
});
test('search rejects unsafe cursors, oversized bodies, and untrusted frontend links',async()=>{
 await assert.rejects(searchResearchDatabase({provider:'gbif',query:'species',cursor:'https://evil.test'}),/cursor/);
 await assert.rejects(searchResearchDatabase({provider:'gbif',query:'species',fetchImpl:async()=>new Response('x'.repeat(1_500_001))}),/too large/);
 const item={id:'2244',provider:'pubchem' as const,title:'Aspirin',authors:[],year:'',description:'',rights:'',url:'https://pubchem.ncbi.nlm.nih.gov/compound/2244'};
 assert.ok(isResearchDatabaseRecord(item,'pubchem'));assert.equal(isResearchDatabaseRecord({...item,url:'https://evil.test/'},'pubchem'),false);
 assert.ok(isResearchDatabaseRecord({...item,provider:'openalex',url:'https://openalex.org/W123456'},'openalex'));
 assert.ok(isResearchDatabaseRecord({...item,provider:'sciencebase',url:'https://www.sciencebase.gov/catalog/item/65abc123'},'sciencebase'));
});
