// Navigation delegates to the real scene that owns each surface. It never
// transforms a document, captures a page texture, or manufactures a room.
const RECORD_KEY = 'studio:camera-arrival';
const MAX_AGE = 15000;
const AXIS = Object.freeze({archive:-1,home:0,gallery:1});
const DURATION = Object.freeze({depart:1200,arrive:850});

export function spatialRoute(value, base='https://helenzhang.studio/') {
  if (Object.hasOwn(AXIS,value)) return value;
  try {
    const url=new URL(value,base), origin=new URL(base).origin;
    if(url.origin!==origin || !['http:','https:'].includes(url.protocol))return null;
    const path=url.pathname.replace(/\/+$/,'')||'/';
    if(path==='/' || path==='/index.html')return url.searchParams.get('room')==='gallery'?'gallery':'home';
    if(path==='/archive' || path==='/archive.html')return 'archive';
    if(path==='/gallery' || path==='/gallery.html')return 'gallery';
  } catch {}
  return null;
}
function destination(value,base) {
  return new URL(value==='home'?'/':value==='archive'?'/archive':value==='gallery'?'/gallery':value,base).href;
}
export function spatialIntent(options) {
  const {href,currentURL,target='',button=0}=options;
  if(!href || button!==0 || options.metaKey || options.ctrlKey || options.altKey || options.shiftKey || options.defaultPrevented || options.download || options.printHandoff || options.galleryTrigger)return null;
  if((target && target.toLowerCase()!=='_self') || /(?:^|\s)external(?:\s|$)/i.test(options.rel||'') || ['entering','world','leaving'].includes(options.sceneMode))return null;
  const from=spatialRoute(currentURL,currentURL),to=spatialRoute(href,currentURL);
  try {
    const url=new URL(href,currentURL);
    if(!from || !to || from===to || url.hash)return null;
    return {from,to,href:url.href,direction:Math.sign(AXIS[to]-AXIS[from])};
  }catch{return null;}
}
export function readSpatialArrival(raw,{route,origin,now=Date.now()}={}) {
  try {
    const record=JSON.parse(raw);
    if(record?.version!==1 || record.to!==route || !Object.hasOwn(AXIS,record.from) || !Object.hasOwn(AXIS,record.to) || record.from===record.to || record.origin!==origin || !Number.isFinite(record.at) || now<record.at || now-record.at>MAX_AGE)return null;
    if(record.direction!==Math.sign(AXIS[record.to]-AXIS[record.from]))return null;
    return record;
  }catch{return null;}
}

export function createSpatialNavigation({document:doc=document,window:win=window,navigate=href=>win.location.assign(href),now=Date.now}={}) {
  const events=new AbortController();
  let departing=false,arrival=null,leg=null,disposed=false,recovery=null;
  const storage=(method,...args)=>{try{return win.sessionStorage[method](...args);}catch{return null;}};
  const emit=(name,detail)=>doc.dispatchEvent(new win.CustomEvent(name,{detail}));
  const currentURL=()=>win.location.href;
  const motionReduced=()=>doc.body?.dataset.motion==='reduced' || win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clearPhase() {doc.documentElement.removeAttribute('data-camera-travel');}
  function reset() {
    leg?.abort();leg=null;departing=false;arrival=null;
    win.clearTimeout(recovery);recovery=null;clearPhase();
    emit('studio:camera-travel-cancel',{});
  }
  async function cameraLeg(record,phase) {
    const controller=new AbortController();leg=controller;
    const detail={phase,from:record.from,to:record.to,route:phase==='depart'?record.from:record.to,direction:record.direction,duration:DURATION[phase],promise:null,signal:controller.signal};
    emit('studio:camera-travel',detail);
    if(!detail.promise)return false;
    doc.documentElement.dataset.cameraTravel=phase;
    let timeout;
    try {
      await Promise.race([Promise.resolve(detail.promise),new Promise(resolve=>{timeout=win.setTimeout(()=>{controller.abort();resolve();},detail.duration+1500);})]);
      return !controller.signal.aborted;
    }catch{return false;}
    finally {win.clearTimeout(timeout);if(leg===controller)leg=null;}
  }
  async function run(target,callback=navigate,options={}) {
    if(disposed || departing || arrival)return false;
    win.clearTimeout(recovery);recovery=null;
    const href=destination(target,currentURL()),from=options.from||spatialRoute(currentURL(),currentURL()),to=spatialRoute(href,currentURL());
    if(!from || !to || from===to || motionReduced()) {
      storage('removeItem',RECORD_KEY);await callback(href);return true;
    }
    departing=true;
    const record={version:1,from,to,direction:Math.sign(AXIS[to]-AXIS[from]),origin:new URL(currentURL()).origin,at:now()};
    emit('studio:navigation',{phase:'depart',from,to});
    if(!options.skipDeparture)await cameraLeg(record,'depart');
    if(disposed || !departing)return false;
    record.at=now();storage('setItem',RECORD_KEY,JSON.stringify(record));
    // A same-document portal is permitted to mount and announce ready inside
    // this callback. Its arrival uses the same directional record as a new page.
    try {await callback(href);}
    catch(error){storage('removeItem',RECORD_KEY);reset();throw error;}
    departing=false;
    if(!arrival && storage('getItem',RECORD_KEY)===JSON.stringify(record))recovery=win.setTimeout(()=>{storage('removeItem',RECORD_KEY);reset();},2200);
    return true;
  }
  async function ready(route=spatialRoute(currentURL(),currentURL())) {
    if(disposed || arrival)return arrival;
    if(doc.body?.classList?.contains('has-held-print')){storage('removeItem',RECORD_KEY);clearPhase();return false;}
    const raw=storage('getItem',RECORD_KEY),record=readSpatialArrival(raw,{route,origin:new URL(currentURL()).origin,now:now()});
    if(!record)return false;
    storage('removeItem',RECORD_KEY);win.clearTimeout(recovery);recovery=null;
    if(motionReduced()){clearPhase();return false;}
    const work=(async()=>{
      emit('studio:navigation',{phase:'arrive',from:record.from,to:record.to});
      await cameraLeg(record,'arrive');
      clearPhase();emit('studio:navigation',{phase:'settled',from:record.from,to:record.to});
      return true;
    })();
    arrival=work;
    try{return await work;}finally{if(arrival===work)arrival=null;}
  }
  doc.addEventListener('click',event=>{
    const link=event.target?.closest?.('a[href]');if(!link)return;
    const intent=spatialIntent({href:link.getAttribute('href'),currentURL:currentURL(),button:event.button,metaKey:event.metaKey,ctrlKey:event.ctrlKey,altKey:event.altKey,shiftKey:event.shiftKey,defaultPrevented:event.defaultPrevented,target:link.getAttribute('target')||'',rel:link.getAttribute('rel')||'',download:link.hasAttribute('download'),galleryTrigger:link.hasAttribute('data-open-gallery'),printHandoff:Boolean(link.matches?.('.print-archive-link,[data-print-handoff]')),sceneMode:doc.body?.dataset.mode});
    if(!intent || win.studioShell)return;
    event.preventDefault();run(intent.href).catch(()=>{});
  },{signal:events.signal});
  win.addEventListener('pagehide',reset,{signal:events.signal});
  win.addEventListener('resize',reset,{signal:events.signal});
  win.addEventListener('pageshow',event=>{if(event.persisted)reset();},{signal:events.signal});
  return {run,ready,dispose(){if(disposed)return;disposed=true;reset();events.abort();}};
}

let defaultController;
function controller() {return defaultController ||= createSpatialNavigation();}
export function runSpatialTravel(target,navigate,options) {return globalThis.window?.studioShell ? window.studioShell.go(target) : controller().run(target,navigate,options);}
export function arriveSpatialTravel(route) {return controller().ready(route);}
export function notifySpatialReady(route) {return globalThis.window?.studioShell ? Promise.resolve() : controller().ready(route);}

if(typeof window!=='undefined' && typeof document!=='undefined') {
  controller();
  if(spatialRoute(location.href,location.href)==='archive' && !document.querySelector('#experience')) {
    import('./archive-camera-travel.js').then(({installArchiveCameraTravel})=>{
      installArchiveCameraTravel();notifySpatialReady('archive');
    }).catch(()=>{});
  }
}
