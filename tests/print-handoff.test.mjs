import test from 'node:test';
import assert from 'node:assert/strict';
const handoff=await import('../public/studio/print-handoff.js').catch(()=>({}));

const record=()=>({version:1,at:1000,artId:'train-scan',from:'https://helen.test/',to:'https://helen.test/archive?scan=train-scan',viewport:{width:1280,height:720},frame:{left:650,top:180,width:290,height:360,matrix:[.994,-.105,.105,.994]},image:{src:'https://helen.test/studio/scan-world/assets/train-scan.jpg',alt:'Exit and caution signage',left:12,top:54,width:266,height:248},paper:{background:'#eae5d9',color:'#232420',shadow:'none'},header:{text:'',left:12,top:12,width:218,height:32},close:{left:242,top:12,width:36,height:32},footer:{text:'View in archive',left:12,top:314,width:266,height:34},lens:null});

test('print framing preserves the exact screen center, size and rotation without translating to the destination layout',()=>{
  assert.equal(typeof handoff.framePrint,'function');
  const frame=handoff.framePrint({rect:{left:632,top:166,width:326,height:388},width:290,height:360,matrix:[.994,-.105,.105,.994]});
  assert.equal(frame.left+frame.width/2,632+326/2);
  assert.equal(frame.top+frame.height/2,166+388/2);
  assert.equal(frame.width,290);assert.equal(frame.height,360);
  assert.deepEqual(frame.matrix,[.994,-.105,.105,.994]);
});

test('handoff records match the exact selected scan, origin, viewport and fresh forward navigation',()=>{
  assert.equal(typeof handoff.validPrintHandoff,'function');
  const options={url:'https://helen.test/archive?scan=train-scan',now:1300,width:1280,height:720,navigationType:'navigate'};
  assert.ok(handoff.validPrintHandoff(record(),options));
  for(const patch of [{url:'https://helen.test/archive?scan=train-scan-wide'},{url:'https://other.test/archive?scan=train-scan'},{now:9001},{now:900},{navigationType:'back_forward'},{navigationType:'reload'},{width:390,height:844}])assert.equal(handoff.validPrintHandoff(record(),{...options,...patch}),false);
  const malformed=record();malformed.frame.width=Infinity;
  assert.equal(handoff.validPrintHandoff(malformed,options),false);
});

test('a consumed handoff cannot replay, including invalid or expired records',()=>{
  assert.equal(typeof handoff.consumePrintHandoff,'function');
  let raw=JSON.stringify(record());
  const storage={getItem(){return raw;},removeItem(){raw=null;}};
  const options={storage,url:'https://helen.test/archive?scan=train-scan',now:1300,width:1280,height:720,navigationType:'navigate'};
  assert.equal(handoff.consumePrintHandoff(options)?.artId,'train-scan');
  assert.equal(handoff.consumePrintHandoff(options),null);
  raw='{broken';assert.equal(handoff.consumePrintHandoff(options),null);assert.equal(raw,null);
  raw=JSON.stringify(record());assert.equal(handoff.consumePrintHandoff({...options,now:20000}),null);assert.equal(raw,null);
});

test('ordinary same-tab print clicks qualify; modifier, download, alternate-target and unrelated links do not',()=>{
  assert.equal(typeof handoff.printHandoffIntent,'function');
  const base={href:'https://helen.test/archive?scan=train-scan',currentURL:'https://helen.test/',button:0};
  assert.equal(handoff.printHandoffIntent(base),'train-scan');
  for(const patch of [{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true},{button:1},{target:'_blank'},{download:true},{defaultPrevented:true},{href:'/archive?scan=not-an-artwork'},{href:'https://other.test/archive?scan=train-scan'}])assert.equal(handoff.printHandoffIntent({...base,...patch}),null);
});

test('inspector controls use available space without changing the held print frame',()=>{
  assert.equal(typeof handoff.placeHandoffPanel,'function');
  for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:390,height:568},{width:844,height:390}]){
    const paper={left:viewport.width*.15,top:viewport.height*.25,width:Math.min(310,viewport.width*.75),height:Math.min(370,viewport.height*.6)};
    const before={...paper};const panel=handoff.placeHandoffPanel(paper,viewport);
    assert.deepEqual(paper,before);
    assert.ok(panel.left>=10&&panel.top>=10);
    assert.ok(panel.left+panel.width<=viewport.width-9);
    assert.ok(panel.top+panel.maxHeight<=viewport.height-9);
    assert.ok(panel.width>=180&&panel.maxHeight>=44);
  }
});
