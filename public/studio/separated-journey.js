// One continuous clock: there is no departure/arrival easing restart.
export function journeySample(progress) {
  const t=Math.max(0,Math.min(1,progress));
  const p=t*t*t*(t*(t*6-15)+10);
  return {outgoing:2.05*p,incoming:2.05*(p-1),retreat:t===0||t===1?0:Math.sin(Math.PI*p)*.07};
}
export const studioSurfaces=new Map();
export function registerStudioSurface(name,surface){studioSurfaces.set(name,surface);return ()=>{if(studioSurfaces.get(name)===surface)studioSurfaces.delete(name);};}
