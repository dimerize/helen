import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const layout = await import('../public/studio/archive-layout.js').catch(() => ({}));
const data = await import('../public/studio/archive-data.js').catch(() => ({}));
const historyModule = await import('../public/studio/archive-history.js').catch(() => ({}));
const items = [
  {id:'wide',project:'standing',aspect:2.87},
  {id:'exit',project:'standing',aspect:1.07},
  {id:'notice',project:'standing',aspect:1.22},
  ...Array.from({length:8},(_,i)=>({id:`thesis-${i}`,project:'thesis',aspect:i%2?.75:1.3})),
  {id:'script',project:'jack',aspect:.7},
  {id:'panels',project:'8ppi',aspect:1.3},
];

test('gathered worktable keeps every full image inside the table without overlaps on a phone or desktop', () => {
  assert.equal(typeof layout.createArchiveLayout,'function');
  for(const width of [284,354,720,1208,1728]){
    const result=layout.createArchiveLayout(items,{width,mode:'gather'});
    assert.equal(result.placements.size,items.length);
    const cards=[...result.placements.values()];
    for(const card of cards){
      assert.ok(card.x>=0 && card.x+card.width<=width+.01);
      assert.ok(card.y>=0 && card.y+card.height<=result.height+.01);
      assert.ok(card.width>70 && card.height>25,'images remain usable at all aspect ratios');
    }
    for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++){
      const A=cards[a],B=cards[b];
      assert.ok(A.x+A.width<=B.x || B.x+B.width<=A.x || A.y+A.height<=B.y || B.y+B.height<=A.y,'contact sheet images cannot conceal each other');
    }
    assert.equal(result.sections.length,4);
  }
});

test('spreading and gathering retain every piece and a focused family moves to the front',()=>{
  assert.equal(typeof layout.createArchiveLayout,'function');
  const spread=layout.createArchiveLayout(items,{width:1208,mode:'spread'});
  const gather=layout.createArchiveLayout(items,{width:1208,mode:'gather',focusProject:'thesis'});
  assert.deepEqual([...spread.placements.keys()].sort(),items.map(item=>item.id).sort());
  assert.equal(gather.sections[0].id,'thesis');
  assert.ok([...spread.placements].some(([id,p])=>p.x!==gather.placements.get(id).x));
});

test('a moved image stays recoverable at each edge even on a narrow screen',()=>{
  assert.equal(typeof layout.clampArchivePosition,'function');
  const bounds={width:354,height:1400};
  assert.deepEqual(layout.clampArchivePosition({x:-700,y:1600,width:240,height:310},bounds),{x:12,y:1078});
  assert.deepEqual(layout.clampArchivePosition({x:800,y:-900,width:240,height:310},bounds),{x:102,y:12});
});

test('touch scrolling wins before a hold, while mouse, move mode, and a held image can move in either axis',()=>{
  assert.equal(typeof layout.archiveDragIntent,'function');
  assert.equal(layout.archiveDragIntent({pointerType:'touch',elapsed:40,dx:2,dy:30}), 'scroll');
  assert.equal(layout.archiveDragIntent({pointerType:'touch',elapsed:40,dx:30,dy:2}), 'scroll');
  assert.equal(layout.archiveDragIntent({pointerType:'touch',elapsed:360,dx:2,dy:30}), 'drag');
  assert.equal(layout.archiveDragIntent({pointerType:'touch',elapsed:40,dx:2,dy:30,moveMode:true}), 'drag');
  assert.equal(layout.archiveDragIntent({pointerType:'mouse',elapsed:40,dx:2,dy:30}), 'drag');
  assert.equal(layout.archiveDragIntent({pointerType:'mouse',elapsed:40,dx:2,dy:2}), 'wait');
});

test('scanner deep links resolve all three real scans and ignore unknown selection IDs',()=>{
  assert.equal(typeof layout.archiveSelection,'function');
  assert.ok(Array.isArray(data.archiveItems));
  for(const id of ['train-scan','train-scan-wide','train-scan-notice']){
    assert.equal(layout.archiveSelection(`https://helen.test/archive?scan=${id}`,data.archiveItems),id);
    const item=data.archiveItems.find(entry=>entry.id===id);
    assert.ok(existsSync(new URL(`../public/artwork/${item.image}`,import.meta.url)));
  }
  assert.equal(layout.archiveSelection('https://helen.test/archive?scan=missing',data.archiveItems),null);
});

test('opening and closing an archive selection preserves unrelated URL context',()=>{
  assert.equal(typeof layout.archiveSelectionURL,'function');
  const opened=layout.archiveSelectionURL('https://helen.test/archive?from=print#archive','train-scan');
  assert.equal(opened,'/archive?from=print&scan=train-scan#archive');
  assert.equal(layout.archiveSelectionURL(`https://helen.test${opened}`,null),'/archive?from=print#archive');
});

function historyFixture(href='https://helen.test/archive'){
  assert.equal(typeof historyModule.createArchiveHistory,'function');
  const win=new EventTarget(),location={href};
  const stack=[{href,state:null}],pending=[];let index=0;
  function traverse(change){index+=change;location.href=stack[index].href;win.dispatchEvent(new Event('popstate'));}
  const history={
    get state(){return stack[index].state;},
    pushState(state,_,url){stack.splice(++index);stack.push({state,href:new URL(url,location.href).href});location.href=stack[index].href;},
    replaceState(state,_,url){stack[index]={state,href:new URL(url,location.href).href};location.href=stack[index].href;},
    back(){pending.push(()=>traverse(-1));},
  };
  const selections=[];
  const controller=historyModule.createArchiveHistory({window:win,history,location,items:[{id:'train-scan'},{id:'painting'}],onSelect:id=>selections.push(id)});
  return {controller,selections,stack,pending,location,history,forward(){traverse(1);},back(){traverse(-1);}};
}

test('a directly linked scan closes onto the table rather than navigating away from the archive',()=>{
  const f=historyFixture('https://helen.test/archive?scan=train-scan');
  f.controller.start();
  assert.deepEqual(f.selections,['train-scan']);
  f.controller.close();
  assert.equal(f.pending.length,0);
  assert.equal(f.location.href,'https://helen.test/archive');
  assert.deepEqual(f.selections,['train-scan',null]);
});

test('Back closes an opened image and Forward restores the exact selected related image',()=>{
  const f=historyFixture();f.controller.start();
  f.controller.open('train-scan');f.controller.open('painting');
  assert.equal(f.stack.length,2,'related images share one inspection history entry');
  f.back();assert.equal(f.selections.at(-1),null);
  f.forward();assert.equal(f.selections.at(-1),'painting');
});

test('repeated close events queue one history traversal and preserve unrelated history state',()=>{
  const f=historyFixture();
  f.history.replaceState({navigationKey:'retain-me'},'',f.location.href);
  f.controller.start();f.controller.open('train-scan');
  assert.equal(f.history.state.navigationKey,'retain-me');
  f.controller.close();f.controller.close();
  assert.equal(f.pending.length,1);
  f.pending.shift()();
  assert.equal(f.location.href,'https://helen.test/archive');
  assert.equal(f.history.state.navigationKey,'retain-me');
});
