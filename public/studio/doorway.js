import { createStudioPortal } from './studio-portal.js';
import { createHomepageEcho } from './homepage-echo.js';
const dialog = document.querySelector('#studio-portal');
let galleryModule;
const loadGallery = () => galleryModule ||= import('./gallery.js').catch(error => {galleryModule=null;throw error;});
let warmed=false;
function warmGallery() {
  if(warmed)return;warmed=true;
  loadGallery().catch(()=>{});
  // Start the real installation assets while the visitor approaches the link.
  // Opening still captures the current page and keeps the physical door closed.
  for(const name of ['thesis-elongated','thesis-painting','thesis-dark-grid']) {
    const image=new Image();image.src=`/artwork/${name}.webp`;image.decode().catch(()=>{});
  }
}
const portal = createStudioPortal({
  dialog,
  captureHomepage: createHomepageEcho,
  createExperience: async (root, options) => {
    const {createGalleryExperience} = await loadGallery();
    return createGalleryExperience(root, options);
  },
  prepare() {
    dialog.dataset.state = 'loading';
    dialog.style.setProperty('--hz-ink', '#f0eee8');
    dialog.querySelector('.hz-enter').disabled = true;
    dialog.querySelector('.hz-enter').textContent = 'Preparing the room';
    dialog.querySelector('.hz-sr').textContent = 'Preparing the studio. The door will stay closed until you enter.';
    dialog.querySelector('.hz-fallback').hidden = true;
    dialog.querySelector('.hz-brand').hidden = false;
  },
  onError(error) {
    console.warn('Studio uses its installation view:', error.message);
    dialog.dataset.state = 'fallback';
    dialog.querySelector('.hz-fallback').hidden = false;
    dialog.querySelector('.hz-sr').textContent = 'The interactive room is unavailable. The installation photographs are available below.';
  },
});
document.querySelectorAll('[data-open-gallery]').forEach(link => {
  link.addEventListener('pointerenter',warmGallery,{once:true});
  link.addEventListener('focus',warmGallery,{once:true});
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();warmGallery();portal.open(link);
  });
});
dialog.querySelector('.hz-brand').addEventListener('click', event => {event.preventDefault();portal.requestClose();});
