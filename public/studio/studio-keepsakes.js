import * as THREE from './vendor/three.module.min.js';
import {detailKit,batchStaticDetails} from './physical-details.js';

// Small invented studio objects, drawn from the work's materials and processes.
// These are scene details, not additional artworks or biographical claims.
const surface=(color,roughness=.72,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function sphere(kit,parent,position,radii,material,name) {
  const m=kit.mesh(parent,new THREE.SphereGeometry(1,24,14),material,position,name);
  m.scale.fromArray(radii);return m;
}
function sheetGeometry(width,depth,height,segments=24) {
  const g=new THREE.PlaneGeometry(width,depth,segments,12);g.rotateX(-Math.PI/2);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i)/width+.5,p.getZ(i)/depth+.5));
  g.computeVertexNormals();return g;
}

export function createWireBeetle() {
  const kit=detailKit(),{box,tube,mesh}=kit;
  const root=new THREE.Group();root.name='Folded copper wire beetle';
  const copper=surface('#685448',.57,.67),patina=surface('#35433b',.86,.35),wire=surface('#555c54',.4,.72),black=surface('#172320',.32,.32);
  copper.bumpMap=kit.brushed;copper.bumpScale=.00005;
  sphere(kit,root,[0,.017,.006],[.011,.006,.017],patina,'Underbody');
  // Two separate pressed wing cases, with a hairline between their folded edges.
  for(const side of [-1,1]) {
    const wing=sphere(kit,root,[side*.008,.022,.007],[.0075,.009,.020],copper,'Pressed copper wing');wing.rotation.z=-side*.08;
    for(let i=0;i<4;i++) {
      const x=-.0048+i*.0028,points=[];
      for(let j=0;j<=12;j++) {
        const z=-.012+j*.002, y=.009*Math.sqrt(Math.max(0,1-(x/.0075)**2-(z/.020)**2))+.00004;
        const p=new THREE.Vector3(x,y,z).applyEuler(wing.rotation).add(wing.position);points.push(p.toArray());
      }
      tube(root,points,.00014,patina,'Hand-scored wing vein');
    }
    for(let j=0;j<3;j++) {
      const z=-.009+j*.013,spread=.027+(j===1?.007:0);
      tube(root,[[side*.009,.018,z],[side*.020,.014,z-.007],[side*spread,.0016,z+.003],[side*(spread+.003),.0015,z+.008]],.00085,wire,'Bent wire leg');
      sphere(kit,root,[side*.01,.018,z],[.0017,.0015,.0016],copper,'Small solder bead');
      // A tiny curl gives the feet an actual point of contact with the case.
      tube(root,[[side*(spread+.003),.0015,z+.008],[side*(spread+.002),.0012,z+.011],[side*spread,.0012,z+.010]],.0007,wire,'Curled wire foot');
    }
  }
  sphere(kit,root,[0,.021,-.015],[.010,.007,.007],patina,'Neck shield');
  sphere(kit,root,[0,.018,-.025],[.007,.006,.007],copper,'Bead head');
  for(const side of [-1,1]) {
    sphere(kit,root,[side*.005,.022,-.029],[.0017,.0019,.0016],black,'Glass bead eye');
    tube(root,[[side*.004,.021,-.03],[side*.009,.030,-.035],[side*.016,.034,-.037],[side*.020,.033,-.034]],.00055,wire,'Curled antenna');
    sphere(kit,root,[side*.020,.033,-.034],[.0011,.0011,.0011],copper,'Antenna solder tip');
  }
  for(const [x,z,r] of [[.010,.012,.0014],[-.011,.004,.001],[-.005,.020,.0008]]) sphere(kit,root,[x,.028,z],[r,.00025,r*.65],patina,'Tiny oxidation mark');
  tube(root,[[0,.023,-.007],[0,.026,.006],[0,.023,.022]],.00045,patina,'Folded wing seam');
  batchStaticDetails(root);return root;
}

/** An accordion contact proof. Its image planes follow the folded paper. */
export function createContactProof(maps=[]) {
  const kit=detailKit(),root=new THREE.Group();root.name='Accordion scan contact proof';
  const paper=surface('#b9b6a5',.95);paper.bumpMap=kit.grain;paper.bumpScale=.00009;paper.side=THREE.DoubleSide;
  const edge=surface('#898875',.96),pencil=surface('#55594f',.95);
  const width=.222,depth=.089;
  const fold=u=>u<1/3?.001+u*.018:u<2/3?.007-(u-1/3)*.018:.001+(u-2/3)*.009;
  const lift=(u,v)=>fold(u)+.0035*Math.pow(Math.max(0,(u-.88)/.12),2)*Math.pow(v,4);
  for(const offset of [0,-.00032]) kit.mesh(root,sheetGeometry(width,depth,(u,v)=>lift(u,v)+offset,36),offset?edge:paper,[0,.0005,0],'Folded cotton paper');
  for(let i=0;i<3;i++) {
    const image=surface('#e0ddcf',.91);image.map=maps[i]||null;image.side=THREE.DoubleSide;
    const aspect=maps[i]?.image?.width/maps[i]?.image?.height||1;
    const w=Math.min(.063,.066*aspect),d=w/aspect,cx=(i-1)*.074;
    const g=sheetGeometry(w,d,(u,v)=>lift((cx+(u-.5)*w)/width+.5,(v-.5)*d/depth+.5)+.00061,16);
    kit.mesh(root,g,image,[cx,.0005,-.003],'Printed scan '+(i+1));
    // Registration cuts and graphite ticks sit in the margin, not over the art.
    for(const x of [-1,1]) for(const z of [-1,1]) {
      const px=cx+x*.033,pz=-.003+z*.035,y=lift(px/width+.5,pz/depth+.5)+.00115;
      kit.box(root,[.003,.00012,.00022],[px,y,pz],pencil,'Registration tick',.00004);
    }
  }
  // Flattened wire clip: outer and inner loops are different heights, like bent steel.
  const clip=new THREE.Group();clip.name='Uneven paperclip';clip.position.set(-.095,.0032,.032);clip.rotation.y=.22;root.add(clip);
  kit.tube(clip,[[0,0,-.007],[-.004,0,-.007],[-.005,0,.014],[0,0,.019],[.005,0,.014],[.005,.001,-.009],[.002,.001,-.013],[-.002,.001,-.010],[-.002,.001,.012],[.001,.001,.013]],.00062,kit.nickel,'Looped wire paperclip');
  batchStaticDetails(root);return root;
}

export function createStudioPencil() {
  const kit=detailKit(),root=new THREE.Group();root.name='Short graphite pencil and curled shaving';
  const lacquer=surface('#364c48',.67),wood=surface('#a68d64',.91),lead=surface('#262c29',.49,.13),worn=surface('#77735c',.87);
  const shaft=kit.mesh(root,new THREE.CylinderGeometry(.0034,.0034,.093,6),lacquer,[0,.0036,0],'Worn hexagonal lacquer');shaft.rotation.z=Math.PI/2;
  const tip=kit.mesh(root,new THREE.CylinderGeometry(.00065,.0034,.014,6),wood,[-.0535,.0036,0],'Uneven sharpened cedar');tip.rotation.z=Math.PI/2;
  const graphite=kit.mesh(root,new THREE.ConeGeometry(.0008,.004,8),lead,[-.0625,.0036,0],'Graphite point');graphite.rotation.z=Math.PI/2;
  const end=kit.cylinder(root,.0028,.0003,[.0467,.0036,0],wood,'Exposed pencil end');end.rotation.z=Math.PI/2;
  const core=kit.cylinder(root,.0009,.0004,[.0469,.0036,0],lead,'Graphite end grain');core.rotation.z=Math.PI/2;
  for(const [x,z,w] of [[.030,-.0015,.008],[-.022,.0012,.010],[.018,.0014,.004]]) kit.box(root,[w,.00015,.0005],[x,.00665,z],worn,'Handling wear through lacquer',.00007);
  for(let i=0;i<5;i++)kit.tube(root,[[-.048-i*.0012,.0055-i*.00025,-.0008],[-.052-i*.0014,.0053-i*.00025,.0005]],.00008,worn,'Cedar grain');
  // A real thin spiral ribbon with a darker painted outer edge.
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=70;i++)for(let side=0;side<2;side++) {
    const t=i/70,a=t*Math.PI*3.1,r=.003+t*.006+side*.0015;
    positions.push(.019+Math.cos(a)*r,.0012+Math.sin(t*Math.PI)*.007+side*.0005,-.021+Math.sin(a)*r);uv.push(t,side);
    if(i<70&&side===0){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();wood.side=THREE.DoubleSide;
  kit.mesh(root,g,wood,[0,0,0],'Curled cedar shaving');
  batchStaticDetails(root);return root;
}

export function createMeshSample() {
  const kit=detailKit(),root=new THREE.Group();root.name='Bent mesh study with a folded card foot';
  const steel=surface('#666d64',.55,.66),oxidized=surface('#47564a',.81,.39),paper=surface('#b7b49e',.94);
  paper.bumpMap=kit.grain;paper.bumpScale=.00014;
  // A wavy wire cloth, folded away from the plane. Every crossing is two wires.
  const point=(u,v,offset=0)=>[(u-.5)*.104,.010+v*.112,.022*Math.sin(u*Math.PI*1.65)+.022*Math.sin(v*Math.PI*.8)+offset];
  for(let i=0;i<=14;i++) {
    const points=[];for(let j=0;j<=12;j++)points.push(point(i/14,j/12,.00035*Math.sin(j*Math.PI)));
    kit.tube(root,points,.00042,i%5?steel:oxidized,'Warp wire');
  }
  for(let j=0;j<=18;j++) {
    const points=[];for(let i=0;i<=16;i++)points.push(point(i/16,j/18,.00055));
    kit.tube(root,points,.00042,steel,'Weft wire');
  }
  // Unequal free wire ends make this a cut sample, not a perfect CAD lattice.
  for(const i of [1,4,8,11]) {
    const p=point(i/14,1);kit.tube(root,[p,[p[0]+.001,p[1]+.003+i*.0002,p[2]+.002]],.00038,steel,'Uneven snipped wire end');
  }
  kit.box(root,[.127,.0015,.083],[0,.001,0],paper,'Creased sample card',.0004);
  kit.box(root,[.052,.011,.022],[0,.0065,.018],kit.dark,'Folded retaining clip',.002);
  for(const side of [-1,1])kit.tube(root,[[side*.019,.010,.020],[side*.022,.018,.033],[side*.013,.022,.037],[side*.009,.011,.023]],.001,kit.nickel,'Binder clip bail');
  // A restrained graphite sketch left beside the actual wire sample.
  for(let i=0;i<4;i++)kit.tube(root,[[.035+i*.004,.002,-.028],[.033+i*.004,.002,-.015],[.029+i*.004,.002,-.005]],.00016,oxidized,'Pencil study on card');
  batchStaticDetails(root);return root;
}

export function createTapeFragment(map) {
  const kit=detailKit(),root=new THREE.Group();root.name='Saved warning-sign offcut under linen tape';
  const paper=surface('#b9b8ab',.96),ink=surface('#b5b7a6',.91);ink.map=map||null;ink.side=THREE.DoubleSide;
  const width=.028,depth=.045,height=(u,v)=>.0002+Math.pow(v,7)*.0022*(.6+u);
  const g=sheetGeometry(width,depth,height,14),p=g.attributes.position;
  for(let i=0;i<p.count;i++){if(i%15===0||i%15===14)p.setX(i,p.getX(i)+Math.sin(i*4.73)*.0006);}
  const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,.30+uv.getX(i)*.31,.35+uv.getY(i)*.33);g.computeVertexNormals();
  const under=g.clone();under.translate(0,-.00024,0);kit.mesh(root,under,paper,[0,0,0],'Torn paper thickness');kit.mesh(root,g,ink,[0,.0001,0],'Actual scan fragment');
  const tape=surface('#a6a18b',.93);tape.transparent=true;tape.opacity=.8;tape.side=THREE.DoubleSide;tape.bumpMap=kit.grain;tape.bumpScale=.00008;
  const tapeMesh=kit.mesh(root,sheetGeometry(.037,.008,(u)=>.0008+Math.pow(Math.max(0,(u-.87)/.13),2)*.002,18),tape,[0,.0001,-.011],'Linen tape with lifted end');tapeMesh.rotation.y=.09;
  batchStaticDetails(root);return root;
}

function contactShadow(root,width,depth,opacity) {
  const data=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++) {
    const radius=Math.hypot((x-31.5)/28,(y-31.5)/28),i=(y*64+x)*4;
    data[i+3]=Math.round(255*Math.exp(-radius*radius*4)*Math.max(0,1-radius*.52));
  }
  const map=new THREE.DataTexture(data,64,64);map.needsUpdate=true;map.magFilter=THREE.LinearFilter;
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshBasicMaterial({map,transparent:true,opacity,depthWrite:false,toneMapped:false}));
  shadow.name='Soft contact with supporting surface';shadow.rotation.x=-Math.PI/2;shadow.position.y=.00008;shadow.raycast=()=>{};root.add(shadow);
}

export function addStudioKeepsakes(computer,maps=[]) {
  const root=new THREE.Group();root.name='Small studio keepsakes';computer.add(root);
  const proof=createContactProof(maps);proof.position.set(.471,.791,-.205);proof.rotation.y=.06;proof.scale.setScalar(.43);root.add(proof);contactShadow(proof,.235,.097,.22);
  const pencil=createStudioPencil();pencil.position.set(.491,.791,.038);pencil.rotation.y=1.30;root.add(pencil);
  const fragment=createTapeFragment(maps[0]);fragment.position.set(.273,1.273,.2173);fragment.rotation.set(Math.PI/2,.08,0);root.add(fragment);
  return {root,proof,pencil,fragment};
}

export function createDoorstop() {
  const kit=detailKit(),root=new THREE.Group();root.name='Small offcut door wedge';
  const wood=surface('#80765f',.89),grain=surface('#615e4d',.96),rubber=surface('#292d27',.95);
  // A simple cut wedge, with exposed laminated edges rather than a metal fitting.
  wood.bumpMap=kit.brushed;wood.bumpScale=.00010;
  const section=new THREE.Shape();section.moveTo(-.052,0);section.lineTo(.052,0);section.lineTo(.052,.026);section.lineTo(-.052,.005);section.closePath();
  const wedge=kit.mesh(root,new THREE.ExtrudeGeometry(section,{depth:.041,bevelEnabled:true,bevelSize:.0008,bevelThickness:.0008,bevelSegments:2,steps:1}).translate(0,0,-.0205),wood,[0,.002,0],'Softened offcut wedge');wedge.rotation.y=Math.PI/2;
  kit.box(root,[.042,.0015,.102],[0,.0008,0],rubber,'Quiet rubber sole',.0005);
  for(const x of [-.0212,.0212]) for(const y of [.007,.011,.015,.019]) {
    const end=.052-(y-.005)/.2019;
    if(end>-.052)kit.tube(root,[[x,y,-.05],[x,y,end-.002]],.0002,grain,'Exposed ply seam');
  }
  kit.tube(root,[[0,.019,-.043],[-.012,.017,-.066],[-.015,.008,-.079],[.005,.005,-.082],[.014,.01,-.073],[0,.019,-.043]],.0012,grain,'Short cotton retrieval loop');
  batchStaticDetails(root);return root;
}
