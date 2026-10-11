// Physical coordinates, independent of viewport or input device. Resizing only
// changes the camera: a work never moves to another wall on a phone.
const placements = {
  'train-scan-wide': {surface:'wall',position:[-3.65,4.55,-4.28],width:5.5,angle:-.025},
  'train-scan': {surface:'table',position:[-4.3,.96,1.05],width:3.35,angle:.09},
  'train-scan-notice': {surface:'table',position:[.1,.97,1],width:3.2,angle:-.085},
  'painting': {surface:'wall',position:[-7.85,3.4,-4.27],width:2.2,angle:.025},
  'source': {surface:'lean',position:[-5.8,1.28,-3.8],width:1.7,angle:-.055},
  'moire': {surface:'table',position:[4.3,.96,.8],width:2.6,angle:.07},
  '8ppi-panels': {surface:'wall',position:[1.65,4.1,-4.28],width:2.4,angle:-.02},
  'revised-script': {surface:'wall',position:[6.1,4.6,-4.28],width:2.05,angle:.03},
  'bent-mesh': {surface:'floor',position:[-7,.075,4.85],width:1.5,angle:-.16},
  'elongated': {surface:'floor',position:[-3.7,.07,6.05],width:1.6,angle:.16},
  'interpretation-1': {surface:'floor',position:[-.35,.07,4.7],width:1.55,angle:-.13},
  'train-installation': {surface:'wall',position:[6.1,1.75,-4.27],width:3.3,angle:-.025},
  'simulation': {surface:'floor',position:[3.05,.075,6.15],width:2.2,angle:.1},
  'interpretation-2': {surface:'floor',position:[6.6,.07,4.85],width:1.55,angle:.18},
  '8ppi-installation': {surface:'lean',position:[-3,1.3,-3.85],width:1.65,angle:.045},
};
export function archiveRoomLayout(items) {
  return items.map(item=>{
    const p=placements[item.id];
    if(!p)throw new Error(`Missing physical archive placement: ${item.id}`);
    const height=p.width/item.aspect,position=[...p.position];
    if(p.surface==='lean')position[1]=height/2*Math.cos(.19)+.015;
    return {...p,id:item.id,position,height};
  });
}
export function archiveRoomCamera(aspect) {
  // Same bearing and target in every viewport; no alternate mobile room.
  const target=[0,2.05,.4], direction=[.12,.52,1];
  const distance=Math.max(23,11.1/(Math.tan(39*Math.PI/360)*Math.max(.25,aspect)));
  const length=Math.hypot(...direction);
  return {target,position:target.map((v,i)=>v+direction[i]/length*distance),distance,fov:39};
}
export function constrainArchiveMove(placement,position) {
  const wall=placement.surface==='wall';
  const c=Math.abs(Math.cos(placement.angle)),s=Math.abs(Math.sin(placement.angle));
  const halfX=(placement.width*c+placement.height*s)/2+.09;
  const halfY=(placement.height*c+placement.width*s)/2+.09;
  const table=placement.surface==='table',limit=table?7.8:9.8;
  const x=Math.max(-limit+halfX,Math.min(limit-halfX,position[0]));
  if(wall)return [x,Math.max(halfY+.15,Math.min(6.05-halfY,position[1])),placement.position[2]];
  const floor=placement.surface==='floor';
  const min=floor?3.2+halfY:table?-1.48+halfY:-3.95;
  const max=floor?9.6-halfY:table?2.98-halfY:-3.2;
  return [x,placement.position[1],Math.max(min,Math.min(max,position[2]))];
}
