import { createStudioPortal } from './studio-portal.js';
import { createHomepageEcho } from './homepage-echo.js';
const dialog = document.querySelector('#studio-portal');
const portal = createStudioPortal({
  dialog,
  captureHomepage: createHomepageEcho,
  createExperience: async (root, options) => {
    const {createGalleryExperience} = await import('./gallery.js');
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
document.querySelectorAll('[data-open-gallery]').forEach(link => link.addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); portal.open(link);
}));
dialog.querySelector('.hz-brand').addEventListener('click', event => {event.preventDefault();portal.requestClose();});
