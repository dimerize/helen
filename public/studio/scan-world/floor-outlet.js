// An accessory beyond the original cable endpoint. The captured scanner and
// its cable remain untouched; this small floor socket simply finishes the run.
export const cableTerminal=Object.freeze([10,-.1,-3]);
export function createFloorOutlet(T,scale=1){
 const root=new T.Group();root.name='Quiet floor socket at the scanner cable terminal';root.scale.setScalar(scale);
 const plate=new T.MeshStandardMaterial({color:'#1d211e',roughness:.8,metalness:.2});
 const inset=new T.MeshStandardMaterial({color:'#0f1310',roughness:.83});
 const rubber=new T.MeshStandardMaterial({color:'#0d0e10',roughness:.46,metalness:.25});
 const metal=new T.MeshStandardMaterial({color:'#44493f',roughness:.66,metalness:.4});
 const fixture=new T.Group();fixture.position.set(10.45,-.23,-3.46);fixture.rotation.y=-.55;root.add(fixture);
 const box=(w,h,d,x,y,z,mat,parent=fixture)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;};
 box(.87,.07,1.42,0,0,0,plate);box(.64,.02,1.1,0,.045,0,inset);
 for(const z of [-.29,.29]){
  box(.48,.012,.45,0,.061,z,plate);
  for(const x of [-.085,.085])box(.025,.006,.12,x,.07,z-.03,inset);
  const ground=new T.Mesh(new T.CircleGeometry(.038,12),inset);ground.rotation.x=-Math.PI/2;ground.position.set(0,.071,z+.12);fixture.add(ground);
 }
 for(const z of [-.61,.61]){
  const screw=new T.Mesh(new T.CylinderGeometry(.027,.027,.007,12),metal);screw.position.set(0,.04,z);fixture.add(screw);
  box(.034,.003,.006,0,.045,z,inset);
 }
 const plug=box(.3,.18,.35,0,.15,.29,rubber);
 for(let i=0;i<3;i++)box(.305,.012,.014,0,.21,.2+i*.065,inset);
 const connection=new T.Vector3(0,.14,.5).applyEuler(fixture.rotation).add(fixture.position);
 const curve=new T.CatmullRomCurve3([new T.Vector3(...cableTerminal),new T.Vector3(10.15,-.1,-3.1),connection]);
 root.add(new T.Mesh(new T.TubeGeometry(curve,18,.046,8,false),rubber));
 // Texture-free, non-emissive and at the original hardware's native scale.
 root.userData.cableTerminal=[...cableTerminal];plug.name='Scanner power plug';
 return root;
}
