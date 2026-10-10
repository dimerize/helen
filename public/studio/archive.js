import { reveal, createDialogMotion } from './studio-motion.js';

(() => {
  'use strict';
  const assets = '/artwork/';
  const sourceItems = [
    {id:'source',image:'thesis-source.webp',title:'Three partial scans',category:'scans',type:'Reconstruction',project:'thesis',relatedTitle:'Thesis project',date:'2026',alt:'Three partial black and white scans of a gym advertisement, assembled across one image.',caption:'A reconstruction from three partial scans of a gym advertisement. Source material from the 2026 thesis project.'},
    {id:'painting',image:'thesis-painting.webp',title:'Gaps in Netted Mesh',category:'material',type:'Painting',project:'thesis',relatedTitle:'Thesis project',date:'2026',alt:'A pale physical painting with a disrupted mesh of dark marks.',caption:'The physical painting Gaps in Netted Mesh, documented for the 2026 thesis project. The same image becomes the surface for the viewer interpretations collected here.'},
    {id:'interpretation-1',image:'interpretation-1.webp',title:'Viewer interpretation 1',category:'interpretations',type:'Drawing',project:'thesis',relatedTitle:'Thesis project',date:'2026',alt:'A viewer’s dark gestural drawing over the mesh painting.',caption:'A viewer’s drawing over an image of Gaps in Netted Mesh. One of eight documented interpretations of the same painting.'},
    {id:'moire',image:'moire.webp',title:'Phone / screen sampling',category:'scans',type:'Sampling',project:'thesis',relatedTitle:'Thesis project',date:'2026',alt:'Screen sampling experiment showing moiré patterns.',caption:'A phone and screen sampling experiment documented in the 2026 thesis project.'},
    {id:'bent-mesh',image:'thesis-dark-grid.webp',title:'Bent Mesh',category:'material',type:'Mockup',project:'thesis',relatedTitle:'Thesis project',date:'2026',alt:'A dark mesh image presented as a Bent Mesh mockup.',caption:'Bent Mesh, a mockup from the 2026 thesis project. This image represents a proposed work.'},
    {id:'elongated',image:'thesis-elongated.webp',title:'Elongated',category:'material',type:'Mockup',project:'thesis',relatedTitle:'Thesis project',date:'2026',alt:'The Elongated image mockup from the thesis project.',caption:'Elongated, a mockup from the 2026 thesis project. This image represents a proposed work.'},
    {id:'simulation',image:'simulation.webp',title:'Rhino experiment',category:'material',type:'Simulation',project:'thesis',relatedTitle:'Thesis project',date:'2026',alt:'A digital form experiment in Rhino.',caption:'A digital experiment in Rhino, documented as part of the 2026 thesis process.'},
    {id:'interpretation-2',image:'interpretation-2.webp',title:'Viewer interpretation 2',category:'interpretations',type:'Drawing',project:'thesis',relatedTitle:'Thesis project',date:'2026',alt:'A second viewer’s drawing over an image of the mesh painting.',caption:'A viewer’s drawing over an image of Gaps in Netted Mesh. One of eight documented interpretations of the same painting.'},
    {id:'train-scan-wide',image:'train-scan-wide.webp',title:'Train warning lettering',category:'scans',type:'Scan',project:'standing',relatedTitle:'Standing Room Only',alt:'Worn yellow train warning lettering captured as a wide scan.',caption:'A scan of train warning lettering and worn material, collected for Standing Room Only V2.'},
    {id:'train-scan',image:'train-scan.webp',title:'Exit / caution signage',category:'scans',type:'Scan',project:'standing',relatedTitle:'Standing Room Only',alt:'Red exit signage and striped caution lettering, distorted in a train scan.',caption:'Train signage, wear, and distortion from Standing Room Only V2.'},
    {id:'train-installation',image:'train-installation.webp',title:'Train projection in the room',category:'material',type:'Installation',project:'standing',relatedTitle:'Standing Room Only',alt:'Standing Room Only V1 train imagery projected onto a wall.',caption:'An installation view of Standing Room Only V1. Train imagery fills a projected window in the room.'},
    {id:'revised-script',image:'script-revised.webp',title:'Revised screenplay page',category:'interpretations',type:'Script',project:'jack',relatedTitle:'Jack.exe & Rose-liet',alt:'A Titanic screenplay page with blacked-out source text and rewritten lines.',caption:'A revised screenplay page from Jack.exe & Rose-liet, with source text blacked out and new lines added.'},
    {id:'8ppi-installation',image:'8ppi-installation.webp',title:'8PPI installation view',category:'material',type:'Installation',project:'8ppi',relatedTitle:'8PPI',alt:'Sixteen 8PPI panels on a black canvas, installed above a screen.',caption:'An installation view of 8PPI: sixteen panels and a screen below.'},
    {id:'8ppi-panels',image:'8ppi-panels.webp',title:'Sixteen painted panels',category:'material',type:'Panels',project:'8ppi',relatedTitle:'8PPI',alt:'Sixteen small 8PPI painted panels arranged on a black canvas.',caption:'The sixteen painted panels of 8PPI, arranged on a black canvas.'}
  ];
  const order=['train-scan-wide','train-scan','painting','source','moire','8ppi-panels','revised-script','bent-mesh','elongated','interpretation-1','train-installation','simulation','interpretation-2','8ppi-installation'];
  const items=order.map(id=>sourceItems.find(item=>item.id===id));
  // x, y and width are percentages of the room. Depth and rotation make each
  // image behave as a loose surface; they do not change its original content.
  const layout=[
    [3,7,37,30,7,-17,-5],[69,2,24,-70,-6,-23,10],
    [40,12,24,-140,9,18,-7],[11,30,17,-60,-6,-13,10],
    [69,31,24,45,14,-20,3],[40,40,20,-20,-10,17,-8],
    [78,46,16,-40,7,-20,7],[3,54,18,30,-8,19,-10],
    [24,64,18,-70,11,-16,9],[46,73,18,10,-6,18,-5],
    [65,67,25,-90,16,-15,6],[3,84,27,-20,-14,20,-4],
    [79,79,15,-20,8,-16,8],[28,86,15,-20,5,14,-9]
  ];
  const mobileLayout=[
    [3,3,74,0,8,-12,-5],[52,10,41,-70,4,-20,8],
    [6,18,45,-45,8,15,-5],[58,27,35,-60,-6,-12,7],
    [4,35,54,20,7,-15,-6],[44,43,48,-65,-7,16,6],
    [8,48,30,-30,5,-15,-7],[53,58,34,-20,8,20,8],
    [6,63,38,-40,6,-16,-8],[43,73,38,-40,6,17,5],
    [2,80,51,-25,8,-15,-6],[53,86,43,-60,-9,15,7],
    [4,89,28,-30,5,15,-7],[76,73,25,-20,7,-15,6]
  ];
  const room=document.getElementById('room');
  const space=document.getElementById('image-space');
  const dialog=document.getElementById('image-dialog');
  const detailMotion=createDialogMotion(dialog,{initialFocus:document.querySelector('.close-dialog')});
  const status=document.getElementById('archive-status');
  const categoryNames={scans:'Scan',material:'Material study',interpretations:'Interpretation'};
  const mobileQuery=matchMedia('(max-width:650px)');
  const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
  let view='room',filter='all',activeId=null;
  let placements=items.map((_,index)=>index);
  let drag=null,lastDragged=null,highestDepth=50,shuffleTimer;
  const offsets=new Map();
  const visibleItems=()=>items.filter(item=>view==='room'||filter==='all'||item.category===filter);
  const bounds=(value,min,max)=>Math.max(min,Math.min(max,value));
  const baseLayout=()=>mobileQuery.matches?mobileLayout:layout;

  function applyPosition(button,index){
    const position=baseLayout()[placements[index]];
    const [x,y,w,z,rx,ry,rz]=position;
    const offset=offsets.get(button.dataset.id)||{x:0,y:0,z};
    Object.entries({'--x':x+'%','--y':y+'%','--w':w+'%','--z':offset.z+'px','--rx':rx+'deg','--ry':ry+'deg','--rz':rz+'deg','--dx':offset.x+'px','--dy':offset.y+'px','--brightness':String(z< -70?.89:1)}).forEach(([key,value])=>button.style.setProperty(key,value));
  }

  function render(){
    space.replaceChildren();
    room.classList.toggle('is-index',view==='index');
    document.querySelector('.room-toolbar').hidden=view!=='room';
    document.querySelector('.index-toolbar').hidden=view!=='index';
    visibleItems().forEach(item=>{
      const index=items.indexOf(item);
      const button=document.createElement('button');
      button.type='button';button.className='fragment';button.dataset.id=item.id;
      button.setAttribute('aria-label',`Inspect ${item.title}, ${item.type.toLowerCase()}`);
      const image=document.createElement('img');
      image.src=assets+item.image;image.alt=item.alt;image.draggable=false;
      image.loading=index<4?'eager':'lazy';image.decoding='async';
      const caption=document.createElement('span');caption.className='fragment-caption';caption.textContent=item.title;
      button.append(image,caption);applyPosition(button,index);
      button.addEventListener('pointerdown',startDrag);
      button.addEventListener('click',event=>{
        if(lastDragged===button){event.preventDefault();lastDragged=null;return;}
        openItem(item.id,button);
      });
      button.addEventListener('keydown',event=>{
        if(view!=='room'||!event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
        event.preventDefault();
        const offset=offsets.get(item.id)||{x:0,y:0,z:baseLayout()[placements[index]][3]};
        offset.x+=event.key==='ArrowRight'?20:event.key==='ArrowLeft'?-20:0;
        offset.y+=event.key==='ArrowDown'?20:event.key==='ArrowUp'?-20:0;
        constrainOffset(button,offset,index);offsets.set(item.id,offset);applyPosition(button,index);
      });
      space.append(button);
    });
    const count=visibleItems().length;
    status.textContent=`${count} ${count===1?'fragment':'fragments'}${view==='room'?' / Every surface opens a closer look.':''}`;
    updateHint();
  }

  function updateHint(){
    document.getElementById('room-hint').textContent=mobileQuery.matches?'Slide images sideways. Tap to look closer.':'Drag to move. Click to look closer.';
  }

  function constrainOffset(button,offset,index){
    const [x,y]=baseLayout()[placements[index]];
    const startX=space.clientWidth*x/100,startY=space.clientHeight*y/100;
    offset.x=bounds(offset.x,-startX+7,space.clientWidth-startX-button.offsetWidth-7);
    offset.y=bounds(offset.y,-startY+7,space.clientHeight-startY-button.offsetHeight-7);
  }

  function startDrag(event){
    if(view!=='room'||event.button!==0||drag)return;
    const button=event.currentTarget,index=items.findIndex(item=>item.id===button.dataset.id);
    const previous=offsets.get(button.dataset.id)||{x:0,y:0,z:baseLayout()[placements[index]][3]};
    lastDragged=null;
    drag={button,index,id:event.pointerId,x:event.clientX,y:event.clientY,start:{...previous},moved:false,touch:event.pointerType==='touch'};
    button.setPointerCapture(event.pointerId);
    button.addEventListener('pointermove',moveDrag);
    button.addEventListener('pointerup',endDrag);
    button.addEventListener('pointercancel',cancelDrag);
  }

  function moveDrag(event){
    if(!drag||event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<7)return;
    if(!drag.moved){
      drag.moved=true;highestDepth=Math.min(115,highestDepth+8);
      drag.button.classList.add('is-dragging');space.classList.add('is-grabbing');
      drag.button.style.zIndex=String(Math.round(highestDepth));
      space.style.setProperty('--room-rx','0deg');space.style.setProperty('--room-ry','0deg');
    }
    const scale=1-highestDepth/(mobileQuery.matches?760:1200);
    const offset={x:drag.start.x+dx*scale,y:drag.start.y+(drag.touch?0:dy*scale),z:highestDepth};
    constrainOffset(drag.button,offset,drag.index);
    offsets.set(drag.button.dataset.id,offset);applyPosition(drag.button,drag.index);
  }

  function releaseDrag(cancelled){
    if(!drag)return;
    const {button,id,moved}=drag;
    if(moved&&!cancelled)lastDragged=button;
    button.classList.remove('is-dragging');space.classList.remove('is-grabbing');
    button.removeEventListener('pointermove',moveDrag);button.removeEventListener('pointerup',endDrag);button.removeEventListener('pointercancel',cancelDrag);
    if(button.hasPointerCapture(id))button.releasePointerCapture(id);
    drag=null;
  }
  function endDrag(){releaseDrag(false);}
  function cancelDrag(){releaseDrag(true);}

  function updatePositions(){
    space.querySelectorAll('.fragment').forEach(button=>applyPosition(button,items.findIndex(item=>item.id===button.dataset.id)));
  }
  document.getElementById('reset').addEventListener('click',()=>{
    placements=items.map((_,index)=>index);offsets.clear();highestDepth=50;
    space.querySelectorAll('.fragment').forEach(button=>button.style.removeProperty('z-index'));
    updatePositions();status.textContent='Original arrangement restored.';
  });
  document.getElementById('shuffle').addEventListener('click',()=>{
    for(let index=placements.length-1;index>0;index--){const target=Math.floor(Math.random()*(index+1));[placements[index],placements[target]]=[placements[target],placements[index]];}
    offsets.clear();highestDepth=50;space.classList.add('is-shuffling');updatePositions();
    clearTimeout(shuffleTimer);shuffleTimer=setTimeout(()=>space.classList.remove('is-shuffling'),1000);
    status.textContent='A new arrangement. Same fragments, different neighbors.';
  });
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    view=button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));
    render();
  }));
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    filter=button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));
    render();
  }));
  space.addEventListener('pointermove',event=>{
    if(view!=='room'||drag||reducedMotion.matches||event.pointerType==='touch')return;
    const rect=space.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width-.5,y=(event.clientY-rect.top)/rect.height-.5;
    space.style.setProperty('--room-rx',`${-y*1.8}deg`);space.style.setProperty('--room-ry',`${x*2.8}deg`);
  });
  space.addEventListener('pointerleave',()=>{if(!drag){space.style.setProperty('--room-rx','0deg');space.style.setProperty('--room-ry','0deg');}});
  mobileQuery.addEventListener('change',()=>{offsets.clear();updatePositions();updateHint();});

  function showItem(id){
    const item=items.find(entry=>entry.id===id);if(!item)return;activeId=id;
    const image=document.getElementById('detail-image');image.src=assets+item.image;image.alt=item.alt;
    document.getElementById('detail-title').textContent=item.title;
    document.getElementById('detail-type').textContent=[...new Set([categoryNames[item.category],item.type,item.date].filter(Boolean))].join(' / ');
    document.getElementById('detail-caption').textContent=item.caption;
    const link=document.getElementById('related-link');link.href=`/project?work=${encodeURIComponent(item.project)}`;link.replaceChildren(document.createTextNode(`View ${item.relatedTitle} `));const arrow=document.createElement('span');arrow.className='ui-icon icon-arrow-up-right';arrow.setAttribute('aria-hidden','true');link.append(arrow);
    const selected=visibleItems();document.getElementById('detail-position').textContent=`${selected.findIndex(entry=>entry.id===id)+1} / ${selected.length}`;
  }
  function openItem(id,trigger){showItem(id);detailMotion.open(trigger);}
  function step(direction){const selected=visibleItems(),index=selected.findIndex(item=>item.id===activeId);showItem(selected[(index+direction+selected.length)%selected.length].id);reveal(document.querySelector('.detail-picture'),{distance:6});}
  document.querySelector('.close-dialog').addEventListener('click',()=>detailMotion.close());
  document.getElementById('previous-image').addEventListener('click',()=>step(-1));
  document.getElementById('next-image').addEventListener('click',()=>step(1));
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();step(-1);}if(event.key==='ArrowRight'){event.preventDefault();step(1);}});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)detailMotion.close();}});
  render();
})();
