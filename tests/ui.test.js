import test from 'node:test';
import assert from 'node:assert/strict';

// 실제 브라우저의 .play-panel 처럼 크기를 돌려주는 가짜 패널이에요.
// 시작 화면 자동 맞춤(fitControls)이 이 값으로 조작 버튼이 화면 밖인지 계산합니다.
const fakePanel=()=>({textContent:'',getBoundingClientRect:()=>({x:0,y:120,top:120,left:0,right:360,bottom:1020,width:360,height:900})});

test('웹 UI 라우팅: 메인 → AI 대결 → 결과 → 칩 지갑 → 기록',async()=>{
 const listeners={};const storage=new Map();const scrolls=[];
 const toast={textContent:'',classList:{toggle(){}}};
 const root={innerHTML:'',addEventListener(type,handler){(listeners[type]??=[]).push(handler);}};
 const panel=fakePanel();
 globalThis.document={getElementById:id=>id==='app'?root:id==='toast'?toast:null,querySelector:sel=>sel==='.play-panel'?panel:null};
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 globalThis.location={search:'',href:'file:///tmp/PLAY_NOW.html',hostname:'',protocol:'file:'};
 globalThis.window={scrollTo(...args){scrolls.push(args);}};
 globalThis.innerHeight=800;globalThis.scrollY=0;
 Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
 globalThis.confirm=()=>true;
 await import(`../src/main.js?run=ui-smoke`);
 const click=async dataset=>{const target={dataset,closest(){return this;},classList:{contains(){return false;}}};for(const cb of listeners.click||[])await cb({target});};
 assert.match(root.innerHTML,/game-card/);
 await click({open:'trust'});assert.match(root.innerHTML,/게임 방법/);
 await click({start:'ai'});assert.match(root.innerHTML,/믿을까요/);
 // fitControls 의 120ms 타이머가 테스트 안에서 끝나도록 기다려요 (테스트가 끝난 뒤 실행되면 uncaughtException)
 await new Promise(resolve=>setTimeout(resolve,200));
 assert.ok(scrolls.some(args=>args[0]&&args[0].behavior==='smooth'),'조작 버튼이 보이도록 화면을 내려요');
 for(let i=0;i<6;i++)await click({trust:'cooperate'});
 assert.match(root.innerHTML,/GAME COMPLETE/);
 await click({action:'wallet'});assert.match(root.innerHTML,/씽크칩 지갑/);
 await click({action:'records'});assert.match(root.innerHTML,/나의 두뇌 기록/);
 const saved=JSON.parse(storage.get('brain-arena:mvp:v2'));
 assert.equal(saved.history.length,1);
});

test('뒤집어 3! 힌트 사용: 씽크칩이 차감됨',async()=>{
 const listeners={};const storage=new Map();const scrolls=[];
 const root={innerHTML:'',addEventListener(type,handler){(listeners[type]??=[]).push(handler);}};
 const toast={textContent:'',classList:{toggle(){}}};
 const panel=fakePanel();
 globalThis.document={getElementById:id=>id==='app'?root:id==='toast'?toast:null,querySelector:sel=>sel==='.play-panel'?panel:null};
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 globalThis.location={search:'',href:'file:///tmp/PLAY_NOW.html',hostname:'',protocol:'file:'};
 globalThis.window={scrollTo(...args){scrolls.push(args);}};
 globalThis.innerHeight=800;globalThis.scrollY=0;
 Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});globalThis.confirm=()=>true;
 await import(`../src/main.js?run=ui-flip-hint`);
 const click=async dataset=>{const target={dataset,closest(){return this;},classList:{contains(){return false;}}};for(const cb of listeners.click||[])await cb({target});};
 await click({open:'flip'});await click({start:'solo'});await click({action:'hint'});
 await new Promise(resolve=>setTimeout(resolve,200));
 assert.ok(scrolls.some(args=>args[0]&&args[0].behavior==='smooth'),'조작 버튼이 보이도록 화면을 내려요');
 const saved=JSON.parse(storage.get('brain-arena:mvp:v2'));
 assert.equal(saved.chips,70);
 assert.match(root.innerHTML,/추천:/);
});
