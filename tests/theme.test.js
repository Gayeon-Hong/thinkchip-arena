import test from 'node:test';
import assert from 'node:assert/strict';
import {THEME_KEY,readThemePreference,initTheme,resolveTheme,setTheme,toggleTheme,getThemePreference} from '../src/theme.js';
let storage,media,callback,meta;
function env(dark=false) {
  storage=new Map();
  media={matches:dark,addEventListener(type,fn){callback=fn;}};
  meta={setAttribute(key,value){this[key]=value;}};
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  globalThis.document={documentElement:{dataset:{},style:{}},querySelector:()=>meta};
  globalThis.matchMedia=()=>media;
}
test('Theme: first visit opens in night mode, even on a light device',()=>{
  env(false);initTheme();assert.equal(getThemePreference(),'dark');assert.equal(resolveTheme(),'dark');assert.equal(document.documentElement.dataset.theme,'dark');
});
test('Theme: toggling persists explicit choice and updates theme-color',()=>{
  env(true);initTheme();toggleTheme();assert.equal(storage.get(THEME_KEY),'light');assert.equal(resolveTheme(),'light');assert.equal(meta.content,'#f4f6fb');
});
test('Theme: saved preference wins over device mode after reinitialization',()=>{
  env(false);storage.set(THEME_KEY,'dark');initTheme();assert.equal(resolveTheme(),'dark');assert.equal(readThemePreference(),'dark');
});
test('Theme: invalid stored values fall back to night',()=>{
  env(false);storage.set(THEME_KEY,'unknown');initTheme();assert.equal(getThemePreference(),'dark');assert.equal(resolveTheme(),'dark');
});
test('Theme: system change updates display only in system mode',()=>{
  env(false);storage.set(THEME_KEY,'system');let calls=0;initTheme(()=>calls++);media.matches=true;callback();assert.equal(resolveTheme(),'dark');assert.equal(calls,1);
  setTheme('light');callback();assert.equal(resolveTheme(),'light');assert.equal(calls,1);
});
test('Theme: storage unavailable does not break rendering',()=>{
  env(true);globalThis.localStorage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.doesNotThrow(()=>initTheme());assert.doesNotThrow(()=>setTheme('light'));assert.equal(resolveTheme(),'light');
});
test('Theme: invalid runtime values do not overwrite a good preference',()=>{
  env(true);initTheme();setTheme('dark');setTheme('not-a-theme');assert.equal(getThemePreference(),'dark');
});
test('Theme: wallet data remains untouched',()=>{
  env(false);const key='brain-arena:mvp:v2';const value=JSON.stringify({chips:157,best:{flip:200}});storage.set(key,value);
  initTheme();setTheme('dark');setTheme('light');setTheme('system');assert.equal(storage.get(key),value);
});
