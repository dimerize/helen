import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpatialNavigation,spatialRoute,spatialIntent,readSpatialArrival} from '../public/studio/spatial-navigation.js';
const base='https://helenzhang.studio/';
function browser(href=base) {
  const document=new EventTarget(),window=new EventTarget(),records=new Map(),timers=new Map(),navigation=[];
  let timerID=0;
  Object.assign(document,{body:{dataset:{}},documentElement:{dataset:{},removeAttribute(){delete this.dataset.cameraTravel;}}});
  Object.assign(window,{location:{href,assign:url=>navigation.push(url)},CustomEvent,matchMedia:()=>({matches:false}),sessionStorage:{getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)},setTimeout:callback=>{const id=++timerID;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id)});
  return {document,window,records,timers,navigation};
}
function click(env,href,extra={}) {
  const link={getAttribute:key=>key==='href'?href:null,hasAttribute:key=>Boolean(extra[key]),matches:()=>Boolean(extra.printHandoff)};
  const event=new Event('click',{cancelable:true});
  Object.defineProperties(event,{button:{value:0},target:{value:{closest:()=>link}},...Object.fromEntries(Object.entries(extra).map(([key,value])=>[key,{value}]))});
  env.document.dispatchEvent(event);return event;
}

test('all six route pairs retain direction on a consistent Archive–Home–Gallery axis',()=>{
  assert.equal(spatialRoute('/?room=gallery',base),'gallery');
  assert.equal(spatialRoute('/gallery/',base),'gallery');
  for(const [from,to,direction] of [['home','archive',-1],['archive','home',1],['home','gallery',1],['gallery','home',-1],['archive','gallery',1],['gallery','archive',-1]]) {
    const fromURL=from==='home'?base:base+from,toURL=to==='home'?base:base+to;
    assert.equal(spatialIntent({currentURL:fromURL,href:toURL}).direction,direction);
  }
});

test('modified links, print handoffs, gallery triggers and bug mode remain with their existing owners',()=>{
  for(const change of [{metaKey:true},{ctrlKey:true},{button:1},{target:'_blank'},{href:'#item'},{href:'https://elsewhere.test/archive'},{printHandoff:true},{galleryTrigger:true},{download:true},{sceneMode:'world'},{sceneMode:'entering'},{sceneMode:'leaving'}])assert.equal(spatialIntent({currentURL:base,href:'/archive',...change}),null);
  const env=browser(),controller=createSpatialNavigation(env);
  assert.equal(click(env,'/archive',{printHandoff:true}).defaultPrevented,false);
  controller.dispose();
});

test('source scene finishes its actual camera promise before native navigation',async()=>{
  const env=browser(),controller=createSpatialNavigation(env);let finish,detail;
  env.document.addEventListener('studio:camera-travel',event=>{detail=event.detail;detail.promise=new Promise(resolve=>finish=resolve);});
  const running=controller.run('/archive?view=index');
  assert.equal(detail.route,'home');assert.equal(detail.phase,'depart');assert.equal(detail.duration,1200);assert.equal(detail.direction,-1);
  assert.deepEqual(env.navigation,[]);
  finish();await running;
  assert.deepEqual(env.navigation,[base+'archive?view=index']);
  const record=JSON.parse([...env.records.values()][0]);assert.equal(record.to,'archive');assert.equal(record.direction,-1);
  controller.dispose();
});

test('same-document gallery ready can consume arrival inside the navigation callback',async()=>{
  const env=browser(),controller=createSpatialNavigation(env),legs=[];
  env.document.addEventListener('studio:camera-travel',event=>{legs.push({...event.detail});event.detail.promise=Promise.resolve();});
  await controller.run('gallery',async()=>{
    assert.equal(env.records.size,1,'arrival is stored before portal.open mounts the gallery');
    env.window.location.href=base+'?room=gallery';await controller.ready('gallery');
  });
  assert.deepEqual(legs.map(leg=>[leg.phase,leg.route,leg.direction,leg.duration]),[['depart','home',1,1200],['arrive','gallery',1,850]]);
  assert.equal(env.records.size,0);assert.equal(env.timers.size,0,'no stale recovery abort after a completed portal arrival');
  controller.dispose();
});

test('physical gallery exit can skip an extra departure while preserving Home arrival',async()=>{
  const env=browser(base+'?room=gallery'),controller=createSpatialNavigation(env),phases=[];
  env.document.addEventListener('studio:camera-travel',event=>{phases.push(event.detail.phase);event.detail.promise=Promise.resolve();});
  await controller.run('/',async()=>{await controller.ready('home');},{skipDeparture:true});
  assert.deepEqual(phases,['arrive']);assert.equal(env.records.size,0);controller.dispose();
});

test('OS or in-site reduced motion bypasses both camera legs and navigation delay',async()=>{
  for(const setting of ['os','site']) {
    const env=browser();if(setting==='os')env.window.matchMedia=()=>({matches:true});else env.document.body.dataset.motion='reduced';
    const controller=createSpatialNavigation(env);let legs=0;
    env.document.addEventListener('studio:camera-travel',()=>legs++);
    await controller.run('archive');assert.equal(legs,0);assert.equal(env.records.size,0);assert.deepEqual(env.navigation,[base+'archive']);controller.dispose();
  }
});

test('arrival records cannot apply to a different scene, origin or stale visit',()=>{
  const record={version:1,from:'home',to:'archive',direction:-1,origin:'https://helenzhang.studio',at:1000};
  assert.deepEqual(readSpatialArrival(JSON.stringify(record),{route:'archive',origin:record.origin,now:1500}),record);
  for(const options of [{route:'home',origin:record.origin,now:1500},{route:'archive',origin:'https://elsewhere.test',now:1500},{route:'archive',origin:record.origin,now:20000}])assert.equal(readSpatialArrival(JSON.stringify(record),options),null);
});

test('pagehide aborts active camera work without following a stale navigation completion',async()=>{
  const env=browser(),controller=createSpatialNavigation(env);let finish,signal;
  env.document.addEventListener('studio:camera-travel',event=>{signal=event.detail.signal;event.detail.promise=new Promise(resolve=>finish=resolve);});
  const running=controller.run('archive');env.window.dispatchEvent(new Event('pagehide'));assert.equal(signal.aborted,true);
  finish();await running;assert.deepEqual(env.navigation,[]);assert.equal(env.records.size,0);controller.dispose();
});

test('missing scene hooks keep native routing usable and failed navigation restores the scene',async()=>{
  const env=browser(),controller=createSpatialNavigation(env);await controller.run('archive');assert.deepEqual(env.navigation,[base+'archive']);
  let cancelled=0;env.document.addEventListener('studio:camera-travel-cancel',()=>cancelled++);
  await assert.rejects(controller.run('gallery',()=>{throw Error('navigation failed');}),/navigation failed/);
  assert.equal(env.records.size,0);assert.ok(cancelled>0);controller.dispose();
});

test('a second route cannot interrupt an in-progress destination arrival',async()=>{
  const env=browser(),controller=createSpatialNavigation(env);let finish;
  env.records.set('studio:camera-arrival',JSON.stringify({version:1,from:'home',to:'archive',direction:-1,origin:'https://helenzhang.studio',at:Date.now()}));
  env.window.location.href=base+'archive';
  env.document.addEventListener('studio:camera-travel',event=>{event.detail.promise=new Promise(resolve=>finish=resolve);});
  const arriving=controller.ready('archive');
  assert.equal(await controller.run('gallery'),false);assert.deepEqual(env.navigation,[]);
  finish();await arriving;controller.dispose();
});

test('resizing aborts camera travel and prevents a queued route from firing later',async()=>{
  const env=browser(),controller=createSpatialNavigation(env);let finish,signal;
  env.document.addEventListener('studio:camera-travel',event=>{signal=event.detail.signal;event.detail.promise=new Promise(resolve=>finish=resolve);});
  const running=controller.run('archive');env.window.dispatchEvent(new Event('resize'));assert.equal(signal.aborted,true);
  finish();await running;assert.deepEqual(env.navigation,[]);assert.equal(env.records.size,0);controller.dispose();
});

test('held-print inspection consumes stale camera arrival without moving its fixed image',async()=>{
  const env=browser(base+'archive?scan=train-scan'),controller=createSpatialNavigation(env);let motion=0;
  env.document.body.classList={contains:className=>className==='has-held-print'};
  env.records.set('studio:camera-arrival',JSON.stringify({version:1,from:'home',to:'archive',direction:-1,origin:'https://helenzhang.studio',at:Date.now()}));
  env.document.addEventListener('studio:camera-travel',()=>motion++);
  assert.equal(await controller.ready('archive'),false);assert.equal(motion,0);assert.equal(env.records.size,0);controller.dispose();
});
