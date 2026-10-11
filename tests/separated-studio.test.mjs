import test from 'node:test';
import assert from 'node:assert/strict';
import {createArchiveLayout} from '../public/studio/archive-layout.js';
import {archiveItems} from '../public/studio/archive-data.js';
const journey=await import('../public/studio/separated-journey.js').catch(()=>({}));
test('a single camera clock lands exactly at both endpoints with no midpoint velocity discontinuity',()=>{
 assert.equal(typeof journey.journeySample,'function');
 const sample=journey.journeySample;
 assert.equal(sample(0).outgoing,0);assert.equal(sample(1).incoming,0);
 assert.ok(sample(.5).outgoing>=1);assert.ok(sample(.5).incoming<=-1);
 const h=.00001,a=sample(.5-h),b=sample(.5),c=sample(.5+h);
 assert.ok(Math.abs((b.outgoing-a.outgoing)/h-(c.outgoing-b.outgoing)/h)<.001);
 assert.equal(sample(0).retreat,0);assert.equal(sample(1).retreat,0);
});
test('fallback archive includes every piece with clear nonoverlapping rotated frame bounds',()=>{
 for(const width of [284,354,720,1208,1728]){
  const {placements}=createArchiveLayout(archiveItems,{width,mode:'spread'});
  const bounds=[...placements.values()].map(p=>{const a=p.angle*Math.PI/180,w=Math.abs(p.width*Math.cos(a))+Math.abs(p.height*Math.sin(a))+16,h=Math.abs(p.height*Math.cos(a))+Math.abs(p.width*Math.sin(a))+32;return {x:p.x+p.width/2-w/2,y:p.y+p.height/2-h/2,w,h};});
  for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j];assert.ok(a.x+a.w+8<=b.x||b.x+b.w+8<=a.x||a.y+a.h+8<=b.y||b.y+b.h+8<=a.y,`frames ${i}/${j} at ${width}`);}
 }
});
test('home bug-mode links cannot reopen an archive inspector through history',async()=>{
 const {archiveSelection}=await import('../public/studio/archive-layout.js');
 assert.equal(archiveSelection('https://helen.test/?scan=train-scan&explore=1',archiveItems),null);
});
