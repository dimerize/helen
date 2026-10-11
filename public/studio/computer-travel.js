import * as THREE from './vendor/three.module.min.js';
import { gsap } from './vendor/gsap.js';

/** Frame the physical monitor by its glass, including narrow phones and landscape. */
export function getComputerPose(kind, {width,height,center=[1.4,1.1034,2.8409],screenWidth=.4455,screenHeight=.3276}) {
  const compact=width<650;
  if(kind==='screen') {
    const fov=compact?43:39;
    const focal=height/(2*Math.tan(THREE.MathUtils.degToRad(fov/2)));
    const pixels=Math.min(width*.86,height*.68*screenWidth/screenHeight);
    const distance=screenWidth*focal/Math.max(pixels,1);
    return {p:[center[0],center[1],center[2]-distance],t:[...center],fov};
  }
  const fov=compact?49:39;
  const focal=height/(2*Math.tan(THREE.MathUtils.degToRad(fov/2)));
  const distance=Math.max(1.5,.945*focal/(width*.88));
  return {p:[.78,1.44,3.02-distance],t:[1.38,1.04,3.02],fov};
}

/** Begin paused; the caller owns cancellation, reduced motion, and lifecycle. */
export function createComputerTimeline({camera,pose,onComplete}) {
  const start=camera.quaternion.clone(),destination=camera.clone(),rotation={progress:0};
  destination.position.fromArray(pose.p);destination.lookAt(...pose.t);
  // Interpolating look-at points can pass through the camera during a 180° turn.
  // Spherical orientation interpolation keeps the turn smooth from any artwork.
  return gsap.timeline({paused:true,onUpdate(){camera.quaternion.slerpQuaternions(start,destination.quaternion,rotation.progress);camera.updateProjectionMatrix();},onComplete})
    .to(camera.position,{x:pose.p[0],y:pose.p[1],z:pose.p[2],duration:1.65,ease:'power3.inOut'},0)
    .to(rotation,{progress:1,duration:1.65,ease:'power3.inOut'},0)
    .to(camera,{fov:pose.fov,duration:1.65,ease:'power3.inOut'},0);
}
