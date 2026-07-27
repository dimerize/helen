/*
  Left and right arrows step between works.

  Deliberately not a swipe gesture. A horizontal swipe handler on a page
  that scrolls vertically has to guess what the visitor meant, and gets it
  wrong often enough to feel like a trap. The links are visible, the edge
  navigation is always there, and the keyboard shortcut is a bonus for
  anyone moving quickly — nothing depends on it.
*/

const prev = document.querySelector<HTMLAnchorElement>('[data-key-prev]');
const next = document.querySelector<HTMLAnchorElement>('[data-key-next]');

if (prev || next) {
  addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

    // Never steal a key from something the visitor is typing into or scrubbing.
    const target = event.target as HTMLElement | null;
    if (target) {
      if (target.isContentEditable) return;
      if (/^(INPUT|TEXTAREA|SELECT|VIDEO|AUDIO)$/.test(target.tagName)) return;
    }

    if (event.key === 'ArrowLeft' && prev) {
      event.preventDefault();
      location.href = prev.href;
    } else if (event.key === 'ArrowRight' && next) {
      event.preventDefault();
      location.href = next.href;
    }
  });
}
