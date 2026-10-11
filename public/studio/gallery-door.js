import * as THREE from './vendor/three.module.min.js';
import {detailKit,batchStaticDetails} from './physical-details.js';
import {createParsonsRelief} from './parsons-relief.js';

export function createGalleryNameplate(kit=detailKit()) {
  const {box,screw,nickel,dark,brushed}=kit;
  const plaque=new THREE.Group();plaque.name='Satin exhibition nameplate';
  box(plaque,[.696,.276,.005],[0,0,0],dark,'Shadow-gap backing',.002);
  const face=new THREE.MeshStandardMaterial({color:'#c1c2b7',metalness:.32,roughness:.54,bumpMap:brushed,bumpScale:.00012});
  box(plaque,[.70,.28,.004],[0,0,.0045],nickel,'Machined plate edge',.0012);
  box(plaque,[.694,.274,.001],[0,0,.007],face,'Brushed anodized face',.0005);
  const logo=createParsonsRelief(.225);logo.position.set(-.294,.105,.0077);plaque.add(logo);
  // The institutional mark is actual relief; small exhibition type is ink on metal.
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=614;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#30342f';ctx.font='500 79px Arial';ctx.fillText('Helen Zhang',123,365);
    ctx.font='400 38px Arial';ctx.fillText('Beyond the humanized machine',123,460);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    const text=new THREE.Mesh(new THREE.PlaneGeometry(.70,.28),new THREE.MeshStandardMaterial({map:texture,transparent:true,roughness:.86,depthWrite:false}));
    text.name='Printed exhibition identification';text.position.z=.008;plaque.add(text);
  }
  for(const [x,y,a] of [[-.323,-.114,.28],[.323,.114,-.6]]) screw(plaque,[x,y,.008],.0033,a);
  // Real hairline edge abrasions: three irregular, nearly flush metal slivers.
  for(const [x,y,w,a] of [[.289,-.136,.018,.02],[-.16,.136,.009,-.03],[.335,-.112,.006,.3]]) {
    const nick=box(plaque,[w,.0003,.0001],[x,y,.008],nickel,'Small handling abrasion',.00004);nick.rotation.z=a;
  }
  batchStaticDetails(plaque,[logo]);
  return plaque;
}

/** Identical leaf size, hinge axis and handle pivot to the existing entrance. */
export function createGalleryDoor() {
  const kit=detailKit(), {box,cylinder,screw,paint,nickel,dark}=kit;
  const door=new THREE.Group();door.name='Painted gallery door';
  box(door,[1.68,2.78,.085],[.84,1.4,0],paint,'Painted steel leaf',.004);
  // Folded edge and recessed latch remain within the existing door thickness.
  box(door,[.004,2.734,.073],[1.674,1.4,0],dark,'Folded leaf edge reveal',.001);
  const kick=new THREE.MeshStandardMaterial({color:'#3b403b',metalness:.48,roughness:.62,bumpMap:kit.brushed,bumpScale:.00007});
  box(door,[1.55,.20,.002],[.84,.174,.044],kick,'Satin graphite kick plate',.002);
  for(const x of [.093,1.587]) for(const y of [.092,.256]) screw(door,[x,y,.0455],.0026,x+y,kick);
  box(door,[.063,.28,.004],[1.5,1.16,.0445],dark,'Handle gasket',.003);
  box(door,[.058,.28,.023],[1.5,1.16,.057],nickel,'Brushed escutcheon',.003);
  for(const y of [1.052,1.268]) screw(door,[1.5,y,.070],.0038,y);
  const handle=new THREE.Group();handle.name='Lever handle';handle.position.set(1.49,1.19,.11);door.add(handle);
  box(handle,[.184,.025,.03],[-.07,0,0],nickel,'Softly worn lever',.009);
  const spindle=cylinder(handle,.018,.045,[.01,0,-.022],nickel,'Lever spindle');spindle.rotation.x=Math.PI/2;
  box(door,[.002,.15,.028],[1.681,1.16,0],nickel,'Latch face',.0005);
  box(door,[.013,.025,.024],[1.679,1.18,0],nickel,'Bevelled latch tongue',.003);
  for(const y of [.23,1.4,2.55]) {
    box(door,[.057,.138,.004],[.034,y,.045],nickel,'Hinge leaf',.001);
    for(const d of [-.049,0,.049]) {
      cylinder(door,.014,.043,[.002,y+d,.046],nickel,'Hinge knuckle');
      screw(door,[.044,y+d,.048],.003,.9+d);
    }
    cylinder(door,.015,.006,[.002,y+.073,.046],nickel,'Hinge pin cap');
  }
  const plaque=createGalleryNameplate(kit);plaque.position.set(.82,1.94,.055);door.add(plaque);
  // Fine bottom seal reads only when the door lifts away from the threshold.
  box(door,[1.646,.013,.035],[.84,.014,-.015],dark,'Flexible bottom sweep',.002);
  batchStaticDetails(door,[handle,plaque,door.getObjectByName('Painted steel leaf')]);
  return {door,handle,plaque};
}

/** A narrow painted reveal, close to the leaf rather than a metal portal. */
export function createGalleryDoorframe() {
  const {box,paint,dark}=detailKit();
  const frame=new THREE.Group();frame.name='Fine painted doorway reveal';
  for(const x of [-.871,.871]) box(frame,[.026,2.83,.106],[x,1.415,3.803],paint,'Narrow painted jamb',.0015);
  box(frame,[1.768,.026,.106],[0,2.817,3.803],paint,'Fine lintel',.0015);
  box(frame,[1.73,.009,.16],[0,.0045,3.735],dark,'Low flush threshold',.001);
  // A fine compression seal sits inside the reveal, almost invisible when shut.
  for(const x of [-.849,.849]) box(frame,[.007,2.795,.009],[x,1.4,3.724],dark,'Door seal',.001);
  batchStaticDetails(frame);
  return frame;
}
