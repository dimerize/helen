import * as T from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/rounded-box.js';

// An optical carrier, with the actual scan as its unedited insert.
export function createCarrier(texture, title='Found on the train') {
  const root=new T.Group(), cover=new T.Group();
  const W=5.2,H=W*texture.image.height/texture.image.width;
  const carbon=new T.MeshStandardMaterial({color:'#242824',roughness:.56,metalness:.42});
  const graphite=new T.MeshStandardMaterial({color:'#41473e',roughness:.42,metalness:.6});
  const edge=new T.MeshStandardMaterial({color:'#707769',roughness:.43,metalness:.72});
  function box(w,h,d,x,y,z,mat=carbon,parent=root,r=.035){
    const o=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,r),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  box(W+.34,H+.34,.10,0,0,-.07);
  box(W+.06,H+.06,.018,0,0,-.011,new T.MeshStandardMaterial({color:'#080b08',roughness:.9}));
  const picture=new T.Mesh(new T.PlaneGeometry(W,H),new T.MeshBasicMaterial({map:texture,toneMapped:false}));
  picture.position.z=.005;root.add(picture);
  // Very narrow edges; the image supplies almost all the visible colour.
  for(const x of [-1,1]) {
    box(.092,H+.25,.10,x*(W/2+.077),0,.024,graphite);
    box(.012,H-.1,.012,x*(W/2+.028),0,.066,edge);
  }
  for(const y of [-1,1]) box(W+.33,.09,.10,0,y*(H/2+.077),.024,graphite);
  // Small spring fingers are actual solids with a raised shoulder and slot.
  for(const x of [-1,1]) for(const y of [-1,1]) {
    box(.25,.12,.044,x*(W/2-.08),y*(H/2-.2),.064,edge);
    box(.13,.014,.046,x*(W/2-.12),y*(H/2-.2),.089,carbon);
    const screw=new T.Mesh(new T.CylinderGeometry(.024,.024,.02,12),graphite);
    screw.rotation.x=Math.PI/2;screw.position.set(x*(W/2+.075),y*(H/2-.2),.086);root.add(screw);
  }
  // Registration notches belong to the rail, not an illustrated frame.
  for(let i=0;i<19;i++)box(.013,i%5===0?.044:.023,.005,-W/2+.16+i*.27,-H/2-.073,.083,edge);
  const glass=new T.Mesh(new T.PlaneGeometry(W+.01,H+.01),new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    vertexShader:`varying vec2 uvv; varying vec3 n; varying vec3 v; void main(){uvv=uv;vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec2 uvv; varying vec3 n; varying vec3 v; void main(){float f=pow(1.-abs(dot(normalize(n),normalize(v))),3.);float strip=exp(-pow((uvv.x+uvv.y*.5-.5)/.075,2.));float rim=pow(abs(uvv.x-.5)*2.,60.)+pow(abs(uvv.y-.5)*2.,60.);gl_FragColor=vec4(.55,.63,.56,.012+strip*.055+f*.13+rim*.09);}`
  }));
  glass.position.z=.09;cover.add(glass);
  box(.16,.59,.026,W/2+.115,-.8,.095,graphite,cover);
  for(let i=0;i<4;i++)box(.063,.011,.009,W/2+.117,-.91+i*.067,.114,edge,cover);
  root.add(cover);
  // Reverse: contact sheet and genuine title, no invented archival metadata.
  const c=document.createElement('canvas');c.width=1024;c.height=1024;
  const ctx=c.getContext('2d');ctx.fillStyle='#20241f';ctx.fillRect(0,0,1024,1024);
  ctx.strokeStyle='#41483d';ctx.lineWidth=2;ctx.strokeRect(55,55,914,914);
  ctx.fillStyle='#a8b29c';ctx.font='28px Geist';ctx.fillText('Helen Zhang',80,120);
  ctx.font='21px Geist';ctx.fillStyle='#818c76';ctx.fillText(title,80,840);
  ctx.font='16px Geist';ctx.fillText('Scan / found material',80,885);
  const im=texture.image,a=im.width/im.height,ww=650,hh=ww/a;
  ctx.drawImage(im,187,490-hh/2,ww,hh);
  const backTexture=new T.CanvasTexture(c);backTexture.colorSpace=T.SRGBColorSpace;
  const back=new T.Mesh(new T.PlaneGeometry(W,H),new T.MeshBasicMaterial({map:backTexture,toneMapped:false}));
  back.rotation.y=Math.PI;back.position.z=-.127;root.add(back);
  return {root,cover,width:W,height:H,dispose(){
    const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());backTexture.dispose();root.removeFromParent();
  }};
}
