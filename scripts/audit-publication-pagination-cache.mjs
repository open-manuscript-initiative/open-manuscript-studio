import assert from 'node:assert/strict';
import { createIncrementalPublicationPaginator, createPublicationPageMetricsResolver, paginatePublicationBlocks } from '../src/components/publicationPageLayout.ts';
let seed=12457;
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
let checks=0;
for(const styled of [false,true]) {
 const paginator=createIncrementalPublicationPaginator(), key={};
 let blocks=Array.from({length:220},(_,i)=>({sectionId:i<110?'a':'b',top:i*28,height:20,noteIds:i%9===0?['n'+i]:[],keepWithNext:i%19===0}));
 const heights=new Map(blocks.flatMap(b=>b.noteIds.map(id=>[id,40+random(100)])));
 const notes={heights,lineHeight:5,separatorHeight:5};
 const geometry=(index,section,inserted)=>({height:inserted?180:section==='a'?140:160,bodyHeight:inserted?140:section==='a'?100:120,topMargin:20+index%2});
 for(let run=0;run<120;run++) {
  const r=createPublicationPageMetricsResolver(geometry,10,20);
  const actual=paginator.paginate(blocks,100,40,notes,styled?r.metrics:undefined,styled?{key,snapshot:r.snapshot,restore:r.restore}:undefined);
  const expected=paginatePublicationBlocks(blocks,100,40,notes,styled?createPublicationPageMetricsResolver(geometry,10,20).metrics:undefined);
  assert.deepEqual(actual,expected,`mode ${styled}, iteration ${run}`);checks++;
  blocks=structuredClone(blocks);
  const index=random(blocks.length), delta=random(9)-4;
  if(run%3===0){blocks[index].height=Math.max(5,blocks[index].height+delta);for(let i=index+1;i<blocks.length;i++)blocks[i].top+=delta;}
  else if(run%3===1){const id='n'+random(220);heights.set(id,20+random(200));}
  else {blocks[index].keepWithNext=!blocks[index].keepWithNext;}
 }
}
console.log(JSON.stringify({seed:12457,comparisons:checks,result:'pass'}));
