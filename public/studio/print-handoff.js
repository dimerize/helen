// A lifted print crosses one native, same-tab navigation. Only its measured
// paper geometry is carried; neither page nor scanner is captured or moved.
const KEY='studio:lifted-print';
const SCANS=new Set(['train-scan','train-scan-wide','train-scan-notice']);
const MAX_AGE=8000;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));

export function framePrint({rect,width,height,matrix}){
  return {left:rect.left+rect.width/2-width/2,top:rect.top+rect.height/2-height/2,width,height,matrix:[...matrix]};
}

export function printHandoffIntent({href,currentURL,button=0,target='',metaKey=false,ctrlKey=false,shiftKey=false,altKey=false,download=false,defaultPrevented=false}){
  if(button!==0||metaKey||ctrlKey||shiftKey||altKey||download||defaultPrevented||(target&&target.toLowerCase()!=='_self'))return null;
  try{
    const current=new URL(currentURL),next=new URL(href,current);
    const id=next.searchParams.get('scan');
    if(next.origin!==current.origin||next.pathname.replace(/\/+$/,'')!=='/archive'||next.hash||!SCANS.has(id))return null;
    return id;
  }catch{return null;}
}

export function validPrintHandoff(record,{url,now=Date.now(),width,height,navigationType='navigate'}={}){
  try{
    if(!record||record.version!==1||!SCANS.has(record.artId)||!finite(record.at)||now<record.at||now-record.at>MAX_AGE)return false;
    if(navigationType==='back_forward'||navigationType==='reload')return false;
    const current=new URL(url),from=new URL(record.from),to=new URL(record.to),image=new URL(record.image.src);
    if(from.origin!==current.origin||to.href!==current.href||image.origin!==current.origin||current.searchParams.get('scan')!==record.artId)return false;
    if(current.pathname.replace(/\/+$/,'')!=='/archive'||!image.pathname.endsWith(`/${record.artId}.jpg`)&&!image.pathname.endsWith(`/${record.artId}.webp`))return false;
    if(!record.viewport||![record.viewport.width,record.viewport.height,width,height].every(finite)||Math.abs(record.viewport.width-width)>2||Math.abs(record.viewport.height-height)>100)return false;
    const frame=record.frame;
    if(!frame||![frame.left,frame.top,frame.width,frame.height].every(finite)||frame.width<80||frame.width>Math.max(width,800)||frame.height<60||frame.height>Math.max(height,1000))return false;
    if(frame.left>width||frame.top>height||frame.left+frame.width<0||frame.top+frame.height<0)return false;
    if(!Array.isArray(frame.matrix)||frame.matrix.length!==4||!frame.matrix.every(value=>finite(value)&&Math.abs(value)<3))return false;
    if(Math.abs(frame.matrix[0]*frame.matrix[3]-frame.matrix[1]*frame.matrix[2])<.1)return false;
    for(const part of [record.image,record.header,record.close,record.footer]){
      if(!part||![part.left,part.top,part.width,part.height].every(finite)||part.width<0||part.height<0||part.width>1000||part.height>1000)return false;
    }
    return true;
  }catch{return false;}
}

export function consumePrintHandoff(options={}){
  try{
    const win=options.window||globalThis.window;
    const storage=options.storage||win.sessionStorage;
    const raw=storage.getItem(KEY);storage.removeItem(KEY);
    if(!raw||raw.length>2500000)return null;
    const record=JSON.parse(raw);
    const validation={url:options.url||win.location.href,now:options.now??Date.now(),width:options.width??win.innerWidth,height:options.height??win.innerHeight,navigationType:options.navigationType??win.performance?.getEntriesByType('navigation')[0]?.type??'navigate'};
    return validPrintHandoff(record,validation)?record:null;
  }catch{return null;}
}

function localBox(element,card,win){
  if(!element)return {left:0,top:0,width:0,height:0};
  let left=0,top=0,current=element;
  while(current&&current!==card){left+=current.offsetLeft;top+=current.offsetTop;current=current.offsetParent;}
  const style=win.getComputedStyle(element);
  return {left,top,width:parseFloat(style.width)||element.offsetWidth,height:parseFloat(style.height)||element.offsetHeight};
}

export function savePrintHandoff(card,artId,options={}){
  try{
    if(!card||!SCANS.has(artId))return false;
    const doc=card.ownerDocument,win=options.window||doc.defaultView;
    const storage=options.storage||win.sessionStorage;storage.removeItem(KEY);
    const link=card.querySelector('.print-archive-link'),image=card.querySelector(':scope > img');
    if(!image||!link||printHandoffIntent({href:link.href,currentURL:win.location.href})!==artId)return false;
    const style=win.getComputedStyle(card),matrix=new win.DOMMatrixReadOnly(style.transform==='none'?'matrix(1,0,0,1,0,0)':style.transform);
    if(!matrix.is2D)return false;
    const rect=card.getBoundingClientRect();
    const frame=framePrint({rect,width:parseFloat(style.width)||card.offsetWidth,height:parseFloat(style.height)||card.offsetHeight,matrix:[matrix.a,matrix.b,matrix.c,matrix.d]});
    const header=card.querySelector('.print-handle > span'),close=card.querySelector('.print-close'),lens=card.querySelector('.paper-lens'),preview=lens?.querySelector('img');
    const record={version:1,at:Date.now(),artId,from:win.location.href,to:link.href,viewport:{width:win.innerWidth,height:win.innerHeight},frame,
      image:{...localBox(image,card,win),src:image.currentSrc||image.src,alt:image.alt||''},
      paper:{background:style.backgroundColor,color:style.color,shadow:style.boxShadow,fontFamily:style.fontFamily,fontSize:style.fontSize},
      header:{...localBox(header,card,win),text:header?.textContent||''},close:localBox(close,card,win),
      footer:{...localBox(link,card,win),text:link.textContent.trim(),fontSize:win.getComputedStyle(link).fontSize},lens:null};
    const carrier=card.querySelector('.carrier-render');
    if(carrier)record.carrier={...localBox(carrier,card,win),src:carrier.toDataURL('image/png')};
    if(lens&&preview?.src&&preview.src.length<360000)record.lens={...localBox(lens,card,win),src:preview.src};
    if(!validPrintHandoff(record,{url:link.href,now:record.at,width:win.innerWidth,height:win.innerHeight}))return false;
    storage.setItem(KEY,JSON.stringify(record));
    // If the visitor clicks during its lift, the source now holds the exact
    // frame being carried instead of continuing away from the saved position.
    for(const animation of card.getAnimations?.()||[])animation.pause();
    link.dataset.printHandoff='';
    return true;
  }catch{return false;}
}

export function installPrintHandoffSource({document:doc=globalThis.document,window:win=globalThis.window}={}){
  const onClick=event=>{
    const link=event.target?.closest?.('.print-archive-link');if(!link)return;
    const id=printHandoffIntent({href:link.href,currentURL:win.location.href,button:event.button,target:link.target,metaKey:event.metaKey,ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey,download:link.hasAttribute('download'),defaultPrevented:event.defaultPrevented});
    if(id)savePrintHandoff(link.closest('.loose-print'),id,{window:win});
    else try{win.sessionStorage.removeItem(KEY);}catch{/* Native navigation is unaffected. */}
  };
  doc.addEventListener('click',onClick,{capture:true});
  return ()=>doc.removeEventListener('click',onClick,{capture:true});
}

export function printScreenBounds(frame){
  const [a,b,c,d]=frame.matrix;
  const width=Math.abs(a)*frame.width+Math.abs(c)*frame.height;
  const height=Math.abs(b)*frame.width+Math.abs(d)*frame.height;
  return {left:frame.left+(frame.width-width)/2,top:frame.top+(frame.height-height)/2,width,height};
}

export function placeHandoffPanel(paper,{width,height}){
  const edge=14,gap=24,desired=Math.min(290,width-edge*2);
  const right=width-(paper.left+paper.width)-gap-edge,left=paper.left-gap-edge;
  const side=right>=240?'right':left>=240?'left':null;
  if(side){
    const panelWidth=Math.min(desired,side==='right'?right:left);
    return {left:side==='right'?paper.left+paper.width+gap:paper.left-gap-panelWidth,top:edge,width:panelWidth,maxHeight:height-edge*2};
  }
  const above=paper.top-gap-edge,below=height-paper.top-paper.height-gap-edge;
  const panelWidth=width-edge*2;
  if(below>=above&&below>=70){
    const top=paper.top+paper.height+gap;
    return {left:edge,top,width:panelWidth,maxHeight:height-top-edge};
  }
  // On a short phone the controls occupy the existing space above the print;
  // the paper itself never gets squeezed or shifted to accommodate the panel.
  return {left:edge,top:edge,width:panelWidth,maxHeight:clamp(above,44,height-edge*2)};
}

function setBox(element,box){
  for(const key of ['left','top','width','height'])element.style[key]=`${box[key]}px`;
}
function icon(doc,name){const span=doc.createElement('span');span.className=`ui-icon icon-${name}`;span.setAttribute('aria-hidden','true');return span;}

export function createHeldPrint(record,{document:doc=globalThis.document,onClose=()=>{},onTable=onClose}={}){
  const paper=doc.createElement('article');paper.className='held-print';paper.setAttribute('aria-label','Selected scan');
  setBox(paper,record.frame);
  paper.style.transform=`matrix(${record.frame.matrix.join(',')},0,0)`;
  paper.style.backgroundColor=record.paper?.background||'#eae5d9';paper.style.color=record.paper?.color||'#232420';paper.style.boxShadow=record.paper?.shadow||'0 18px 60px #0009';
  if(record.paper?.fontFamily)paper.style.fontFamily=record.paper.fontFamily;
  const image=doc.createElement('img');image.className='held-print-image';image.src=record.image.src;image.alt=record.image.alt;image.draggable=false;setBox(image,record.image);paper.append(image);
  if(record.carrier?.src?.startsWith('data:image/png;base64,') && record.carrier.src.length<2000000){
    const carrier=doc.createElement('img');carrier.className='held-carrier';carrier.src=record.carrier.src;carrier.alt='';setBox(carrier,record.carrier);paper.append(carrier);image.style.opacity='0';paper.classList.add('has-carrier');
  }
  const header=doc.createElement('span');header.className='held-print-header';header.textContent=record.header.text;setBox(header,record.header);paper.append(header);
  const close=doc.createElement('button');close.type='button';close.className='held-print-close';close.setAttribute('aria-label','Close image');close.append(icon(doc,'close'));setBox(close,record.close);close.addEventListener('click',onClose);paper.append(close);
  const footer=doc.createElement('button');footer.type='button';footer.className='held-print-footer';footer.append(doc.createTextNode('Find in room'),icon(doc,'arrow-up-right'));setBox(footer,record.footer);footer.style.fontSize=record.footer.fontSize||'12px';footer.addEventListener('click',onTable);paper.append(footer);
  const preview=record.lens;
  if(preview&&[preview.left,preview.top,preview.width,preview.height].every(finite)&&preview.width<200&&preview.height<200){
    try{
      const url=new URL(preview.src,record.from);
      if(url.origin===new URL(record.from).origin||/^data:image\/png;base64,/.test(preview.src)){
        const link=doc.createElement('a');link.href=`/?scan=${encodeURIComponent(record.artId)}&explore=1`;link.className='held-print-lens';link.setAttribute('aria-label','Explore scan');setBox(link,preview);
        const lensImage=doc.createElement('img');lensImage.src=preview.src;lensImage.alt='';link.append(lensImage);paper.append(link);
      }
    }catch{/* The optional lens preview never blocks the actual print. */}
  }
  return {element:paper,closeButton:close,image};
}
