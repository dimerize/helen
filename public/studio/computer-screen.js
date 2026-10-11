/** The canvas is the distant CRT preview; focused interaction uses the real HTML. */
export async function createComputerScreen(container, {signal} = {}) {
  const canvas = container.ownerDocument.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const context = canvas.getContext('2d');
  const instagram = container.querySelector('[data-computer-pane="instagram"]');
  const mail = container.querySelector('[data-computer-pane="mail"]');
  const buttons = [...container.querySelectorAll('[data-computer-app]')];
  const images = [...container.querySelectorAll('[data-computer-avatar], [data-computer-photo]')];
  const loading = new AbortController();
  let disposed = false;

  function setApp(app) {
    if (disposed) return;
    const isMail = app === 'mail';
    instagram.hidden = isMail;
    mail.hidden = !isMail;
    container.querySelector('[data-computer-title]').textContent = isMail ? 'Mail — A note to Helen' : `Instagram — ${container.dataset.profileName}`;
    container.querySelector('[data-computer-location]').textContent = isMail ? 'New message' : container.dataset.profileLocation;
    container.querySelector('[data-computer-status]').textContent = isMail ? 'Helen’s address book' : 'Public profile preview';
    container.querySelector('[data-computer-hint]').textContent = isMail ? 'Opens your email app' : 'Open Instagram to explore';
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.computerApp === app));
  }
  const handlers = buttons.map(button => {
    const handler = () => setApp(button.dataset.computerApp);
    button.addEventListener('click', handler);
    return [button, handler];
  });
  function hide() {
    container.hidden = true;
    container.inert = true;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    hide();
    loading.abort();
    for (const [button, handler] of handlers) button.removeEventListener('click', handler);
    signal?.removeEventListener('abort', dispose);
    // Release the backing bitmap. The gallery owns and disposes its CanvasTexture.
    canvas.width = canvas.height = 1;
  }
  const screen = {
    canvas,
    show() {
      if (disposed) return;
      setApp('instagram');
      instagram.scrollTop = 0;
      mail.scrollTop = 0;
      container.hidden = false;
      container.inert = false;
      container.querySelector('[data-computer-profile]').focus({preventScroll: true});
    },
    hide,
    place({left, top, width, height, compact = false}) {
      if (disposed || ![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
      const baseWidth = compact ? 400 : 600;
      const baseHeight = compact ? 300 : 450;
      Object.assign(container.style, {
        left: `${left}px`, top: `${top}px`, width: `${baseWidth}px`, height: `${baseHeight}px`,
        transform: `scale(${width / baseWidth}, ${height / baseHeight})`,
      });
      container.dataset.compact = String(compact);
      // Keep primary touch targets at least 44 CSS pixels after the glass transform.
      container.style.setProperty?.('--hz-computer-target', `${Math.max(44, 44 * baseHeight / height)}px`);
    },
    dispose,
  };
  hide();
  setApp('instagram');
  signal?.addEventListener('abort', dispose, {once: true});
  if (signal?.aborted) dispose();
  if (!disposed) {
    const decoded = await Promise.all(images.map(image => waitForImage(image, loading.signal)));
    if (!disposed && context) drawPreview(context, decoded, container.dataset);
  }
  return screen;
}

function waitForImage(image, signal) {
  if (signal.aborted || image.complete) return Promise.resolve(image.naturalWidth > 0 ? image : null);
  return new Promise(resolve => {
    const finish = () => {
      clearTimeout(timeout);
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      signal.removeEventListener('abort', finish);
      resolve(!signal.aborted && image.naturalWidth > 0 ? image : null);
    };
    const timeout = setTimeout(finish, 2500);
    image.addEventListener('load', finish, {once: true});
    image.addEventListener('error', finish, {once: true});
    signal.addEventListener('abort', finish, {once: true});
  });
}

function drawPreview(cx, images, profile) {
  const crop = (image, x, y, width, height) => {
    cx.fillStyle = '#262c2e';
    cx.fillRect(x, y, width, height);
    if (!image) return;
    const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sw = width / ratio, sh = height / ratio;
    cx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, width, height);
  };
  cx.fillStyle = '#424448';
  cx.fillRect(0, 0, 1024, 768);
  cx.fillStyle = '#d5d7d1';
  cx.font = '18px monospace';
  cx.fillText('Helen’s computer', 20, 30);
  cx.fillText('Instagram / Mail', 770, 30);
  cx.fillStyle = '#bfc1bd';
  cx.fillRect(17, 51, 990, 677);
  cx.fillStyle = '#292d59';
  cx.fillRect(22, 56, 980, 36);
  cx.fillStyle = '#fff';
  cx.font = '19px monospace';
  cx.fillText(`Instagram — ${profile.profileName}`, 35, 81);
  cx.fillText('−  □', 936, 81);
  cx.fillStyle = '#242625';
  cx.font = '17px monospace';
  cx.fillText('Instagram    Mail', 34, 122);
  cx.fillText(profile.profileLocation, 590, 122);
  cx.fillStyle = '#0c1013';
  cx.fillRect(23, 138, 978, 565);
  cx.fillStyle = '#f4f4f3';
  cx.font = '34px Arial';
  cx.fillText('Instagram', 52, 190);
  cx.fillStyle = '#ecefed';
  cx.fillRect(783, 156, 186, 46);
  cx.fillStyle = '#191d1a';
  cx.font = '20px Arial';
  cx.fillText('Open profile ↗', 801, 186);
  cx.save();
  cx.beginPath();
  cx.arc(112, 286, 52, 0, Math.PI * 2);
  cx.clip();
  crop(images[0], 60, 234, 104, 104);
  cx.restore();
  cx.fillStyle = '#f4f4f3';
  cx.font = '28px Arial';
  cx.fillText(profile.instagram, 208, 270);
  cx.font = '20px Arial';
  cx.fillText(profile.profileName, 209, 305);
  cx.fillStyle = '#b5bcc0';
  cx.font = '17px Arial';
  cx.fillText(profile.profileLine, 209, 335);
  // Keep the second photo row inside the window, underneath the OS status bar.
  cx.save();
  cx.beginPath();
  cx.rect(23, 138, 978, 565);
  cx.clip();
  images.slice(1).forEach((image, i) => crop(image, 50 + (i % 3) * 310, 374 + Math.floor(i / 3) * 282, 305, 277));
  cx.restore();
  cx.fillStyle = '#bfc1bd';
  cx.fillRect(0, 735, 1024, 33);
  cx.fillStyle = '#262725';
  cx.font = '19px monospace';
  cx.fillText('HZ    Instagram       Mail', 14, 758);
  cx.fillText('Online', 928, 758);
  cx.fillStyle = '#313632';
  cx.font = '14px monospace';
  cx.fillText('Public profile preview', 28, 722);
  cx.fillText('Open Instagram to explore', 778, 722);
  cx.fillStyle = 'rgba(255,255,255,.025)';
  for (let y = 0; y < 768; y += 4) cx.fillRect(0, y, 1024, 1);
}
