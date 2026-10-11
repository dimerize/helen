const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Work in table pixels so a dragged image and its shadow always share a plane.
// The source aspect ratio is never cropped or changed by an arrangement.
export function createArchiveLayout(items, {width, mode='spread', focusProject=null}={}) {
  width=Math.max(250,width||1000);
  const mobile=width<620, padding=mobile?16:30, gap=mobile?22:38;
  const placements=new Map(), sections=[];
  let bottom=0;
  if(mode==='gather'){
    const projects=[...new Set(items.map(item=>item.project))];
    if(focusProject && projects.includes(focusProject))projects.unshift(...projects.splice(projects.indexOf(focusProject),1));
    const columns=width<620?2:width<950?3:4;
    const cell=(width-padding*2-gap*(columns-1))/columns;
    let y=60;
    for(const project of projects){
      const group=items.filter(item=>item.project===project);
      sections.push({id:project,x:padding,y:y-44});
      let rowHeight=0;
      group.forEach((item,index)=>{
        if(index && index%columns===0){y+=rowHeight+54;rowHeight=0;}
        const aspect=item.aspect||1;
        const cardHeight=Math.min(cell/aspect,mobile?180:250);
        const cardWidth=cardHeight*aspect;
        placements.set(item.id,{x:padding+(index%columns)*(cell+gap),y,width:cardWidth,height:cardHeight,angle:0,depth:0});
        rowHeight=Math.max(rowHeight,cardHeight);
      });
      y+=rowHeight+110;
    }
    bottom=y-45;
  }else{
    // A wide scan opens the table; the remaining surfaces fall into loose lanes.
    // No perspective-dependent hit areas or hidden back-facing images.
    const lanes=mobile?2:3;
    const lane=(width-padding*2)/lanes;
    const levels=Array(lanes).fill(mobile?36:48);
    items.forEach((item,index)=>{
      const aspect=item.aspect||1;
      if(index===0 && aspect>2){
        const cardWidth=(width-padding*2)*(mobile?.86:.61);
        const cardHeight=cardWidth/aspect;
        const y=mobile?40:62;
        placements.set(item.id,{x:padding+(mobile?4:14),y,width:cardWidth,height:cardHeight,angle:-7,depth:10});
        levels[0]=y+cardHeight+(mobile?70:100);
        if(!mobile)levels[1]=y+cardHeight+140;
        else levels[1]=y+cardHeight+20;
        bottom=y+cardHeight;
        return;
      }
      const laneIndex=levels.indexOf(Math.min(...levels));
      const angles=[-4,7,-6,3,-8,5,-3,6,-4,8,-5];
      const cardWidth=lane*(mobile?.79:.8)+(aspect>1.7?lane*.08:0);
      const cardHeight=Math.min(cardWidth/aspect,mobile?260:390);
      const actualWidth=cardHeight*aspect;
      const x=padding+laneIndex*lane+(lane-actualWidth)*.5;
      const y=levels[laneIndex]+(index%3)*13;
      placements.set(item.id,{x,y,width:actualWidth,height:cardHeight,angle:angles[index%angles.length],depth:(index%4)*3});
      levels[laneIndex]=y+cardHeight+(mobile?58:105);
      bottom=Math.max(bottom,y+cardHeight);
    });
    bottom+=mobile?75:100;
  }
  return {placements,sections,height:Math.ceil(bottom)};
}

export function clampArchivePosition({x,y,width,height},bounds){
  return {x:clamp(x,12,Math.max(12,bounds.width-width-12)),y:clamp(y,12,Math.max(12,bounds.height-height-12))};
}

export function archiveDragIntent({pointerType='mouse',elapsed=0,dx=0,dy=0,moveMode=false}){
  if(Math.hypot(dx,dy)<7)return 'wait';
  if(pointerType==='touch' && !moveMode && elapsed<330)return 'scroll';
  return 'drag';
}

export function archiveSelection(href,items){
  const id=new URL(href,'https://archive.invalid').searchParams.get('scan');
  return items.some(item=>item.id===id)?id:null;
}

export function archiveSelectionURL(href,id){
  const url=new URL(href,'https://archive.invalid');
  if(id)url.searchParams.set('scan',id);
  else url.searchParams.delete('scan');
  return url.pathname+url.search+url.hash;
}
