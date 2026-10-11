import test from 'node:test';
import assert from 'node:assert/strict';
const links = await import('../public/studio/scan-world/scan-links.js').catch(() => ({}));
test('each lifted scan has its own stable archive destination', () => {
  assert.equal(typeof links.scanArchiveURL, 'function');
  assert.deepEqual([0,1,2].map(links.scanArchiveURL), ['/archive?scan=train-scan','/archive?scan=train-scan-wide','/archive?scan=train-scan-notice']);
});
test('an archive deep link resolves to the exact original scan', () => {
  assert.equal(typeof links.scanIndexFromURL, 'function');
  assert.equal(links.scanIndexFromURL('https://helenzhang.studio/?scan=train-scan-notice&explore=1'),2);
  assert.equal(links.scanIndexFromURL('https://helenzhang.studio/?scan=train-scan'),0);
  for(const value of ['https://helenzhang.studio/','https://helenzhang.studio/?scan=unknown','https://helenzhang.studio/?scan=../../x','not a URL']) assert.equal(links.scanIndexFromURL(value), null);
});
