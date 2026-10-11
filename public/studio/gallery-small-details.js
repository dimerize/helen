import * as THREE from './vendor/three.module.min.js';
import {detailKit,batchStaticDetails} from './physical-details.js';

export function addGallerySmallDetails(parent,{halfWidth,back,height}) {
  const kit=detailKit(),{box,cylinder,screw,tube,cream}=kit;
  const root=new THREE.Group();root.name='Painted services and repaired plaster';parent.add(root);
  const conduit=new THREE.Group();conduit.name='Ceiling conduit and junction';root.add(conduit);
  // Surface-mounted service follows the ceiling's existing fixture axis.
  tube(conduit,[[-.22,height-.036,2.7],[-.22,height-.036,-3.98],[-.22,height-.09,back+.055],[-.22,height-.34,back+.036]],.011,cream,'Painted electrical conduit');
  for(const z of [-3.65,-2.1,-.75,.7,2.45]) {
    const collar=cylinder(conduit,.014,.038,[-.22,height-.036,z],cream,'Conduit coupling');collar.rotation.x=Math.PI/2;
    box(conduit,[.069,.014,.025],[-.22,height-.009,z+.075],cream,'Conduit saddle');
    for(const x of [-.245,-.195]) {const fixing=screw(conduit,[x,height-.018,z+.075],.0025,.4,cream);fixing.rotation.x=Math.PI/2;}
  }
  box(conduit,[.115,.112,.037],[-.22,height-.36,back+.027],cream,'Junction enclosure',.007);
  box(conduit,[.119,.116,.006],[-.22,height-.36,back+.05],cream,'Junction lid',.004);
  for(const x of [-.264,-.176]) screw(conduit,[x,height-.36,back+.054],.003,1.2,cream);
  for(const z of [-.16,1.56,-3.26]) {
    // Two softly rounded brackets under each existing ceiling beam.
    for(const x of [-halfWidth+.035,halfWidth-.035]) box(root,[.056,.075,.022],[x,height-.19,z-.29],cream,'Painted beam connection',.002);
  }
  const repairs=new THREE.Group();repairs.name='Quiet plaster repairs';root.add(repairs);
  const patch=new THREE.MeshStandardMaterial({color:'#e5e3da',roughness:.98,bumpMap:kit.grain,bumpScale:.00018});
  // Old pin holes are millimetres across and sit away from the installed works.
  for(const [y,z] of [[1.57,-2.98],[1.71,-2.985],[.46,2.78]]) {
    const fill=cylinder(repairs,.009,.0007,[-halfWidth+.001,y,z],patch,'Filled hanging hole');fill.rotation.z=Math.PI/2;
    const pin=cylinder(repairs,.0014,.0008,[-halfWidth+.0015,y+.001,z],kit.dark,'Recess in repaired plaster');pin.rotation.z=Math.PI/2;
  }
  for(const side of [-1,1]) for(const z of [-2.6,1.1]) {
    box(root,[.0008,.122,.0016],[side*(halfWidth-.0396),.068,z],kit.dark,'Skirting butt joint',.0001);
    const nail=screw(root,[side*(halfWidth-.0401),.102,z+.018],.0018,.3,kit.nickel);nail.rotation.y=-side*Math.PI/2;
  }
  batchStaticDetails(conduit);batchStaticDetails(repairs);
  batchStaticDetails(root,[conduit,repairs]);
  return {root,conduit,repairs};
}

export function addComputerSmallDetails(parent,materials) {
  const kit=detailKit(),{box,cylinder,screw,tube}=kit;
  const desk=new THREE.Group();desk.name='Desk joinery and cable restraint';parent.add(desk);
  materials.desk.bumpMap=kit.grain;materials.desk.bumpScale=.00012;
  materials.rear.bumpMap=kit.grain;materials.rear.bumpScale=.00007;
  for(const [x,w] of [[.474,.012],[.491,.005]]) box(desk,[w,.00045,.00025],[x,.771,.3351],materials.deskEdge,'Tiny desktop edge wear',.00008);
  for(const x of [-.457,.457]) for(const z of [-.191,.261]) {
    // Threaded necks connect the original adjustable feet to their steel legs.
    cylinder(desk,.009,.017,[x,.034,z],kit.nickel,'Levelling foot threaded neck');
    for(const y of [.03,.035,.04]) cylinder(desk,.0095,.001,[x,y,z],materials.steel,'Foot thread');
    const bolt=screw(desk,[x,.72,z+.016],.0045,.65,materials.steel);
    bolt.name='Desk apron fixing';
  }
  // Modelled straps wrap the existing relaxed keyboard cable at its actual path.
  box(desk,[.025,.009,.012],[-.376,.797,-.105],materials.steel,'Desktop cable saddle',.003);
  for(const x of [-.387,-.365]) {const fix=screw(desk,[x,.803,-.105],.0018,.4);fix.rotation.x=-Math.PI/2;}
  tube(desk,[[.17,.846,-.239],[.20,.814,-.269],[.20,.774,-.28],[.206,.62,-.272],[.239,.59,-.254]],.003,materials.cable,'Small service loop behind desktop');
  box(desk,[.026,.036,.013],[.208,.675,-.255],materials.steel,'Rear cable clip',.003);
  const computer=new THREE.Group();computer.name='Computer service details';parent.add(computer);
  for(const x of [-.174,.174]) for(const y of [1.08,1.34]) {
    const screwHead=screw(computer,[x,y,-.2415],.0031,.5+x,materials.inset);screwHead.rotation.y=Math.PI;
  }
  // A small folded inventory tab is only visible beside the monitor's lower edge.
  const labelMaterial=new THREE.MeshStandardMaterial({color:'#c2bda9',roughness:.9});
  box(computer,[.062,.014,.0007],[-.065,.882,.1163],labelMaterial,'Worn paper inventory tab',.0003);
  box(computer,[.008,.014,.0004],[-.092,.882,.117],materials.inset,'Folded label corner',.00015).rotation.y=-.12;
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#666655';ctx.font='26px monospace';ctx.fillText('HZ / 01',20,43);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const label=kit.mesh(computer,new THREE.PlaneGeometry(.052,.013),new THREE.MeshStandardMaterial({map,transparent:true,roughness:.93,depthWrite:false}),[-.062,.882,.1171],'Tiny inventory ink');label.castShadow=false;
  }
  // Small felt restraint where the existing signal lead descends behind the CRT.
  const cuff=cylinder(computer,.0055,.018,[.077,.987,-.25],materials.rubber,'Signal cable felt tie');cuff.rotation.z=-.4;
  batchStaticDetails(desk);batchStaticDetails(computer);
  return {desk,computer};
}
