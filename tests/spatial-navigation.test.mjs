import test from 'node:test';
import assert from 'node:assert/strict';

const spatial = await import('../public/studio/spatial-navigation.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const base = 'https://helenzhang.studio/';
const intent = overrides => spatial.navigationIntent?.({currentURL: base, href: '/archive', ...overrides});

test('route identity recognizes the gallery query without misclassifying project or external URLs', () => {
  for (const [href, want] of [['/', 'home'], ['/archive/', 'archive'], ['/gallery', 'gallery'], ['/?room=gallery', 'gallery'], ['/project?work=thesis', null], ['https://elsewhere.test/archive', null], ['javascript:alert(1)', null]]) {
    assert.equal(spatial.studioRoute?.(href, base), want, href);
  }
});

test('ordinary internal page navigation preserves the intended destination and its query', () => {
  assert.deepEqual(intent({href:'/archive?view=index'}), {from:'home', to:'archive', fromURL:base, toURL:'https://helenzhang.studio/archive?view=index'});
});

test('native modified, hash, external, download, target, and gallery-trigger clicks remain untouched', () => {
  for (const change of [{button:1},{metaKey:true},{ctrlKey:true},{altKey:true},{shiftKey:true},{defaultPrevented:true},{href:'#entrances'},{href:'/archive#item'},{href:'mailto:hello@example.com'},{href:'https://elsewhere.test/archive'},{download:true},{target:'_blank'},{rel:'external noopener'},{galleryTrigger:true},{href:'/'},{href:'/project?work=thesis'}]) {
    assert.equal(intent(change), null, JSON.stringify(change));
  }
});

test('portal travel and homepage scene modes exclusively retain ownership', () => {
  for (const sceneMode of ['entering','world','leaving']) assert.equal(intent({sceneMode}), null);
  assert.equal(intent({portalActive:true}), null);
  assert.equal(intent({sceneMode:'home'})?.to, 'archive');
  assert.equal(intent({currentURL:base+'archive', href:'/'})?.to, 'home');
});

test('a navigation lock refuses a second click and resets for a restored document', () => {
  assert.equal(typeof spatial.createTravelState, 'function');
  const state = spatial.createTravelState();
  assert.equal(state.begin(), true);
  assert.equal(state.begin(), false);
  state.reset();
  assert.equal(state.begin(), true);
  state.reset(); state.setPortal(true);
  assert.equal(state.begin(), false);
  state.setPortal(false);
  assert.equal(state.begin(), true);
});

test('arrival records cannot leak to an unrelated page, external URL, or a stale later visit', () => {
  const record = {version:1, from:'home', to:'archive', fromURL:base, toURL:base+'archive', at:1000};
  assert.deepEqual(spatial.readTravelRecord?.(JSON.stringify(record), base+'archive', 1200), record);
  for (const [raw, url, now] of [[JSON.stringify(record),base,1200],[JSON.stringify(record),base+'archive',20000],['not json',base,1200],[JSON.stringify({...record,fromURL:'https://elsewhere.test/'}),base+'archive',1200],[JSON.stringify({...record,to:'home'}),base+'archive',1200],[JSON.stringify(record),base+'archive',900]]) {
    assert.equal(spatial.readTravelRecord?.(raw,url,now), null);
  }
});

test('movement tilts up toward Archive, gathers toward Home, and advances toward the Gallery door', () => {
  const archive = spatial.travelGeometry?.('archive','depart', {width:1200,height:800});
  const home = spatial.travelGeometry?.('home','depart', {width:1200,height:800});
  const gallery = spatial.travelGeometry?.('gallery','depart', {width:1200,height:800});
  assert.ok(archive?.y > 0 && archive?.z < 0 && archive?.rx > 0, 'viewer rises over the table');
  assert.ok(home?.z < 0 && home?.scale < 1, 'objects gather back toward the scanner');
  assert.ok(gallery?.z > 0 && gallery?.scale > 1, 'viewer advances toward the doorway');
  assert.ok(archive.duration + spatial.travelGeometry('archive','arrive').duration <= 650);
});

test('geometry remains bounded and finite for mobile, enormous, or invalid viewports', () => {
  for (const viewport of [{width:390,height:844},{width:10000,height:10000},{width:0,height:NaN}]) {
    for (const route of ['home','archive','gallery']) {
      const geometry = spatial.travelGeometry?.(route,'arrive',viewport);
      assert.ok(geometry && [geometry.x,geometry.y,geometry.z,geometry.rx,geometry.ry,geometry.scale].every(Number.isFinite));
      assert.ok(Math.abs(geometry.x)<=120 && Math.abs(geometry.y)<=130 && Math.abs(geometry.rx)<=24);
    }
  }
});

test('reduced motion removes spatial displacement and all transition delay', () => {
  const geometry = spatial.travelGeometry?.('archive','arrive',{reducedMotion:true});
  assert.ok(geometry);
  assert.deepEqual([geometry.x,geometry.y,geometry.z,geometry.rx,geometry.ry,geometry.scale,geometry.duration], [0,0,0,0,0,1,0]);
});

test('table fan contracts toward the measured anchor and leaves original transforms available', () => {
  const left = spatial.fragmentFlight?.({left:0,top:100,width:100,height:100}, {x:500,y:500}, 0);
  const right = spatial.fragmentFlight?.({left:700,top:500,width:100,height:100}, {x:500,y:500}, 9);
  assert.ok(left?.x>0 && left?.y>0);
  assert.ok(right?.x<0 && right?.y<0);
  assert.ok(left?.scale<1 && right?.scale<1);
  assert.ok(right?.delay<=90);
});
