import test from 'node:test';
import assert from 'node:assert/strict';
const {createStudioPortal}=await import('../public/studio/studio-portal.js').catch(()=>({}));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(url='https://helen.test/'){
 assert.equal(typeof createStudioPortal,'function','portal lifecycle controller exists');
 const element=()=>Object.assign(new EventTarget(),{dataset:{},focused:false,focus(){this.focused=true;},classList:{add(){},remove(){}}});
 const dialog=element();dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 const trigger=element(),doc=Object.assign(new EventTarget(),{body:element(),activeElement:trigger,hidden:false});
 const win=Object.assign(new EventTarget(),{scrollY:640,scrollTo({top}){win.scrollY=top;}});
 const location={href:url};const stack=[{url,state:null}];let index=0;const pendingHistory=[];
 const traverse=d=>{index+=d;location.href=stack[index].url;win.dispatchEvent(new Event('popstate'));};
 const history={get state(){return stack[index].state;},pushState(state,_,url){stack.splice(++index);stack.push({state,url:String(url)});location.href=String(url);},replaceState(state,_,url){stack[index]={state,url:String(url)};location.href=String(url);},back(){pendingHistory.push(()=>traverse(-1));}};
 const captures=[],experiences=[],scanner=[];
 doc.addEventListener('studio:gallery',e=>scanner.push(e.detail.open));
 const controller=createStudioPortal({dialog,document:doc,window:win,location,history,prepare(){dialog.dataset.state='loading';},captureHomepage(){return new Promise(resolve=>captures.push(resolve));},async createExperience(root,{onExit}){const e={disposed:false,paused:false,exit(){onExit();},dispose(){this.disposed=true;},pause(){this.paused=true;},resume(){this.paused=false;}};experiences.push(e);root.dataset.state='closed';return e;}});
 const resolveCapture=async()=>{const echo={canvas:{},disposed:false,dispose(){this.disposed=true;}};captures.shift()(echo);await flush();return echo;};
 return {controller,dialog,trigger,win,doc,location,stack,scanner,captures,experiences,resolveCapture,back:()=>traverse(-1),forward:()=>traverse(1),flushHistory(){pendingHistory.splice(0).forEach(fn=>fn());}};
}
test('opening only presents the closed doorway after loading',async()=>{const f=fixture();f.controller.open(f.trigger);assert.equal(f.dialog.open,true);await f.resolveCapture();assert.equal(f.dialog.dataset.state,'closed');assert.equal(f.stack.length,2);});
test('close during capture disposes late resources and never mounts the old room',async()=>{const f=fixture();f.controller.open(f.trigger);f.controller.requestClose();const echo=await f.resolveCapture();f.flushHistory();assert.equal(f.dialog.open,false);assert.equal(echo.disposed,true);assert.equal(f.experiences.length,0);assert.equal(f.location.href,'https://helen.test/');});
test('normal exit restores scanner, original scroll, focus and history entry',async()=>{const f=fixture();f.controller.open(f.trigger);const echo=await f.resolveCapture();f.win.scrollY=0;f.controller.requestClose();f.flushHistory();assert.equal(f.dialog.open,false);assert.equal(f.win.scrollY,640);assert.equal(f.trigger.focused,true);assert.equal(f.experiences[0].disposed,true);assert.equal(echo.disposed,true);assert.deepEqual(f.scanner,[true,false]);assert.equal(f.location.href,'https://helen.test/');});
test('Back then Forward while capture is pending ignores the obsolete mount',async()=>{const f=fixture();f.controller.open(f.trigger);f.back();f.forward();const stale=await f.resolveCapture();assert.equal(stale.disposed,true);await f.resolveCapture();assert.equal(f.dialog.open,true);assert.equal(f.experiences.length,1);assert.equal(f.stack.length,2);});
test('direct room URL closes without leaving homepage',async()=>{const f=fixture('https://helen.test/?room=gallery');await f.resolveCapture();f.controller.requestClose();assert.equal(f.location.href,'https://helen.test/');assert.equal(f.stack.length,1);});
test('BFCache suspends and resumes existing room without recreating its entrance',async()=>{const f=fixture();f.controller.open(f.trigger);await f.resolveCapture();f.win.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:true}));assert.equal(f.experiences[0].paused,true);f.win.dispatchEvent(Object.assign(new Event('pageshow'),{persisted:true}));assert.equal(f.experiences[0].paused,false);assert.equal(f.experiences.length,1);});
test('native cancel delegates to the room context without closing the studio',async()=>{
 const f=fixture();f.controller.open(f.trigger);const echo=await f.resolveCapture();
 let cancelled=0,exited=0;
 f.experiences[0].cancel=()=>{cancelled++;};
 f.experiences[0].exit=()=>{exited++;};
 const event=new Event('cancel',{cancelable:true});f.dialog.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);assert.equal(cancelled,1);assert.equal(exited,0);
 assert.equal(f.dialog.open,true);assert.equal(echo.disposed,false);assert.equal(f.experiences[0].disposed,false);
 assert.equal(f.location.href,'https://helen.test/?room=gallery');
 f.controller.dispose();
});
test('native cancel still exits when an experience has no contextual handler',async()=>{
 const f=fixture();f.controller.open(f.trigger);const echo=await f.resolveCapture();
 const event=new Event('cancel',{cancelable:true});f.dialog.dispatchEvent(event);f.flushHistory();
 assert.equal(event.defaultPrevented,true);assert.equal(f.dialog.open,false);
 assert.equal(echo.disposed,true);assert.equal(f.experiences[0].disposed,true);assert.equal(f.location.href,'https://helen.test/');
});
