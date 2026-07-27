/*
  A running local clock, standing in for the words "based in New York".

  Paired with the coordinates above it, this says where she is without
  saying it, and gives the page one thing that is alive.

  If this never runs the element stays hidden by CSS, so nothing looks
  broken or half-finished.
*/

const el = document.querySelector<HTMLTimeElement>('[data-clock]');

if (el) {
  const timeZone = el.dataset.tz || 'America/New_York';

  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });

  let timer = 0;

  const tick = () => {
    el.textContent = format.format(new Date());
  };

  const start = () => {
    tick();
    timer = window.setInterval(tick, 1000);
  };

  const stop = () => {
    clearInterval(timer);
    timer = 0;
  };

  start();

  // No reason to keep counting for a tab nobody is looking at.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (!timer) start();
  });
}
