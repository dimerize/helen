import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialNavigation } from '../public/studio/spatial-navigation.js';

// Model the browser's event and navigation boundary. The regression was this
// module cancelling ordinary clicks and delaying them for whole-page motion.
function browser() {
  const effects = {listeners: [], frames: [], navigation: [], storage: []};
  const target = name => {
    const element = new EventTarget();
    const add = element.addEventListener.bind(element);
    element.addEventListener = (type, handler, options) => {effects.listeners.push([name,type]);add(type,handler,options);};
    return element;
  };
  const document = target('document'), window = target('window'), media = target('media');
  Object.assign(document, {body:{dataset:{}},documentElement:{removeAttribute(){}},querySelector(){return null;}});
  Object.assign(window, {
    location:{href:'https://helenzhang.studio/',assign:href=>effects.navigation.push(href)},
    matchMedia:()=>media,
    sessionStorage:{getItem(){return null;},setItem(...args){effects.storage.push(args);},removeItem(){}},
    requestAnimationFrame:callback=>effects.frames.push(callback),clearTimeout(){},setTimeout(){return 1;},
    CustomEvent,
  });
  return {document,window,effects};
}

test('ordinary links retain native click handling without a departure delay', async () => {
  const env=browser();
  const controller=createSpatialNavigation({...env,navigate:href=>env.effects.navigation.push(href)});
  const click=new Event('click',{cancelable:true});
  const link={getAttribute:key=>key==='href'?'/archive?view=index':null,hasAttribute:()=>false};
  Object.defineProperties(click,{button:{value:0},target:{value:{closest:()=>link}}});
  env.document.dispatchEvent(click);
  await Promise.resolve();await Promise.resolve();
  assert.equal(click.defaultPrevented,false,'browser owns the destination, query and history');
  assert.deepEqual(env.effects.navigation,[],'no scripted replacement navigation');
  assert.deepEqual(env.effects.storage,[],'no later arrival animation is queued');
  controller.dispose();
});

test('module import does not attach page-motion listeners or schedule arrival work', async () => {
  const env=browser();
  globalThis.window=env.window;globalThis.document=env.document;
  try {
    await import(`../public/studio/spatial-navigation.js?native-navigation=${Date.now()}`);
    assert.deepEqual(env.effects.listeners,[],'the page does not acquire a navigation interceptor');
    assert.deepEqual(env.effects.frames,[],'no surprise animation after load or history restore');
  } finally {delete globalThis.window;delete globalThis.document;}
});

test('legacy explicit initialization remains inert during history and gallery lifecycle events', () => {
  const env=browser();
  const controller=createSpatialNavigation(env);
  for(const type of ['pageshow','pagehide','pagereveal','pageswap','popstate'])env.window.dispatchEvent(new Event(type));
  env.document.dispatchEvent(new CustomEvent('studio:gallery',{detail:{open:true}}));
  env.document.dispatchEvent(new CustomEvent('studio:portal-travel',{detail:{phase:'returned'}}));
  assert.deepEqual(env.effects,{listeners:[],frames:[],navigation:[],storage:[]});
  assert.doesNotThrow(()=>{controller.dispose();controller.dispose();});
});
