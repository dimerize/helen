import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const inspectionModule=await import('../public/studio/archive-inspection.js').catch(()=>({}));
const motionSource=readFileSync(new URL('../public/studio/studio-motion.js',import.meta.url),'utf8')
  .replace(/^import .*\n/,'').replaceAll('export function','function');

// Exercise the actual shared dialog lifecycle, controlling only the browser's
// animation completions so Forward can occur during the pending exit.
function fixture(){
  assert.equal(typeof inspectionModule.createArchiveInspection,'function');
  const completions=[],queuedEvents=[];
  const style=()=>({opacity:'',transform:'',overflow:'',setProperty(key,value){this[key]=value;},removeProperty(key){this[key]='';}});
  const element=()=>({style:style(),isConnected:true,focus(){}});
  const trigger=element(),closeButton=element(),body=element(),media=Object.assign(new EventTarget(),{matches:false});
  const dialog=Object.assign(new EventTarget(),element(),{
    open:false,showModal(){this.open=true;},close(){this.open=false;queuedEvents.push(()=>this.dispatchEvent(new Event('close')));},
  });
  const context=vm.createContext({
    matchMedia:()=>media,document:{body,activeElement:trigger},
    getComputedStyle:target=>({opacity:target.style.opacity||'1',transform:target.style.transform||'none'}),
    animate(target,frames,options){
      for(const[key,values]of Object.entries(frames))target.style[key]=values[0];
      const job={cancel(){},finished:new Promise(()=>{}),finish:options.onComplete};completions.push(job);return job;
    },
  });
  vm.runInContext(`${motionSource}\nglobalThis.makeMotion=createDialogMotion;`,context);
  const motion=context.makeMotion(dialog,{initialFocus:closeButton});
  const shown=[],changed=[];
  const inspector=inspectionModule.createArchiveInspection({dialog,motion,show:id=>shown.push(id),change:id=>changed.push(id)});
  return {inspector,dialog,body,trigger,completions,shown,changed,flush(){while(queuedEvents.length)queuedEvents.shift()();}};
}

test('Forward during the archive exit reopens the selected scan and invalidates its stale close',()=>{
  const f=fixture();
  f.inspector.select('train-scan',f.trigger);
  f.completions.at(-1).finish();
  f.inspector.select(null); // Back
  const staleExit=f.completions.at(-1);
  assert.equal(f.dialog.open,true,'native dialog remains open until animated exit ends');
  f.inspector.select('train-scan'); // Forward before that exit ends
  staleExit.finish();f.flush();
  assert.equal(f.dialog.open,true,'the old exit must not close the restored selection');
  assert.equal(f.body.style.overflow,'hidden','the reopened modal retains scroll lock');
  f.completions.at(-1).finish();
  assert.equal(f.dialog.style.opacity,'');
  assert.equal(f.shown.at(-1),'train-scan');
});

test('related-image navigation changes content without restarting the open dialog animation',()=>{
  const f=fixture();f.inspector.select('train-scan',f.trigger);
  f.completions.at(-1).finish();const jobs=f.completions.length;
  f.inspector.select('painting');
  assert.equal(f.completions.length,jobs);
  assert.deepEqual(f.changed,['painting']);
  assert.deepEqual(f.shown,['train-scan','painting']);
});
