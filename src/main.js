import {initTheme,toggleTheme,getThemePreference,resolveTheme,setTheme} from './theme.js';
import {icon} from './icons.js';
import {esc,fmt,newSeed} from './util.js';
import {GAMES,GAME_BY_ID,PARTY_GAMES} from './catalog.js';
import {createFlip,playFlip,flipOptions,flipAdvice,flipValue,FLIP_LIMIT,FLIP_TOTAL,simulateFlipBot} from './games/flip.js';
import {createBlind,playBlind,blindAdvice} from './games/blind.js';
import {createTriad,selectTriad,skipTriad,trioAdvice,triadBotTarget} from './games/triad.js';
import {createTrust,playTrust,trustAdvice} from './games/trust.js';
import {createBaseball,playBaseball,baseballAdvice,baseballBotTarget,baseballBotRun,BB_LEN,BB_TRIES} from './games/baseball.js';
import {createNim,playNim,nimAdvice,NIM_ROUNDS} from './games/nim.js';
import {createAuction,playAuction,auctionAdvice,AUC_ROUNDS} from './games/auction.js';
import {createMaze,playMaze,mazeAdvice,mazeBotTarget,insideCorridor,MAZE_W,MAZE_H,MAZE_STAGES} from './games/maze.js';
import {createDraw,playDraw,drawAdvice,drawBotTarget,shapeOf,DRAW_SIZE,DRAW_ROUNDS} from './games/draw.js';
import {toPath} from './games/geometry.js';
import {createMarbles,playMarbles,marblesAdvice,roleOf,parity,PARITY_KO,MB_ROUNDS} from './games/marbles.js';
import {createRedLight,stepRedLight,phaseAt,redLightBotTarget,redLightBotRun,redLightAdvice,RL_TIME,RL_GOAL} from './games/redlight.js';
import {createBridge,playBridge,bridgeAdvice,bridgeBotTarget,bridgeBotRun} from './games/bridge.js';
import {LEVELS,LEVEL_KO} from './util.js';
import {createSudoku,playSudoku,sudokuBotTarget,sudokuAdvice,sudokuLeft,SD_MAX_MISTAKES} from './games/sudoku.js';
import {createMerge,playMerge,mergeBotTarget,mergeAdvice} from './games/merge.js';
import {createStroop,playStroop,endStroop,stroopBotTarget,stroopAdvice,COLORS} from './games/stroop.js';
import {createGomoku,playGomoku,gomokuAI,gomokuAdvice,GM_N} from './games/gomoku.js';
import {createDots,playDots,dotsAI,dotsAdvice,DB_N,DB_H,DB_V,DB_LINES} from './games/dots.js';
import {liveAvailable,connectLive,newRoomCode,normalizeCode} from './live.js';
import {createMinority,playMinority,minorityAdvice,minorityBotTarget,minorityBotRun,MI_ROUNDS,MI_POINT} from './games/minority.js';
import {defaultProfile,normalizeProfile,awardRun,spendChips,awardAd,grantPaid,AD_DAILY_LIMIT,HINT_COST,AD_REWARD,todayKey} from './wallet.js';
import {listChipPacks,buyChipPack,restoreChipOrders} from './toss.js';
import {TOSS_CONFIG,shareInvite,showRewardedAd,initToss,bindBackHandler,exitApp,isRewardedAdSupported} from './toss.js';
import {LIVE_URL} from './live.config.js';
import {aiTell,aiTellReact,BLUFF_GAMES} from './games/bluff.js';
// 계정 (public/account.js): 로그인하면 칩이 계정(서버)에 저장돼요. 없으면(파일로 연 데모·테스트) 예전처럼 이 기기 지갑.
const ACC=globalThis.ThinkChipAccount||null;if(ACC)ACC.init(LIVE_URL);
const acctOn=()=>!!(ACC&&ACC.api);
const loggedIn=()=>acctOn()&&!!ACC.state.loggedIn;
const guest=()=>acctOn()&&!ACC.state.loggedIn; // 로그인 안 함 = 둘러보기 (칩 받기·쓰기·충전 불가)
const bal=()=>acctOn()?(ACC.state.wallet?ACC.state.wallet.chips:0):profile.chips;
const adsToday=()=>acctOn()?(ACC.state.wallet?.adsToday||0):Number(profile.adCount[todayKey()]||0);

const KEY='brain-arena:mvp:v2';
const root=document.getElementById('app');
const params=new URLSearchParams(location.search);
const openGame=GAME_BY_ID[params.get('open')]?params.get('open'):null; // 3D 라운지 테이블에서 바로 게임 소개 화면으로
const partyGame=PARTY_GAMES[params.get('party')]||GAME_BY_ID[params.get('party')]?params.get('party'):null; // 3D 라운지 파티 라운지·테이블 '같이'에서 실시간 방을 그 게임으로 바로 시작
const invitedGame=GAME_BY_ID[params.get('game')] ? params.get('game') : openGame;
const invitedSeed=(params.get('seed')||'').slice(0,80);
const rawTarget=params.get('target');
const parsedTarget=rawTarget===null?null:Number(rawTarget);
const invitedTarget=Number.isFinite(parsedTarget)&&parsedTarget>=0&&parsedTarget<=10000000?parsedTarget:null;
const invitedFrom=(params.get('from')||'친구').slice(0,16);
const invitedRoom=normalizeCode(params.get('room'));
const wantInvite=params.get('invite')==='1'; // 라운지 '카톡으로 친구 부르기' → 방에 들어오자마자 초대 공유
const fromLounge=params.get('from')==='lounge';
// 라운지에서 '연습 / AI 대결'을 이미 골랐으면 모드 선택 화면 없이 바로 시작해요
const directMode=openGame&&['solo','ai'].includes(params.get('mode'))?params.get('mode'):null;
const directLevel=LEVELS.includes(params.get('level'))?params.get('level'):null;
// 처음 들어오면 3D 라운지가 첫 화면. 라운지 로고(?home=1)나 게임/방 링크로 온 경우만 기존 홈을 보여줘요.
const wantLounge=typeof location.replace==='function'&&!['home','open','party','room','game','from','seed','wallet'].some(k=>params.has(k))&&!/\/lounge\//.test(location.pathname||'');
const goLounge=()=>{try{location.replace('./lounge/index.html');}catch{}};
if(wantLounge&&TOSS_CONFIG.target!=='toss')goLounge(); // 토스 앱은 토스 계정 로그인을 마친 뒤 라운지로 (아래 initToss)
const LOUNGE_URL='./lounge/index.html'+(invitedRoom?`?room=${invitedRoom}`:'');
let storageKey=KEY; // must exist before the first readProfile() call
let profile=readProfile();
let screen=invitedRoom||partyGame?'live':invitedGame?'intro':'home';
let live=null; // real-time room: {code, conn, state, status, error, startedRound, cd}
let roomDraft=invitedRoom||'';
let chatOpen=false,chatPeekTimer=null;const chatMuted=new Set();
const LIVE_EXTRA=PARTY_GAMES;
const PARTY_IDS=Object.keys(LIVE_EXTRA);
const liveGameInfo=id=>GAME_BY_ID[id]||LIVE_EXTRA[id]||GAME_BY_ID.flip;
const CHAT_QUICK=['ㅋㅋㅋ','진짜야?','블러핑 아님','믿어봐','⭕ 맞아','❌ 아니야','🤔 애매해','다음엔 이긴다'];
let selectedGame=invitedGame||'blind';
let difficulty='normal';
let session=null;
let rulesOpen=false;
let toastMsg='';
let toastTimer;
let loadingAd=false;
let viewTab='all';
let previousPage='home';
const icons={chip:'⬡',flame:'✦',trophy:'♛',swords:'⚔',bot:'✧',share:'↗'};

function readProfile(){try{return normalizeProfile(JSON.parse(localStorage.getItem(storageKey)))}catch{return defaultProfile();}}
function saveProfile(){try{localStorage.setItem(storageKey,JSON.stringify(profile));}catch{}}
// Toss user key -> separate records per Toss account on the same device (first launch migrates device data).
function useUserKey(hash){if(!hash)return;const k=`${KEY}:u:${hash.slice(0,32)}`;if(k===storageKey)return;
 try{if(localStorage.getItem(k)===null&&localStorage.getItem(KEY)!==null)localStorage.setItem(k,localStorage.getItem(KEY));}catch{}
 storageKey=k;profile=readProfile();render();}
// 로그인: 웹/MS = 카카오 (페이지 이동 후 돌아와요), 토스 = 토스 계정으로 자동
function askLogin(why=''){if(!acctOn())return;
 if(TOSS_CONFIG.target==='toss'){flash('잠시만요, 연결하는 중이에요.');initToss().then(st=>st.userKeyHash?ACC.loginToss(st.userKeyHash,profile.nickname):false).then(ok=>ok||ACC.loginDevice(profile.nickname)).catch(()=>{});return;}
 if(confirm(`${why}로그인이 필요해요.\n카카오로 로그인할까요? (칩·옷·친구가 계정에 저장돼요)`)){if(!ACC.loginKakao(location.href.split('#')[0]))flash('지금은 로그인할 수 없어요. 인터넷 연결을 확인해 주세요.');}}
// 결제 지급: 결제 완료 → 먼저 이 기기 줄에 넣고 서버 지갑에 올려요 (같은 주문은 서버가 한 번만 지급, 실패하면 다음에 다시)
const PQ='thinkchip:purchaseq';
const skuForChips=n=>(TOSS_CONFIG.chipPacks||[]).find(p=>p.chips===n)?.sku||'';
function readPQ(){try{return JSON.parse(localStorage.getItem(PQ))||[];}catch{return [];}}
async function flushPurchases(){if(!loggedIn()||flushPurchases.busy)return;flushPurchases.busy=true;
 try{for(const it of readPQ()){let r;try{r=await ACC.call('purchase',it);}catch{break;}
  if(r.ok||r.error==='bad'){try{localStorage.setItem(PQ,JSON.stringify(readPQ().filter(x=>x.orderId!==it.orderId)));}catch{}if(r.granted)flash(`⬡ ${fmt(r.granted)} 씽크칩이 계정에 충전됐어요!`);}}}
 finally{flushPurchases.busy=false;}}
function flash(message){toastMsg=message;renderToast();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toastMsg='';renderToast()},3200);}
function renderToast(){let el=document.getElementById('toast');if(!el)return;el.textContent=toastMsg;el.classList.toggle('show',!!toastMsg);}
function chips(n=bal()){return `<span class="chip-icon">${icon('chip')}</span><strong>${fmt(n)}</strong>`;}
function labelMode(mode){return ({solo:'혼자 연습',ai:'AI 대결',friend:'친구 기록 대결',live:'실시간 대결'})[mode]||'연습';}
function gameById(){return GAME_BY_ID[selectedGame];}
function currentSeed(){return invitedGame===selectedGame&&invitedSeed?invitedSeed:newSeed();}
function aiTarget(id,seed,level){return id==='flip'?simulateFlipBot(seed,level):id==='triad'?triadBotTarget(seed,level):id==='baseball'?baseballBotTarget(seed,level):id==='maze'?mazeBotTarget(seed,level):id==='draw'?drawBotTarget(seed,level):id==='redlight'?redLightBotTarget(seed,level):id==='bridge'?bridgeBotTarget(seed,level):id==='minority'?minorityBotTarget(seed,level):id==='sudoku'?sudokuBotTarget(seed,level):id==='merge'?mergeBotTarget(seed,level):id==='stroop'?stroopBotTarget(seed,level):null;}
function createRound(id,seed,level){return ({flip:()=>createFlip(seed),blind:()=>createBlind(seed,level),triad:()=>createTriad(seed),trust:()=>createTrust(seed,level),baseball:()=>createBaseball(seed,level),nim:()=>createNim(seed,level),auction:()=>createAuction(seed,level),maze:()=>createMaze(seed,level),draw:()=>createDraw(seed,level),marbles:()=>createMarbles(seed,level),redlight:()=>createRedLight(seed,level),bridge:()=>createBridge(seed,level),minority:()=>createMinority(seed,level),sudoku:()=>createSudoku(seed,level),merge:()=>createMerge(seed,level),stroop:()=>createStroop(seed,level),gomoku:()=>createGomoku(seed,level,true),dots:()=>createDots(seed,level,true)})[id]();}
function header({back=false,title='씽크칩 아레나'}={}){
 const dark=resolveTheme()==='dark';
 return `<header class="topbar"><div class="top-left">${back?`<button class="back icon-btn" data-action="back" aria-label="뒤로가기">${icon('back')}</button>`:`<div class="brand-avatar brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" width="100%" height="100%"><defs><linearGradient id="bmk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5f8bff"/><stop offset=".55" stop-color="#7660ff"/><stop offset="1" stop-color="#9b5cff"/></linearGradient></defs><polygon points="20,3 34.7,11.5 34.7,28.5 20,37 5.3,28.5 5.3,11.5" fill="url(#bmk)" stroke="url(#bmk)" stroke-width="3" stroke-linejoin="round"/><path d="M20 10.5Q21.6 18.4 29.5 20Q21.6 21.6 20 29.5Q18.4 21.6 10.5 20Q18.4 18.4 20 10.5Z" fill="#fff"/></svg></div>`}<div class="brand-lockup"><div class="brand-title">${esc(title)}</div><div class="brand-sub">THINKCHIP ARENA</div></div></div><div class="top-actions"><a class="lounge-pill lounge-link" href="./lounge/index.html" aria-label="3D 라운지로" title="3D 라운지로"><span aria-hidden="true">🏠</span>라운지</a><button class="theme-toggle icon-btn" data-action="toggle-theme" aria-label="${dark?'데이':'나이트'} 모드로 전환" title="${dark?'데이':'나이트'} 모드로 전환">${icon(dark?'sun':'moon')}</button><button class="wallet-link" data-action="wallet" aria-label="씽크칩 지갑 열기">${chips()}</button></div></header>`;
}
function bottomNav(active){if(fromLounge)return ''; // 라운지에서 온 화면엔 2D 메뉴를 안 보여요 (라운지가 메뉴)

 const items=[['home','grid','게임'],['records','trophy','내 기록'],['wallet','chip','씽크칩'],['settings','settings','설정']];
 return `<nav class="bottom-nav" aria-label="하단 메뉴">${items.map(([id,symbol,label])=>`<button data-action="${id}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}>${icon(symbol)}<small>${label}</small></button>`).join('')}</nav>`;
}
function home(){
 const count=Object.keys(profile.best).length;
 return `<div class="page lobby-page"><main class="shell lobby-shell">${header()}
 <div class="lobby-eyebrow"><span>YOUR NEXT MOVE.</span><span class="collection-label">${String(GAMES.length+PARTY_IDS.length).padStart(2,'0')} GAMES <i></i> LIVE</span></div>
 <section class="hero arena-hero"><div class="hero-grid" aria-hidden="true"></div><div class="hero-top"><span class="kicker"><i></i> THINK. PLAY. WIN.</span><span class="edition">THE ARENA OF MINDS</span></div>
 <div class="hero-copy"><h1>읽고, 속이고,<br><em>살아남아라.</em></h1><p>숫자와 심리, 배신과 동맹.<br>단 한 번의 선택이 승부를 가른다.</p></div>
 <div class="hero-mosaic" aria-hidden="true">${mosaicTiles()}</div>
 <div class="hero-actions"><a class="hero-cta" href="./lounge/index.html">아레나 입장 ${icon('arrow')}</a><button class="hero-ghost" data-action="random">랜덤 매치</button></div>
 <div class="hero-bottom"><span>실시간 · 최대 8인 · ${GAMES.length+PARTY_IDS.length} GAMES</span><span>${liveAvailable()?'● LIVE':'SOLO · AI'}</span></div></section>
 ${todayCard()}
 <div class="quick-modes"><button data-action="live">⚡<span><strong>방 코드로 대결</strong><small>친구와 같은 판, 같은 순간</small></span>${icon('up')}</button><button data-action="random-ai">${icon('bot')}<span><strong>AI 랜덤 매치</strong><small>상대는 기다려주지 않는다</small></span>${icon('up')}</button></div>
 <div class="section-title"><div><span class="mini-kicker">PARTY · LIVE</span><h2>친구들과 파티 · 협동</h2></div><span class="section-count">${String(PARTY_IDS.length).padStart(2,'0')}</span></div>
 <div class="party-row">${Object.values(LIVE_EXTRA).map(g=>`<button class="party-card ${g.color}" data-action="party:${g.id}"><span class="party-ico">${g.symbol}</span><strong>${esc(g.title)}</strong><small>${esc(g.short)}</small><em>${g.coop?'🤝 협동 · ':''}${g.min}명+ · 실시간</em></button>`).join('')}</div>
 <div class="section-title"><div><span class="mini-kicker">PICK YOUR BATTLE</span><h2>승부를 고르세요</h2></div><span class="section-count">${String(GAMES.length).padStart(2,'0')}</span></div>
 <div class="filters" role="group" aria-label="게임 분류"><button data-filter="all" class="${viewTab==='all'?'active':''}" aria-pressed="${viewTab==='all'}">전체</button><button data-filter="number" class="${viewTab==='number'?'active':''}" aria-pressed="${viewTab==='number'}">숫자·추리</button><button data-filter="mind" class="${viewTab==='mind'?'active':''}" aria-pressed="${viewTab==='mind'}">심리전</button><button data-filter="survival" class="${viewTab==='survival'?'active':''}" aria-pressed="${viewTab==='survival'}">서바이벌</button><button data-filter="duel" class="${viewTab==='duel'?'active':''}" aria-pressed="${viewTab==='duel'}">1:1 전략</button></div>
 <section class="game-grid" aria-label="게임 목록">${GAMES.filter(g=>viewTab==='all'||(viewTab==='number'?['baseball','nim'].includes(g.id):viewTab==='survival'?['marbles','redlight','bridge','minority'].includes(g.id):viewTab==='duel'?['gomoku','dots'].includes(g.id):['blind','trust','auction'].includes(g.id))).map(gameCard).join('')}</section>
 <section class="info-banner"><div class="banner-icon">${icon('chip')}</div><div><strong>좋은 한 수는, 씽크칩이 된다.</strong><p>대결로 모으고 힌트로 한 발 더.</p></div><button data-action="wallet" aria-label="씽크칩 지갑 열기">${icon('arrow')}</button></section>
 <div class="lobby-foot"><span>${count} / ${GAMES.length} 게임 도전 중</span><span>PLAY SMART. HAVE FUN.</span></div><p class="legal-note">씽크칩 아레나 · 두뇌게임 모음</p></main>${bottomNav('home')}<div class="toast" id="toast" role="status"></div></div>`;
}
function dailyGame(){const d=new Date(),k=d.getFullYear()*372+d.getMonth()*31+d.getDate();return GAMES[(k*7+3)%GAMES.length];}
function mosaicTiles(){const pick=['blind','marbles','trust','minority','redlight','auction','nim','bridge','baseball'].map(id=>GAME_BY_ID[id]).filter(Boolean);
 return pick.map((g,i)=>`<span class="mt ${g.color}" style="--i:${i}">${esc(g.symbol)}</span>`).join('');}
function todayCard(){const g=dailyGame();return `<button class="today-card ${g.color}" data-open="${g.id}"><span class="today-art">${esc(g.symbol)}</span><span class="today-copy"><small>TODAY'S MATCH</small><strong>${esc(g.title)}</strong><em>${esc(g.short)}</em></span><span class="today-go">${icon('arrow')}</span></button>`;}
function gameCard(g){
 const number=String(GAMES.findIndex(x=>x.id===g.id)+1).padStart(2,'0');
 const art={flip:'<span class="mini-tile">3</span><span class="mini-tile">4</span><span class="mini-tile">5</span>',blind:'<span class="mini-tile dark-tile">?</span><span class="mini-tile">8</span>',triad:'<span class="shape shape-triangle"></span><span class="shape shape-circle"></span><span class="shape shape-square"></span>',trust:'<span class="trust-orb">TRUST</span><span class="trust-orb betray-orb">?</span>',baseball:'<span class="bb-ball">1</span><span class="bb-ball">7</span><span class="bb-ball">4</span>',nim:'<span class="nim-stone"></span><span class="nim-stone"></span><span class="nim-stone"></span><span class="nim-stone last"></span>',auction:'<span class="auc-item">💎</span><span class="auc-item">👑</span><span class="auc-item">🧨</span>',maze:'<svg class="art-maze" viewBox="0 0 120 60"><path d="M8 30 C 30 0, 45 60, 65 30 S 100 0, 112 30" /></svg>',draw:'<span class="art-draw">♥</span><span class="art-draw">⬡</span><span class="art-draw">◯</span>',marbles:'<span class="art-emo">✊</span><span class="art-mb"><i></i><i></i><i></i></span><span class="art-tag">홀? 짝?</span>',redlight:'<span class="art-emo">🏃</span><span class="art-dots">· · ·</span><span class="art-emo">👀</span>',bridge:'<span class="art-bridge">'+Array.from({length:8},(_,i)=>`<i class="${[1,2,4,7].includes(i)?"s":""}"></i>`).join('')+'</span>',minority:'<span class="art-tag big">A</span><span class="art-emo">⚖</span><span class="art-tag big">B</span>',sudoku:'<span class="art-sd">'+[5,3,0,0,7,0,6,0,0].map(n=>`<i>${n||''}</i>`).join('')+'</span>',merge:'<span class="art-mg"><i>2</i><i>4</i><i>8</i><i>16</i></span>',stroop:'<span class="art-st" style="color:#4d8bff">빨강</span><span class="art-st" style="color:#ff4d5e">초록</span>',gomoku:'<span class="art-gm">'+'●○●○●'.split('').map((c,i)=>`<i class="${c==='●'?'b':'w'}" style="--k:${i}"></i>`).join('')+'</span>',dots:'<span class="art-db"><i></i><i class="own"></i><i class="own"></i><i></i></span>'}[g.id];
 const best=profile.best[g.id];
 return `<button class="game-card" data-open="${g.id}"><div class="game-art ${g.color}"><span class="art-index">GAME / ${number}</span><div class="art-deck">${art}</div><span class="art-caption">${({flip:'FLIP TRIO',blind:'BLIND NUMBER',triad:'TRIPLE RULE',trust:'TRUST OR NOT',baseball:'NUMBER DETECTIVE',nim:'LAST ONE LOSES',auction:'SEALED AUCTION',maze:'DONT TOUCH',draw:'DRAW IT RIGHT',marbles:'ODD OR EVEN',redlight:'RED LIGHT',bridge:'STEPPING STONES',minority:'MINORITY RULE',sudoku:'SUDOKU',merge:'MERGE IT',stroop:'COLOR CLASH',gomoku:'FIVE IN A ROW',dots:'DOTS & BOXES'})[g.id]}</span></div><div class="card-info"><div class="card-genre">${esc(g.genre)}<span>${icon('clock')}${esc(g.time.replace('약 ',''))}</span></div><strong>${esc(g.title)}</strong><p>${esc(g.short)}</p><div class="card-bottom"><span>${best!==undefined?`BEST ${fmt(best)}점`:'첫 승부를 기다려요'}</span><span class="card-arrow">${icon('up')}</span></div></div></button>`;
}
function intro(){
 const g=gameById(),isInvite=invitedGame===selectedGame&&invitedTarget!==null;
 return `<div class="page"><main class="shell">${header({back:true,title:'게임 선택'})}
 <section class="detail-hero ${g.color}"><div class="detail-badge">${esc(g.genre)} · ${g.time}</div><div class="detail-symbol">${esc(g.symbol)}</div><h1>${esc(g.title)}</h1><p>${esc(g.short)}</p></section>
 ${isInvite?`<div class="challenge-callout"><div><span>친구 도전장이 도착했어요!</span><strong>${esc(invitedFrom)} · ${fmt(invitedTarget)}점</strong></div><span class="challenge-flame">⚔</span></div>`:''}
 <div class="section-title tight"><div><span class="mini-kicker">HOW TO PLAY</span><h2>게임 방법</h2></div></div>
 <div class="rule-preview">${rulesFor(g.id).map((s,i)=>`<div class="rule-line"><span>${String(i+1).padStart(2,'0')}</span><p>${esc(s)}</p></div>`).join('')}</div>
 <div class="section-title tight"><div><span class="mini-kicker">SELECT A MODE</span><h2>대결 모드 선택</h2></div></div>
 <div class="mode-list">${isInvite?`<button class="mode-card featured" data-start="friend"><span class="mode-icon">${icon('duel')}</span><span><strong>${esc(invitedFrom)} 기록 깨기</strong><small>같은 숫자 순서로 ${fmt(invitedTarget)}점 도전 · 힌트 없음</small></span><span class="mode-go">→</span></button>`:''}
 <button class="mode-card" data-start="solo"><span class="mode-icon">${icon('spark')}</span><span><strong>혼자 연습</strong><small>편하게 규칙 익히기 · 씽크칩 힌트 사용 가능</small></span><span class="mode-go">→</span></button>
 <button class="mode-card" data-start="ai"><span class="mode-icon">${icon('bot')}</span><span><strong>AI와 대결</strong><small>상대의 전략을 이기고 보너스 칩 획득</small></span><span class="mode-go">→</span></button><label class="difficulty-row">AI 난이도 <select data-difficulty>${LEVELS.map(k=>`<option value="${k}" ${difficulty===k?'selected':''}>${LEVEL_KO[k]} · 승리 +${AI_WIN[k]}칩</option>`).join('')}</select></label>
 <button class="mode-card" data-start="friend"><span class="mode-icon">${icon('duel')}</span><span><strong>친구와 점수 대결</strong><small>먼저 플레이한 뒤 링크로 기록 도전장을 보내요</small></span><span class="mode-go">→</span></button>
 <button class="mode-card live-mode" data-action="live-create-here"><span class="mode-icon">${icon('duel')}</span><span><strong>친구와 실시간 대결</strong><small>방을 만들고 같은 판에서 동시에 겨뤄요</small></span><span class="mode-go">→</span></button></div>
 <p class="fineprint">친구 대결은 같은 조건으로 기록을 겨루는 도전장 방식이에요.</p>
 </main>${bottomNav('home')}<div id="toast" class="toast" role="status"></div></div>`;
}
function baseballUI(g){const inp=session.input||[];const left=BB_TRIES-g.turn;
 return `<section class="play-panel bb-panel"><div class="panel-heading"><div><span class="mini-kicker">NUMBER DETECTIVE</span><h2>비밀 번호 세 자리를 맞혀요</h2></div><span class="round-tag">${Math.min(g.turn+1,BB_TRIES)}/${BB_TRIES}</span></div>
 <div class="bb-slots">${[0,1,2].map(i=>`<div class="bb-slot ${inp[i]?'filled':''}">${inp[i]??''}</div>`).join('')}</div>
 <div class="bb-pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-digit="${n}" ${inp.includes(n)||inp.length>=BB_LEN?'disabled':''}>${n}</button>`).join('')}</div>
 <div class="bb-actions"><button class="ghost-btn" data-action="bb-clear">지우기</button><button class="primary-btn" data-action="bb-submit" ${inp.length===BB_LEN?'':'disabled'}>확인 (${left}번 남음)</button></div>
 <div class="bb-log">${g.history.length?g.history.slice().reverse().map((h,i)=>`<div><span>${g.history.length-i}.</span><b>${h.guess.join(' ')}</b><em class="${h.strike===3?'hit':''}">${h.strike}S ${h.ball}B${h.strike+h.ball===0?' · 아웃':''}</em></div>`).join(''):'<p>숫자 3개를 고른 뒤 확인을 눌러요. 결과가 여기에 쌓여요.</p>'}</div></section>`;}
function nimUI(g){const n=g.stones;
 return `<section class="play-panel nim-panel"><div class="panel-heading"><div><span class="mini-kicker">LAST ONE LOSES</span><h2>마지막 돌은 가져가지 마세요</h2></div><span class="round-tag">${Math.min(g.round+1,NIM_ROUNDS)}판</span></div>
 <div class="nim-score"><span>나 <b>${g.wins}</b>승</span><span>AI <b>${g.losses}</b>승</span></div>
 <div class="nim-pile" aria-label="남은 돌 ${n}개">${Array.from({length:n},(_,i)=>`<span class="nim-stone ${i===n-1?'last':''}"></span>`).join('')}</div>
 <p class="nim-count">남은 돌 <b>${n}</b>개</p>
 ${g.last?`<p class="round-outcome">${g.last.roundEnd?(g.last.roundEnd==='win'?'🎉 AI가 마지막 돌을 가져갔어요. 이번 판 승리! 새 판 시작':'😵 내가 마지막 돌을 가져갔어요. 이번 판 패배. 새 판 시작'):`내가 ${g.last.mine}개 → AI가 ${g.last.cpu}개 가져갔어요`}</p>`:'<p class="round-outcome">내 차례예요. 몇 개를 가져갈까요?</p>'}
 <div class="nim-actions">${[1,2,3].map(k=>`<button class="choice-btn" data-take="${k}" ${k>n?'disabled':''}>${k}개 가져가기</button>`).join('')}</div></section>`;}
function auctionUI(g){const lot=g.lots[g.turn],bid=Math.min(session.bid||0,g.coins);
 return `<section class="play-panel auc-panel"><div class="panel-heading"><div><span class="mini-kicker">SEALED AUCTION</span><h2>얼마를 걸까요?</h2></div><span class="round-tag">${Math.min(g.turn+1,AUC_ROUNDS)}/${AUC_ROUNDS}</span></div>
 ${lot?`<div class="auc-lot ${lot.value<0?'trap':''}"><span class="auc-icon">${lot.icon}</span><div><strong>${esc(lot.name)}</strong><small>가치 ${lot.value>0?'+':''}${lot.value*10}점</small></div></div>`:''}
 <div class="auc-wallets"><div><span>내 칩</span><b>${g.coins}</b></div><div><span>AI 칩</span><b>${g.cpuCoins}</b></div></div>
 <div class="auc-bid"><button data-bid="-5">−5</button><button data-bid="-1">−1</button><strong>${bid}<small>칩</small></strong><button data-bid="1">+1</button><button data-bid="5">+5</button></div>
 <button class="primary-btn auc-submit" data-action="bid-submit">${bid}칩 몰래 입찰하기</button>
 ${g.last?`<p class="round-outcome">직전: ${g.last.lot.icon} ${esc(g.last.lot.name)} — 나 ${g.last.mine} vs AI ${g.last.cpu} · ${g.last.winner==='me'?'낙찰!':g.last.winner==='cpu'?'AI 낙찰':'동점 · 유찰'}</p>`:''}
 <div class="auc-bag"><span>내 보물</span>${g.myItems.length?g.myItems.map(x=>`<i title="${esc(x.name)}">${x.icon}</i>`).join(''):'<em>아직 없음</em>'}</div></section>`;}
function mazeUI(g){const st=g.stages[g.turn]||g.stages.at(-1),p=st.points,s=p[0],e=p.at(-1),guide=session.hint&&session.hintKey===g.turn;
 return `<section class="play-panel tracer-panel"><div class="panel-heading"><div><span class="mini-kicker">DON'T TOUCH</span><h2>${g.turn?'길은 좁아지고, 내 점은 커져요':'벽에 닿지 말고 빠져나가요'}</h2></div><span class="round-tag">${Math.min(g.turn+1,MAZE_STAGES)}/${MAZE_STAGES}</span></div>
 <svg id="tracer" data-kind="maze" viewBox="0 0 ${MAZE_W} ${MAZE_H}" role="img" aria-label="미로 판">
  <rect width="${MAZE_W}" height="${MAZE_H}" rx="18" class="maze-wall"/>
  <path d="${toPath(p)}" class="maze-road" stroke-width="${st.half*2}"/>
  ${guide?`<path d="${toPath(p)}" class="maze-guide"/>`:''}
  <circle cx="${s[0]}" cy="${s[1]}" r="${Math.max(8,st.half-3)}" class="maze-start"/><text x="${s[0]}" y="${s[1]+5}" class="maze-label">출발</text>
  <text x="${e[0]}" y="${e[1]+8}" class="maze-goal">🏁</text>
  <polyline id="tracerTrail" class="tracer-trail" points=""/><circle id="tracerDot" r="${st.dot||9}" class="tracer-dot" cx="${s[0]}" cy="${s[1]}"/>
 </svg>
 <p class="round-outcome" id="tracerMsg">${g.last?(g.last.ok?`통과! +${g.last.pts}점 (${(g.last.ms/1000).toFixed(1)}초)`:g.last.reason==='touch'?'앗, 벽에 닿았어요! 0점':g.last.reason==='start'?'초록 출발점에서 시작해야 해요. 0점':'손을 뗐어요. 0점'):'초록 출발점을 누른 채로 깃발까지 가요'}</p>
 <div class="sub-stats"><span>${g.results.map((r,i)=>`${i+1}단계 ${r.pts}`).join(' · ')||`${MAZE_STAGES}단계 · 점 크기 ${Math.round((st.dot||9)*2)}px`}</span><span>합계 ${g.score}점</span></div></section>`;}
function drawUI(g){const id=g.order[g.turn]||g.order.at(-1),sh=shapeOf(id),guide=session.hint&&session.hintKey===g.turn;
 return `<section class="play-panel tracer-panel"><div class="panel-heading"><div><span class="mini-kicker">DRAW IT RIGHT</span><h2>${sh.icon} ${esc(sh.name)}${(sh.name.charCodeAt(sh.name.length-1)-0xAC00)%28?'을':'를'} 그려요</h2></div><span class="round-tag">${Math.min(g.turn+1,DRAW_ROUNDS)}/${DRAW_ROUNDS}</span></div>
 <svg id="tracer" data-kind="draw" viewBox="0 0 ${DRAW_SIZE} ${DRAW_SIZE}" role="img" aria-label="그리기 판">
  <rect width="${DRAW_SIZE}" height="${DRAW_SIZE}" rx="18" class="draw-board"/>
  <path d="${toPath(sh.pts,true)}" class="draw-guide ${guide?'strong':''}"/>
  <polyline id="tracerTrail" class="tracer-trail" points=""/>
 </svg>
 <p class="round-outcome" id="tracerMsg">${g.last?`${esc(shapeOf(g.last.id).name)} ${g.last.pts}점! ${g.last.pts>=90?'완벽해요 ✨':g.last.pts>=70?'잘 그렸어요':'다음엔 선을 따라 끝까지!'}`:'손을 떼지 말고 한 번에 그려요'}</p>
 <div class="sub-stats"><span>${g.results.map(r=>`${shapeOf(r.id).icon} ${r.pts}점`).join(' · ')||'3가지 모양'}</span><span>합계 ${g.score}점</span></div></section>`;}
// Pointer tracking for drag games (bound after each render; no re-render while dragging).
function bindTracer(){const svg=document.getElementById('tracer');if(!svg||!session||session.game.over)return;
 const kind=svg.dataset.kind,trail=document.getElementById('tracerTrail'),dot=document.getElementById('tracerDot'),msg=document.getElementById('tracerMsg');
 let pts=null,done=false;
 const toBoard=e=>{const m=svg.getScreenCTM();if(!m)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return [p.x,p.y,performance.now()];};
 const finish=()=>{if(done||!pts)return;done=true;const trace=pts;pts=null;
  session.game=kind==='maze'?playMaze(session.game,trace):playDraw(session.game,trace.map(p=>[p[0],p[1]]));session.hint=null;session.hintKey=null;
  if(session.game.over)complete();else render();};
 svg.addEventListener('pointerdown',e=>{if(done)return;e.preventDefault();try{svg.setPointerCapture(e.pointerId);}catch(_){}const p=toBoard(e);if(!p)return;pts=[p];trail.setAttribute('points',`${p[0]},${p[1]}`);if(dot){dot.setAttribute('cx',p[0]);dot.setAttribute('cy',p[1]);}
  if(kind==='maze'){const st=session.game.stages[session.game.turn];if(Math.hypot(p[0]-st.points[0][0],p[1]-st.points[0][1])>st.half+10){msg.textContent='초록 출발점에서 시작하세요';pts=null;}}});
 svg.addEventListener('pointermove',e=>{if(!pts||done)return;if(e.pointerType==='mouse'&&e.buttons===0){up();return;} // PC: 마우스 버튼을 이미 뗐으면 그리기 끝 (창 밖에서 떼서 pointerup 을 놓친 경우)
  const p=toBoard(e);if(!p)return;pts.push(p);
  trail.setAttribute('points',trail.getAttribute('points')+` ${p[0].toFixed(1)},${p[1].toFixed(1)}`);if(dot){dot.setAttribute('cx',p[0]);dot.setAttribute('cy',p[1]);}
  if(kind==='maze'){const st=session.game.stages[session.game.turn],goal=st.points.at(-1);
   if(!insideCorridor(st,p)){svg.classList.add('touched');finish();}
   else if(Math.hypot(p[0]-goal[0],p[1]-goal[1])<=st.half)finish();}});
 const up=()=>{if(pts&&pts.length>1)finish();else pts=null;};
 svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
}
function marblesUI(g){const role=roleOf(g),bet=Math.max(1,Math.min(g.me,session.bet||1)),h=session.hintKey===g.turn?session.hint:null,L=g.last;
 const dots=n=>`<span class="mb-dots">${Array.from({length:Math.min(n,20)},()=>'<i></i>').join('')}</span>`;
 const lastMsg=L?(L.role==='guess'?`AI 손에는 ${L.hidden}개(${PARITY_KO[parity(L.hidden)]})! ${L.win?`맞혔어요 +${L.amt}개`:`틀렸어요 -${L.amt}개`}`:`AI가 '${PARITY_KO[L.guess]}'에 ${L.bet}개 → ${L.win?`AI가 틀렸어요 +${L.amt}개`:`AI가 맞혔어요 -${L.amt}개`}`):'구슬 10개씩 들고 시작! 먼저 AI 손을 맞혀 보세요.';
 return `<section class="play-panel mb-panel"><div class="panel-heading"><div><span class="mini-kicker">ODD OR EVEN</span><h2>${role==='guess'?'AI 손 안의 구슬, 홀일까 짝일까?':'구슬 몇 개를 쥘까요?'}</h2></div><span class="round-tag">${Math.min(g.turn+1,MB_ROUNDS)}/${MB_ROUNDS}</span></div>
 <div class="mb-board"><div><small>나</small><strong>${g.me}</strong>${dots(g.me)}</div><div class="mb-fist ${role}">${role==='guess'?'✊':'🤲'}</div><div><small>AI</small><strong>${g.cpu}</strong>${dots(g.cpu)}</div></div>
 <p class="round-outcome">${lastMsg}</p>
 ${role==='guess'?`<div class="choice-title">걸 구슬 <small>맞히면 그만큼 가져와요</small></div>
 <div class="mb-bets">${[1,2,3,5].filter(n=>n<g.me).concat([g.me]).filter((v,i,a)=>a.indexOf(v)===i).map(n=>`<button data-mb-bet="${n}" class="${bet===n?'active':''}">${n===g.me?`올인 ${n}`:n}</button>`).join('')}</div>
 <div class="trust-actions mb-guess"><button data-mb-guess="odd" class="${h?.guess==='odd'?'hinted':''}"><strong>홀</strong><small>${bet}개 걸기</small></button><button data-mb-guess="even" class="${h?.guess==='even'?'hinted':''}"><strong>짝</strong><small>${bet}개 걸기</small></button></div>`
 :`<div class="choice-title">쥘 개수 <small>AI가 홀짝을 맞히면 AI가 건 만큼 잃어요</small></div>
 <div class="number-choices">${Array.from({length:Math.min(g.me,9)},(_,i)=>i+1).map(n=>`<button data-mb-hide="${n}" class="${h?.hideParity&&parity(n)===h.hideParity?'hinted':''}">${n}</button>`).join('')}</div>`}
 </section>`;}
function redLightUI(g){const ph=phaseAt(g,g.t),left=Math.max(0,(RL_TIME-g.t)/1000);
 return `<section class="play-panel rl-panel"><div class="panel-heading"><div><span class="mini-kicker">RED LIGHT</span><h2>술래가 보면 멈춰요!</h2></div><span class="round-tag" id="rlTime">${left.toFixed(1)}초</span></div>
 <div class="rl-field" id="rlField" data-phase="${g.t?ph.type:'idle'}">
  <div class="rl-tagger" id="rlTagger">${g.t&&ph.type==='red'?'👀':'🙈'}</div>
  <div class="rl-chant" id="rlChant">${g.t?'':'버튼을 누르면 시작해요'}</div>
  <div class="rl-finish">FINISH</div>
  <div class="rl-runner" id="rlRunner" style="bottom:${6+g.pos*0.8}%">🏃</div>
 </div>
 <div class="rl-progress"><span id="rlBar" style="width:${g.pos}%"></span></div>
 <button class="rl-btn" id="rlBtn" ${g.over?'disabled':''}>꾹 누르고 있으면 전진</button>
 <p class="round-outcome" id="rlMsg">${g.over?(g.finished?'완주! 🎉':g.caught?'움직이다 걸렸어요! 탈락 😵':'시간 초과!'):'손을 떼면 멈춰요'}</p></section>`;}
const CHANT='무궁화 꽃이 피었습니다';
function bindRedLight(){const btn=document.getElementById('rlBtn');if(!btn||!session||session.id!=='redlight'||session.game.over)return;
 const S=session;S.rl=S.rl||{holding:false,running:false,last:0};
 const down=e=>{e.preventDefault();try{btn.setPointerCapture(e.pointerId);}catch(_){}S.rl.holding=true;btn.classList.add('down');if(!S.rl.running){S.rl.running=true;S.rl.last=performance.now();requestAnimationFrame(tick);}};
 const up=()=>{S.rl.holding=false;btn.classList.remove('down');};
 btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('lostpointercapture',up);btn.addEventListener('contextmenu',e=>e.preventDefault());
 function tick(now){if(session!==S||screen!=='game'){S.rl.running=false;return;}
  if(document.hidden)S.rl.holding=false;
  const dt=Math.min(60,now-S.rl.last);S.rl.last=now;S.game=stepRedLight(S.game,dt,S.rl.holding);const g=S.game,ph=phaseAt(g,g.t);
  const $=id=>document.getElementById(id);const field=$('rlField');
  if(field){field.dataset.phase=ph.type;field.classList.toggle('hinted',!!(S.hint?.warn&&ph.type==='warn'));}
  if($('rlTagger'))$('rlTagger').textContent=ph.type==='red'?'👀':'🙈';
  if($('rlChant')){const p=ph.type==='green'?Math.min(1,(g.t-ph.start)/(ph.end-ph.start)):1;$('rlChant').textContent=ph.type==='red'?'멈춰!':CHANT.slice(0,Math.max(1,Math.ceil(CHANT.length*(ph.type==='warn'?1:p*0.85))));}
  if($('rlRunner'))$('rlRunner').style.bottom=`${6+g.pos*0.8}%`;if($('rlBar'))$('rlBar').style.width=`${g.pos}%`;if($('rlTime'))$('rlTime').textContent=`${Math.max(0,(RL_TIME-g.t)/1000).toFixed(1)}초`;
  if(g.over){S.rl.running=false;S.rl.holding=false;render();setTimeout(()=>{if(session===S&&screen==='game')complete();},1100);return;}
  requestAnimationFrame(tick);}
}
function bridgeUI(g){const stones=g.stages[g.stage],pv=session.preview,h=session.hintKey===`${g.stage}:${g.step}`?session.hint:null;
 const W=g.widths?.[g.stage]??2,sides=Array.from({length:W},(_,k)=>k),broken=Array.isArray(g.broken)?g.broken:g.broken==null?[]:[g.broken],nm=sd=>W===3?['왼쪽','가운데','오른쪽'][sd]:sd?'오른쪽':'왼쪽';
 const rows=stones.map((safe,i)=>{const passed=i<g.step||(g.over&&g.last?.ok),cur=i===g.step&&!g.over&&!pv?.active&&session.previewedStage===g.stage,glow=pv?.active&&pv.idx===i;
  return `<div class="br-row w${W} ${cur?'current':''}"><span class="br-num">${i+1}</span>${sides.map(sd=>{const cls=[passed&&sd===safe?'safe':'',passed&&sd!==safe?'dim':'',glow&&sd===safe?'glow':'',cur&&broken.includes(sd)?'broken':'',cur&&h?.side===sd?'hinted':''].join(' ');
   return cur?`<button class="br-stone ${cls}" data-side="${sd}" ${broken.includes(sd)?'disabled':''} aria-label="${i+1}번째 ${nm(sd)} 돌">${broken.includes(sd)?'💥':''}</button>`:`<span class="br-stone ${cls}">${passed&&sd===safe?'👣':''}</span>`;}).join('')}<span class="br-me">${cur?'🧍':''}</span></div>`;}).reverse().join('');
 return `<section class="play-panel br-panel"><div class="panel-heading"><div><span class="mini-kicker">STEPPING STONES</span><h2>${pv?.active?'안전한 돌을 기억하세요!':g.over?(g.lives>0?'모두 건넜어요! 🎉':'목숨을 모두 잃었어요'):'안전한 돌을 골라 건너요'}</h2></div><span class="round-tag">${g.stage+1}/${g.stages.length}단계</span></div>
 <div class="br-status"><span>${'❤️'.repeat(Math.max(0,g.lives))}${'🤍'.repeat(Math.max(0,g.maxLives-g.lives))}</span><span>${pv?.active?`${pv.idx+1}/${stones.length} 보는 중`:`${g.step}/${stones.length}칸`}</span></div>
 <div class="br-bridge"><div class="br-goal">GOAL</div>${rows}<div class="br-start">START</div></div>
 <p class="round-outcome">${g.last?.ok===false?'💥 와장창! 다른 쪽이 안전해요':g.last?.stageClear?'단계 통과! 다음 다리가 보여요':''}</p></section>`;}
function bindBridge(){if(!session||session.id!=='bridge'||session.game.over)return;const S=session,g=S.game;if(S.previewedStage===g.stage)return;
 S.previewedStage=g.stage;const token={};S.preview={active:true,idx:-1,token};const n=g.stages[g.stage].length;
 const stepFn=()=>{if(session!==S||S.preview?.token!==token||screen!=='game')return;S.preview.idx++;if(S.preview.idx>=n){S.preview={active:false};render();return;}render();setTimeout(stepFn,g.previewMs);};
 setTimeout(stepFn,g.stage?900:500);}
function minorityUI(g){const [a,b]=g.topics[Math.min(g.round,g.topics.length-1)],L=g.last,h=session.hintKey===g.round?session.hint:null,lab=x=>x===0?'A':'B';
 const pick=L?(id=>L.picks[id]):null;
 return `<section class="play-panel mi-panel"><div class="panel-heading"><div><span class="mini-kicker">MINORITY RULE</span><h2>적은 쪽을 고르면 +${MI_POINT}점</h2></div><span class="round-tag">${Math.min(g.round+1,MI_ROUNDS)}/${MI_ROUNDS}</span></div>
 ${L?`<p class="round-outcome mi-last">지난 판: A ${L.count[0]}명 vs B ${L.count[1]}명 → ${L.minority===null?'동점·몰빵, 아무도 점수 없음':`${lab(L.minority)} 쪽 승리! ${L.won?`나도 +${MI_POINT}점 🎉`:'나는 다수 쪽 😵'}`}</p>`:''}
 <div class="mi-players"><div class="mi-p me"><span>🙋</span><b>${g.score}</b><small>${L?lab(L.me):'나'}</small></div>${g.bots.map(bt=>`<div class="mi-p ${L&&L.minority!==null&&pick(bt.id)===L.minority?'won':''}"><span>${bt.avatar}</span><b>${bt.pts}</b><small>${L?lab(pick(bt.id)):'·'}</small></div>`).join('')}</div>
 <div class="mi-hist">${g.history.length?g.history.map(r=>`<span class="${r.won?'w':''}">${r.count[0]}:${r.count[1]}</span>`).join(''):'<em>참가자마다 버릇이 있어요. 매 판 누가 뭘 골랐는지 잘 보세요.</em>'}</div>
 <div class="mi-q"><button data-mi="0" class="choice-btn ${h?.side===0?'hinted':''}"><small>A</small>${esc(a)}</button><span>vs</span><button data-mi="1" class="choice-btn ${h?.side===1?'hinted':''}"><small>B</small>${esc(b)}</button></div></section>`;}
// ───────── 실시간 대결 (live-server/) ─────────
function livePid(){try{let id=localStorage.getItem('thinkchip:pid');if(!id){id=(crypto.randomUUID?.()||String(Math.random()).slice(2)+Date.now()).replace(/[^a-zA-Z0-9]/g,'').slice(0,24);localStorage.setItem('thinkchip:pid',id);}return id;}catch{return window.__pid||(window.__pid=String(Math.random()).slice(2,14));}}
function liveName(){if(!profile.nickname){profile.nickname=`플레이어${String(Math.floor(Math.random()*90)+10)}`;saveProfile();}return profile.nickname.slice(0,12);}
function liveMe(){return live?.state?.players?.find(p=>p.pid===livePid());}
function liveOthers(){return (live?.state?.players||[]).filter(p=>p.pid!==livePid()&&p.inRound);}
function joinLive(code,pickGame){leaveLive();const pid=livePid();
 live={code,state:null,status:'connecting',error:null,startedRound:0,pendingPick:pickGame,cd:null,chat:[],unread:0};chatOpen=false;
 live.conn=connectLive({code,name:liveName(),pid,
  onState:m=>onLiveState(m),
  onChat:m=>onChat(m),
  onChatLog:items=>{if(!live)return;live.chat=items;renderChatDock();},
  onSnap:m=>{if(!live)return;live.spec={pid:m.pid,d:m.d,k:m.k};if(screen==='spectate'&&!live.specRaf){live.specRaf=requestAnimationFrame(()=>{if(live)live.specRaf=0;if(screen==='spectate')render();});}},
  onEmoji:m=>{if(stage)stage.say(m.pid,m.e);const p=live?.state?.players?.find(x=>x.pid===m.pid);flash(`${p?esc(p.name):'누군가'} ${m.e}`);},
  onStatus:st=>{if(!live)return;live.status=st;if(screen==='live')render();},
  onError:code=>{if(!live)return;live.error=code;flash(code==='full'?'방이 꽉 찼어요 (최대 8명).':code==='lost'?'연결이 끊겼어요. 다시 입장해 주세요.':'방에 들어가지 못했어요.');if(code==='full'){leaveLive();}if(screen==='live')render();}});
 screen='live';render();}
async function inviteToRoom(){if(!live)return;const g=liveGameInfo(live.state?.game||partyGame||'blind');const out=await shareInvite(new URLSearchParams({room:live.code}),`${liveName()}님이 씽크칩 아레나에서 '${g.title}' 같이 하재요! 지금 들어와 🎮 방 코드: ${live.code}`);flash(out.ok?'초대 링크를 보냈어요.':`${out.error} 방 코드 ${live.code}를 친구에게 알려주세요.`);}
function leaveLive(){if(stage){stage.destroy();stage=null;}if(!live)return;clearInterval(live.cd);live.conn?.close();live=null;chatOpen=false;renderChatDock();}
function onLiveState(m){if(wantInvite&&live&&!live.autoInvited&&m&&m.t==='state'){live.autoInvited=true;setTimeout(()=>inviteToRoom(),400);}if(!live)return;const prev=live.state;live.state=m;live.code=m.code||live.code;
 const me=m.players.find(p=>p.pid===livePid());
 if(live.pendingPick&&me?.host){live.conn.send({t:'pick',game:live.pendingPick,level:difficulty});live.pendingPick=null;}
 if(m.turns&&m.phase==='playing'&&me?.inRound&&live.startedRound===m.round){ // 차례대로: 내 차례가 오면 카운트다운 뒤 시작, 아니면 관전
  const cur=m.turns.order[m.turns.idx];
  if(cur===livePid()&&!me.done&&live.myTurnRound!==`${m.round}:${m.turns.idx}`){live.myTurnRound=`${m.round}:${m.turns.idx}`;screen='spectate';live.spec=null;render();clearTimeout(live.turnT);live.turnT=setTimeout(()=>{if(live&&live.state?.turns?.order?.[live.state.turns.idx]===livePid())beginLiveGame(true);},Math.max(0,m.turns.startAt-live.conn.serverNow()));return;}
  if(screen==='spectate'){if(prev?.turns?.idx!==m.turns.idx)live.spec=null;render();return;}}
 if(m.phase!=='playing'&&screen==='spectate'){screen='live';}
 if(m.phase==='playing'&&me?.inRound&&live.startedRound!==m.round){if(screen!=='live'){screen='live';}render();return;}
 if(screen==='game'&&session?.mode==='live'){
  if(Number.isInteger(session.duelIdx)&&m.duel?.boards?.[session.duelIdx]){const bd=m.duel.boards[session.duelIdx];
   if(bd.moves.length>session.game.moves.length&&!session.game.over){session.game=replayDuel(session.id,session.seed,session.difficulty,bd);if(session.game.over){complete();return;}render();return;}
   if(bd.forfeit&&!session.game.over){session.game={...session.game,over:true,winner:session.game.meIdx,score:100,cpuScore:0};complete();return;}}
  patchLiveBar();return;}
 if(screen==='live'){const ae=document.activeElement;if(ae&&ae.tagName==='INPUT'&&root.contains(ae)){live.dirty=true;return;}render();}
 if(prev&&prev.phase==='playing'&&m.phase==='result'&&screen==='live'){const r=liveRanking(),me=livePid();if(m.series?.done){if(m.series.champion.includes(me))flash('🏆 최종 우승! 축하해요');}else if(r[0]?.pid===me&&(r.length<2||r[0].score>r[1].score))flash('🏆 이번 판 1등!');}}
function liveRanking(){return [...(live?.state?.players||[])].filter(p=>p.inRound).sort((a,b)=>b.score-a.score);}
function beginLiveGame(myTurn){const st=live.state;live.startedRound=st.round;clearInterval(live.cd);live.cd=null;
 if(PARTY_IDS.includes(st.game)){screen='live';chatOpen=false;render();return;}
 if(st.turns&&!myTurn){const cur=st.turns.order[st.turns.idx];if(cur!==livePid()){screen='spectate';live.spec=null;render();window.scrollTo?.(0,0);return;}live.myTurnRound=`${st.round}:${st.turns.idx}`;}
 const tIdx=st.turns?st.turns.order.indexOf(livePid()):-1,seed=tIdx>=0?`${st.seed}:${tIdx}`:st.seed; // 차례대로: 사람마다 다른 판 (앞사람 걸 보고 외우지 못하게)
 selectedGame=st.game;difficulty=st.level;let g=createRound(st.game,seed,st.level);let duelIdx;
 if(['gomoku','dots'].includes(st.game)){duelIdx=st.duel?.boards?.findIndex(b=>b.players.includes(livePid()));if(duelIdx<0||duelIdx===undefined){screen='live';render();return;}const bd=st.duel.boards[duelIdx];g=replayDuel(st.game,st.seed,st.level,bd);}
 session={id:st.game,mode:'live',seed,difficulty:st.level,game:g,challenger:null,botTarget:null,liveRound:st.round,lastSent:-1,duelIdx,t0:0,sel:null,flipped:false,hint:null,hintKey:null,award:0,input:[],bid:0,bet:1,preview:null,previewedStage:-1,rl:null,turn:!!st.turns};
 screen='game';rulesOpen=false;render();window.scrollTo?.(0,0);fitControls();if(st.turns)startSnaps();}
// 실시간 점수 대결 시간 제한: 남은 시간을 화면 위에 띄우고, 시간이 끝나면 지금 점수로 마감
function liveDeadline(){const st=live?.state;if(!st||st.phase!=='playing')return 0;return st.turns?st.turns.deadline||0:st.endAt||0;}
let limitTimer=setInterval(()=>{const dl=liveDeadline();let el=document.getElementById('liveTimer');
 const show=dl&&(screen==='spectate'||(screen==='game'&&session?.mode==='live'&&!session.game.over));
 if(!show){if(el)el.remove();return;}
 const left=dl-live.conn.serverNow();if(!el){el=document.createElement('div');el.id='liveTimer';el.className='live-timer';document.body.appendChild(el);}
 const sec=Math.max(0,Math.ceil(left/1000)),mine=screen==='game'&&session?.mode==='live'&&!session.game.over;
 if(!el.firstChild){el.innerHTML='<span></span><button type="button" data-skip-turn="1">⏭ 넘기기</button>';}
 el.firstChild.textContent=`⏱ ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;el.lastChild.hidden=!mine;el.classList.toggle('urgent',left<10000);
 el.onclick=e=>{if(!e.target.closest('[data-skip-turn]')||!session||session.game.over)return;if(!confirm('이번 차례를 여기서 끝낼까요? 지금 점수로 기록돼요.'))return;session.game={...session.game,over:true};flash('⏭ 차례를 넘겼어요');complete();};
 if(screen==='game'&&session?.mode==='live'&&!session.game.over&&left<=0&&(!live.state.turns||live.state.turns.order[live.state.turns.idx]===livePid())){session.game={...session.game,over:true};flash('⏰ 시간 끝! 지금 점수로 마감해요');complete();}},250);limitTimer.unref?.(); // 테스트(node)에서 프로세스가 안 끝나는 것 방지
// 차례대로: 내 게임 화면 상태를 0.2초마다(바뀌었을 때만) 다른 사람에게 중계
const SNAP_UI=['input','bid','bet','flipped','sel','preview','previewedStage','hint','t0','rl'];let snapTimer=0;
function startSnaps(){clearInterval(snapTimer);let last='',k=0;const s0=session;
 const tick=()=>{if(!live||session!==s0||screen!=='game'){clearInterval(snapTimer);return;}const ui={};for(const f of SNAP_UI)if(s0[f]!==undefined)ui[f]=s0[f];
  let d;try{d=JSON.stringify({g:s0.game,ui});}catch{return;}if(d===last||d.length>22000)return;last=d;live.conn.send({t:'snap',d,k:++k});};
 snapTimer=setInterval(tick,200);tick();}
function spectateView(){const st=live?.state,T=st?.turns;if(!st||!T)return '';const cur=T.order[T.idx],cp=st.players.find(p=>p.pid===cur),myI=T.order.indexOf(livePid()),G=GAME_BY_ID[st.game]||liveGameInfo(st.game);
 const queue=T.order.map((id,i)=>{const p=st.players.find(x=>x.pid===id);return `<span class="tq ${i<T.idx?'done':i===T.idx?'now':''} ${id===livePid()?'me':''}">${i+1}. ${esc(p?.name||'?')}${id===livePid()?' (나)':''}${p?.done?` · ${fmt(p.score)}점`:''}</span>`;}).join('');
 const mine=cur===livePid();let body='';
 if(mine)body=`<div class="spec-wait"><b>내 차례!</b><p>잠시 뒤 시작해요…</p></div>`;
 else if(live.spec&&live.spec.pid===cur){let sp=null;try{sp=JSON.parse(live.spec.d);}catch{}
  if(sp){const real=session;session={id:st.game,mode:'live',seed:'',difficulty:st.level,game:sp.g,challenger:null,botTarget:null,liveRound:st.round,award:0,spectating:true,...sp.ui};let html='';try{html=gameView().replace(GAME_STAGE_SLOT,'');}catch(e){html='';}session=real;
   body=`<div class="spectate-view" inert>${html}</div>`;}}
 if(!body)body=`<div class="spec-wait"><b>${esc(cp?.name||'?')}님 차례</b><p>곧 화면이 보여요…</p></div>`;
 return `<div class="page"><main class="shell"><div class="spec-top"><span class="mini-kicker">${esc(G.title||'')} · 차례대로</span><h2>${mine?'🎮 내 차례':`👀 ${esc(cp?.name||'?')}님 플레이 중`}</h2><div class="turn-queue">${queue}</div>${!mine&&myI>T.idx?`<p class="fineprint">내 차례까지 ${myI-T.idx}명 남았어요</p>`:''}</div>${body}<button class="btn tertiary full" data-action="live-leave" style="margin-top:12px">방 나가기</button></main></div>`;}
function liveTick(){if(!live)return;const st=live.state,me=liveMe();clearInterval(live.cd);live.cd=null;
 if(st?.phase==='playing'&&st.party&&live.startedRound===st.round){
  const upd=()=>{if(!live||screen!=='live')return clearInterval(live?.cd);const el=document.getElementById('ptTime'),dl=live.state?.party?.deadline;if(el&&dl){const left=Math.max(0,dl-live.conn.serverNow());el.textContent=`${Math.ceil(left/1000)}초`;el.classList.toggle('urgent',left<5000);}};
  live.cd=setInterval(upd,200);upd();return;}
 if(st?.phase==='playing'&&st.game==='forehead'&&st.fh&&live.startedRound===st.round){
  const upd=()=>{if(!live||screen!=='live')return clearInterval(live?.cd);const now=live.conn.serverNow(),left=Math.max(0,st.fh.endAt-now),el=document.getElementById('fhTime');
   if(el)el.textContent=`${Math.floor(left/60000)}:${String(Math.floor(left/1000)%60).padStart(2,'0')}`;
   const b=document.getElementById('fhGuessBtn'),cd=Math.ceil(((live.state?.fh?.next)||0)-now)/1000;if(b){b.disabled=cd>0;b.textContent=cd>0?`${Math.ceil(cd)}초`:'정답 도전';}};
  live.cd=setInterval(upd,250);upd();return;}
 if(st?.phase==='playing'&&me?.inRound&&live.startedRound!==st.round){
  const step=()=>{if(!live||screen!=='live'){clearInterval(live?.cd);return;}const left=st.startAt-live.conn.serverNow();const el=document.getElementById('liveCount');
   if(left<=0){beginLiveGame();return;}if(el)el.textContent=String(Math.min(3,Math.ceil(left/1000)));};
  live.cd=setInterval(step,100);step();}}
function replayDuel(id,seed,level,bd){const meIdx=bd.players.indexOf(livePid());let g=id==='gomoku'?createGomoku(seed,level,meIdx===0):createDots(seed,level,meIdx===0);const play=id==='gomoku'?playGomoku:playDots;for(const i of bd.moves)g=play(g,i);return g;}
function sendLiveProgress(){if(!session||session.mode!=='live'||session.game.over)return;const sc=session.game.score;if(sc===session.lastSent)return;session.lastSent=sc;live?.conn?.send({t:'progress',score:sc,round:session.liveRound});}
function liveBarHTML(){const ps=(live?.state?.players||[]).filter(p=>p.inRound);return ps.map(p=>`<span class="lb-p ${p.pid===livePid()?'me':''} ${p.done?'done':''} ${p.online?'':'off'}"><b>${esc(p.name)}</b><em>${fmt(p.pid===livePid()&&session?session.game.score:p.score)}</em>${p.done?'<i>완료</i>':''}</span>`).join('')||'<span class="lb-p">연결 중…</span>';}
function patchLiveBar(){const el=document.getElementById('liveBar');if(el)el.innerHTML=liveBarHTML();const en=document.getElementById('enemyScore');const v=opponentScore();if(en&&v!==null)en.textContent=fmt(v);}
const SERIES_KO={survival:'탈락전',league:'리그',tournament:'토너먼트'};
function seriesNextLabel(sr){return sr.kind==='league'?`${sr.idx+1}/${sr.len}판`:sr.kind==='survival'?`${sr.idx+1}라운드`:sr.bracket[sr.stage]?.[0]?.label||'토너먼트';}
function modePicker(st){const sr=st.series,cur=sr?`${sr.kind}:${sr.len||0}`:'single';
 const opts=[['single','한 판','그냥 한 판 승부'],['survival:0','탈락전','매 판 꼴찌 탈락, 최후의 1인'],['league:3','리그 3판','순위 점수 합산, 1위가 우승'],['league:5','리그 5판','긴 승부, 누적 점수'],['tournament:0','토너먼트','1:1 대진, 결승까지']];
 return `<div class="choice-title">1위 뽑기 방식 <small>방장이 골라요</small></div><div class="live-modes">${opts.map(([k,t,d])=>`<button data-live-mode="${k}" class="${cur===k||(k==='single'&&!sr)?'active':''}"><b>${t}</b><small>${d}</small></button>`).join('')}</div>`;}
function seriesPanel(st){const sr=st.series;if(!sr)return '';const nm=id=>esc(st.players.find(p=>p.pid===id)?.name||'나간 친구'),me=livePid();
 const head=`<div class="series-head"><span class="mini-kicker">${SERIES_KO[sr.kind]} ${sr.kind==='league'?`· ${sr.len}판`:''}</span><b>${sr.done?`🏆 ${sr.champion.map(nm).join(', ')} 우승!`:!sr.started?'모두 준비하면 시작해요':sr.kind==='league'?`${Math.min(sr.idx+1,sr.len)}/${sr.len}판 진행`:sr.kind==='survival'?`생존 ${sr.alive.length}명 · ${sr.idx+1}라운드`:(sr.bracket[sr.stage]?.[0]?.label||'토너먼트')}</b></div>`;
 if(!sr.started)return `<div class="series ${sr.kind}">${head}<p class="series-desc">${sr.kind==='survival'?'매 판 점수가 가장 낮은 사람이 탈락해요. 마지막까지 남으면 우승!':sr.kind==='league'?`${sr.len}판 동안 매 판 순위대로 점수를 받아요 (4명이면 4·3·2·1점). 합계 1위가 우승!`:'1:1로 붙어서 이긴 사람만 올라가요. 준결승 → 결승. 게임은 매 판 랜덤으로 바뀌어요.'}</p></div>`;
 let body='';
 if(sr.kind==='league'){const rows=[...sr.members].sort((a,b)=>(sr.pts[b]||0)-(sr.pts[a]||0)||(sr.wins[b]||0)-(sr.wins[a]||0));
  body=`<table class="series-table"><thead><tr><th>#</th><th>이름</th><th>1등</th><th>점수</th></tr></thead><tbody>${rows.map((id,i)=>`<tr class="${id===me?'me':''} ${sr.champion.includes(id)?'champ':''}"><td>${i+1}</td><td>${nm(id)}</td><td>${sr.wins[id]||0}</td><td><b>${sr.pts[id]||0}</b></td></tr>`).join('')}</tbody></table>`;}
 else if(sr.kind==='survival'){body=`<div class="series-chips">${sr.members.map(id=>{const out=!sr.alive.includes(id);return `<span class="${out?'out':''} ${id===me?'me':''} ${sr.champion.includes(id)?'champ':''}">${out?'💀':'🙂'} ${nm(id)}</span>`;}).join('')}</div>`;}
 else body=`<div class="bracket">${sr.bracket.map(stage=>`<div class="br-stage">${stage.map(m=>`<div class="br-match"><small>${m.label}</small>${[['a','sa'],['b','sb']].map(([k,sk])=>m[k]?`<div class="${m.w===m[k]?'win':m.w?'lose':''} ${m[k]===me?'me':''}"><span>${nm(m[k])}</span><em>${m.w?fmt(Math.max(0,m[sk])):''}</em></div>`:'<div class="bye"><span>부전승</span></div>').join('')}</div>`).join('')}</div>`).join('')}</div>`;
 const stop=liveMe()?.host&&!sr.done&&st.phase!=='playing'?'<button class="series-stop" data-live-mode="single">시리즈 그만하기</button>':'';
 return `<div class="series ${sr.kind} ${sr.done?'done':''}">${head}${body}${stop}</div>`;}
function liveView(){
 const head=`<div class="page"><main class="shell compact">${header({back:true,title:'실시간 대결'})}`,foot=`</main><div id="toast" class="toast" role="status"></div></div>`;
 if(!liveAvailable())return head+`<section class="live-empty"><div class="live-big">⚡</div><h2>실시간 대결 서버를 준비 중이에요</h2><p>곧 열려요! 그동안은 <b>친구와 점수 대결</b>로 기록을 겨뤄 보세요.</p><button class="btn secondary full" data-action="home">게임 목록으로</button></section>`+foot;
 if(!live)return head+`<section class="live-entry"><span class="mini-kicker">REAL-TIME DUEL</span><h1>같은 판, 같은 순간.<br>누가 더 영리한가.</h1><p>방을 만들고 코드를 건네세요. 최대 8명이 같은 판에서 동시에 겨룹니다.</p>
  <label class="nickname-row">내 이름 <input id="nickname" maxlength="12" placeholder="예: 숫자천재" value="${esc(profile.nickname)}" /></label>
  <button class="btn primary full" data-action="live-create">방 만들기</button>
  <div class="live-join"><input id="roomCode" inputmode="latin" autocapitalize="characters" autocomplete="off" maxlength="6" placeholder="방 코드" value="${esc(roomDraft)}" /><button class="btn secondary" data-action="live-join">입장</button></div></section>`+foot;
 const st=live.state,me=liveMe(),G=st?liveGameInfo(st.game):null;
 if(!st)return head+`<section class="live-empty"><div class="live-big spin">⬡</div><h2>${live.status==='closed'?'연결하지 못했어요':'방에 연결하는 중…'}</h2><p>방 코드 <b>${esc(live.code)}</b></p>${live.status==='closed'?'<button class="btn primary full" data-action="live-join">다시 시도</button>':''}<button class="btn tertiary full" data-action="live-leave">나가기</button></section>`+foot;
 if(st.phase==='playing'&&me?.inRound&&live.startedRound!==st.round)
  return head+`<section class="live-countdown" data-game-color="${G.color}"><span class="mini-kicker">ROUND ${st.round}</span><h2>${G.symbol} ${esc(G.title)}</h2><div class="live-count" id="liveCount">3</div><p>모두 같은 판으로 동시에 시작해요!</p></section>`+foot;
 if(st.phase==='playing'&&st.game==='forehead'&&me?.inRound)return head+STAGE_SLOT+(st.fh?.pending?assignView(st,me):foreheadView(st,me))+foot;
 if(st.phase==='playing'&&st.party&&me?.inRound)return head+STAGE_SLOT+partyView(st,me)+foot;
 const isHost=!!me?.host,ps=st.players,ready=!!me?.ready,enough=ps.filter(p=>p.online).length>=2;
 const rank=liveRanking(),showRes=st.phase==='result'||(st.phase==='playing'&&(me?.done||!me?.inRound));
 return head+STAGE_SLOT+`<section class="live-room"><div class="live-code-row"><div><span class="mini-kicker">ROOM CODE</span><strong class="live-code">${esc(live.code)}</strong></div><button class="btn secondary" data-action="live-invite">초대하기 ↗</button></div>
 ${live.status!=='open'?`<p class="live-warn">${live.status==='reconnecting'?'연결이 잠깐 끊겨서 다시 연결하는 중…':'연결 중…'}</p>`:''}
 ${seriesPanel(st)}
 ${showRes&&rank.length?`<div class="live-result"><span class="mini-kicker">${st.phase==='result'?`ROUND ${st.round} RESULT`:'LIVE SCORES'}</span>${st.party?.kind==='liar'&&st.phase==='result'?`<p class="liar-reveal">😈 거짓말쟁이: <b>${esc(st.players.find(p=>p.pid===st.party.liar)?.name||'?')}</b> · 제시어: <b>${esc(st.party.word||'')}</b>${st.party.guess?` · 마지막 추리: '${esc(st.party.guess)}'`:''}</p>`:''}<h2>${st.phase==='result'?(st.party?.kind==='liar'?(st.party.winner==='liar'?'😈 거짓말쟁이 승리!':'🎉 시민 승리!'):LIVE_EXTRA[st.game]?.coop?(st.party?.result==='lose'?`💔 아쉬워요! 팀 점수 ${rank[0]?.score||0}점`:`🤝 팀 점수 ${rank[0]?.score||0}점!`):rank.length>1&&rank[0].score===rank[1].score?'🤝 공동 1등!':`🏆 ${esc(rank[0].name)} 승리!`):me?.inRound?'다른 친구를 기다리는 중…':st.series?.started?'이번 판은 관전 중이에요 👀':'진행 중인 판이 끝나면 같이 해요'}</h2>
  <ol>${rank.map((p,i)=>`<li class="${p.pid===livePid()?'me':''}"><span>${i+1}</span><b>${esc(p.name)}${st.game==='forehead'&&st.fh?.words?.[p.pid]?` <small class="fh-reveal">${esc(st.fh.words[p.pid])}</small>`:''}</b><em>${fmt(p.score)}점</em>${p.done?'':p.online?'<i>플레이 중</i>':'<i>나감</i>'}</li>`).join('')}</ol></div>`:''}
 <div class="live-players">${ps.filter(p=>p.online).map(p=>`<div class="live-p ${p.ready?'ready':''} ${p.pid===livePid()?'me':''}"><span class="lp-av">${p.host?'👑':p.bot?'🤖':'🙂'}</span><b>${esc(p.name)}${p.pid===livePid()?' (나)':''}</b><em>${p.ready?'준비 완료':'대기'}</em></div>`).join('')}${ps.filter(p=>p.online).length<8?'<div class="live-p empty"><span class="lp-av">＋</span><b>친구 기다리는 중</b><em>최대 8명</em></div>':''}</div>
 ${st.phase!=='playing'&&isHost&&!(st.series?.started&&!st.series?.done)?modePicker(st):''}
 ${st.phase!=='playing'?`<div class="choice-title">이번 판 게임 <small>${isHost?'방장이 골라요':'방장이 고르는 중'}</small></div>
 ${PARTY_IDS.includes(st.game)?`<p class="fineprint party-rule">${esc(LIVE_EXTRA[st.game].short)} (${LIVE_EXTRA[st.game].min}명 이상)</p>`:''}${isHost?`<div class="live-games">${[...Object.values(LIVE_EXTRA),...GAMES].map(g=>`<button data-live-game="${g.id}" class="${g.color} ${st.game===g.id?'active':''} ${PARTY_IDS.includes(g.id)?'party':''}"><span>${g.symbol}</span>${esc(g.title)}${PARTY_IDS.includes(g.id)?`<em>${g.coop?'협동':'파티'} · ${g.min}명+</em>`:''}</button>`).join('')}</div>
  ${st.game==='forehead'?topicPicker(st):''}${BOT_PARTY.includes(st.game)?botPicker(st):''}${!PARTY_IDS.includes(st.game)&&!['gomoku','dots'].includes(st.game)?`<div class="choice-title">진행 방식</div><div class="live-modes turnmode"><button data-live-turn="1" class="${st.turnMode!==false?'active':''}">👀 차례대로<small>한 명씩, 나머진 관전</small></button><button data-live-turn="0" class="${st.turnMode===false?'active':''}">⚡ 동시에<small>다 같이 한 번에</small></button></div>`:''}<div class="live-levels" ${PARTY_IDS.includes(st.game)?'hidden':''}>${LEVELS.map(k=>`<button data-live-level="${k}" class="${st.level===k?'active':''}">${LEVEL_KO[k]}</button>`).join('')}</div>`
 :`<div class="live-picked ${G.color}"><span>${G.symbol}</span><div><b>${esc(G.title)}</b><small>${esc(G.short)}</small></div></div>`}
 <button class="btn ${ready?'secondary':'primary'} full live-ready" data-action="live-ready">${ready?'준비 취소':st.series?.done?'새 시리즈 시작 · 준비':st.series?.started?`다음 판 준비 (${seriesNextLabel(st.series)})`:st.phase==='result'?'한 판 더! 준비 완료':'준비 완료'}</button>
 <p class="fineprint">${enough?'모두 준비하면 3초 뒤 같은 판으로 동시에 시작해요.':'친구가 들어오면 시작할 수 있어요. 초대하기를 눌러 링크를 보내세요.'}</p>`:''}
 <div class="live-emojis">${['👍','😮','😂','🔥','😭','👏'].map(e=>`<button data-emoji="${e}">${e}</button>`).join('')}</div>
 <button class="btn tertiary full" data-action="live-leave">방 나가기</button></section>`+foot;}
// 파티 게임 빈자리 채우기: 방장이 AI 0~3명을 넣어요 (내 단어 맞히기는 대화가 필요해서 제외)
const BOT_PARTY=['liar','nunchi','vote','tele','mind'];
function botPicker(st){const n=st.players.filter(p=>p.bot).length;return `<div class="choice-title">AI 로 빈자리 채우기 <small>사람이 모자랄 때</small></div><div class="live-modes bots">${[0,1,2,3].map(k=>`<button data-live-bots="${k}" class="${n===k?'active':''}">${k?`🤖 ${k}명`:'없음'}</button>`).join('')}</div>`;}
function topicPicker(st){const isHost=liveMe()?.host,cur=st.fhTopic||'random';const opts=[['random','🎲 랜덤 단어','동물·음식·직업…'],['people','🏛 역사 인물','세종대왕, 아인슈타인…'],['tales','📖 동화 캐릭터','흥부, 신데렐라…'],['custom','✍️ 친구가 정해주기','서로 단어를 몰래 정해줘요']];
 return `<div class="choice-title">출제 방식 <small>${isHost?'방장이 골라요':''}</small></div><div class="live-modes topic">${opts.map(([k,t,d])=>`<button ${isHost?`data-live-topic="${k}"`:'disabled'} class="${cur===k?'active':''}"><b>${t}</b><small>${d}</small></button>`).join('')}</div>`;}
function assignView(st,me){const f=st.fh,target=st.players.find(p=>p.pid===f.assignTo),n=st.players.filter(p=>p.inRound).length,done=f.words?.[f.assignTo];
 return `<section class="fh"><div class="fh-top"><span class="mini-kicker">✍️ 친구가 정해주기</span><span>${f.assigned}/${n} 완료</span></div>
 <div class="fh-me"><div class="fh-card mine">🎯</div><div><b>${target?`${esc(target.name)}님의 단어를 정해주세요`:'잠시만요…'}</b><p>연예인, 캐릭터, 물건 뭐든 OK! ${target?esc(target.name):'상대'}님만 모르게 돼요. 너무 어려우면 재미없어요 😉</p></div></div>
 ${done?`<p class="round-outcome">✅ '${esc(done)}'(으)로 정했어요. 다른 친구들을 기다리는 중…</p>`:`<form class="fh-guess" id="assignForm"><input id="assignInput" maxlength="20" placeholder="예) 아이언맨, 떡볶이" autocomplete="off"><button type="submit">정하기</button></form>`}
 <p class="fineprint">모두 정하면 바로 시작해요. 욕설은 자동으로 가려져요.</p><button class="btn tertiary full" data-action="live-leave">방 나가기</button></section>`;}
function partyView(st,me){const P=st.party,nm=id=>esc(st.players.find(p=>p.pid===id)?.name||'?'),meId=livePid();
 const top=(kicker)=>`<div class="fh-top"><span class="mini-kicker">${kicker}</span><span class="fh-time" id="ptTime">${P.deadline?'':''}</span></div>`;
 if(P.kind==='liar'){const speaker=P.order[P.turn%P.order.length],myTurn=P.stage==='hint'&&speaker===meId;
  const card=P.amLiar?`<div class="fh-me liar"><div class="fh-card mine">😈</div><div><b>당신이 거짓말쟁이!</b><p>주제는 <b>${esc(P.cat)}</b>. 제시어를 아는 척 설명하세요. 들키면 마지막에 제시어를 맞혀야 이겨요.</p></div></div>`
   :`<div class="fh-me"><div class="fh-card mine liar-word">${esc(P.word||'')}</div><div><b>제시어를 받았어요</b><p>주제 <b>${esc(P.cat)}</b>. 너무 쉽게 말하면 거짓말쟁이가 눈치채요!</p></div></div>`;
  const hints=`<div class="liar-hints">${P.hints.map(h=>`<div><b>${nm(h.pid)}</b><span>${esc(h.text)}</span></div>`).join('')||'<em>한 명씩 돌아가며 제시어를 한 마디로 설명해요.</em>'}</div>`;
  let act='';
  if(P.stage==='hint')act=myTurn?`<form class="fh-guess" id="liarHintForm"><input id="liarHint" maxlength="40" placeholder="${P.amLiar?'아는 척 한 마디…':'제시어를 한 마디로'}" autocomplete="off" enterkeyhint="send"><button type="submit">설명하기</button></form><p class="fineprint">내 차례예요! 시간 안에 안 쓰면 패스돼요.</p>`:`<p class="round-outcome">🎤 <b>${nm(speaker)}</b>님이 설명하는 중… (${Math.min(P.turn+1,P.order.length*P.laps)}/${P.order.length*P.laps})</p>`;
  else if(P.stage==='vote')act=`<div class="choice-title">거짓말쟁이는 누구? <small>${P.voted.length}/${P.order.length} 투표</small></div><div class="liar-vote">${P.order.filter(id=>id!==meId).map(id=>`<button data-accuse="${id}" class="${P.myVote===id?'active':''}">${nm(id)}</button>`).join('')}</div>`;
  else if(P.stage==='lastguess')act=P.amLiar?`<p class="round-outcome">들켰어요! 제시어를 맞히면 역전승 🔥</p><form class="fh-guess" id="liarGuessForm"><input id="liarGuess" maxlength="20" placeholder="제시어는…?" autocomplete="off"><button type="submit">최후의 추리</button></form>`:`<p class="round-outcome">🎯 ${nm(P.accused)}님 지목! 제시어를 추리하는 중…</p>`;
  return `<section class="fh liar">${top(`거짓말쟁이 찾기 · ${P.stage==='hint'?'설명':P.stage==='vote'?'투표':'최후의 추리'}`)}${card}${hints}${act}<button class="btn tertiary full" data-action="live-leave">방 나가기</button></section>`;}
 if(P.kind==='nunchi'){const done=P.safe.includes(meId),out=P.out.includes(meId),pend=P.pend?.pid===meId,racers=st.players.filter(p=>p.inRound);
  return `<section class="fh nunchi">${top('눈치 게임')}
  <div class="nc-next"><small>다음 숫자</small><strong>${P.next}</strong></div>
  <button class="nc-btn ${done?'safe':out?'out':pend?'pend':''}" data-action="nunchi-call" ${done||out||pend?'disabled':''}>${done?'세이프 ✅':out?'탈락 💥':pend?'외쳤다!':`${P.next}!`}</button>
  <div class="nc-players">${racers.map(p=>`<span class="${P.safe.includes(p.pid)?'safe':P.out.includes(p.pid)?'out':''}">${esc(p.name)}${P.safe.includes(p.pid)?' ✅':P.out.includes(p.pid)?' 💥':''}</span>`).join('')}</div>
  <div class="nc-log">${P.calls.slice(-8).map(c=>`<span class="${c.ok?'ok':'bad'}">${c.n} ${nm(c.pid)}${c.clash?' 💥동시':c.last?' 😵마지막':''}</span>`).join('')}</div>
  <p class="fineprint">눈치껏 아무 때나 눌러요. 다른 사람과 0.45초 안에 겹치면 둘 다 탈락, 마지막까지 못 누르면 탈락!</p><button class="btn tertiary full" data-action="live-leave">방 나가기</button></section>`;}
 if(P.kind==='tele'){const last=P.history.at(-1),reveal=P.stage==='reveal',racers=st.players.filter(p=>p.inRound);
  return `<section class="fh tele">${top(`🤝 마음 맞추기 · ${Math.min(P.idx+1,P.rounds)}/${P.rounds} · 팀 ${P.team}점`)}
  ${reveal&&last?`<div class="tele-q">${esc(last.prompt)}</div><div class="tele-ans">${racers.map(p=>{const a=last.answers[p.pid];const hit=a&&Object.values(last.answers).filter(x=>x&&x.replace(/\s/g,'').toLowerCase()===a.replace(/\s/g,'').toLowerCase()).length>1;return `<div class="${hit?'hit':''}"><small>${esc(p.name)}</small><b>${a?esc(a):'—'}</b></div>`;}).join('')}</div><p class="round-outcome">${last.best>1?`${last.best}명 일치! +${last.pts}${last.all?' 전원 일치 🎉':''}`:'아무도 안 맞았어요 😅 다음엔 더 뻔하게!'}</p>`
  :`<div class="tele-q">${esc(P.prompt||'')}</div><p class="fineprint">친구들이 뭐라고 쓸지 상상해서 <b>똑같이</b> 써 보세요. 가장 뻔한 답이 정답!</p>
   ${P.myAnswer?`<p class="round-outcome">✅ '${esc(P.myAnswer)}' 제출! (${P.answered.length}/${racers.length}) · 시간 안에 바꿀 수 있어요</p>`:''}
   <form class="fh-guess" id="teleForm"><input id="teleInput" maxlength="20" placeholder="${P.myAnswer?'답 바꾸기':'내 답'}" autocomplete="off" enterkeyhint="send"><button type="submit">${P.myAnswer?'바꾸기':'제출'}</button></form>`}
  <button class="btn tertiary full" data-action="live-leave">방 나가기</button></section>`;}
 if(P.kind==='mind'){const others=st.players.filter(p=>p.inRound&&p.pid!==meId),top1=P.played.at(-1);
  return `<section class="fh mind">${top(`🤝 타이밍 맞추기 · ${P.level}/${P.maxLevel}단계`)}
  <div class="mind-status"><span>${'❤️'.repeat(Math.max(0,P.lives))}${'🤍'.repeat(Math.max(0,3-P.lives))}</span><span>팀 점수 ${P.team}</span></div>
  <div class="mind-pile">${top1?`<div class="mind-card ${top1.ok?'':'bad'}">${top1.n}</div><small>${nm(top1.pid)}${top1.burned?' (버려짐)':''}</small>`:'<div class="mind-card empty">?</div><small>가장 작은 수를 가진 사람이 먼저!</small>'}</div>
  <div class="mind-trail">${P.played.slice(-10).map(c=>`<span class="${c.ok?'':'bad'}">${c.n}</span>`).join('')}</div>
  <div class="mind-others">${others.map(p=>`<span>${esc(p.name)} <b>${'🂠'.repeat(P.counts[p.pid]||0)||'✓'}</b></span>`).join('')}</div>
  <div class="mind-hand"><small>내 손</small><div>${P.hand.map((n,i)=>`<span class="${i===0?'next':''}">${n}</span>`).join('')||'<em>다 냈어요! 친구들을 기다려요</em>'}</div></div>
  ${P.stage==='between'?'<p class="round-outcome">✅ 단계 성공! 다음 카드를 나눠주는 중…</p>':`<button class="nc-btn" data-action="mind-play" ${P.hand.length?'':'disabled'}>${P.hand.length?`${P.hand[0]} 내기`:'대기 중'}</button>`}
  <p class="fineprint">숫자를 말하면 반칙! (채팅에서 숫자는 자동으로 가려져요) 감으로만 타이밍을 맞추세요.</p>
  <button class="btn tertiary full" data-action="live-leave">방 나가기</button></section>`;}
 if(P.kind==='vote'){const [a,b]=P.topic||['',''],last=P.history.at(-1),reveal=P.stage==='reveal';
  return `<section class="fh vote">${top(`사람 소수결 · ${Math.min(P.idx+1,P.rounds)}/${P.rounds}`)}
  ${reveal&&last?`<div class="vt-reveal"><div class="${last.minority===0?'win':''}"><b>${esc(last.topic[0])}</b><strong>${last.count[0]}</strong></div><div class="${last.minority===1?'win':''}"><b>${esc(last.topic[1])}</b><strong>${last.count[1]}</strong></div></div><p class="round-outcome">${last.minority===null?'동점! 이번엔 아무도 점수 없음':`적은 쪽 '${esc(last.topic[last.minority])}' +20점`}</p>`
  :`<p class="round-outcome">적은 쪽만 +20점! 채팅으로 떠보고, 속이고, 배신하세요 😏</p><div class="mi-q"><button data-side2="0" class="choice-btn ${P.myVote===0?'hinted':''}"><small>A</small>${esc(a)}</button><span>vs</span><button data-side2="1" class="choice-btn ${P.myVote===1?'hinted':''}"><small>B</small>${esc(b)}</button></div><p class="fineprint">${P.voted.length}/${st.players.filter(p=>p.inRound).length}명 선택 완료 · 시간 안에 바꿀 수 있어요</p>`}
  <div class="nc-players">${st.players.filter(p=>p.inRound).map(p=>`<span>${esc(p.name)} <b>${p.score}</b></span>`).join('')}</div>
  <button class="btn tertiary full" data-action="live-leave">방 나가기</button></section>`;}
 return '';}
function foreheadView(st,me){const f=st.fh||{words:{},solved:{},wrong:{}},mine=f.solved[me.pid],others=st.players.filter(p=>p.inRound&&p.pid!==me.pid);
 return `<section class="fh"><div class="fh-top"><span class="mini-kicker">주제 · ${esc(f.cat||'')}</span><span class="fh-time" id="fhTime">5:00</span></div>
 <div class="fh-me ${mine?'solved':''}"><div class="fh-card mine">${mine?esc(f.words[me.pid]||''):'❓'}</div><div><b>${mine?`정답! ${mine.rank}등 🎉`:'내 단어는 나만 몰라요'}</b><p>${mine?'이제 친구들 질문에 답해 주세요.':'채팅으로 질문해 보세요. 예) "나 먹는 거야?", "나 털 있어?"'}</p></div></div>
 <div class="fh-others">${others.map(p=>`<div class="fh-other ${f.solved[p.pid]?'solved':''} ${p.online?'':'off'}"><span class="fh-name">${esc(p.name)}</span><strong>${esc(f.words[p.pid]||'?')}</strong><small>${f.solved[p.pid]?`✅ ${f.solved[p.pid].rank}등`:f.wrong[p.pid]?`땡 ${f.wrong[p.pid]}번`:'추리 중'}</small></div>`).join('')}</div>
 ${mine?'':`<form class="fh-guess" id="fhForm"><input id="fhGuess" maxlength="20" placeholder="내 단어는…?" autocomplete="off" enterkeyhint="go"><button id="fhGuessBtn" type="submit">정답 도전</button></form><p class="fineprint">틀리면 ${8}초 동안 다시 도전할 수 없어요. 먼저 맞힐수록 점수가 높아요 (100·70·50·30).</p>`}
 <div class="choice-title">친구 질문에 바로 답하기</div><div class="fh-answers">${['⭕ 맞아','❌ 아니야','🤔 애매해','🔥 거의 다 왔어'].map(q=>`<button data-chat-quick="${q}">${q}</button>`).join('')}</div>
 <button class="btn tertiary full" data-action="live-leave">방 나가기</button></section>`;}
// ── 3D 무대: 같은 방 친구들의 캐릭터 (lounge/ 의 three.js 캐릭터를 필요할 때만 불러와요) ──
let stage=null,stageLoading=null;
function loadStage(){if(window.ThinkChipStage)return Promise.resolve(true);if(stageLoading)return stageLoading;
 const load=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s);});
 stageLoading=(window.THREE?Promise.resolve():load('./vendor/three.min.js')).then(()=>load('./lounge/avatar.js')).then(()=>load('./lounge/stage.js')).then(()=>true).catch(()=>false);return stageLoading;}
function syncStage(){const host=document.getElementById('liveStage');if(!host||!live?.state||stage===false)return;
 if(!stage){loadStage().then(ok=>{if(stage)return syncStage();const h=document.getElementById('liveStage');if(!ok||!h||!live){if(!ok)stage=false;return;}stage=window.ThinkChipStage.mount(h,{height:150})||false;if(stage)syncStage();});return;}
 if(stage.el.parentNode!==host)host.appendChild(stage.el);
 stage.setPlayers(live.state.players.filter(p=>p.online).map(p=>({pid:p.pid,name:p.name,look:p.look||'',me:p.pid===livePid(),status:p.ready?'ready':'',online:true})));}
const STAGE_SLOT='<div id="liveStage" class="live-stage" aria-hidden="true"></div>';
// ── 게임 안 캐릭터 무대: 라운지에서 꾸민 내 캐릭터가 AI·친구 캐릭터와 마주 앉아 같이 플레이해요 ──
const NPCS=[{name:'지우',look:{hair:'pony',hairColor:0x2b211d,top:'knit',topColor:0xff7a8a,bottom:'skirt',bottomColor:0x2c3550,eyes:'sparkle',acc:'ribbon'}},
 {name:'민수',look:{hair:'spiky',hairColor:0x1d1f2b,top:'jacket',topColor:0x3fcf9a,bottom:'jeans',eyes:'cat',acc:'headset'}},
 {name:'하린',look:{hair:'curly',hairColor:0x8a5a3c,top:'hoodie',topColor:0xffb34d,bottom:'shorts',eyes:'round',acc:'beanie'}},
 {name:'도윤',look:{hair:'buzz',hairColor:0x4a2f26,top:'suit',topColor:0x1b2742,bottom:'jogger',eyes:'sleepy',acc:'sunglass'}}];
const GLINES={me:{up:['좋아 👍','계획대로 😏','나이스 ㅋㅋ','이거지!'],down:['헐 😮','음… 🤔','아직 몰라'],win:['이겼다 ㅋㅋㅋ','역시 나 😎'],lose:['ㅠㅠ 한 판 더!','다음엔 이긴다 😡']},
 foe:{up:['훗 😏','이번엔 내가 ㅋㅋ','읽혔지?'],down:['헐 😮','뭐야 ㅠㅠ','흠… 🤔'],win:['내가 이겼지 😎','ㅋㅋㅋ 아깝다'],lose:['인정… 👍','다음 판 각오해 😡']}};
let gstage=null,gstageHost=null;
const pickLine=a=>a[Math.floor(Math.random()*a.length)];
function myAvatarLook(){try{const v=JSON.parse(localStorage.getItem('thinkchip:avatar:v1'));if(v&&v.look)return v.look;}catch(e){}return {};}
function foeFor(s){if(!s||s.mode==='solo')return null;if(s.mode==='friend'){return s.challenger?{name:s.challenger.name||'친구',look:{hair:'part',top:'tee',topColor:0x5aa9ff,eyes:'dot'}}:null;}
 let h=0;for(const c of String(s.id))h=(h*31+c.charCodeAt(0))>>>0;const n=NPCS[h%NPCS.length];return {name:n.name+' (AI)',look:n.look};}
function stageCast(){const s=session;if(!s)return [];const foe=foeFor(s);
 return [{pid:'me',name:profile.nickname||'나',look:myAvatarLook(),me:true},...(foe?[{pid:'foe',...foe}]:[])];}
function syncGameStage(){const host=document.getElementById('gameStage');
 if(!host){if(gstage&&!['game','result'].includes(screen)){gstage.destroy();gstage=null;gstageHost=null;}return;}
 if(gstage===false)return;
 if(!gstage){loadStage().then(ok=>{if(gstage||!ok){if(!ok)gstage=false;return;}const h=document.getElementById('gameStage');if(!h)return;gstage=window.ThinkChipStage.mount(h,{height:innerHeight<860?104:150})||false;if(gstage){gstage.setPlayers(stageCast());gstageHost=session;syncGameStage();}});return;}
 if(gstage.el.parentNode!==host)host.appendChild(gstage.el);
 const s=session;if(!s)return;if(gstageHost!==s){gstage.setPlayers(stageCast());gstageHost=s;s._st=null;}
 const my=s.game.score,foe=s.mode==='ai'&&s.botTarget===null?s.game.cpuScore:null;
 if(!s._st){s._st={my,foe,end:false};if(screen==='game')gstage.say('foe',pickLine(['한 판 붙자 😏','봐주는 거 없다 ㅋㅋ','긴장되네 🤔']));return;}
 const st=s._st;
 // 심리전: 매 판 AI 의 한마디 (진심일 수도, 블러핑일 수도) + 판이 끝나면 반응
 if(s.mode==='ai'&&BLUFF_GAMES.includes(s.id)){const tk=s.game.turn,tell=!s.game.over?aiTell(s.id,s.game):null,box=document.getElementById('aiTell');
  if(box){box.hidden=!tell;if(tell)box.innerHTML=`<b>🤖 AI</b> ${esc(tell.text)}`;}
  if(st.tk!==tk){const prev=st.tell;if(prev&&st.tk!==undefined&&s.game.last){const won=s.id==='trust'?s.game.last.mine==='betray'?s.game.last.cpu==='cooperate':s.game.last.cpu==='cooperate':s.id==='marbles'?!!s.game.last.win:s.id==='auction'?s.game.last.winner!=='cpu':s.game.last.outcome!=='lose';
    const line=aiTellReact(prev,won,`${s.seed}:${tk}`);if(line){gstage.say('foe',line);gstage.react('foe',prev.truth===false&&!won?'smug':won?'hmm':'happy');}
    if(tell)setTimeout(()=>{if(gstage&&session===s&&s.game.turn===tk)gstage.say('foe',tell.text);},1800);}
   else if(tell)gstage.say('foe',tell.text);
   st.tk=tk;st.tell=tell;}}
 if(screen==='result'&&!st.end){st.end=true;const v=calcVictory();
  if(v===true){gstage.say('me',pickLine(GLINES.me.win));setTimeout(()=>gstage&&gstage.say('foe',pickLine(GLINES.foe.lose)),700);}
  else if(v===false){gstage.say('foe',pickLine(GLINES.foe.win));setTimeout(()=>gstage&&gstage.say('me',pickLine(GLINES.me.lose)),700);}
  else gstage.say('me',pickLine(['끝! 😊','기록 세웠다 👍']));return;}
 if(my>st.my){gstage.say('me',pickLine(GLINES.me.up));gstage.react('foe','wow');}
 else if(my<st.my){gstage.say('me',pickLine(GLINES.me.down));gstage.react('foe','smug');}
 if(foe!=null&&st.foe!=null&&foe>st.foe){gstage.say('foe',pickLine(GLINES.foe.up));gstage.react('me','hmm');}
 st.my=my;st.foe=foe;}
const GAME_STAGE_SLOT='<div id="gameStage" class="live-stage game-stage" aria-hidden="true"></div><div id="aiTell" class="ai-tell" hidden></div>';
// ── 채팅 (실시간 방 안에서만) ──
function onChat(m){if(!live)return;if(stage&&!m.sys)stage.say(m.pid,m.text);live.chat=[...(live.chat||[]),m].slice(-60);const mine=m.pid===livePid();
 if(!chatOpen&&!mine&&!chatMuted.has(m.pid)){live.unread=(live.unread||0)+1;const pk=document.getElementById('chatPeek');if(pk){pk.textContent=m.sys?m.text:`${m.name}: ${m.text}`;pk.classList.add('show');clearTimeout(chatPeekTimer);chatPeekTimer=setTimeout(()=>pk.classList.remove('show'),3200);}}
 renderChatDock();}
function sendChat(text){const t=String(text||'').trim();if(!t||!live)return;if(!live.conn.send({t:'chat',text:t.slice(0,80)}))flash('연결이 끊겨서 보내지 못했어요.');}
function chatLogHTML(){const me=livePid();return (live?.chat||[]).filter(m=>!chatMuted.has(m.pid)).map(m=>m.sys?`<div class="cm sys">${esc(m.text)}</div>`:`<div class="cm ${m.pid===me?'me':''}"><b>${esc(m.name)}${m.pid!==me?`<button data-mute="${esc(m.pid)}" aria-label="${esc(m.name)} 채팅 숨기기">🔇</button>`:''}</b><span>${esc(m.text)}</span></div>`).join('')||'<div class="cm sys">아직 대화가 없어요. 먼저 인사해 보세요! 👋</div>';}
function renderChatDock(){let d=document.getElementById('chatDock');const show=!!live&&!!live.state&&(screen==='live'||screen==='game');
 if(!show){d?.remove();return;}
 if(!d){d=document.createElement('div');d.id='chatDock';d.className='chat-dock';(document.querySelector('.app-root')||document.body).appendChild(d);
  d.innerHTML=`<div class="chat-peek" id="chatPeek"></div><button class="chat-fab" data-chat="toggle" aria-label="채팅 열기">💬<span class="chat-badge" id="chatBadge"></span></button>
  <div class="chat-panel" role="dialog" aria-label="채팅"><div class="chat-head"><b>💬 채팅</b><small id="chatRoom"></small><button data-chat="close" aria-label="채팅 닫기">✕</button></div><div class="chat-log" id="chatLog" aria-live="polite"></div>
  <div class="chat-quick">${CHAT_QUICK.map(q=>`<button data-chat-quick="${q}">${q}</button>`).join('')}</div>
  <form class="chat-form" id="chatForm"><input id="chatInput" maxlength="80" placeholder="메시지 보내기" autocomplete="off" enterkeyhint="send"><button type="submit">전송</button></form>
  <p class="chat-note">욕설·링크는 자동으로 가려져요. 🔇를 누르면 그 사람 채팅을 숨겨요.</p></div>`;
  d.addEventListener('click',e=>{const b=e.target.closest('[data-chat],[data-chat-quick],[data-mute]');if(!b)return;
   if(b.dataset.chat==='toggle'){chatOpen=!chatOpen;if(chatOpen&&live)live.unread=0;renderChatDock();if(chatOpen)setTimeout(()=>document.getElementById('chatInput')?.focus({preventScroll:true}),50);}
   else if(b.dataset.chat==='close'){chatOpen=false;renderChatDock();}
   else if(b.dataset.chatQuick)sendChat(b.dataset.chatQuick);
   else if(b.dataset.mute){chatMuted.add(b.dataset.mute);flash('이 사람의 채팅을 숨겼어요.');renderChatDock();}});
  d.addEventListener('submit',e=>{e.preventDefault();const inp=document.getElementById('chatInput');sendChat(inp.value);inp.value='';});}
 d.classList.toggle('open',chatOpen);if(chatOpen&&live)live.unread=0;
 const badge=document.getElementById('chatBadge');if(badge){badge.textContent=live.unread>9?'9+':String(live.unread||'');badge.hidden=!live.unread;}
 const room=document.getElementById('chatRoom');if(room)room.textContent=`방 ${live.code}`;
 const log=document.getElementById('chatLog');if(log){const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<40;log.innerHTML=chatLogHTML();if(atBottom||chatOpen)log.scrollTop=log.scrollHeight;}}
// ── 스도쿠 · 숫자 합치기 · 색깔 맞히기 · 오목 · 땅따먹기 ──
function sudokuUI(g){const sel=session.sel,h=session.hint&&session.hintKey===currentTurnKey()?session.hint:null,selV=Number.isInteger(sel)?g.board[sel]:0;
 const cells=g.board.map((v,i)=>{const r=(i/9)|0,c=i%9,peer=Number.isInteger(sel)&&(((sel/9)|0)===r||sel%9===c||(((sel/27)|0)===((i/27)|0)&&(((sel%9)/3)|0)===((c/3)|0)));
  return `<button data-sd-cell="${i}" class="${g.givens[i]?'given':''} ${i===sel?'sel':''} ${peer&&i!==sel?'peer':''} ${v&&v===selV&&i!==sel?'same':''} ${h?.cell===i?'hinted':''} ${g.last?.i===i&&!g.last.ok?'bad':''}">${v||''}</button>`;}).join('');
 const counts=Array(10).fill(0);g.board.forEach(v=>counts[v]++);
 return `<section class="play-panel sd-panel"><div class="panel-heading"><div><span class="mini-kicker">SUDOKU</span><h2>남은 칸 ${sudokuLeft(g)}개</h2></div><span class="round-tag" id="gTime">0:00</span></div>
 <div class="sd-grid">${cells}</div>
 <div class="sd-pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-sd-num="${n}" ${counts[n]>=9?'disabled':''} class="${h?.n===n?'hinted':''}">${n}</button>`).join('')}</div>
 <div class="sub-stats"><span>실수 ${'✕'.repeat(g.mistakes)}${'·'.repeat(SD_MAX_MISTAKES-g.mistakes)}</span><span>기준 시간 ${Math.round(g.par/60000)}분</span></div></section>`;}
function mergeUI(g){const h=session.hint&&session.hintKey===currentTurnKey()?session.hint:null,ar={up:'↑',down:'↓',left:'←',right:'→'};
 return `<section class="play-panel mg-panel"><div class="panel-heading"><div><span class="mini-kicker">MERGE IT</span><h2>최고 ${g.best}</h2></div><span class="round-tag">${g.moves-g.used}수 남음</span></div>
 <div class="mg-board" id="mgBoard">${g.board.map(v=>`<span class="mg-t v${Math.min(v,4096)}">${v||''}</span>`).join('')}</div>
 <div class="mg-pad">${['up','left','down','right'].map(d=>`<button data-mg-dir="${d}" class="d-${d} ${h?.dir===d?'hinted':''}">${ar[d]}</button>`).join('')}</div>
 <p class="round-outcome">${g.last?.gain?`+${g.last.gain}점!`:'판을 밀어서 같은 숫자를 합치세요'}</p></section>`;}
function stroopUI(g){const it=g.items[g.idx],ink=COLORS.find(c=>c.id===it.ink),word=COLORS.find(c=>c.id===it.word),h=session.hint&&session.hintKey===currentTurnKey()?session.hint:null;
 return `<section class="play-panel st-panel"><div class="panel-heading"><div><span class="mini-kicker">COLOR CLASH</span><h2 class="st-ask ${it.ask}">${it.ask==='ink'?'🎨 글자의 <b>색</b>은?':'📖 글자의 <b>뜻</b>은?'}</h2></div><span class="round-tag" id="gTime">${Math.round(g.time/1000)}초</span></div>
 <div class="st-word" style="color:${ink.hex}">${word.name}</div>
 <div class="st-answers">${g.colors.map(id=>{const c=COLORS.find(x=>x.id===id);return `<button data-st-ans="${id}" class="${h?.answer===id?'hinted':''}"><i style="background:${c.hex}"></i>${c.name}</button>`;}).join('')}</div>
 <div class="sub-stats"><span>${g.last?(g.last.correct?`⭕ +${g.last.gain}`:'❌ -15'):'시작하면 시간이 흘러요'}</span><span>연속 ${g.combo} · 맞음 ${g.right}</span></div></section>`;}
function turnLabel(g){if(g.over)return g.winner==='draw'?'무승부!':g.winner===g.meIdx?'승리! 🎉':'패배 😵';return g.toMove===g.meIdx?'내 차례':session.mode==='live'?'상대 차례…':'AI 생각 중…';}
function gomokuUI(g){const h=session.hint&&session.hintKey===currentTurnKey()?session.hint:null,lastI=g.last?.i,win=new Set(g.line||[]),my=g.meIdx===0?'⚫':'⚪';
 return `<section class="play-panel gm-panel"><div class="panel-heading"><div><span class="mini-kicker">FIVE IN A ROW · 나는 ${my}</span><h2>${turnLabel(g)}</h2></div><span class="round-tag">${g.moves.length}수</span></div>
 <div class="gm-board" style="--n:${GM_N}">${g.board.map((v,i)=>`<button data-gm-cell="${i}" class="${v===0?'b':v===1?'w':''} ${i===lastI?'last':''} ${win.has(i)?'win':''} ${h?.cell===i?'hinted':''}" ${v>=0||g.over||g.toMove!==g.meIdx?'tabindex="-1"':''} aria-label="${(i/GM_N|0)+1}행 ${i%GM_N+1}열"></button>`).join('')}</div>
 <p class="round-outcome">${g.over?'':g.toMove===g.meIdx?'빈 칸을 눌러 돌을 놓아요':'잠시만요…'}</p></section>`;}
function dotsUI(g){const h=session.hint&&session.hintKey===currentTurnKey()?session.hint:null,S=56,P=14,size=DB_N*S+P*2,me=g.meIdx,col=o=>o===me?'var(--accent)':'#ff6b6b';
 let lines='';for(let r=0;r<=DB_N;r++)for(let c=0;c<DB_N;c++){const li=DB_H(r,c),o=g.lines[li];lines+=`<line x1="${P+c*S}" y1="${P+r*S}" x2="${P+(c+1)*S}" y2="${P+r*S}" class="db-l ${o>=0?'on':''} ${h?.line===li?'hinted':''}" style="${o>=0?`stroke:${col(o)}`:''}"/><rect data-db-line="${li}" x="${P+c*S+6}" y="${P+r*S-11}" width="${S-12}" height="22" class="db-hit"/>`;}
 for(let r=0;r<DB_N;r++)for(let c=0;c<=DB_N;c++){const li=DB_V(r,c),o=g.lines[li];lines+=`<line x1="${P+c*S}" y1="${P+r*S}" x2="${P+c*S}" y2="${P+(r+1)*S}" class="db-l ${o>=0?'on':''} ${h?.line===li?'hinted':''}" style="${o>=0?`stroke:${col(o)}`:''}"/><rect data-db-line="${li}" x="${P+c*S-11}" y="${P+r*S+6}" width="22" height="${S-12}" class="db-hit"/>`;}
 const boxes=g.owner.map((o,k)=>o<0?'':`<rect x="${P+(k%DB_N)*S+5}" y="${P+((k/DB_N)|0)*S+5}" width="${S-10}" height="${S-10}" rx="7" style="fill:${col(o)}" class="db-box"/><text x="${P+(k%DB_N)*S+S/2}" y="${P+((k/DB_N)|0)*S+S/2+6}" class="db-own">${o===me?'나':session.mode==='live'?'상대':'AI'}</text>`).join('');
 let dots='';for(let r=0;r<=DB_N;r++)for(let c=0;c<=DB_N;c++)dots+=`<circle cx="${P+c*S}" cy="${P+r*S}" r="5" class="db-dot"/>`;
 return `<section class="play-panel db-panel"><div class="panel-heading"><div><span class="mini-kicker">DOTS & BOXES</span><h2>${turnLabel(g)}</h2></div><span class="round-tag">나 ${g.pts[me]} : ${g.pts[1-me]}</span></div>
 <svg class="db-board" viewBox="0 0 ${size} ${size}">${boxes}${lines}${dots}</svg>
 <p class="round-outcome">${g.last?.closed&&!g.over?(g.last.by===me?'상자 획득! 한 번 더 🎉':'상대가 상자를 가져갔어요'):'점 사이를 눌러 선을 그어요'}</p></section>`;}
function mergeMove(dir){if(!session||session.id!=='merge')return;const before=session.game;session.game=playMerge(before,dir);if(session.game===before)return;session.hint=null;session.hintKey=null;if(session.game.over)complete();else render();}
function stroopAnswer(id){const g=session.game;if(g.over)return;if(!session.t0){session.t0=Date.now();}session.game=playStroop(g,id);session.hint=null;session.hintKey=null;if(session.game.over)complete();else render();}
// 오목/땅따먹기: my move, then AI reply (solo/AI) or relay to the friend (live).
function turnMove(i){const g=session.game;if(g.over||g.toMove!==g.meIdx)return;const play=session.id==='gomoku'?playGomoku:playDots,next=play(g,i);if(next===g)return;
 session.game=next;session.hint=null;session.hintKey=null;
 if(session.mode==='live'){live?.conn?.send({t:'move',b:session.duelIdx,i,n:g.moves.length,next:next.toMove,over:next.over});if(next.over)complete();else render();return;}
 if(next.over)return complete();render();}
function aiReply(){if(!session||!['gomoku','dots'].includes(session.id)||screen!=='game')return;session.aiPending=false;let g=session.game;if(g.over||g.toMove===g.meIdx)return;
 const ai=session.id==='gomoku'?gomokuAI:dotsAI,play=session.id==='gomoku'?playGomoku:playDots;g=play(g,ai(g));session.game=g;
 if(g.over)return complete();render();}
// Timers for sudoku (elapsed) and stroop (countdown); merge swipe.
function bindGameExtras(){if(!session)return;clearInterval(session.timer);
 if(session.id==='sudoku'&&!session.game.over){session.t0=session.t0||Date.now();const tick=()=>{const el=document.getElementById('gTime');if(!el||!session||session.id!=='sudoku')return clearInterval(session?.timer);const s=Math.floor((Date.now()-session.t0)/1000);el.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};session.timer=setInterval(tick,500);tick();}
 if(session.id==='stroop'&&!session.game.over){const S=session;const tick=()=>{const el=document.getElementById('gTime');if(session!==S||screen!=='game')return clearInterval(S.timer);if(!S.t0){if(el)el.textContent=`${Math.round(S.game.time/1000)}초`;return;}const left=S.game.time-(Date.now()-S.t0);if(el)el.textContent=`${Math.max(0,Math.ceil(left/1000))}초`;if(left<=0){clearInterval(S.timer);S.game=endStroop(S.game);complete();}};S.timer=setInterval(tick,200);tick();}
 if(session.id==='merge'){const el=document.getElementById('mgBoard');if(el){let sx=0,sy=0,on=false;el.addEventListener('pointerdown',e=>{on=true;sx=e.clientX;sy=e.clientY;});el.addEventListener('pointerup',e=>{if(!on)return;on=false;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;mergeMove(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));});}}
 if(['gomoku','dots'].includes(session.id)&&session.mode!=='live'&&!session.game.over&&session.game.toMove!==session.game.meIdx&&!session.aiPending){session.aiPending=true;setTimeout(aiReply,420);}}
function rulesFor(id){return ({flip:['숫자를 4개 줄 중 하나에 넣어요.','같은 숫자 3개 또는 연속 숫자 3개면 점수 획득!','현재 숫자를 10에서 빼는 값으로 뒤집을 수 있어요. 총 6번!'],blind:['1~9 숫자 카드를 한 장씩 한 번만 사용해요.','AI도 숨긴 카드 한 장을 냅니다. 높은 카드가 승리!','9라운드 동안 가장 많이 이겨보세요.'],triad:['카드 9장 중에서 "세트"가 되는 3장을 골라요.','카드마다 특징이 3가지 있어요: 색(주황·청록·노랑), 모양(▲·●·◆), 개수(1·2·3개).','세트 조건: 색·모양·개수를 하나씩 따로 봤을 때, 각각 3장이 "전부 같거나" 아니면 "전부 다르거나" 해야 해요.','2장만 같고 1장만 다른 특징이 하나라도 있으면 세트가 아니에요. (아래 예시 참고)','총 5문제. 정답 +40점, 오답 -8점.'],trust:['6라운드 동안 AI와 협력 또는 배신을 골라요.','둘 다 협력하면 각 3점, 혼자 배신하면 5점을 얻어요.','둘 다 배신하면 각 1점. 상대의 패턴을 읽어야 해요.'],baseball:['1~9 중 서로 다른 숫자 3개로 된 비밀 번호를 맞혀요.','숫자와 자리가 모두 맞으면 스트라이크(S), 숫자만 맞으면 볼(B)이에요.','8번 안에 맞히면 성공! 빨리 맞힐수록 점수가 높아요(최고 100점).'],nim:['돌 더미에서 번갈아 1~3개씩 가져가요. 내가 먼저 시작해요.','마지막 돌을 가져가는 쪽이 그 판에서 져요.','3판 2선승! 한 판 이길 때마다 +30점. 수학으로 이길 수 있어요.'],auction:['보물 5개가 하나씩 경매에 나와요. 나와 AI 모두 30칩으로 시작해요.','몰래 입찰해서 더 많이 건 쪽이 보물을 가져가요. 같으면 아무도 못 가져가요(칩은 사라져요).','보물 가치×10점 + 남은 칩. 💣 함정 상자는 마이너스예요!'],maze:['초록 출발점을 누른 채로 손가락을 떼지 말고 깃발까지 길을 따라가요.','벽에 닿거나 손을 떼면 그 단계는 0점이에요.','5단계! 단계마다 길은 좁아지고 내 점은 커져요. 통과 40점 + 빠를수록 최대 20점.'],draw:['점선으로 보이는 모양을 손을 떼지 않고 한 번에 그려요.','선에 가까울수록, 모양을 끝까지 둘러 그릴수록 점수가 높아요(최고 100점).','5라운드: 동그라미·세모 → 하트·씽크칩 → 별·번개. 갈수록 채점이 깐깐해져요.'],marbles:['나와 AI 모두 구슬 10개로 시작해요. 한 번은 맞히고, 한 번은 숨기며 번갈아 10판!','맞히는 쪽은 홀·짝을 고르고 구슬을 걸어요. 맞히면 건 만큼 상대 구슬을 가져와요.','숨기는 쪽은 쥔 개수의 홀·짝만 중요해요. 남은 구슬 1개 = 10점.'],redlight:['버튼을 꾹 누르고 있으면 앞으로 가요. 결승선까지 25초!','술래가 돌아보면(👀) 바로 손을 떼세요. 시간이 갈수록 술래가 빨라지고, 높은 난이도엔 돌아보는 척(페이크)도 해요!','완주 100점 + 남은 시간 보너스. 탈락하면 간 거리만큼만 점수를 받아요.'],bridge:['안전한 돌이 하나씩 차례로 반짝여요. 잘 기억하세요!','왼쪽/오른쪽 중 안전한 돌을 골라 건너요. 틀리면 목숨 -1.','3단계, 갈수록 다리가 길어지고 보여주는 속도가 빨라져요. 고수부터는 돌이 3개!','한 번에 맞힌 칸 10점, 단계 통과 20점, 남은 목숨 10점씩.'],sudoku:['가로줄·세로줄·3×3 칸에 1~9가 한 번씩만 들어가요.','칸을 누르고 아래 숫자를 고르세요. 틀린 숫자는 들어가지 않고 실수 1회!','실수 3번이면 끝. 빨리 풀수록 점수가 높아요(최대 1000점).'],
 merge:['화면을 밀거나 화살표로 판 전체를 밀어요. 같은 숫자가 부딪히면 합쳐져요.','합쳐진 숫자만큼 점수! 정해진 횟수 안에 최대한 많이 합치세요.','큰 숫자를 한쪽 구석에 모아두는 게 요령이에요.'],
 stroop:['단어가 아니라 글자의 색을 골라요. ("빨강"이 파란색이면 → 파랑)','어려움부터는 가끔 "뜻"을 물어봐요. 위의 질문을 꼭 보세요!','맞히면 +10점에 연속 보너스, 틀리면 -15점. 제한 시간 안에 최대한 많이!'],
 gomoku:['검은 돌과 흰 돌을 번갈아 놓아요. 가로·세로·대각선으로 5개를 먼저 이으면 승리!','상대의 열린 3·4는 꼭 막으세요.','실시간 대결에서는 친구와 1:1로 붙어요. 빨리 이길수록 보너스.'],
 dots:['점과 점 사이에 선을 하나씩 그어요.','상자의 네 번째 선을 그으면 그 상자는 내 땅 + 한 번 더!','세 번째 선을 그어주면 상대가 가져가요. 끝까지 땅이 많은 쪽이 승리.'],
 minority:['나와 AI 참가자 8명, 모두 9명이 두 쪽 중 하나를 골라요.','적은 쪽을 고른 사람만 +20점! 반반이거나 한쪽에 몰리면 아무도 점수가 없어요.','참가자마다 버릇이 있어요(고집, 번갈아, 따라쟁이…). 7판 뒤 1등이면 +30점.']})[id];}
function start(mode){
 const seed=mode==='friend'&&invitedGame===selectedGame&&invitedSeed?invitedSeed:newSeed();
 const g=createRound(selectedGame,seed,difficulty);
 const challenger=mode==='friend'&&invitedGame===selectedGame&&invitedTarget!==null?{score:invitedTarget,name:invitedFrom}:null;
 session={id:selectedGame,mode,seed,difficulty,game:g,challenger,botTarget:mode==='ai'?aiTarget(selectedGame,seed,difficulty):null,flipped:false,hint:null,hintKey:null,award:0,input:[],bid:0,bet:1,preview:null,previewedStage:-1,rl:null,t0:0,sel:null};
 // 점수 대결 게임은 AI 가 먼저 실제로 플레이하는 걸 보여주고, 그다음 내 차례 (점수만 띡 나오지 않게)
 if(mode==='ai'&&AI_RUN[selectedGame]){session.aiRun=AI_RUN[selectedGame](seed,difficulty);session.botTarget=session.aiRun.score;session.rp={i:0,done:false};screen='aiturn';rulesOpen=false;render();window.scrollTo?.(0,0);startReplay();return;}
 screen='game';rulesOpen=false;render();window.scrollTo?.(0,0);fitControls();
}
// 폰에서 게임을 시작하면 조작 버튼이 화면 아래로 잘리지 않게, 판 전체가 보이도록 살짝 내려줘요
function fitControls(){setTimeout(()=>{const p=document.querySelector('.play-panel');if(!p||typeof window.scrollTo!=='function')return;const r=p.getBoundingClientRect();if(r.bottom>innerHeight)window.scrollTo({top:Math.max(0,scrollY+Math.min(r.top-8,r.bottom-innerHeight+12)),behavior:'smooth'});},120);}
// ───────── AI 차례: AI 가 같은 판을 실제로 플레이하는 장면 (숫자 탐정·징검다리·무궁화·소수결) ─────────
const AI_RUN={baseball:baseballBotRun,bridge:bridgeBotRun,redlight:redLightBotRun,minority:minorityBotRun};
let replayTimer=0;
function stopReplay(){clearInterval(replayTimer);replayTimer=0;}
function replayLen(){const r=session.aiRun;return session.id==='baseball'?r.history.length:session.id==='bridge'?r.moves.length:session.id==='minority'?r.rounds.length:r.frames.length;}
function startReplay(){stopReplay();const s=session,step=s.id==='redlight'?50:s.id==='bridge'?520:s.id==='minority'?1100:950; // 무궁화는 2배속
 replayTimer=setInterval(()=>{if(session!==s||screen!=='aiturn')return stopReplay();s.rp.i+=1;if(s.rp.i>=replayLen()){s.rp.i=replayLen();s.rp.done=true;stopReplay();}patchReplay();},step);}
function patchReplay(){const el=document.getElementById('aiReplay');if(el)el.innerHTML=aiReplayBody();const f=document.getElementById('aiFoot');if(f)f.innerHTML=aiFoot();}
function aiFoot(){const s=session;return s.rp.done?`<div class="ai-result"><span>AI 점수</span><strong>${fmt(s.aiRun.score)}점</strong><small>이 점수를 넘으면 승리!</small></div><button class="btn primary full" data-action="my-turn">▶ 이제 내 차례</button>`
 :`<button class="btn secondary full" data-action="ai-skip">⏭ 건너뛰고 결과 보기</button>`;}
function aiReplayBody(){const s=session,r=s.aiRun,i=s.rp.i;
 if(s.id==='baseball'){const rows=r.history.slice(0,i);return `<p class="ai-note">AI 도 자기만의 숨은 세 자리 숫자를 추리해요 (기회 ${BB_TRIES}번)</p><div class="ai-rows">${rows.map((h,k)=>`<div class="ai-row ${h.strike===BB_LEN?'win':''}"><span>${k+1}</span><b>${h.guess.join(' ')}</b><em>${h.strike===BB_LEN?'정답! 🎉':`${h.strike}S ${h.ball}B`}</em></div>`).join('')}${!s.rp.done?'<div class="ai-row thinking"><span>…</span><b>생각 중</b><em>🤔</em></div>':!r.solved?'<div class="ai-row lose"><span>✕</span><b>못 맞혔어요</b><em>0점</em></div>':''}</div>`;}
 if(s.id==='bridge'){const m=r.moves[Math.min(i,r.moves.length)-1],done=r.moves.slice(0,i),lives=m?(m.ok?m.lives:m.lives-1):r.moves[0]?.lives??3;
  const cur=m||r.moves[0];const stones=cur?Array.from({length:cur.width},(_,k)=>`<i class="${m&&k===m.side?(m.ok?'ok':'bad'):''}">${m&&k===m.side?(m.ok?'🦶':'💥'):''}</i>`).join(''):'';
  return `<p class="ai-note">AI 가 기억한 안전한 돌을 골라 건너요</p><div class="ai-bridge"><div class="ai-stat"><span>단계 ${cur?cur.stage+1:1}/${r.total}</span><span>${cur?cur.step+1:1}번째 칸</span><span>${'♥'.repeat(Math.max(0,lives))}${'♡'.repeat(Math.max(0,(r.moves[0]?.lives??3)-lives))}</span></div><div class="ai-stones">${stones}</div><div class="ai-trail">${done.map(x=>x.ok?'🟩':'🟥').join('')}</div></div>${s.rp.done?`<p class="ai-note">${r.cleared>=r.total?'끝까지 건넜어요! 🏁':`${r.cleared}단계까지 건넜어요`}</p>`:''}`;}
 if(s.id==='redlight'){const f=r.frames[Math.min(i,r.frames.length-1)]||{pos:0,t:0,phase:'green'},pct=Math.min(100,f.pos/RL_GOAL*100),face=f.phase==='red'?'👀':f.phase==='warn'?'⚠️':'🙈';
  return `<p class="ai-note">AI 가 술래 눈치를 보며 달려요 (2배속)</p><div class="ai-rl ${f.phase}"><div class="ai-tagger">${face}<small>${f.phase==='red'?'돌아봤다!':f.phase==='warn'?'무궁화 꽃이…':'피었습니다~'}</small></div><div class="ai-track"><i style="left:${pct}%">${s.rp.done&&r.caught?'💀':s.rp.done&&r.finished?'🏁':f.holding?'🏃':'🧍'}</i></div><div class="ai-stat"><span>${(f.t/1000).toFixed(1)}초</span><span>${Math.round(pct)}%</span></div></div>`;}
 if(s.id==='minority'){const rows=r.rounds.slice(0,i);return `<p class="ai-note">AI 가 다른 8명의 버릇을 읽고 적은 쪽을 골라요</p><div class="ai-rows">${rows.map((x,k)=>`<div class="ai-row ${x.won?'win':''}"><span>${k+1}</span><b>${esc(x.topic[x.me])}<small> ${x.count[0]}:${x.count[1]}</small></b><em>${x.won?`+${MI_POINT}`:x.minority===null?'동점':'✕'}</em></div>`).join('')}${!s.rp.done?'<div class="ai-row thinking"><span>…</span><b>고르는 중</b><em>🤔</em></div>':`<div class="ai-row"><span>🏆</span><b>${r.rank}등</b><em>${fmt(r.score)}점</em></div>`}</div>`;}
 return '';}
function aiTurnView(){const s=session,g=GAME_BY_ID[s.id];return `<div class="page"><main class="shell">${header({back:true,title:g.title})}${GAME_STAGE_SLOT}
 <section class="ai-turn"><div class="ai-badge">🤖 AI 차례 <small>${esc(LEVEL_KO[s.difficulty]||'')}</small></div><h2>AI 가 먼저 플레이해요</h2>
 <div id="aiReplay" class="ai-replay">${aiReplayBody()}</div><div id="aiFoot" class="ai-foot">${aiFoot()}</div></section></main></div>`;}
function currentTurnKey(){const g=session.game;return session.id==='triad'||session.id==='minority'?g.round:session.id==='bridge'?`${g.stage}:${g.step}`:session.id==='redlight'?'rl':g.turn;}
function opponentScore(){if(!session)return null;if(session.mode==='live'){const o=liveOthers();return o.length?Math.max(...o.map(p=>p.score)):null;}if(session.challenger)return session.challenger.score;if(session.mode==='ai'){if(session.botTarget!==null)return session.botTarget;return session.game.cpuScore;}return null;}
function statusText(){
 if(!session)return '';
 if(session.mode==='solo')return '연습 모드 · 혼자 기록에 도전';
 if(session.mode==='live')return `실시간 대결 · 방 ${esc(live?.code||'')}`;
 if(session.challenger)return `${esc(session.challenger.name)}님의 기록 ${fmt(session.challenger.score)}점에 도전`;
 if(session.mode==='friend')return '친구에게 도전장을 보낼 기록 만들기';
 return 'AI 대결 · '+(LEVEL_KO[session.difficulty]||'보통');
}
function gameView(){const g=gameById(),s=session,round=s.game,enemy=opponentScore();
 return `<div class="page"><main class="shell compact">${header({back:true,title:g.title})}
 <div class="game-caption"><span class="kicker"><i></i>${labelMode(s.mode)}</span><button class="help-btn" data-action="rules">? 게임 방법</button></div>
 ${s.mode==='live'?STAGE_SLOT:GAME_STAGE_SLOT}
 <section class="score-panel"><div><span>내 점수</span><strong>${fmt(round.score)}</strong></div><div class="score-divider"></div><div><span>${s.mode==='live'?'상대 최고':enemy===null?'최고 기록':s.challenger?'친구 기록':'AI 점수'}</span><strong id="enemyScore">${fmt(enemy===null?(s.mode==='live'?0:profile.best[s.id]||0):enemy)}</strong></div></section>
 <p class="match-status">${statusText()}</p>${s.mode==='live'?`<div class="live-bar" id="liveBar">${liveBarHTML()}</div>`:''}
 ${s.id==='flip'?flipUI(round):s.id==='blind'?blindUI(round):s.id==='triad'?triadUI(round):s.id==='baseball'?baseballUI(round):s.id==='nim'?nimUI(round):s.id==='auction'?auctionUI(round):s.id==='maze'?mazeUI(round):s.id==='draw'?drawUI(round):s.id==='marbles'?marblesUI(round):s.id==='redlight'?redLightUI(round):s.id==='bridge'?bridgeUI(round):s.id==='minority'?minorityUI(round):s.id==='sudoku'?sudokuUI(round):s.id==='merge'?mergeUI(round):s.id==='stroop'?stroopUI(round):s.id==='gomoku'?gomokuUI(round):s.id==='dots'?dotsUI(round):trustUI(round)}
 <div class="hint-row"><div><strong>💡 씽크칩 힌트</strong><small>${s.mode==='friend'||s.mode==='live'?'공정한 대결을 위해 사용할 수 없어요.':`한 번에 ${HINT_COST}칩 · ${guest()?'로그인하면 쓸 수 있어요':`보유 ${fmt(bal())}칩`}`}</small></div><button data-action="hint" ${s.mode==='friend'||s.mode==='live'?'disabled':''}>${s.hint&&s.hintKey===currentTurnKey()?'다시 보기':`${HINT_COST}칩 사용`}</button></div>
 ${s.hint&&s.hintKey===currentTurnKey()?`<div class="hint-result">${esc(showHint())}</div>`:''}
 <button class="leave-game" data-action="leave">${fromLounge?'← 라운지로 돌아가기':'← 게임 목록으로 돌아가기'}</button>
 </main><div class="toast" id="toast" role="status"></div>${rulesOpen?rulesModal(s.id):''}</div>`;
}
function flipUI(g){const raw=g.deck[g.turn], val=session.flipped?flipValue(raw):raw,options=flipOptions(g);
 return `<section class="play-panel"><div class="panel-heading"><div><span class="mini-kicker">FLIP TRIO</span><h2>숫자를 놓을 줄 선택</h2></div><span class="round-tag">${g.turn}/${FLIP_TOTAL}</span></div>
 <div class="meter"><span style="width:${Math.round(g.turn/FLIP_TOTAL*100)}%"></span></div>
 <div class="flip-lanes">${g.lanes.map((lane,i)=>{const possible=options.some(x=>x.lane===i&&x.flipped===session.flipped&&x.match);return `<button class="flip-lane ${possible?'glow':''} ${session.hint?.lane===i&&session.hintKey===g.turn?'hinted':''}" data-lane="${i}" ${lane.length>=5?'disabled':''}><b>${String(i+1).padStart(2,'0')}</b><div class="tiles">${Array.from({length:5},(_,j)=>lane[j]?`<span class="n-${lane[j]}">${lane[j]}</span>`:'<span class="empty">·</span>').join('')}</div><small>${possible?'조합 가능!':lane.length>=5?'가득 참':'→'}</small></button>`;}).join('')}</div>
 <div class="flip-footer"><span>완성 ${g.matches}조합</span><span>콤보 ×${Math.max(g.streak,1)}</span></div></section>
 <section class="hand-panel"><div><span class="mini-kicker">CURRENT TILE</span><h2>이번 차례의 숫자</h2></div><div class="hand-inner"><div class="big-tile ${session.flipped?'alt':''}"><small>NOW</small><strong>${val}</strong><span>뒤집으면 ${flipValue(val)}</span></div><div class="hand-side"><button class="flip-cta" data-action="flip" ${(raw===5||g.flipsUsed>=FLIP_LIMIT)?'disabled':''}><span>⟳</span><div><strong>${session.flipped?'원래 숫자로':'숫자 뒤집기'}</strong><small>남은 기회 ${FLIP_LIMIT-g.flipsUsed}/${FLIP_LIMIT}</small></div></button><div class="upnext"><small>다음 숫자</small><strong>${g.deck.slice(g.turn+1,g.turn+3).join(' · ')||'마지막'}</strong></div></div></div></section>
 <div class="example-strip"><span>3 · 4 · 5 = <b>40점</b></span><span>7 · 7 · 7 = <b>30점</b></span></div>`;
}
function blindUI(g){return `<section class="play-panel blind-panel"><div class="panel-heading"><div><span class="mini-kicker">BLIND NUMBER</span><h2>AI보다 높은 숫자를 내세요</h2></div><span class="round-tag">${g.turn+1}/9</span></div>
 <div class="duel-board"><div class="duel-player"><small>나</small><div class="face-card">${g.last?.mine??'?'}</div><span>${g.wins}승</span></div><div class="duel-versus">VS</div><div class="duel-player"><small>AI</small><div class="face-card cpu">${g.last?.cpu??'?'}</div><span>${g.losses}승</span></div></div>
 ${g.last?`<p class="round-outcome">직전 결과 · ${g.last.mine} 대 ${g.last.cpu} — ${g.last.outcome==='win'?'승리!':g.last.outcome==='tie'?'무승부':'패배'}</p>`:'<p class="round-outcome">상대 숫자는 선택 후 공개돼요</p>'}
 <div class="choice-title">낼 숫자를 선택하세요 <small>카드마다 한 번만 사용</small></div><div class="number-choices">${Array.from({length:9},(_,i)=>{const n=i+1;return `<button data-number="${n}" ${!g.remaining.includes(n)?'disabled':''} class="${session.hint?.choice===n&&session.hintKey===g.turn?'hinted':''}">${n}</button>`;}).join('')}</div>
 <div class="sub-stats"><span>승리 ${g.wins} · 무승부 ${g.ties} · 패배 ${g.losses}</span><span>9라운드 종료</span></div></section>`;}
function triadCard(card,index,selected){const shapes=['▲','●','◆'];const color=['coral','aqua','gold'][card.color];return `<button class="triad-card ${color} ${selected?'selected':''} ${session.hint?.includes(index)&&session.hintKey===session.game.round?'hinted':''}" data-card="${index}" aria-pressed="${selected?'true':'false'}">${Array.from({length:card.count},()=>`<span>${shapes[card.shape]}</span>`).join('')}</button>`;}
function triadUI(g){return `<section class="play-panel"><div class="panel-heading"><div><span class="mini-kicker">TRIPLE RULE</span><h2>세트가 되는 카드 3장 찾기</h2></div><span class="round-tag">${g.round+1}/5</span></div>
 <p class="tri-rule">색 · 모양 · 개수 <b>각각</b> 3장이 <b>전부 같거나 전부 달라야</b> 세트! <button class="link-btn" data-action="rules">예시 보기</button></p>
 <p class="triad-description">색·모양·개수가 각자 <strong>전부 같거나 전부 달라야</strong> 해요.</p><div class="triad-grid">${g.board.map((c,i)=>triadCard(c,i,g.selected.includes(i))).join('')}</div>
 <div class="sub-stats"><span>선택 ${g.selected.length}/3 · 오답 ${g.mistakes}회</span><button data-action="skip" class="skip-btn">이 문제 건너뛰기 →</button></div></section>`;}
function trustUI(g){return `<section class="play-panel trust-panel"><div class="panel-heading"><div><span class="mini-kicker">TRUST OR BETRAY</span><h2>이번 판, 믿을까요?</h2></div><span class="round-tag">${g.turn+1}/6</span></div>
 <div class="payoff-box"><div><span>둘 다 협력</span><strong>나 +3 · AI +3</strong></div><div><span>나만 배신</span><strong>나 +5 · AI +0</strong></div><div><span>나만 협력</span><strong>나 +0 · AI +5</strong></div><div><span>둘 다 배신</span><strong>나 +1 · AI +1</strong></div></div>
 ${g.last?`<div class="last-choice">직전: 나 <b>${g.last.mine==='cooperate'?'협력':'배신'}</b> / AI <b>${g.last.cpu==='cooperate'?'협력':'배신'}</b> · +${g.last.earned}점</div>`:'<p class="last-choice">AI는 자신의 패턴에 따라 선택합니다.</p>'}
 <div class="trust-actions"><button data-trust="cooperate"><span>${icon('check')}</span><strong>협력</strong><small>같이 이기기</small></button><button data-trust="betray"><span>${icon('spark')}</span><strong>배신</strong><small>한 수 앞서기</small></button></div>
 <div class="sub-stats"><span>내 점수 ${g.score}</span><span>AI 점수 ${g.cpuScore}</span></div></section>`;}
const TRI_SHAPES=['▲','●','◆'],TRI_COLORS=['coral','aqua','gold'],TRI_COLOR_KO=['주황','청록','노랑'];
function miniTri(c){return `<span class="triad-card mini ${TRI_COLORS[c.color]}">${Array.from({length:c.count},()=>`<span>${TRI_SHAPES[c.shape]}</span>`).join('')}</span>`;}
function triCheck(cards){return [['color','색'],['shape','모양'],['count','개수']].map(([k,ko])=>{const n=new Set(cards.map(c=>c[k])).size;return `<li class="${n===2?'no':'ok'}">${ko}: ${n===1?'전부 같음 ✅':n===3?'전부 다름 ✅':'2장만 같음 ❌'}</li>`;}).join('');}
function triadExamples(){const ex=[
  {t:'세트 ✅',cards:[{color:0,shape:0,count:1},{color:0,shape:1,count:2},{color:0,shape:2,count:3}]},
  {t:'세트 ✅',cards:[{color:0,shape:1,count:2},{color:1,shape:1,count:2},{color:2,shape:1,count:2}]},
  {t:'세트 아님 ❌',cards:[{color:0,shape:0,count:1},{color:0,shape:1,count:2},{color:1,shape:2,count:3}]}];
 return `<div class="tri-examples"><b>예시로 이해하기</b>${ex.map(e=>`<div class="tri-ex"><div class="tri-ex-cards">${e.cards.map(miniTri).join('')}</div><div><strong>${e.t}</strong><ul>${triCheck(e.cards)}</ul></div></div>`).join('')}</div>`;}
function rulesModal(id){return `<div class="modal-backdrop" data-action="close-rules"><div class="modal-card" role="dialog" aria-modal="true" aria-label="게임 방법"><div class="modal-top"><h2>${esc(GAME_BY_ID[id].title)} 규칙</h2><button class="icon-btn" data-action="close-rules" aria-label="닫기">×</button></div>${rulesFor(id).map((rule,i)=>`<div class="rule-line"><span>${i+1}</span><p>${esc(rule)}</p></div>`).join('')}${id==='triad'?triadExamples():''}<button class="btn primary full" data-action="close-rules">알겠어요</button></div></div>`;}
// AI 를 이겼을 때 보상: 난이도가 높을수록 많이 줘요 (라운지 난이도 버튼에도 같은 숫자를 보여줘요)
const AI_WIN={easy:10,normal:18,hard:30,expert:45,master:60};
function calcVictory(){const s=session,g=s.game;if(s.challenger)return g.score>s.challenger.score;if(s.mode!=='ai')return null;if(s.botTarget!==null)return g.score>s.botTarget;return g.score>g.cpuScore;}
function complete(){if(!session||!session.game.over)return;
 const s=session,g=s.game,victory=s.mode==='live'?null:calcVictory();
 let payout=s.mode==='ai'?(victory?AI_WIN[s.difficulty]||18:3):s.mode==='friend'||s.mode==='live'?5:3;
 payout=Math.round(payout*(GAME_BY_ID[s.id]?.bonus||1)); // 게임별 차등 보상
 const key=`${s.id}:${s.seed}:${s.mode}:${s.difficulty}`;
 if(acctOn()){s.awardGuest=guest();s.award=s.awardGuest?0:null; // 서버 지갑: 같은 판은 한 번만, 하루 200칩까지 (서버가 확인)
  if(!s.awardGuest)ACC.call('earn',{key,amount:payout}).then(r=>{s.award=r.ok?r.earned:0;if(screen==='result'&&session===s)render();}).catch(()=>{s.award=0;s.awardFail=true;if(screen==='result'&&session===s)render();});}
 else{const result=awardRun(profile,key,payout);profile=result.profile;s.award=result.earned;}
 profile.best[s.id]=Math.max(Number(profile.best[s.id]||0),g.score);
 profile.history=[{id:s.id,score:g.score,mode:s.mode,at:new Date().toISOString(),victory},...profile.history].slice(0,30);
 saveProfile();
 if(s.mode==='live'){live?.conn?.send({t:'done',score:g.score,round:s.liveRound});clearInterval(snapTimer);screen=s.turn&&live?.state?.phase==='playing'?'spectate':'live';live&&(live.spec=null);render();window.scrollTo?.(0,0);return;}
 screen='result';render();window.scrollTo?.(0,0);
}
function result(){const s=session,g=s.game,enemy=opponentScore(),victory=calcVictory();
 return `<div class="page"><main class="shell result-shell">${header({back:true,title:'대결 결과'})}${GAME_STAGE_SLOT}<section class="result-box"><div class="result-emblem">${victory===true?'♛':victory===false?'✧':'★'}</div><span class="mini-kicker">GAME COMPLETE</span><h1>${victory===true?'승리! 멋진 한 수였어요.':victory===false?'아쉬워요, 다음 판엔 이길 수 있어요!':'대결 완료!'}</h1><p>${esc(GAME_BY_ID[s.id].title)} · ${labelMode(s.mode)}</p>
 <div class="result-numbers"><div><span>내 점수</span><strong>${fmt(g.score)}</strong></div><div class="result-vs">VS</div><div><span>${s.challenger?'친구 기록':enemy!==null?'AI 점수':'내 최고 기록'}</span><strong>${fmt(enemy===null?profile.best[s.id]:enemy)}</strong></div></div>
 ${s.awardGuest?(TOSS_CONFIG.target==='toss'?`<div class="reward-box"><div><span class="reward-icon">⬡</span><div><strong>연결하는 중이에요</strong><small>인터넷 연결을 확인해 주세요. 연결되면 다음 판부터 칩을 받아요.</small></div></div></div>`:`<div class="reward-box"><div><span class="reward-icon">⬡</span><div><strong>로그인하면 씽크칩을 받아요</strong><small>로그인 없이 둘러보는 중이에요. 칩·옷·친구는 계정에 저장돼요.</small></div></div><button class="btn primary" data-action="login">로그인</button></div>`)
 :`<div class="reward-box"><div><span class="reward-icon">⬡</span><div><strong>${s.award===null?'씽크칩 받는 중…':`씽크칩 +${s.award}`}</strong><small>${s.award===null?'계정 지갑에 넣고 있어요.':s.awardFail?'연결이 불안정해 보상을 받지 못했어요.':s.award===0?'이미 보상을 받았거나 오늘의 획득 한도에 도달했어요.':'오늘의 도전 보상이 지갑에 지급됐어요.'}</small></div></div><span>보유 ${fmt(bal())}칩</span></div>`}
 <button class="btn primary full" data-action="share">친구에게 이 기록으로 도전장 보내기 ↗</button><button class="btn secondary full" data-action="retry">${s.mode==='friend'?'같은 판 재도전':'한 판 더'}</button><button class="btn tertiary full" data-action="home">${fromLounge?'🏠 라운지로 돌아가기':'다른 게임 고르기'}</button>
 <div class="ad-card"><span>ADVERTISEMENT · OPTIONAL</span><strong>보상형 광고로 씽크칩 받기</strong><p>광고를 끝까지 시청하고 보상을 받으면 +${AD_REWARD}칩. SDK 설정 전에는 지급되지 않습니다.</p><button data-action="watch-ad" ${loadingAd||!TOSS_CONFIG.enableRewardedAds?'disabled':''}>${loadingAd?'광고 여는 중…':'광고 보고 +20칩 받기'}</button></div>
 </section></main><div id="toast" class="toast" role="status"></div></div>`;
}
let chipPacks=null,buying=false; // 콘솔에 등록된 충전 상품 (토스 앱 안에서만)
async function loadChipPacks(){if(chipPacks!==null)return;chipPacks=[];chipPacks=await listChipPacks();if(screen==='wallet')render();}
function grantChips(n,orderId){if(!acctOn()){profile=grantPaid(profile,n);saveProfile();return true;}
 try{localStorage.setItem(PQ,JSON.stringify([...readPQ(),{sku:skuForChips(n),orderId:String(orderId||`local-${Date.now()}`)}]));}catch{return false;}
 flushPurchases();return true;}
function wallet(){loadChipPacks();const count=adsToday();return `<div class="page"><main class="shell">${header({back:true,title:'씽크칩 지갑'})}
 <section class="wallet-hero"><span class="mini-kicker">THINK CHIP WALLET</span><div class="wallet-balance"><span class="wallet-big-icon">⬡</span><strong>${guest()?'-':fmt(bal())}</strong><span>CHIP</span></div>${guest()&&TOSS_CONFIG.target==='toss'?`<p style="font-size:11px;opacity:.7;margin-top:6px">연결하는 중이에요… 인터넷 연결을 확인해 주세요.</p>`:guest()?`<button class="btn primary full" data-action="login" style="margin-top:12px">🔑 로그인하고 씽크칩 모으기</button><p style="font-size:11px;opacity:.7;margin-top:6px">로그인 없이 둘러보는 중이에요. 칩·옷·친구는 계정에 저장돼서 기기를 바꿔도 그대로예요.</p>`:acctOn()&&TOSS_CONFIG.target!=='toss'?`<p style="font-size:11px;opacity:.7;margin-top:6px">카카오 계정 지갑 · 선물할 수 있는 칩 ⬡${fmt(ACC.state.wallet?.paid||0)}</p>`:''}<p>도전해서 모으고, 생각이 막힐 때 힌트로 사용하세요.</p></section>
 ${chipPacks===null?'':chipPacks.length?`<div class="section-title tight"><div><span class="mini-kicker">CHIP SHOP</span><h2>씽크칩 충전</h2></div></div><div class="chip-packs">${chipPacks.map(p=>`<button class="chip-pack" data-buy="${esc(p.sku)}" ${buying?'disabled':''}><span class="cp-amt">⬡ ${fmt(p.chips)}</span><small>${esc(p.displayName||'')}</small><b>${esc(p.displayAmount||'')}</b></button>`).join('')}</div><p class="fineprint">${chipPacks[0]?.store==='ms'?'Microsoft Store 계정으로 결제돼요.':'토스페이로 결제돼요.'} 충전한 칩은 옷·방 꾸미기와 힌트에 쓸 수 있고 현금으로 바꿀 수 없어요.</p>`:''}
 <div class="section-title tight"><div><h2>씽크칩 얻기</h2></div></div>
 <div class="shop-card"><div class="shop-icon">▶</div><div><strong>보상형 광고 시청</strong><p>시청 완료 시 +${AD_REWARD}칩 · 오늘 ${count}/${AD_DAILY_LIMIT}회</p></div><button data-action="watch-ad" ${loadingAd||!TOSS_CONFIG.enableRewardedAds||count>=AD_DAILY_LIMIT?'disabled':''}>${!TOSS_CONFIG.enableRewardedAds?'연동 전':loadingAd?'준비 중':'시청'}</button></div>
 <div class="shop-card"><div class="shop-icon gift">♛</div><div><strong>AI 대결에서 이기기</strong><p>난이도에 따라 10~60칩 · 어려운 게임은 추가 보너스</p></div><button data-action="home">게임</button></div>
  <div class="section-title tight"><div><h2>씽크칩 사용처</h2></div></div>
 <div class="shop-card"><div class="shop-icon hint">💡</div><div><strong>전략 힌트 1회</strong><p>혼자 연습 / AI 대결에서만 사용 가능</p></div><span class="price-tag">-${HINT_COST}칩</span></div>
 <label class="nickname-row">공유할 때 사용할 별명 (선택) <input id="nickname" maxlength="16" placeholder="예: 숫자천재" value="${esc(profile.nickname)}" /></label>
 <p class="fineprint">씽크칩은 게임 안에서만 쓰는 포인트로, 현금으로 바꿀 수 없어요. 칩과 기록은 이 기기의 토스 계정에 저장돼요.</p>
 </main>${bottomNav('wallet')}<div id="toast" class="toast" role="status"></div></div>`;}
function records(){return `<div class="page"><main class="shell">${header({back:true,title:'내 기록'})}<div class="section-title"><div><span class="mini-kicker">PERSONAL RECORDS</span><h2>나의 두뇌 기록</h2></div></div>
 <div class="record-list">${GAMES.map(g=>`<button data-open="${g.id}" class="record-row"><span class="record-icon ${g.color}">${g.symbol}</span><span><strong>${esc(g.title)}</strong><small>${esc(g.genre)}</small></span><b>${fmt(profile.best[g.id]||0)}점</b><em>↗</em></button>`).join('')}</div>
 <div class="section-title tight"><div><h2>최근 대결</h2></div></div><div class="history-list">${profile.history.length?profile.history.map(x=>`<div><span>${esc(GAME_BY_ID[x.id]?.title||x.id)} · ${labelMode(x.mode)}</span><strong>${fmt(x.score)}점</strong></div>`).join(''):'<div>아직 기록이 없어요. 첫 게임을 시작해 보세요.</div>'}</div>
 <p class="fineprint">이 기기의 토스 계정에 저장된 내 기록이에요.</p></main>${bottomNav('records')}<div id="toast" class="toast" role="status"></div></div>`;}
function settings(){
 const mode=getThemePreference();
 return `<div class="page"><main class="shell">${header({back:true,title:'화면 설정'})}<section class="settings-intro"><span class="mini-kicker">MAKE IT YOURS</span><h1>당신의 플레이,<br>당신의 분위기.</h1><p>편안한 화면으로 다음 한 수에 집중하세요.</p></section><div class="theme-options" role="group" aria-label="화면 모드">${[['dark','moon','나이트','깊은 네이비와 실버 블루'],['light','sun','데이','화이트에 더한 남색 포인트'],['system','system','기기 설정','휴대폰의 모드를 따라가요']].map(([id,sym,title,desc])=>`<button class="theme-option ${mode===id?'selected':''}" data-theme-choice="${id}" aria-pressed="${mode===id}"><span class="theme-option-icon">${icon(sym)}</span><span><strong>${title}</strong><small>${desc}</small></span><span class="selection-ring">${mode===id?icon('check'):''}</span></button>`).join('')}</div><div class="settings-note">${icon('check')}<p>선택한 모드는 이 브라우저에 저장됩니다.<br>게임 중에 바꿔도 점수와 진행은 유지돼요.</p></div><div class="build-info"><span>THINKCHIP ARENA</span><span>v1.0.0</span></div><p class="fineprint">친구 대결은 도전 링크로 같은 판에서 기록을 비교하는 방식이에요.</p></main>${bottomNav('settings')}<div id="toast" class="toast" role="status"></div></div>`;
}

// 게임 색은 라운지에서 그 게임이 놓인 테이블 네온 색을 따라가요 (라운지 ↔ 게임 화면 색이 이어지게)
const ZONE_TINT={blind:'rose',trust:'rose',auction:'rose',marbles:'rose',minority:'rose',baseball:'sky',nim:'sky',redlight:'lime',bridge:'lime',gomoku:'violet',dots:'violet'};
function render(){const gid=['intro','game','result','aiturn'].includes(screen)?(session&&screen!=='intro'?session.id:selectedGame):null;const de=document.documentElement;if(de?.dataset){if(gid&&GAME_BY_ID[gid])de.dataset.game=ZONE_TINT[gid]||GAME_BY_ID[gid].color;else delete de.dataset.game;}
 root.innerHTML=screen==='spectate'?spectateView():screen==='aiturn'?aiTurnView():screen==='live'?liveView():screen==='home'?home():screen==='intro'?intro():screen==='game'?gameView():screen==='result'?result():screen==='wallet'?wallet():screen==='settings'?settings():records();renderToast();if(screen==='game'){bindTracer();bindRedLight();bindBridge();bindGameExtras();if(session?.mode==='live'){sendLiveProgress();syncStage();}}syncGameStage();if(screen==='live'){liveTick();syncStage();}renderChatDock();}
// 라운지가 허브: 라운지에서 들어온 게임은 어디서 나가든 그 테이블 앞으로 돌아가요 (번 칩도 같이 알려줌)
function toLounge(){if(screen==='game'&&session&&!session.game.over){if(!confirm(session.mode==='live'?'이번 판을 포기할까요? 지금 점수로 기록돼요.':'진행 중인 게임을 그만두고 라운지로 돌아갈까요? 이 판의 보상은 지급되지 않아요.'))return true;
  if(session.mode==='live')live?.conn?.send({t:'done',score:session.game.score,round:session.liveRound});}
 const q=new URLSearchParams();if(invitedRoom)q.set('room',invitedRoom);const gid=live?.state?.game||session?.id||partyGame||openGame;if(gid)q.set('back',gid);if(session?.game?.over&&session.award)q.set('won',String(session.award));
 leaveLive();const url='./lounge/index.html'+(q.toString()?`?${q}`:'');document.body.classList.add('to-lounge');setTimeout(()=>{location.href=url;},260);return true;}
function goBack(){if(rulesOpen){rulesOpen=false;render();return true;}if(screen==='home')return false;
 if(screen==='aiturn'){stopReplay();if(fromLounge)return toLounge();setScreen('intro');return true;}
 if(fromLounge&&['intro','live','game','result','wallet'].includes(screen))return toLounge(); // 라운지에서 온 사람은 라운지로 돌아가요
 if(screen==='game')setScreen(session?.mode==='live'?'live':'intro');
 else if(screen==='live'){leaveLive();setScreen('home');}else if(screen==='wallet'){if(fromLounge)return toLounge();setScreen(previousPage==='game'?'home':previousPage);}else setScreen('home');return true;}
function setScreen(name){if(screen==='game'&&name!=='game'&&session&&!session.game.over){if(!confirm(session.mode==='live'?'이번 판을 포기할까요? 지금 점수로 기록돼요.':'진행 중인 게임을 종료하고 나갈까요? 이 판의 보상은 지급되지 않아요.'))return;
 if(session.mode==='live'){live?.conn?.send({t:'done',score:session.game.score,round:session.liveRound});name=live?'live':name;}}screen=name;rulesOpen=false;render();window.scrollTo?.(0,0);}
function tapHint(){if(!session||session.game.over||session.mode==='friend'||session.mode==='live')return;
 const turn=currentTurnKey();if(session.hint&&session.hintKey===turn){flash(typeof session.hint==='string'?session.hint:'힌트가 표시되고 있어요.');return;}
 if(acctOn()){if(guest())return askLogin('힌트를 쓰려면 ');if(tapHint.busy)return;tapHint.busy=true;const s0=session;
  ACC.call('spend',{amount:HINT_COST}).then(r=>{tapHint.busy=false;if(r.ok){if(session===s0&&!s0.game.over)applyHint(turn);}else flash(r.error==='chips'?'씽크칩이 부족해요. 칩 상점에서 모아보세요.':'잠시 후 다시 시도해 주세요.');}).catch(()=>{tapHint.busy=false;flash('인터넷 연결을 확인해 주세요.');});return;}
 const {profile:next,ok}=spendChips(profile,HINT_COST);if(!ok)return flash('씽크칩이 부족해요. 칩 상점에서 모아보세요.');
 profile=next;saveProfile();applyHint(turn);}
function applyHint(turn){session.hintKey=turn;
 if(session.id==='flip') {const hint=flipAdvice(session.game);session.hint=hint?{...hint}:null;flash(`추천: ${hint.lane+1}번 줄${hint.flipped?'에 뒤집어서':'에'} 놓기!`);}
 if(session.id==='blind')session.hint=blindAdvice(session.game);
 if(session.id==='triad')session.hint=trioAdvice(session.game);
 if(session.id==='trust')session.hint=trustAdvice(session.game);
 if(session.id==='baseball')session.hint=baseballAdvice(session.game);
 if(session.id==='nim')session.hint=nimAdvice(session.game);
 if(session.id==='auction')session.hint=auctionAdvice(session.game);
 if(session.id==='maze')session.hint=mazeAdvice(session.game);
 if(session.id==='draw')session.hint=drawAdvice(session.game);
 if(session.id==='marbles')session.hint=marblesAdvice(session.game);
 if(session.id==='redlight')session.hint=redLightAdvice(session.game);
 if(session.id==='bridge')session.hint=bridgeAdvice(session.game);
 if(session.id==='minority')session.hint=minorityAdvice(session.game);
 if(session.id==='sudoku')session.hint=sudokuAdvice(session.game,session.sel);
 if(session.id==='merge')session.hint=mergeAdvice(session.game);
 if(session.id==='stroop')session.hint=stroopAdvice(session.game);
 if(session.id==='gomoku')session.hint=gomokuAdvice(session.game);
 if(session.id==='dots')session.hint=dotsAdvice(session.game);
 render();
}
function showHint(){const h=session?.hint;if(!h)return '';
 if(session.id==='flip')return `추천: ${h.lane+1}번 줄에 ${h.flipped?'숫자를 뒤집어':'현재 숫자로'} 놓아보세요.`;
 if(session.id==='triad')return `반짝이는 카드 3장을 선택해 보세요.`;
 return h.note||'';
}
function drawHintPatch(){if(!session||screen!=='game')return;const el=document.querySelector('.hint-result');if(el)el.textContent=showHint();}
async function shareResult(){if(!session)return;
 const query=new URLSearchParams({game:session.id,seed:session.seed,target:String(session.game.score),from:profile.nickname.trim().slice(0,16)||'익명 플레이어'});
 const message=`${profile.nickname||'친구'}가 ${GAME_BY_ID[session.id].title}에서 ${fmt(session.game.score)}점! 이 기록을 깨보세요.`;
 const out=await shareInvite(query,message);flash(out.ok?'도전 링크 공유를 진행했어요.':out.error);
}
async function requestAd(){if(loadingAd)return;
 if(!isRewardedAdSupported())return flash('광고 보상은 토스 앱에서 받을 수 있어요.');
 if(guest())return askLogin('광고 보상을 받으려면 ');
 if(adsToday()>=AD_DAILY_LIMIT)return flash('오늘 받을 수 있는 광고 보상을 모두 받았어요.');
 loadingAd=true;render();
 try{const watched=await showRewardedAd();if(watched){if(acctOn()){const r=await ACC.call('ad');flash(r.ok&&r.earned?`광고 시청 완료! 씽크칩 +${r.earned}`:r.ok?'오늘 받을 수 있는 광고 보상을 모두 받았어요.':'보상을 받지 못했어요. 잠시 후 다시 시도해 주세요.');}else{const result=awardAd(profile);profile=result.profile;saveProfile();flash(`광고 시청 완료! 씽크칩 +${result.earned}`);}}else flash('광고를 끝까지 보면 씽크칩을 받을 수 있어요.');}
 catch(error){flash(error?.message||'광고 재생에 실패했어요.');}
 finally{loadingAd=false;render();}
}
root.addEventListener('click',async e=>{
 const target=e.target.closest('[data-action],[data-open],[data-filter],[data-start],[data-buy],[data-lane],[data-number],[data-card],[data-trust],[data-digit],[data-take],[data-bid],[data-mb-bet],[data-mb-guess],[data-mb-hide],[data-side],[data-mi],[data-theme-choice],[data-quick],[data-live-game],[data-live-bots],[data-live-turn],[data-live-level],[data-live-mode],[data-live-topic],[data-accuse],[data-side2],[data-sd-cell],[data-sd-num],[data-mg-dir],[data-st-ans],[data-gm-cell],[data-db-line],[data-emoji],[data-chat-quick]');if(!target)return;
 const action=target.dataset.action;
 if(action==='login'){askLogin();return;}
 if(action==='ai-skip'&&session?.rp){stopReplay();session.rp.i=replayLen();session.rp.done=true;patchReplay();return;}
 if(action==='my-turn'&&session){stopReplay();screen='game';render();window.scrollTo?.(0,0);fitControls();return;}
 if(target.disabled)return;
 if(action==='toggle-theme'){toggleTheme();render();return;}
 if(target.dataset.liveGame&&live){live.conn.send({t:'pick',game:target.dataset.liveGame,level:live.state?.level});return;}
 if(target.dataset.liveTopic&&live){live.conn.send({t:'pick',game:live.state?.game,level:live.state?.level,topic:target.dataset.liveTopic});return;}
 if(target.dataset.accuse&&live){live.conn.send({t:'accuse',target:target.dataset.accuse});return;}
 if(target.dataset.side2!==undefined&&live){live.conn.send({t:'side',v:Number(target.dataset.side2)});return;}
 if(action==='mind-play'&&live){live.conn.send({t:'mindplay'});return;}
 if(action==='nunchi-call'&&live){live.conn.send({t:'call'});target.classList.add('pressed');return;}
 if(action?.startsWith?.('party:')){const id=action.slice(6);if(!liveAvailable()){screen='live';render();return;}joinLive(newRoomCode(),id);return;}
 if(target.dataset.liveMode&&live){const [kind,len]=target.dataset.liveMode.split(':');live.conn.send({t:'mode',kind,len:Number(len)||0});return;}
 if(target.dataset.liveLevel&&live){live.conn.send({t:'pick',game:live.state?.game,level:target.dataset.liveLevel});return;}
 if(target.dataset.chatQuick&&live){sendChat(target.dataset.chatQuick);return;}
 if(target.dataset.emoji&&live){live.conn.send({t:'emoji',e:target.dataset.emoji});return;}
 if(action==='live'){screen='live';rulesOpen=false;render();window.scrollTo?.(0,0);return;}
 if(action==='random'){const g=GAMES[Math.floor(Math.random()*GAMES.length)];selectedGame=g.id;setScreen('intro');return;}
 if(action==='random-ai'){const g=GAMES[Math.floor(Math.random()*GAMES.length)];selectedGame=g.id;difficulty='normal';start('ai');flash(`🎲 ${g.title}!`);return;}
 if(action==='party'){if(!liveAvailable()){screen='live';render();return;}joinLive(newRoomCode(),'forehead');return;}
 if(action==='live-create'){joinLive(newRoomCode(),null);return;}
 if(action==='live-create-here'){joinLive(newRoomCode(),selectedGame);screen='live';render();return;}
 if(action==='live-join'){const c=live?live.code:normalizeCode(document.getElementById('roomCode')?.value||roomDraft);if(c.length<4)return flash('방 코드 4자리를 입력해 주세요.');joinLive(c,null);return;}
 if(target.dataset.liveTurn!==undefined&&live){live.conn.send({t:'turnmode',v:target.dataset.liveTurn==='1'});return;}
 if(target.dataset.liveBots!==undefined&&live){live.conn.send({t:'bots',n:Number(target.dataset.liveBots)});return;}
 if(action==='live-ready'&&live){const me=liveMe();live.conn.send({t:'ready',v:!(me?.ready)});return;}
 if(action==='live-invite'&&live){await inviteToRoom();return;}
 if(action==='live-leave'){if(fromLounge){toLounge();return;}leaveLive();setScreen('home');return;}
 if(target.dataset.themeChoice){setTheme(target.dataset.themeChoice);render();return;}
 if(target.dataset.quick){selectedGame='flip';start(target.dataset.quick);return;}
 if(target.dataset.open){selectedGame=target.dataset.open;setScreen('intro');return;}
 if(target.dataset.filter){viewTab=target.dataset.filter;render();return;}
 if(target.dataset.start){start(target.dataset.start);return;}
 if(target.dataset.buy){if(guest())return askLogin('씽크칩을 충전하려면 ');if(buying)return;buying=true;render();const out=await buyChipPack(target.dataset.buy,(n,id)=>grantChips(n,id));buying=false;render();flash(out.ok?`⬡ ${fmt(out.chips)} 씽크칩이 충전됐어요!`:out.error);return;}
 if(screen==='game'&&session&&!session.game.over){
  if(target.dataset.lane!==undefined){session.game=playFlip(session.game,Number(target.dataset.lane),session.flipped);session.flipped=false;session.hint=null;session.hintKey=null;if(session.game.over)complete();else {render();if(session.game.last?.cleared)flash(`조합 성공! +${session.game.last.earned}점`);}return;}
  if(target.dataset.number!==undefined){session.game=playBlind(session.game,Number(target.dataset.number));session.hint=null;session.hintKey=null;if(session.game.over)complete();else render();return;}
  if(target.dataset.card!==undefined){session.game=selectTriad(session.game,Number(target.dataset.card));if(session.game.last){session.hint=null;session.hintKey=null;}if(session.game.over)complete();else {render();if(session.game.last?.valid===false){const ko={color:'색',shape:'모양',count:'개수'};const w=(session.game.last.why||[]).map(k=>ko[k]);flash(w.length?`❌ ${w.join('·')}: 2장만 같고 1장만 달라요. -8점`:'조건이 맞지 않아요. -8점');}else if(session.game.last?.valid===true)flash('정답! +40점');}return;}
  if(target.dataset.digit){const d=Number(target.dataset.digit);session.input=session.input||[];if(session.input.length<BB_LEN&&!session.input.includes(d))session.input.push(d);render();return;}
  if(target.dataset.take){session.game=playNim(session.game,Number(target.dataset.take));session.hint=null;session.hintKey=null;if(session.game.over)complete();else render();return;}
  if(target.dataset.sdCell!==undefined&&session?.id==='sudoku'){session.sel=Number(target.dataset.sdCell);render();return;}
  if(target.dataset.sdNum&&session?.id==='sudoku'){if(!Number.isInteger(session.sel))return flash('먼저 칸을 골라주세요.');const before=session.game;session.game=playSudoku(before,session.sel,Number(target.dataset.sdNum),Date.now()-session.t0);if(session.game===before)return;
   if(session.game.last&&!session.game.last.ok){flash(`❌ 틀렸어요! (실수 ${session.game.mistakes}/${SD_MAX_MISTAKES})`);}else{session.hint=null;session.hintKey=null;}if(session.game.over)complete();else render();return;}
  if(target.dataset.mgDir&&session?.id==='merge'){mergeMove(target.dataset.mgDir);return;}
  if(target.dataset.stAns&&session?.id==='stroop'){stroopAnswer(target.dataset.stAns);return;}
  if(target.dataset.gmCell!==undefined&&session?.id==='gomoku'){turnMove(Number(target.dataset.gmCell));return;}
  if(target.dataset.dbLine!==undefined&&session?.id==='dots'){turnMove(Number(target.dataset.dbLine));return;}
  if(target.dataset.mbBet){session.bet=Math.max(1,Math.min(session.game.me,Number(target.dataset.mbBet)));render();return;}
  if(target.dataset.mbGuess){const bet=Math.max(1,Math.min(session.game.me,session.bet||1));session.game=playMarbles(session.game,{guess:target.dataset.mbGuess,bet});session.bet=1;session.hint=null;session.hintKey=null;if(session.game.over)complete();else render();return;}
  if(target.dataset.mbHide){session.game=playMarbles(session.game,{hide:Number(target.dataset.mbHide)});session.hint=null;session.hintKey=null;if(session.game.over)complete();else render();return;}
  if(target.dataset.side!==undefined&&session?.id==='bridge'){if(session.preview?.active)return;const before=session.game;session.game=playBridge(before,Number(target.dataset.side));if(session.game===before)return;session.hint=null;session.hintKey=null;
   if(session.game.over){render();setTimeout(()=>{if(session?.id==='bridge'&&screen==='game')complete();},session.game.last?.ok?500:900);}else{render();if(session.game.last?.stageClear)flash('단계 통과! +20점');}return;}
  if(target.dataset.mi!==undefined){session.game=playMinority(session.game,Number(target.dataset.mi));session.hint=null;session.hintKey=null;if(session.game.over){flash(session.game.rank===1?'최종 1등! +30점':`최종 ${session.game.rank}등`);complete();}else render();return;}
  if(target.dataset.bid){session.bid=Math.max(0,Math.min(session.game.coins,(session.bid||0)+Number(target.dataset.bid)));render();return;}
  if(target.dataset.trust){session.game=playTrust(session.game,target.dataset.trust);session.hint=null;session.hintKey=null;if(session.game.over)complete();else render();return;}
 }
 if(action==='home'){if(fromLounge){toLounge();return;}setScreen('home');}
 else if(action==='settings')setScreen('settings');
 else if(action==='wallet'){previousPage=screen;setScreen('wallet');}
 else if(action==='records')setScreen('records');
 else if(action==='back')goBack();
 else if(action==='leave'){if(fromLounge)toLounge();else setScreen('home');}
 else if(action==='rules'){rulesOpen=true;render();}
 else if(action==='close-rules'){rulesOpen=false;render();}
 else if(action==='flip'&&screen==='game'&&session.id==='flip'){session.flipped=!session.flipped;render();}
 else if(action==='hint'){tapHint();if(['maze','draw','marbles','bridge','minority','sudoku','merge','stroop','gomoku','dots'].includes(session?.id))render();else drawHintPatch();}
 else if(action==='bb-clear'&&session){session.input=[];render();}
 else if(action==='bb-submit'&&session?.id==='baseball'){const before=session.game.turn;session.game=playBaseball(session.game,session.input||[]);if(session.game.turn!==before){session.input=[];session.hint=null;session.hintKey=null;}if(session.game.over){if(!session.game.solved)flash(`정답은 ${session.game.secret.join('')}였어요!`);complete();}else render();}
 else if(action==='bid-submit'&&session?.id==='auction'){session.game=playAuction(session.game,Math.min(session.bid||0,session.game.coins));session.bid=0;session.hint=null;session.hintKey=null;if(session.game.over)complete();else render();}
 else if(action==='skip'&&screen==='game'&&session.id==='triad'){session.game=skipTriad(session.game);session.hint=null;session.hintKey=null;if(session.game.over)complete();else render();}
 else if(action==='retry'){const mode=session.mode,seed=mode==='friend'?session.seed:newSeed();session={...session,seed,game:createRound(session.id,seed,session.difficulty),flipped:false,hint:null,t0:0,sel:null,aiPending:false,preview:null,previewedStage:-1,rl:null,bet:1,hintKey:null,award:0,input:[],bid:0};screen='game';render();}
 else if(action==='share')await shareResult();
 else if(action==='watch-ad')await requestAd();
});
root.addEventListener('click',e=>{if(e.target.classList?.contains('modal-backdrop')){rulesOpen=false;render();}});
document.addEventListener?.('keydown',e=>{if(screen==='game'&&session?.id==='merge'){const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];if(d){e.preventDefault();mergeMove(d);}}});
root.addEventListener('submit',e=>{const f=e.target.id,map={teleForm:['teleInput','tele'],assignForm:['assignInput','assign'],liarHintForm:['liarHint','hint'],liarGuessForm:['liarGuess','liarguess']};
 if(map[f]){e.preventDefault();const inp=document.getElementById(map[f][0]);const v=(inp?.value||'').trim();if(!v||!live)return;live.conn.send({t:map[f][1],text:v});inp.value='';inp.blur();return;}
 if(e.target.id==='fhForm'){e.preventDefault();const inp=document.getElementById('fhGuess');const v=(inp?.value||'').trim();if(!v||!live)return;live.conn.send({t:'guess',text:v});inp.value='';inp.blur();}});
root.addEventListener('focusout',e=>{if(e.target.tagName==='INPUT'&&live?.dirty&&screen==='live'){live.dirty=false;setTimeout(render,0);}});
root.addEventListener('input',e=>{if(e.target.id==='roomCode'){const v=normalizeCode(e.target.value);roomDraft=v;if(e.target.value!==v)e.target.value=v;}});
root.addEventListener('change',e=>{if(e.target.matches('[data-difficulty]')){difficulty=e.target.value;render();}if(e.target.id==='nickname'){profile.nickname=String(e.target.value||'').trim().slice(0,16);saveProfile();flash('별명이 저장됐어요.');}});
// 친구 대결의 부정 점수는 현재 서버 검증이 없습니다. 출시 전 점수 리플레이 서버 필수.
initTheme(()=>{if(!wantLounge)render();});
// 라운지로 넘어갈 때는 옛 홈 화면을 그리지 않고 '라운지 준비 중' 화면을 그대로 둬요 (8초 안에 못 넘어가면 홈을 보여줘요)
if(!wantLounge)render();else setTimeout(()=>{if(document.getElementById('boot'))render();},8000);
if(directMode){if(directLevel)difficulty=directLevel;start(directMode);}
if(params.get('wallet')==='1'){screen='wallet';render();}
// Toss: safe area, user key (per-account records), ad preload; Android back -> in-app back, exit confirm on home.
if(ACC)ACC.onChange(()=>{if(ACC.state.welcomeBonus&&!wantLounge){flash(`🎉 가입 축하 보너스 +${ACC.state.welcomeBonus} 씽크칩!`);ACC.clearWelcome();}flushPurchases();if(!(wantLounge&&document.getElementById('boot'))&&['home','wallet','result','intro','records'].includes(screen))render();});
initToss().then(async st=>{useUserKey(st.userKeyHash);
 if(TOSS_CONFIG.target==='toss'&&ACC&&!ACC.hasSession()){ // 토스 앱: 로그인 화면 없이 자동 (토스 사용자 키가 있으면 그걸로, 없으면 이 기기 계정)
  const ok=st.inToss&&st.userKeyHash?await ACC.loginToss(st.userKeyHash,profile.nickname):false;if(!ok)await ACC.loginDevice(profile.nickname);}
 const restoring=restoreChipOrders((n,id)=>grantChips(n,id)).then(n=>{if(n){flash(`결제된 ⬡ ${fmt(n)} 씽크칩을 지급했어요`);render();}});
 if(wantLounge&&TOSS_CONFIG.target==='toss'){await Promise.race([restoring.then(()=>flushPurchases()),new Promise(r=>setTimeout(r,4000))]).catch(()=>{});return goLounge();}
 // Web / MS Store build only: offline support. Never inside the Toss app.
 if(!st.inToss&&'serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
}).catch(()=>{if(wantLounge&&TOSS_CONFIG.target==='toss')goLounge();});
bindBackHandler(()=>{if(goBack())return;if(confirm('게임을 종료할까요?'))void exitApp();});
if(liveAvailable()&&(invitedRoom||partyGame))joinLive(invitedRoom||newRoomCode(),partyGame);
