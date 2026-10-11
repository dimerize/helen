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
    // Hanging lanes reserve the entire rotated frame, not just its photograph.
    const lanes=width<420?1:width<900?2:3, lane=(width-padding*2)/lanes;
    const levels=Array(lanes).fill(58);
    items.forEach((item,index)=>{
      const aspect=item.aspect||1, angle=[-2,1.5,-1,2,-1.5][index%5];
      const a=Math.abs(angle)*Math.PI/180;
      const fullWidth=lane-32;
      const cardWidth=Math.min(fullWidth/(Math.cos(a)+Math.sin(a)/aspect),mobile?230:360);
      const cardHeight=cardWidth/aspect;
      const rotatedHeight=cardHeight*Math.cos(a)+cardWidth*Math.sin(a);
      const laneIndex=levels.indexOf(Math.min(...levels));
      const x=padding+laneIndex*lane+(lane-cardWidth)/2;
      const y=levels[laneIndex]+(rotatedHeight-cardHeight)/2;
      placements.set(item.id,{x,y,width:cardWidth,height:cardHeight,angle,depth:0});
      levels[laneIndex]+=rotatedHeight+86;
      bottom=Math.max(bottom,levels[laneIndex]);
    });

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
  const url=new URL(href,'https://archive.invalid');
  if(!/^\/archive(?:\/|\.html)?$/.test(url.pathname))return null;
  const id=url.searchParams.get('scan');
  return items.some(item=>item.id===id)?id:null;
}

export function archiveSelectionURL(href,id){
  const url=new URL(href,'https://archive.invalid');
  if(id)url.searchParams.set('scan',id);
  else url.searchParams.delete('scan');
  return url.pathname+url.search+url.hash;
}
