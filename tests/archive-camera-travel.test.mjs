import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/studio/vendor/three.module.min.js';
import {archiveCameraFrame,archiveCardGeometry,archiveCameraPose} from '../public/studio/archive-camera-travel.js';

test('individual 3D image cards match their DOM projection at every physical depth',()=>{
  for(const [width,height] of [[1440,900],[390,844],[844,390]]) {
    const frame=archiveCameraFrame(width,height),camera=new THREE.PerspectiveCamera(frame.fov,width/height,.1,frame.distance*3);
    camera.position.z=frame.distance;camera.updateMatrixWorld(true);
    for(const depth of [4,18,38]) {
      const source={centerX:width*.42,centerY:height*.67,width:190,height:130,angle:7*Math.PI/180,depth};
      const layout=archiveCardGeometry(source,frame),group=new THREE.Group();group.position.set(layout.x,layout.y,layout.z);group.rotation.z=layout.rotation;group.updateMatrixWorld(true);
      for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
        const point=new THREE.Vector3(x*layout.width/2,-y*layout.height/2,0).applyMatrix4(group.matrixWorld).project(camera);
        const px=(point.x*.5+.5)*width,py=(-point.y*.5+.5)*height;
        const expectedX=source.centerX+Math.cos(source.angle)*x*source.width/2-Math.sin(source.angle)*y*source.height/2;
        const expectedY=source.centerY+Math.sin(source.angle)*x*source.width/2+Math.cos(source.angle)*y*source.height/2;
        assert.ok(Math.abs(px-expectedX)<1e-6);assert.ok(Math.abs(py-expectedY)<1e-6);
      }
    }
  }
});

test('camera movement is level, monotonic, and continuous in one consistent route direction',()=>{
  const frame=archiveCameraFrame(1200,800);
  for(const phase of ['depart','arrive'])for(const direction of [-1,1]) {
    let previous=archiveCameraPose(frame,phase,direction,0);
    for(let i=1;i<=100;i++) {
      const point=archiveCameraPose(frame,phase,direction,i/100);
      assert.equal(point.y,0);assert.ok((point.x-previous.x)*direction>=-1e-8);
      assert.ok(Math.hypot(point.x-previous.x,point.z-previous.z)<3);
      previous=point;
    }
    assert.equal(frame.fov,39);
  }
  const arrived=archiveCameraPose(frame,'arrive',1,1);assert.ok(Math.abs(arrived.x)<1e-9);assert.equal(arrived.y,0);assert.equal(arrived.z,frame.distance);
});

test('invalid viewport sizes cannot create an infinite perspective camera',()=>{
  for(const pair of [[0,800],[1200,0],[NaN,800],[1200,Infinity]])assert.throws(()=>archiveCameraFrame(...pair),RangeError);
});

test('archive projection keeps textured paper distinctly in front of its thin backing at 24-bit depth precision',()=>{
  for(const height of [390,844,1400]) {
    const frame=archiveCameraFrame(1440,height),camera=new THREE.PerspectiveCamera(frame.fov,1440/height,frame.near??.1,frame.far??frame.distance*3);
    camera.position.z=frame.distance;camera.updateMatrixWorld(true);
    for(const depth of [4,18,38]) {
      const face=new THREE.Vector3(0,0,depth).project(camera).z;
      const backing=new THREE.Vector3(0,0,depth-.03).project(camera).z;
      const depthSteps=(backing-face)*.5*(2**24-1);
      assert.ok(depthSteps>8,`paper/backing only ${depthSteps} depth steps apart at ${height}px`);
    }
  }
});
