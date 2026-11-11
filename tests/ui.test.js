import test from 'node:test';
import assert from 'node:assert/strict';

test('웹 UI 라우팅: 메인 → AI 대결 → 결과 → 칩 지갑 → 기록',async()=>{
 const listeners={};const storage=new Map();
 const toast={textContent:'',classList:{toggle(){}}};
 const root={innerHTML:'',addEventListener(type,handler){(listeners[type]??=[]).push(handler);}};
 globalThis.document={getElementById:id=>id==='app'?root:id==='toast'?toast:null,querySelector:()=>null};
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 globalThis.location={search:'',href:'file:///tmp/PLAY_NOW.html',hostname:'',protocol:'file:'};
 globalThis.window={scrollTo(){}};
 Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
 globalThis.confirm=()=>true;
 await import(`../src/main.js?run=ui-smoke`);
 const click=async dataset=>{const target={dataset,closest(){return this;},classList:{contains(){return false;}}};for(const cb of listeners.click||[])await cb({target});};
 assert.match(root.innerHTML,/game-card/);
 await click({open:'trust'});assert.match(root.innerHTML,/게임 방법/);
 await click({start:'ai'});assert.match(root.innerHTML,/믿을까요/);
 for(let i=0;i<6;i++)await click({trust:'cooperate'});
 assert.match(root.innerHTML,/GAME COMPLETE/);
 await click({action:'wallet'});assert.match(root.innerHTML,/씽크칩 지갑/);
 await click({action:'records'});assert.match(root.innerHTML,/나의 두뇌 기록/);
 const saved=JSON.parse(storage.get('brain-arena:mvp:v2'));
 assert.equal(saved.history.length,1);
});

test('뒤집어 3! 힌트 사용: 씽크칩이 차감됨',async()=>{
 const listeners={};const storage=new Map();
 const root={innerHTML:'',addEventListener(type,handler){(listeners[type]??=[]).push(handler);}};
 const toast={textContent:'',classList:{toggle(){}}};
 globalThis.document={getElementById:id=>id==='app'?root:id==='toast'?toast:null,querySelector:()=>({textContent:''})};
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 globalThis.location={search:'',href:'file:///tmp/PLAY_NOW.html',hostname:'',protocol:'file:'};
 globalThis.window={scrollTo(){}};
 Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});globalThis.confirm=()=>true;
 await import(`../src/main.js?run=ui-flip-hint`);
 const click=async dataset=>{const target={dataset,closest(){return this;},classList:{contains(){return false;}}};for(const cb of listeners.click||[])await cb({target});};
 await click({open:'flip'});await click({start:'solo'});await click({action:'hint'});
 const saved=JSON.parse(storage.get('brain-arena:mvp:v2'));
 assert.equal(saved.chips,70);
 assert.match(root.innerHTML,/추천:/);
});
