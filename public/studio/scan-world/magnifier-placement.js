/*
  The magnifier is the door into the bug game. It should read as a tool resting
  on the scanner, not as a second headline. On desktop it is smaller and sits
  further toward the right edge, so the scan stays open and the headline leads.
  Wherever the scanner already fills the screen's width (phones, and any
  portrait screen such as a tablet held upright) it only shrinks: moving it
  right there would push it off the glass and off the screen.

  These are the only place its size and sideways position are set, in the
  scanner's native units. The first placement and every resize read them.
*/
export const MAGNIFIER_LAYOUT = {
  wide: { x: 2.1, scale: .62 },
  narrow: { x: 1.35, scale: .64 },
};

/**
 * True where the scanner fills the screen's width: below 700px, where it
 * switches to its phone camera (getPose in original-scanner.js), and on any
 * portrait screen, where the desktop camera crops both sides of the scanner.
 */
export const isNarrowScene = (width, height) => width < 700 || width < height;

/** Fits the approved accessory to the unmodified scanner, in native units. */
export function placeScannerMagnifier(THREE, group, unitScale=1, {narrow=false}={}) {
  const {x, scale} = MAGNIFIER_LAYOUT[narrow ? 'narrow' : 'wide'];
  group.position.set(0,0,0);
  // Preserve the approved diagonal: the internal handle yaw is +.48.
  group.rotation.set(0,-.18,0);
  group.scale.setScalar(scale);
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group);
  // Account for the camera looking down onto an elevated instrument: a heel
  // merely past the physical edge still projects over the scanner. This fixed
  // native pose clears the front silhouette on both homepage camera layouts.
  const z=2.98;
  // The unchanged carriage vents top out at .462. Its full automatic pass
  // must clear the lowest part of the tool, including the thicker grip.
  const y=.47-bounds.min.y;
  group.position.set(x*unitScale,y*unitScale,z*unitScale);
  group.scale.setScalar(scale*unitScale);
  group.updateMatrixWorld(true);
}
