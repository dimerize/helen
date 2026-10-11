// Selection intent and the native dialog's visible state are separate during
// an animated exit. Keep them together at the history/animation boundary.
export function createArchiveInspection({dialog,motion,show,change=()=>{}}){
  let selected=null;
  function select(id,trigger){
    const open=!dialog.open||selected===null;
    selected=id;
    if(!id){motion.close();return;}
    show(id);
    if(open)motion.open(trigger);
    else change(id);
  }
  return {select};
}
