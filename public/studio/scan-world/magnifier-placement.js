/** Fits the approved accessory to the unmodified scanner, in native units. */
export function placeScannerMagnifier(THREE, group, unitScale=1) {
  group.position.set(0,0,0);
  // A straighter handle lets the lens sit farther back on the platen.
  group.rotation.set(0,-.48,0);
  group.scale.setScalar(.73);
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group);
  const z=7.1/2+.035+.03-bounds.max.z;
  // The unchanged carriage vents top out at .462. Its full automatic pass
  // must clear the lowest part of the tool, including the thicker grip.
  const y=.47-bounds.min.y;
  group.position.set(1.35*unitScale,y*unitScale,z*unitScale);
  group.scale.setScalar(.73*unitScale);
  group.updateMatrixWorld(true);
}
