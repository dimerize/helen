import { archiveSelection, archiveSelectionURL } from './archive-layout.js';

// Opening an image creates one reversible table → inspection entry. Moving
// between related images updates that entry, so Back always returns to the table.
export function createArchiveHistory({window,history,location,items,onSelect}){
  let closing=false,started=false;
  function sync(){closing=false;onSelect(archiveSelection(location.href,items));}
  function start(){
    if(started)return;
    started=true;window.addEventListener('popstate',sync);
    const id=archiveSelection(location.href,items);
    if(id){
      const owned=Boolean(history.state?.archiveSelection?.owned);
      history.replaceState({...history.state,archiveSelection:{id,owned}},'',location.href);
      onSelect(id);
    }
  }
  function open(id){
    if(closing||!items.some(item=>item.id===id))return false;
    const replacing=Boolean(archiveSelection(location.href,items));
    const owned=replacing?Boolean(history.state?.archiveSelection?.owned):true;
    history[replacing?'replaceState':'pushState']({...history.state,archiveSelection:{id,owned}},'',archiveSelectionURL(location.href,id));
    onSelect(id);return true;
  }
  function close(){
    if(closing)return;
    if(history.state?.archiveSelection?.owned&&archiveSelection(location.href,items)){
      closing=true;history.back();
    }else{
      history.replaceState({...history.state,archiveSelection:null},'',archiveSelectionURL(location.href,null));
      onSelect(null);
    }
  }
  function dispose(){window.removeEventListener('popstate',sync);started=false;}
  return {start,open,close,dispose};
}
