/** Fits the approved accessory to the unmodified scanner, in native units. */
export function placeScannerMagnifier(THREE, group, unitScale=1) {
  group.position.set(0,0,0);
  // Preserve the approved diagonal: the internal handle yaw is +.48.
  group.rotation.set(0,-.18,0);
  group.scale.setScalar(.73);
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group);
  // Account for the camera looking down onto an elevated instrument: a heel
  // merely past the physical edge still projects over the scanner. This fixed
  // native pose clears the front silhouette on both homepage camera layouts.
  const z=2.98;
  // The unchanged carriage vents top out at .462. Its full automatic pass
  // must clear the lowest part of the tool, including the thicker grip.
  const y=.47-bounds.min.y;
  group.position.set(1.35*unitScale,y*unitScale,z*unitScale);
  group.scale.setScalar(.73*unitScale);
  group.updateMatrixWorld(true);
}
