import { createDialogMotion } from './studio-motion.js';
import { archiveItems as items, archiveProjects as projects } from './archive-data.js';
import { createArchiveLayout, clampArchivePosition, archiveDragIntent } from './archive-layout.js';
import { createArchiveHistory } from './archive-history.js';
import { createArchiveInspection } from './archive-inspection.js';

const assets='/artwork/';
const room=document.getElementById('room');
const space=document.getElementById('image-space');
const markers=document.getElementById('project-markers');
const dialog=document.getElementById('image-dialog');
const status=document.getElementById('archive-status');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const coarse=matchMedia('(pointer:coarse)');
const detailMotion=createDialogMotion(dialog,{initialFocus:document.querySelector('.close-dialog'),fallbackFocus:document.getElementById('page-title')});
const categoryNames={scans:'Scan',material:'Material study',interpretations:'Interpretation'};
const scans=new Set(['train-scan','train-scan-wide','train-scan-notice']);
const buttons=new Map();
const positions=new Map();
let view='room', filter='all', arrangement='spread', focusProject=null, activeId=null;
let tableLayout, drag=null, moveMode=false, highIndex=20, suppressClickUntil=0, suppressClickId=null;
let resizeFrame=0, settlingTimer=0, tableWidth=0, lensOn=false, lensPoint={x:.5,y:.5};
let closingToFamily=null;
let inspectionTrigger=null;
const inspection=createArchiveInspection({dialog,motion:detailMotion,show:showItem,change:animateItemChange});
const selectionHistory=createArchiveHistory({window,history,location,items,onSelect:id=>{
  if(!id)activeId=null;
  else closingToFamily=null;
  inspection.select(id,inspectionTrigger||buttons.get(id));
  inspectionTrigger=null;
}});

const selectedItems=()=>items.filter(item=>view==='room'||filter==='all'||item.category===filter);
const setStatus=text=>{status.textContent=text;};

function paintPosition(id){
  const button=buttons.get(id),position=positions.get(id);
  if(!button||!position)return;
  button.style.setProperty('--x',`${position.x}px`);
  button.style.setProperty('--y',`${position.y}px`);
  button.style.setProperty('--angle',`${position.angle||0}deg`);
  button.style.setProperty('--card-width',`${position.width}px`);
  button.style.setProperty('--card-height',`${position.height}px`);
}

function render(){
  releaseDrag(true);
  space.replaceChildren();buttons.clear();
  room.classList.toggle('is-index',view==='index');
  document.querySelector('.room-toolbar').hidden=view!=='room';
  document.querySelector('.index-toolbar').hidden=view!=='index';
  for(const [index,item] of selectedItems().entries()){
    const button=document.createElement('button');
    button.type='button';button.className='fragment';button.dataset.id=item.id;button.dataset.project=item.project;
    button.dataset.spatialFragment='';button.setAttribute('aria-label',`Inspect ${item.title}`);
    button.setAttribute('aria-describedby','move-instructions');
    const image=document.createElement('img');image.src=assets+item.image;image.alt=item.alt;image.draggable=false;
    image.width=item.width;image.height=item.height;image.loading=index<4?'eager':'lazy';image.decoding='async';
    const caption=document.createElement('span');caption.className='fragment-caption';caption.textContent=item.title;
    const turn=document.createElement('span');turn.className='fragment-corner';turn.setAttribute('aria-hidden','true');
    button.append(image,caption,turn);
    button.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')beginDrag(event,button);});
    button.addEventListener('touchstart',event=>{
      if(event.touches.length!==1)return;
      const point=event.touches[0];
      beginDrag({clientX:point.clientX,clientY:point.clientY,button:0,pointerType:'touch',pointerId:point.identifier},button);
    },{passive:true});
    button.addEventListener('click',event=>{
      if(suppressClickId===item.id&&performance.now()<suppressClickUntil){event.preventDefault();return;}
      if(moveMode&&event.detail!==0)return;
      openItem(item.id,button);
    });
    button.addEventListener('keydown',event=>{
      if(view!=='room'||!event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();
      const current=positions.get(item.id),step=event.shiftKey?6:24;
      const x=current.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0);
      const y=current.y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0);
      Object.assign(current,clampArchivePosition({...current,x,y},{width:space.clientWidth,height:tableLayout.height}));
      button.style.zIndex=String(++highIndex);paintPosition(item.id);
      setStatus(`${item.title} moved. Press Enter to inspect it.`);
    });
    buttons.set(item.id,button);space.append(button);
  }
  arrange(false);
  updateHint();
  if(view==='index')setStatus(`${selectedItems().length} images.`);
}

function arrange(animate=true){
  clearTimeout(settlingTimer);
  room.classList.remove('is-settling');
  if(view==='index'){room.style.removeProperty('height');markers.replaceChildren();return;}
  const oldHeight=room.offsetHeight;
  tableWidth=space.clientWidth;
  tableLayout=createArchiveLayout(items,{width:tableWidth,mode:arrangement,focusProject});
  room.dataset.arrangement=arrangement;
  room.classList.toggle('is-settling',animate&&!reduced.matches);
  // Leave the outgoing table's physical space until the fragments settle.
  room.style.height=`${animate?Math.max(oldHeight,tableLayout.height):tableLayout.height}px`;
  positions.clear();
  for(const [id,position] of tableLayout.placements){
    positions.set(id,{...position});
    const button=buttons.get(id);if(!button)continue;
    button.style.setProperty('--settle-delay',animate?`${items.findIndex(item=>item.id===id)*18}ms`:'0ms');
    button.style.zIndex='';button.classList.toggle('is-related',Boolean(focusProject&&itemById(id).project===focusProject));
    paintPosition(id);
  }
  markers.replaceChildren();
  for(const section of tableLayout.sections){
    const project=projects[section.id];
    const label=document.createElement('button');label.type='button';label.className='project-marker';
    label.style.left=`${section.x}px`;label.style.top=`${section.y}px`;
    label.setAttribute('aria-label',`Bring ${project.title} to the front of the table`);
    const title=document.createElement('span');title.textContent=project.title;
    label.append(title);label.addEventListener('click',()=>gatherProject(section.id));markers.append(label);
  }
  document.getElementById('spread').setAttribute('aria-pressed',String(arrangement==='spread'));
  document.getElementById('gather').setAttribute('aria-pressed',String(arrangement==='gather'));
  settlingTimer=setTimeout(()=>{
    room.classList.remove('is-settling');room.style.height=`${tableLayout.height}px`;
    for(const button of buttons.values())button.style.setProperty('--settle-delay','0ms');
  },animate&&!reduced.matches?1150:0);
}

function itemById(id){return items.find(item=>item.id===id);}
function updateHint(){
  document.getElementById('room-hint').textContent=coarse.matches
    ?moveMode?'Drag images. Turn Move images off to scroll.':'Hold to move. Tap to inspect.'
    :'Drag to move. Open to inspect.';
}
function gatherProject(project){
  arrangement='gather';focusProject=project;
  if(view!=='room')setView('room');else arrange();
  setStatus(`${projects[project].title} moved to the top.`);
  room.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
}

function beginDrag(event,button){
  if(view!=='room'||event.button!==0||drag)return;
  const position=positions.get(button.dataset.id);
  drag={button,id:button.dataset.id,pointerId:event.pointerId,pointerType:event.pointerType,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,start:{...position},started:performance.now(),active:false,scroll:window.scrollY,timer:0};
  if(event.pointerType==='touch'&&!moveMode){
    drag.timer=setTimeout(()=>{if(drag)activateDrag();},330);
  }else if(moveMode){activateDrag();}
  if(event.pointerType!=='touch')button.setPointerCapture(event.pointerId);
}
function activateDrag(){
  if(!drag||drag.active)return;
  clearTimeout(drag.timer);drag.active=true;
  drag.button.classList.add('is-dragging');drag.button.style.zIndex=String(++highIndex);
  room.classList.add('is-grabbing');
  drag.button.setAttribute('aria-label',`Moving ${itemById(drag.id).title}`);
}
function moveDrag(point,event){
  if(!drag)return;
  const dx=point.clientX-drag.startX,dy=point.clientY-drag.startY;
  if(!drag.active){
    const intent=archiveDragIntent({pointerType:drag.pointerType,elapsed:performance.now()-drag.started,dx,dy,moveMode});
    if(intent==='scroll'){releaseDrag(true);return;}
    if(intent==='wait')return;
    activateDrag();
  }
  if(event.cancelable)event.preventDefault();
  const previous=positions.get(drag.id);
  const offset=clampArchivePosition({...drag.start,x:drag.start.x+dx,y:drag.start.y+dy+window.scrollY-drag.scroll},{width:space.clientWidth,height:tableLayout.height});
  Object.assign(previous,offset);
  if(!reduced.matches)previous.angle=drag.start.angle+Math.max(-4,Math.min(4,(point.clientX-drag.lastX)*.24));
  drag.lastX=point.clientX;drag.lastY=point.clientY;
  paintPosition(drag.id);
}
function releaseDrag(cancelled=false){
  if(!drag)return;
  const current=drag;drag=null;clearTimeout(current.timer);
  if(current.active){
    suppressClickId=current.id;suppressClickUntil=performance.now()+500;
    const p=positions.get(current.id);
    if(p){p.angle=arrangement==='gather'?0:current.start.angle;paintPosition(current.id);}
    if(!cancelled)setStatus(`${itemById(current.id).title} placed on the table.`);
  }
  current.button.classList.remove('is-dragging');room.classList.remove('is-grabbing');
  current.button.setAttribute('aria-label',`Inspect ${itemById(current.id).title}`);
  if(current.pointerType!=='touch'&&current.button.hasPointerCapture(current.pointerId))current.button.releasePointerCapture(current.pointerId);
}
document.addEventListener('pointermove',event=>{if(drag&&drag.pointerType!=='touch'&&drag.pointerId===event.pointerId)moveDrag(event,event);});
document.addEventListener('pointerup',event=>{if(drag&&drag.pointerType!=='touch'&&drag.pointerId===event.pointerId)releaseDrag();});
document.addEventListener('pointercancel',event=>{if(drag&&drag.pointerType!=='touch'&&drag.pointerId===event.pointerId)releaseDrag(true);});
document.addEventListener('touchmove',event=>{
  if(!drag||drag.pointerType!=='touch')return;
  if(event.touches.length!==1){releaseDrag(true);return;}
  const point=[...event.touches].find(touch=>touch.identifier===drag.pointerId);
  if(point)moveDrag(point,event);
},{passive:false});
document.addEventListener('touchend',()=>{if(drag?.pointerType==='touch')releaseDrag();});
document.addEventListener('touchcancel',()=>{if(drag?.pointerType==='touch')releaseDrag(true);});
window.addEventListener('blur',()=>releaseDrag(true));

function setView(next){
  view=next;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  render();
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  filter=button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));
  render();
}));
document.getElementById('spread').addEventListener('click',()=>{
  releaseDrag(true);arrangement='spread';focusProject=null;arrange();setStatus('Spread arrangement restored.');
});
document.getElementById('gather').addEventListener('click',()=>{
  releaseDrag(true);arrangement='gather';focusProject=null;arrange();setStatus('Grouped by project.');
});
document.getElementById('move-images').addEventListener('click',event=>{
  releaseDrag(true);moveMode=!moveMode;room.classList.toggle('move-mode',moveMode);
  event.currentTarget.setAttribute('aria-pressed',String(moveMode));updateHint();
});

function showItem(id){
  const item=itemById(id);if(!item)return;
  activeId=id;setLens(false);
  const image=document.getElementById('detail-image');image.src=assets+item.image;image.alt=item.alt;
  image.width=item.width;image.height=item.height;
  document.getElementById('detail-title').textContent=item.title;
  document.getElementById('detail-type').textContent=[...new Set([categoryNames[item.category],item.type,item.date].filter(Boolean))].join(' / ');
  document.getElementById('detail-caption').textContent=item.caption;
  const link=document.getElementById('related-link');link.href=`/project?work=${encodeURIComponent(item.project)}`;
  link.replaceChildren(document.createTextNode(`View ${item.relatedTitle} `));
  const arrow=document.createElement('span');arrow.className='ui-icon icon-arrow-up-right';arrow.setAttribute('aria-hidden','true');link.append(arrow);
  const explore=document.getElementById('explore-scan');explore.hidden=!scans.has(id);
  explore.href=`/?scan=${encodeURIComponent(id)}&explore=1`;
  const selected=items;
  document.getElementById('detail-position').textContent=`${selected.findIndex(entry=>entry.id===id)+1} / ${selected.length}`;
  const related=document.getElementById('related-images');related.replaceChildren();
  for(const sibling of items.filter(entry=>entry.project===item.project&&entry.id!==id)){
    const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Inspect ${sibling.title}`);button.title=sibling.title;
    const thumbnail=document.createElement('img');thumbnail.src=assets+sibling.image;thumbnail.alt='';thumbnail.loading='lazy';
    button.append(thumbnail);button.addEventListener('click',event=>{
      const keyboardActivation=event.detail===0;
      openItem(sibling.id);
      // The selected thumbnail is replaced by the new image's connections.
      // Keep keyboard focus inside the inspector without moving pointer focus.
      if(keyboardActivation&&activeId===sibling.id){
        const heading=document.getElementById('detail-title');
        heading.tabIndex=-1;heading.focus({preventScroll:true});
      }
    });related.append(button);
  }
  document.querySelector('.detail-connections').hidden=!related.children.length;
  document.getElementById('connections-label').textContent=`Also in ${item.relatedTitle}`;
  document.getElementById('gather-family').dataset.project=item.project;
  for(const [fragmentId,button] of buttons)button.classList.toggle('is-inspected',fragmentId===id);
}
function openItem(id,trigger=buttons.get(id)){
  inspectionTrigger=trigger;selectionHistory.open(id);
}
function animateItemChange(){
  if(!reduced.matches){
    document.getElementById('detail-image').animate([{transform:'translateX(12px) rotate(.8deg)',opacity:.4},{transform:'none',opacity:1}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});
  }
}
function requestClose(){
  selectionHistory.close();
}
function step(direction){
  const selected=items,index=selected.findIndex(item=>item.id===activeId);
  openItem(selected[(index+direction+selected.length)%selected.length].id);
}
document.querySelector('.close-dialog').addEventListener('click',requestClose);
document.getElementById('previous-image').addEventListener('click',()=>step(-1));
document.getElementById('next-image').addEventListener('click',()=>step(1));
dialog.addEventListener('keydown',event=>{
  if(lensOn&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
    event.preventDefault();
    lensPoint.x=Math.max(0,Math.min(1,lensPoint.x+(event.key==='ArrowRight'?.07:event.key==='ArrowLeft'?-.07:0)));
    lensPoint.y=Math.max(0,Math.min(1,lensPoint.y+(event.key==='ArrowDown'?.07:event.key==='ArrowUp'?-.07:0)));
    placeLens();return;
  }
  if(event.key==='ArrowLeft'){event.preventDefault();step(-1);}
  if(event.key==='ArrowRight'){event.preventDefault();step(1);}
});
dialog.addEventListener('cancel',requestClose);
dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)requestClose();
});
dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  setLens(false);
  if(closingToFamily){const project=closingToFamily;closingToFamily=null;gatherProject(project);}
  for(const button of buttons.values())button.classList.remove('is-inspected');
});
document.getElementById('gather-family').addEventListener('click',event=>{
  closingToFamily=event.currentTarget.dataset.project;requestClose();
});

// The loupe samples the original image, preserving its pixel texture and edges.
const picture=document.querySelector('.detail-picture');
const lens=document.getElementById('detail-lens');
const detailImage=document.getElementById('detail-image');
function setLens(on){
  lensOn=on;picture.classList.toggle('is-magnifying',on);
  document.getElementById('magnify-image').setAttribute('aria-pressed',String(on));
  document.getElementById('magnify-hint').hidden=!on;
  document.getElementById('magnify-hint').textContent=coarse.matches?'Move across the image to look closer.':'Move across the image, or use arrow keys.';
  if(on){lensPoint={x:.5,y:.5};placeLens();}
}
function placeLens(){
  if(!lensOn)return;
  const box=picture.getBoundingClientRect(),image=detailImage.getBoundingClientRect();
  const size=Math.min(coarse.matches?150:190,box.width*.5),zoom=2.7;
  const px=image.left-box.left+lensPoint.x*image.width,py=image.top-box.top+lensPoint.y*image.height;
  lens.style.width=`${size}px`;lens.style.height=`${size}px`;
  lens.style.left=`${Math.max(4,Math.min(box.width-size-4,px-size/2))}px`;
  lens.style.top=`${Math.max(4,Math.min(box.height-size-4,py-size/2))}px`;
  lens.style.backgroundImage=`url("${detailImage.src}")`;
  lens.style.backgroundSize=`${image.width*zoom}px ${image.height*zoom}px`;
  lens.style.backgroundPosition=`${size/2-lensPoint.x*image.width*zoom}px ${size/2-lensPoint.y*image.height*zoom}px`;
}
function moveLens(event){
  if(!lensOn||event.target.closest('button'))return;
  const box=detailImage.getBoundingClientRect();
  lensPoint={x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))};
  placeLens();
}
document.getElementById('magnify-image').addEventListener('click',()=>setLens(!lensOn));
picture.addEventListener('pointermove',moveLens);picture.addEventListener('pointerdown',moveLens);
detailImage.addEventListener('load',placeLens);
window.addEventListener('resize',()=>{
  cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{
    // Mobile browser chrome changes the viewport height during scrolling; it
    // must never reset the visitor's arrangement or cancel their active drag.
    if(view==='room'&&Math.abs(space.clientWidth-tableWidth)>.5){releaseDrag(true);arrange(false);}
    placeLens();
  });
});
coarse.addEventListener('change',updateHint);
document.addEventListener('studio:navigation',event=>{if(event.detail?.phase==='depart')releaseDrag(true);});
render();
requestAnimationFrame(()=>selectionHistory.start());
