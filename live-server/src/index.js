// Real-time rooms for 씽크칩 아레나. One Durable Object per room code relays a tiny shared state:
// who is in the room, which game the host picked, a shared seed + start time, and everyone's live score.
// Every player plays the same seeded board at the same moment; the server only coordinates and relays.
import {DurableObject} from 'cloudflare:workers';

const MAX_PLAYERS = 8, LOUNGE_MAX = 20; // LNG* = 3D 라운지 공개방 (게임 대신 함께 돌아다니는 공간)
const cleanDeco = (v) => String(v || '').replace(/[^a-z0-9._]/g, '').slice(0, 400); // lounge 방 꾸미기 encodeDeco
const cleanLook = (v) => String(v || '').replace(/[^a-z0-9.]/g, '').slice(0, 300); // lounge/avatar.js encodeLook
const GAMES = ['flip', 'blind', 'triad', 'trust', 'baseball', 'nim', 'auction', 'maze', 'draw', 'marbles', 'redlight', 'bridge', 'minority', 'forehead', 'liar', 'nunchi', 'vote', 'sudoku', 'merge', 'stroop', 'gomoku', 'dots', 'tele', 'mind', 'onecard'];
// 목록에서 내린 게임: 예전 방은 계속 열리지만 탈락전 랜덤 뽑기에는 나오지 않아요
const RETIRED = ['flip', 'triad', 'maze', 'draw', 'sudoku', 'merge', 'stroop'];
const TURN = ['gomoku', 'dots']; // 1:1 turn games: the server relays moves between the two players of each board
const PARTY = ['forehead', 'liar', 'nunchi', 'vote', 'tele', 'mind', 'onecard'];
const MIN_PLAYERS = {liar: 3, vote: 3};
const FH_TOPICS = ['random', 'people', 'tales', 'custom'];
// 내 단어 맞히기: everyone sees the others' words but not their own.
const FH_TIME = 5 * 60 * 1000, FH_COOLDOWN = 8000, FH_POINTS = [100, 70, 50, 30];
const FH_WORDS = {
  '동물': ['사자', '호랑이', '코끼리', '기린', '펭귄', '고양이', '강아지', '토끼', '판다', '원숭이', '돌고래', '상어', '거북이', '다람쥐', '하마', '낙타', '부엉이', '앵무새', '개구리', '문어', '고슴도치', '캥거루', '얼룩말', '악어'],
  '음식': ['김치찌개', '떡볶이', '짜장면', '피자', '치킨', '라면', '초밥', '비빔밥', '삼겹살', '햄버거', '김밥', '순대', '냉면', '불고기', '마라탕', '붕어빵', '호떡', '파스타', '돈가스', '족발', '팥빙수', '탕수육', '카레', '샌드위치'],
  '직업': ['의사', '소방관', '경찰', '선생님', '요리사', '가수', '배우', '변호사', '간호사', '프로그래머', '파일럿', '농부', '기자', '미용사', '택배기사', '유튜버', '운동선수', '화가', '사진작가', '과학자', '판사', '우주비행사', '마술사', '바리스타'],
  '물건': ['우산', '냉장고', '칫솔', '안경', '시계', '가위', '휴대폰', '베개', '거울', '숟가락', '지우개', '노트북', '헤어드라이어', '선풍기', '이어폰', '열쇠', '지갑', '양말', '모자', '자전거', '전자레인지', '연필', '리모컨', '빗자루'],
  '장소': ['학교', '병원', '공항', '도서관', '놀이공원', '편의점', '찜질방', '수영장', '영화관', '동물원', '바다', '캠핑장', '노래방', 'PC방', '지하철역', '백화점', '경찰서', '시장', '헬스장', '교회', '박물관', '스키장', '카페', '미용실'],
  '__people': ['세종대왕', '이순신', '신사임당', '유관순', '장영실', '광개토대왕', '김구', '안중근', '허준', '정약용', '선덕여왕', '을지문덕', '아인슈타인', '뉴턴', '에디슨', '나폴레옹', '클레오파트라', '모차르트', '베토벤', '셰익스피어', '콜럼버스', '레오나르도 다빈치', '링컨', '간디', '퀴리 부인', '갈릴레이', '징기스칸', '반 고흐'],
  '__tales': ['신데렐라', '백설공주', '피노키오', '흥부', '놀부', '심청이', '콩쥐', '팥쥐', '홍길동', '춘향이', '이몽룡', '손오공', '저팔계', '알라딘', '로빈 후드', '헨젤', '그레텔', '인어공주', '앨리스', '도로시', '산타클로스', '견우', '직녀', '선녀', '나무꾼', '혹부리 영감', '별주부', '토끼', '잭', '라푼젤'],
  '스포츠': ['축구', '야구', '농구', '배구', '탁구', '테니스', '골프', '수영', '마라톤', '볼링', '스키', '태권도', '복싱', '양궁', '배드민턴', '스케이트', '씨름', '펜싱', '서핑', '클라이밍', '줄넘기', '당구', '유도', '역도'],
};
const TELE_PROMPTS = ['빨간 과일 하면?', '여름 하면 떠오르는 것', '편의점에서 제일 먼저 집는 것', '동물원 하면 제일 먼저 보러 갈 동물', '월요일 하면?', '바다 하면?', '겨울 간식 하면?', '학교 하면 떠오르는 것', '1부터 10 중 숫자 하나', '색깔 하나', '아침 메뉴 하면?', '제일 무서운 동물', '생일 선물 하면?', '비 오는 날 먹고 싶은 것', '캠핑 하면?', '야식 하면?', '한국 하면 떠오르는 음식', '크리스마스 하면?', '귀여운 동물 하면?', '운동 하면 떠오르는 것'];

// ── 파티 게임 AI (빈자리 채우기): 사람이 모자라도 AI 1~3명이 같이 해요. 내 단어 맞히기는 대화가 필요해서 제외 ──
const BOT_GAMES = ['liar', 'nunchi', 'vote', 'tele', 'mind', 'onecard'];
// ── 원카드 (일반 트럼프 52장 + 조커 2장으로 하는 전래 카드 놀이) ──
// 카드: 'S7' = ♠7, 'HA' = ♥A, 'DT' = ◆10, 'XB' = 흑백 조커, 'XC' = 컬러 조커
const OC_SUITS = ['S', 'H', 'D', 'C'], OC_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const OC_TURN_MS = 15000, OC_ONE_MS = 3000, OC_BROKE = 20;
const ocDeck = () => [...OC_SUITS.flatMap((su) => OC_RANKS.map((r) => su + r)), 'XB', 'XC'].sort(() => Math.random() - 0.5);
const SUIT_KO = {S: '♠스페이드', H: '♥하트', D: '◆다이아', C: '♣클로버'};
const ocLabel = (c) => c === 'XB' ? '흑백 조커' : c === 'XC' ? '컬러 조커' : `${'♠♥◆♣'['SHDC'.indexOf(c[0])]}${c[1] === 'T' ? '10' : c[1]}`;
const ocPower = (c) => c === 'XC' ? 7 : c === 'XB' ? 5 : c === 'SA' ? 5 : c[1] === 'A' ? 3 : c[1] === '2' ? 2 : 0; // 공격 카드: 2(+2) A(+3) ♠A(+5) 흑조커(+5) 컬러조커(+7)
// 실시간 점수 대결 시간 제한 (초): 한 사람이 너무 오래 끌지 않게. 시간이 끝나면 그때 점수로 마감
const TIME_LIMIT = {blind: 60, trust: 50, baseball: 120, nim: 60, auction: 80, marbles: 100, redlight: 40, bridge: 90, minority: 80, flip: 90, triad: 90, maze: 60, draw: 60, sudoku: 240, merge: 120, stroop: 45};
const limitMs = (g) => (TIME_LIMIT[g] || 90) * 1000;
const BOTS = [{pid: 'bot1', name: '🤖 지우', look: ''}, {pid: 'bot2', name: '🤖 민수', look: ''}, {pid: 'bot3', name: '🤖 하린', look: ''}];
const isBot = (id) => /^bot[1-3]$/.test(String(id));
const TELE_ANSWERS = {'빨간 과일 하면?': ['사과', '딸기', '사과', '체리'], '여름 하면 떠오르는 것': ['수박', '바다', '수박', '에어컨'], '편의점에서 제일 먼저 집는 것': ['삼각김밥', '음료수', '라면', '삼각김밥'],
  '동물원 하면 제일 먼저 보러 갈 동물': ['사자', '기린', '판다', '사자'], '월요일 하면?': ['출근', '피곤', '출근', '등교'], '바다 하면?': ['파도', '모래', '수영', '파도'], '겨울 간식 하면?': ['붕어빵', '군고구마', '붕어빵', '호떡'],
  '학교 하면 떠오르는 것': ['급식', '선생님', '시험', '급식'], '1부터 10 중 숫자 하나': ['7', '3', '7', '1'], '색깔 하나': ['빨강', '파랑', '파랑', '노랑'], '아침 메뉴 하면?': ['토스트', '밥', '시리얼', '토스트'],
  '제일 무서운 동물': ['상어', '호랑이', '뱀', '상어'], '생일 선물 하면?': ['케이크', '꽃', '케이크', '돈'], '비 오는 날 먹고 싶은 것': ['파전', '라면', '파전', '짬뽕'], '캠핑 하면?': ['고기', '텐트', '불멍', '고기'],
  '야식 하면?': ['치킨', '라면', '치킨', '족발'], '한국 하면 떠오르는 음식': ['김치', '비빔밥', '김치', '불고기'], '크리스마스 하면?': ['산타', '트리', '산타', '선물'], '귀여운 동물 하면?': ['고양이', '강아지', '판다', '고양이'], '운동 하면 떠오르는 것': ['헬스', '축구', '달리기', '헬스']};
const LIAR_BLUFF = ['음… 다들 아는 거예요', '생각보다 흔해요', '저는 좋아해요 ㅎㅎ', '자주 봐요', '이름만 들어도 알 걸요?'];
const LIAR_FEEL = {'동물': ['동물원에 있어요', '귀여울 수도 무서울 수도', '털이 있을 수도'], '음식': ['맛있어요', '배고플 때 생각나요', '한국에서 많이 먹어요'], '직업': ['일하는 사람이에요', '유니폼이 있을 수도', '어릴 때 꿈이었을지도'],
  '물건': ['집에 하나쯤 있어요', '매일 쓸 수도', '손에 들 수 있어요'], '장소': ['가 본 적 있을 거예요', '사람이 많을 때가 있어요', '주말에 가요'], '스포츠': ['땀 흘려요', 'TV에서 봤어요', '공이 있을 수도']};
const rnd = (a, b) => a + Math.random() * (b - a), pickR = (a) => a[Math.floor(Math.random() * a.length)];
const BASE_CATS = () => Object.keys(FH_WORDS).filter((k) => !k.startsWith('__'));
const DILEMMAS = [['평생 여름', '평생 겨울'], ['과거로 가기', '미래로 가기'], ['투명인간', '순간이동'], ['짜장면', '짬뽕'], ['부먹', '찍먹'], ['산', '바다'], ['아침형', '저녁형'], ['고양이', '강아지'], ['카톡 답장 바로', '천천히'], ['돈 많은 백수', '바쁜 부자'], ['민초 좋아', '민초 싫어'], ['깻잎 떼줘도 됨', '절대 안 됨'], ['여행은 계획', '여행은 즉흥'], ['콜라', '사이다'], ['치킨', '피자'], ['영화관', '집에서 넷플'], ['혼밥 가능', '혼밥 불가'], ['첫눈에 반함', '천천히 스며듦'], ['1억 받고 10년 늙기', '그냥 살기'], ['라면에 계란 넣기', '안 넣기']];
const norm = (t) => String(t || '').toLowerCase().replace(/[\s.,!?~\-_'"]/g, '');
const LEVELS = ['easy', 'normal', 'hard', 'expert', 'master'];
const EMOJIS = ['👍', '😮', '😂', '🔥', '😭', '👏'];
const COUNTDOWN_MS = 3300;
const CODE_RE = /^[A-Z0-9]{4,6}$/;
const BAD = [/씨\s*발|시\s*발|ㅅ\s*ㅂ|ㅆ\s*ㅂ|씹|좆|ㅈ\s*같|병\s*신|ㅂ\s*ㅅ|개\s*새|개\s*색|ㄱ\s*ㅅ\s*ㄲ|미친\s*놈|미친\s*년|니\s*애미|느\s*금|애\s*미|애\s*비|fuck|shit|bitch/gi];
// Chat text: one line, max 80 chars, no links, strong profanity masked.
const cleanChat = (s) => { let t = String(s || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  t = t.replace(/(https?:\/\/|www\.)\S+|\S+\.(com|net|kr|io|me|ly|gg|xyz|app|dev)(\/\S*)?/gi, '[링크]');
  for (const re of BAD) t = t.replace(re, (m) => '*'.repeat(Math.min(4, m.length)));
  return t; };
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) || '플레이어';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/live\/([A-Za-z0-9]{4,6})$/);
    if (m) {
      const code = m[1].toUpperCase();
      if (!CODE_RE.test(code)) return new Response('bad room', {status: 400});
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', {status: 426});
      // 로그인한 사람: 세션을 확인해서 뱃지를 붙여 줘요 (클라이언트가 위조할 수 없게 워커가 헤더로). VIP 라운지는 입장권·뱃지가 있어야 들어가요.
      const h = new Headers(req.headers); h.delete('x-tc-badges');
      const ses = url.searchParams.get('token') ? await readSession(env, url.searchParams.get('token')) : null;
      let pass = null; if (ses) { const pid = await pidOf(env, ses.a); if (pid === url.searchParams.get('pid')) pass = await env.USER.get(env.USER.idFromName(pid)).vipCheck().catch(() => null); }
      if (VIP_RE.test(code) && !pass?.ok) return new Response('vip only', {status: 403});
      if (pass?.badges?.length) h.set('x-tc-badges', pass.badges.join(','));
      const u2 = new URL(req.url); u2.searchParams.delete('token');
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(new Request(u2, {headers: h, method: req.method}));
    }
    if (url.pathname === '/' || url.pathname === '/health') return new Response('thinkchip-live ok', {headers: {'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*'}});
    if (url.pathname === '/api/user') return userApi(req, env);
    if (url.pathname.startsWith('/auth/')) return authApi(req, env, url);
    return new Response('not found', {status: 404});
  },
};

// ───────── 계정 · 서버 지갑 · 친구 · 칩 선물 ─────────
// 로그인: 웹/MS Store = 카카오, 토스 앱 = 토스 사용자 키. 로그인하면 서명된 세션 토큰을 줘요 (서버에 세션 저장 없음).
// 계정마다 공개 id(pid = HMAC(비밀, 계정))로 User Durable Object 하나: 지갑(칩)·친구·선물함·저장 데이터.
const PID_RE = /^[a-f0-9]{24}$/;
const MAX_FRIENDS = 100, MAX_INBOX = 50, INVITE_TTL = 2 * 3600e3;
const GIFT_AMOUNTS = [100, 300, 1000, 3000];
const GIFT_DAILY_MAX = 5000; // 한 사람이 하루에 보낼 수 있는 칩
const INITIAL_CHIPS = 100, WELCOME_BONUS = 300, ATTEND_REWARD = 30, PLAY_DAILY_CAP = 200, RUN_MAX = 150, AD_REWARD = 20, AD_DAILY_LIMIT = 5, IMPORT_MAX = 3000;
const CHIP_PACKS = {chips_300: 300, chips_1000: 1100, chips_3000: 3500, vip_30: 500}; // app.config.js chipPacks 와 같게
const VIP_PACKS = {vip_30: 30};
// 토스 콘솔 상품 ID → 서버 상품 (app.config.js chipPacks.tossSku 와 같게). 주문 확인은 mTLS 인증서로 토스 서버에 물어봐요
const TOSS_SKUS = {'ait.0000098395.082c18cf.2be99887a0.4467161148': 'chips_300', 'ait.0000098395.8b7347b8.b664cd8029.4467283967': 'chips_1000',
  'ait.0000098395.34707b2f.0a2e449a2b.4467393007': 'chips_3000', 'ait.0000098395.4d757553.5327de2082.4468048393': 'vip_30'};
const TOSS_ORDER_API = 'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/order/get-order-status';
async function tossOrder(env, orderId) { // {ok, sku} | {wait} | {bad} | {retry}
  try {
    const r = await env.TOSS_MTLS.fetch(TOSS_ORDER_API, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({orderId})});
    const j = await r.json().catch(() => null), o = j && j.resultType === 'SUCCESS' && j.success;
    if (!o) return {retry: true};
    if (o.status === 'PURCHASED' || o.status === 'PAYMENT_COMPLETED') return {ok: true, sku: TOSS_SKUS[o.sku] || o.sku};
    if (o.status === 'ORDER_IN_PROGRESS') return {wait: true};
    if (o.status === 'ERROR') return {retry: true};
    return {bad: o.status}; // FAILED · REFUNDED · NOT_FOUND · MINIAPP_MISMATCH
  } catch { return {retry: true}; }
} // 현금 패키지: VIP 30일 + 500칩 (스토어에 상품을 등록하면 앱에 자동으로 보여요)
// ── VIP 라운지 · 뱃지 · 전광판 슈퍼챗 · 한정판 비서 스킨 ──
const VIP_PLANS = {d7: {price: 500, days: 7}, d30: {price: 1500, days: 30}, one: {price: 100, tickets: 1}, ten: {price: 800, tickets: 10}};
const SC_TIERS = {normal: {price: 50, ms: 8000}, mega: {price: 200, ms: 20000}};
// 한정판 비서 스킨 (until 이 지나면 더 살 수 없어요. 산 사람은 계속 써요)
const SKINS = {classic: {price: 0}, idol: {price: 300}, gold: {price: 600}, winter: {price: 400, until: '2027-01-01'}, hanbok: {price: 400, until: '2027-02-28'}};
const VIP_RE = /^VIP\d$/;
const REFUND_MS = 10 * 60e3; // 구매 취소는 10분 안에만
// 뱃지 (주니어 네이버 동물농장처럼 모아서 내 방 진열장에 전시). VIP 라운지 무료 입장은 VIP_FREE 뱃지만.
const BADGE_IDS = ['first', 'win10', 'win50', 'win100', 'champ', 'champ3', 'mvp', 'friend5', 'attend7', 'vip', 'patron'];
const VIP_FREE = ['champ', 'win50', 'mvp'];
function badgesOf(u = {}) { const st = u.stats || {}, w = st.wins || 0, c = st.champs || 0, b = [];
  if (w >= 1) b.push('first'); if (w >= 10) b.push('win10'); if (w >= 50) b.push('win50'); if (w >= 100) b.push('win100');
  if (c >= 1) b.push('champ'); if (c >= 3) b.push('champ3'); if (c >= 5 || w >= 200) b.push('mvp');
  if (Object.keys(u.friends || {}).length >= 5) b.push('friend5'); if ((st.attend || 0) >= 7) b.push('attend7'); if (u.vip?.bought) b.push('vip'); if ((u.skins || []).length > 1) b.push('patron'); return b; }
// 욕설 거르기 (띄어쓰기·특수문자·숫자를 끼워 넣어도 잡게). 도발·응원은 OK, 욕·비하는 안 돼요.
const BAD_WORDS = ['씨발', '시발', '씨바', '시바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '좆', '존나', 'ㅈㄴ', '개새', '새끼', 'ㅅㄲ', '지랄', 'ㅈㄹ', '미친놈', '미친년', '닥쳐', '꺼져', '엠창', '느금', '니애미', '느그', '애미', '애비', '썅', '쌍놈', '창녀', '걸레', 'fuck', 'shit', 'bitch', 'fxck'];
const badNorm = (t) => String(t || '').toLowerCase().replace(/[\s0-9._\-~!@#$%^&*()+=|\\/?,'"`:;<>[\]{}]/g, '');
const hasBad = (t) => { const n = badNorm(t); return BAD_WORDS.some((w) => n.includes(w)); };
const maskBad = (t) => hasBad(t) ? String(t).replace(new RegExp(BAD_WORDS.map((w) => w.split('').join('[\\s0-9._~!*-]*')).join('|'), 'gi'), (m) => '♡'.repeat(Math.min(4, m.length))) : t;
const SESSION_DAYS = 180;
const ITEM_PRICES = {"hair:pony":[40,"포니테일"],"hair:curly":[60,"물결펌"],"hair:long":[60,"긴 생머리"],"hair:spiky":[40,"삐죽 머리"],"hair:wolf":[60,"울프컷"],"hair:hime":[70,"히메컷"],"hair:dandy":[50,"댄디컷"],"hair:wave":[80,"S컬 웨이브"],"top:knit":[50,"꽈배기 니트"],"top:shirt":[60,"셔츠 + 넥타이"],"top:jacket":[90,"봄버 재킷"],"top:suit":[120,"정장 재킷"],"top:tank":[40,"나시"],"top:vneck":[70,"딥브이넥 니트"],"top:layered":[60,"레이어드 티"],"top:crop":[60,"크롭티"],"top:cardigan":[70,"단추 가디건"],"top:puffer":[130,"숏패딩"],"bottom:skirt":[40,"플리츠 스커트"],"bottom:jogger":[30,"트레이닝 팬츠"],"bottom:wide":[50,"슬랙스"],"bottom:cargo":[60,"카고 팬츠"],"bottom:mini":[50,"미니스커트"],"bottom:longskirt":[60,"롱스커트"],"shoes:boots":[40,"부츠"],"shoes:loafer":[40,"로퍼"],"shoes:chunky":[60,"하이탑"],"shoes:mary":[50,"메리제인"],"hair:mperm":[60,"애즈펌"],"top:blouse":[50,"리본 블라우스"],"top:sailor":[60,"세일러 카라"],"top:dress":[90,"원피스"],"top:baseball":[80,"야구 점퍼"],"acc:glasses":[30,"동그란 안경"],"acc:sunglass":[50,"선글라스"],"acc:beanie":[40,"비니"],"acc:cap":[40,"볼캡"],"acc:headset":[70,"헤드셋"],"acc:ribbon":[30,"리본"],"acc:crown":[300,"왕관 (우승자)"],"acc:bucket":[50,"버킷햇"],"acc:earring":[40,"진주 귀걸이"],"acc:necklace":[40,"실버 목걸이"],"acc:hairpin":[30,"헤어핀"],"wall:cream":[60,"크림"],"wall:mint":[60,"민트"],"wall:pink":[60,"체리 핑크"],"wall:black":[80,"블랙"],"wall:sky":[60,"하늘"],"floor:white":[80,"화이트 우드"],"floor:marble":[100,"대리석"],"floor:walnut":[70,"월넛"],"floor:pinktile":[80,"핑크 타일"],"rug:red":[40,"레드"],"rug:green":[40,"포레스트"],"rug:purple":[40,"퍼플"],"rug:beige":[40,"베이지"],"items:arcade":[150,"아케이드 기계"],"items:trophy":[120,"트로피 장식장"],"items:tank":[130,"어항"],"items:piano":[200,"피아노"],"items:tree":[90,"반짝이 트리"],"items:bean":[70,"빈백 소파"],"items:neon":[60,"네온 하트"],"items:plants":[50,"화분 세트"],"items:sofa":[120,"2인 소파"],"items:bed":[150,"침대"],"items:desk":[100,"책상 세트"],"items:tv":[130,"TV"],"items:shelf":[80,"책장"],"items:lamp":[40,"무드등"]}; // 옷·가구 선물 가격표 (public/lounge 의 WARDROBE·DECOR 와 같게. 바뀌면 같이 고쳐요)
const AVATAR_CATS = ['hair', 'top', 'bottom', 'shoes', 'acc'];

// 로그인 후 돌아갈 수 있는 사이트 (다른 사이트로 세션이 새지 않게)
const RETURN_OK = (u) => { try { const x = new URL(u); return (x.protocol === 'https:' && (/(^|\.)thinkchip-arena\.pages\.dev$/.test(x.hostname) || x.hostname === 'gayeon-hong.github.io')) || (x.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(x.hostname)); } catch { return false; } };
const CORS = {'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type'};
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json; charset=utf-8', ...CORS}});
const dayKey = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = (str) => b64u(enc.encode(str)), unb64uStr = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
let secretCache = null;
async function secret(env) { // SESSION_SECRET 이 없으면 처음 한 번 만들어 보관해요
  if (secretCache) return secretCache;
  const raw = env.SESSION_SECRET || await env.USER.get(env.USER.idFromName('__config__')).secret();
  secretCache = await crypto.subtle.importKey('raw', enc.encode(raw), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return secretCache;
}
const hmac = async (env, msg) => b64u(await crypto.subtle.sign('HMAC', await secret(env), enc.encode(msg)));
const pidOf = async (env, acct) => hex(await crypto.subtle.sign('HMAC', await secret(env), enc.encode('pid:' + acct))).slice(0, 24);
async function makeSession(env, acct, platform) {
  const body = b64uStr(JSON.stringify({a: acct, p: platform, e: Date.now() + SESSION_DAYS * 864e5}));
  return `${body}.${await hmac(env, 's:' + body)}`;
}
async function readSession(env, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || sig !== await hmac(env, 's:' + body)) return null;
  try { const d = JSON.parse(unb64uStr(body)); return d.e > Date.now() && d.a ? d : null; } catch { return null; }
}
async function issue(env, acct, platform, name) {
  const pid = await pidOf(env, acct), token = await makeSession(env, acct, platform);
  await env.USER.get(env.USER.idFromName(pid)).init(pid, acct, platform, name || '');
  return {token, pid};
}
const page = (html, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#101226;color:#eef;display:grid;place-items:center;min-height:90vh;text-align:center">${html}</body>`, {status, headers: {'content-type': 'text/html; charset=utf-8'}});

async function authApi(req, env, url) {
  const origin = `${url.protocol}//${url.host}`, redirectUri = `${origin}/auth/kakao/callback`;
  if (url.pathname === '/auth/kakao/start') {
    const ret = url.searchParams.get('return') || '';
    if (!RETURN_OK(ret)) return page('잘못된 요청이에요.', 400);
    if (!env.KAKAO_REST_KEY) return page('카카오 로그인이 아직 설정되지 않았어요.', 503);
    const st = b64uStr(JSON.stringify({r: ret, t: Date.now()})), state = `${st}.${await hmac(env, 'k:' + st)}`;
    const q = new URLSearchParams({client_id: env.KAKAO_REST_KEY, redirect_uri: redirectUri, response_type: 'code', state});
    return Response.redirect(`https://kauth.kakao.com/oauth/authorize?${q}`, 302);
  }
  if (url.pathname === '/auth/kakao/callback') {
    const [st, sig] = String(url.searchParams.get('state') || '').split('.');
    let ret = ''; try { if (st && sig === await hmac(env, 'k:' + st)) { const d = JSON.parse(unb64uStr(st)); if (Date.now() - d.t < 15 * 60e3 && RETURN_OK(d.r)) ret = d.r; } } catch {}
    if (!ret) return page('로그인 요청이 만료됐어요. 다시 시도해 주세요.', 400);
    const back = (hash) => Response.redirect(`${ret.split('#')[0]}#${hash}`, 302);
    const code = url.searchParams.get('code'); if (!code) return back('login=cancel');
    const tk = await fetch('https://kauth.kakao.com/oauth/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded;charset=utf-8'},
      body: new URLSearchParams({grant_type: 'authorization_code', client_id: env.KAKAO_REST_KEY, redirect_uri: redirectUri, code, ...(env.KAKAO_CLIENT_SECRET ? {client_secret: env.KAKAO_CLIENT_SECRET} : {})})}).then((r) => r.json()).catch(() => null);
    if (!tk?.access_token) return back('login=fail');
    const me = await fetch('https://kapi.kakao.com/v2/user/me', {headers: {authorization: `Bearer ${tk.access_token}`}}).then((r) => r.json()).catch(() => null);
    if (!me?.id) return back('login=fail');
    const nick = me.kakao_account?.profile?.nickname || me.properties?.nickname || '';
    const {token} = await issue(env, `kakao:${me.id}`, 'kakao', nick);
    return back(`session=${encodeURIComponent(token)}`);
  }
  if (url.pathname === '/auth/dev' && env.DEV_LOGIN === '1') { // 로컬 테스트 전용 (wrangler dev --var DEV_LOGIN:1). 배포 서버엔 없음
    const n = String(url.searchParams.get('name') || 'dev').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    const {token} = await issue(env, `dev:${n}`, 'kakao', n); return json({ok: true, token});
  }
  if (url.pathname === '/auth/device') { // 토스 앱: 로그인 화면 없이 이 기기(브라우저)마다 자동 계정 — 선물은 안 되는 계정이에요
    if (req.method === 'OPTIONS') return new Response(null, {headers: CORS});
    let b; try { b = await req.json(); } catch { return json({error: 'bad'}, 400); }
    const id = String(b?.id || ''); if (!/^[a-f0-9]{32}$/.test(id)) return json({error: 'bad'}, 400);
    const {token} = await issue(env, `device:${id}`, 'toss', String(b.name || ''));
    return json({ok: true, token});
  }
  if (url.pathname === '/auth/toss') { // 토스 앱: 토스가 주는 사용자 식별 해시 (앱별로 다르고 남이 알 수 없어요)
    if (req.method === 'OPTIONS') return new Response(null, {headers: CORS});
    let b; try { b = await req.json(); } catch { return json({error: 'bad'}, 400); }
    const h = String(b?.hash || ''); if (!/^[A-Za-z0-9+/=_-]{16,200}$/.test(h)) return json({error: 'bad'}, 400);
    const {token} = await issue(env, `toss:${h}`, 'toss', String(b.name || ''));
    return json({ok: true, token});
  }
  return new Response('not found', {status: 404});
}

async function userApi(req, env) {
  if (req.method === 'OPTIONS') return new Response(null, {headers: CORS});
  if (req.method !== 'POST') return json({error: 'method'}, 405);
  let body; try { body = await req.json(); } catch { return json({error: 'bad'}, 400); }
  const ses = await readSession(env, body?.token);
  if (!ses) return json({error: 'login', status: 401}, 401);
  const pid = await pidOf(env, ses.a);
  // 워커는 client() 만 불러요. 다른 User 에게 보내는 내부 메서드(incoming/link/receive …)는 User 끼리만 불러서 밖에서 위조할 수 없어요.
  const out = await env.USER.get(env.USER.idFromName(pid)).client({...body, pid, toss: ses.p === 'toss'});
  return json(out, out.status || 200);
}

const freshUser = () => ({pid: '', acct: '', platform: '', name: '', toss: false, friends: {}, inReq: {}, outReq: {}, gifts: [], sent: {day: '', total: 0}, sentIds: [],
  w: {chips: INITIAL_CHIPS, paid: 0, done: [], earn: {day: '', total: 0}, ad: {day: '', count: 0}, orders: [], imported: false}, data: {}});

export class User extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.u = Object.assign(freshUser(), (await ctx.storage.get('u')) || {}); if (!this.u.w) this.u.w = freshUser().w; });
  }
  async save() { await this.ctx.storage.put('u', this.u); }
  async claimOrder(id, pid) { const k = 'o:' + id, cur = await this.ctx.storage.get(k); if (cur) return cur; await this.ctx.storage.put(k, pid); return pid; } // '__orders__' 객체에서만 써요
  async secret() { let s = await this.ctx.storage.get('secret'); if (!s) { const a = new Uint8Array(32); crypto.getRandomValues(a); s = hex(a); await this.ctx.storage.put('secret', s); } return s; }
  async init(pid, acct, platform, name) { const u = this.u; u.pid = pid; u.acct = acct; u.platform = platform; u.toss = platform === 'toss'; if (!u.name && name) u.name = cleanName(name); await this.save(); return 'ok'; }
  other(pid) { return this.env.USER.get(this.env.USER.idFromName(pid)); }
  wallet() { const w = this.u.w, d = dayKey(); return {chips: w.chips, paid: Math.min(w.paid, w.chips), earnedToday: w.earn.day === d ? w.earn.total : 0, earnCap: PLAY_DAILY_CAP, adsToday: w.ad.day === d ? w.ad.count : 0, adLimit: AD_DAILY_LIMIT, attended: w.attend === d, imported: w.imported}; }
  // 관리자(ADMIN_PIDS, wrangler.toml): 옷·가구를 전부 가진 것으로 (힌트·칩은 다른 사람과 똑같이)
  isAdmin() { return String(this.env.ADMIN_PIDS || '').split(/[\s,]+/).filter(Boolean).includes(this.u.pid); }
  view(extra = {}) { const u = this.u; return {ok: true, pid: u.pid, name: u.name, platform: u.platform, admin: this.isAdmin(), wallet: this.wallet(), data: u.data,
    friends: Object.entries(u.friends).map(([pid, f]) => ({pid, name: f.name, nogift: !!f.toss, seen: f.seen || 0, where: f.where || ''})), invites: (u.invites || []).filter((i) => Date.now() - i.at < INVITE_TTL), requests: Object.entries(u.inReq).map(([pid, r]) => ({pid, name: r.name, at: r.at})),
    pending: Object.keys(u.outReq), gifts: u.gifts, stats: u.stats || {wins: 0, champs: 0}, badges: badgesOf(u), vip: this.vipView(), skins: u.skins || ['classic'], skin: u.skin || 'classic', buys: (u.buys || []).filter((x) => !x.refunded && Date.now() - x.at < REFUND_MS).map(({id, kind, amount, what, at}) => ({id, kind, amount, what, at})), refundMs: REFUND_MS, sentToday: u.sent.day === dayKey() ? u.sent.total : 0, giftMax: GIFT_DAILY_MAX, ...extra}; }
  vipView() { const v = this.u.vip || {}, now = Date.now(), badge = badgesOf(this.u).some((b) => VIP_FREE.includes(b)) || this.isAdmin();
    return {until: v.until || 0, tickets: v.tickets || 0, day: v.day || 0, badge, ok: badge || (v.until || 0) > now || (v.day || 0) > now}; }
  async vipCheck() { const v = this.vipView(); return {ok: v.ok, badges: badgesOf(this.u), name: this.u.name || ''}; } // 워커가 VIP 라운지 입장 때 불러요
  async award(kind) { const u = this.u; if (!u.pid) return 'nouser'; u.stats = u.stats || {wins: 0, champs: 0};
    if (kind === 'win') u.stats.wins = (u.stats.wins || 0) + 1; else if (kind === 'champ') u.stats.champs = (u.stats.champs || 0) + 1; await this.save(); return 'ok'; }
  record(r) { const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); this.u.buys = [...(this.u.buys || []).filter((x) => Date.now() - x.at < 864e5), {...r, id, at: Date.now()}].slice(-30); return id; }
  addChips(n, paid = false) { const w = this.u.w; w.chips = Math.min(9999999, w.chips + n); if (paid) w.paid += n; }

  async client(b) {
    const u = this.u, w = u.w, today = dayKey();
    if (!u.pid) u.pid = b.pid;
    if (typeof b.name === 'string' && b.name.trim() && cleanName(b.name) !== u.name) { // 이름을 바꾸면 친구들 목록에도
      u.name = cleanName(b.name); for (const f of Object.keys(u.friends)) { try { await this.other(f).rename(u.pid, u.name); } catch {} } }
    if (u.toss !== !!b.toss) u.toss = !!b.toss;
    // 접속 상태: 내 친구들 목록에 '온라인 · 어디' 로 보여요 (90초에 한 번, 또는 방을 옮겼을 때만 친구들에게 알려요)
    { const now = Date.now(), where = typeof b.where === 'string' && (b.where === '' || CODE_RE.test(b.where)) ? b.where : (u.where || ''), moved = where !== (u.where || '');
      u.seen = now; u.where = where;
      if (moved || now - (u.pushAt || 0) > 90e3) { u.pushAt = now; await Promise.all(Object.keys(u.friends).map((f) => this.other(f).presence(u.pid, now, where).catch(() => {}))); } }
    const to = String(b.to || ''), extra = {};
    if (!w.welcomed) { w.welcomed = true; this.addChips(WELCOME_BONUS); extra.welcome = WELCOME_BONUS; } // 회원가입(첫 로그인) 보상
    switch (b.op) {
      case 'hello': break;
      // ── 지갑 ──
      case 'earn': { // 게임 보상: 같은 판(key)은 한 번만, 하루 200칩까지
        const key = String(b.key || '').slice(0, 120), amount = Math.max(0, Math.min(RUN_MAX, Math.trunc(Number(b.amount) || 0)));
        if (!key) return {error: 'bad', status: 400};
        if (w.done.includes(key)) { extra.earned = 0; extra.reason = 'duplicate'; break; }
        if (w.earn.day !== today) w.earn = {day: today, total: 0};
        const earned = Math.max(0, Math.min(amount, PLAY_DAILY_CAP - w.earn.total));
        w.done = [...w.done, key].slice(-500); w.earn.total += earned; this.addChips(earned);
        extra.earned = earned; extra.reason = earned ? 'ok' : 'cap'; break;
      }
      case 'ad': {
        if (w.ad.day !== today) w.ad = {day: today, count: 0};
        if (w.ad.count >= AD_DAILY_LIMIT) { extra.earned = 0; extra.reason = 'limit'; break; }
        w.ad.count += 1; this.addChips(AD_REWARD); extra.earned = AD_REWARD; extra.reason = 'ok'; break;
      }
      case 'attend': { // 라운지 비서 데스크 출석 보너스 (하루 한 번)
        if (w.attend === today) { extra.earned = 0; break; }
        w.attend = today; u.stats = u.stats || {wins: 0, champs: 0}; u.stats.attend = (u.stats.attend || 0) + 1; this.addChips(ATTEND_REWARD); extra.earned = ATTEND_REWARD; break;
      }
      case 'spend': { // 힌트·옷·가구 구매 — 무료 칩부터 써요
        const amount = Math.trunc(Number(b.amount));
        if (!(amount > 0 && amount <= 1000000)) return {error: 'bad', status: 400};
        if (w.chips < amount) return {...this.view(), error: 'chips', status: 400};
        w.chips -= amount; w.paid = Math.min(w.paid, w.chips);
        if (b.what) extra.buyId = this.record({kind: 'spend', amount, what: String(b.what).replace(/[^a-z0-9:,_]/gi, '').slice(0, 200)}); break;
      }
      case 'refund': { // 구매 취소: 산 지 REFUND_MS(10분) 안에만. 쓴 칩은 돌려주고 산 물건은 빼요
        const r = (u.buys || []).find((x) => x.id === String(b.id || ''));
        if (!r || r.refunded) return {...this.view(), error: 'gone', status: 400};
        if (Date.now() - r.at > REFUND_MS) return {...this.view(), error: 'late', status: 400};
        const v = u.vip = u.vip || {};
        if (r.kind === 'vip') { const plan = VIP_PLANS[r.plan];
          if (plan.days) v.until = Math.max(0, (v.until || 0) - plan.days * 864e5);
          else { if ((v.tickets || 0) < plan.tickets) return {...this.view(), error: 'used', status: 400}; v.tickets -= plan.tickets; } }
        if (r.kind === 'skin') { const t = r.thanks || {};
          if (t.kind === 'ticket') { if (!(v.tickets > 0)) return {...this.view(), error: 'used', status: 400}; v.tickets -= 1; }
          else if (t.amount) { if (w.chips + r.amount < t.amount) return {...this.view(), error: 'used', status: 400}; w.chips -= t.amount; }
          u.skins = (u.skins || []).filter((x) => x !== r.item); if (u.skin === r.item) u.skin = 'classic'; }
        this.addChips(r.amount); w.paid = Math.min(w.paid, w.chips); r.refunded = true; extra.refunded = r; break;
      }
      case 'purchase': { // 결제 완료된 주문 지급 (같은 주문은 한 번만, 계정 전체에서도 한 번만). 토스 주문은 토스 서버에 확인 후 지급
        const chips = CHIP_PACKS[b.sku], id = String(b.orderId || '').slice(0, 200);
        if (!chips || !id) return {error: 'bad', status: 400};
        if (w.orders.includes(id)) { extra.granted = 0; break; }
        if ((u.platform === 'toss' || b.store === 'toss') && this.env.TOSS_MTLS) {
          const t = await tossOrder(this.env, id);
          if (t.wait || t.retry) return {...this.view(), error: 'pending', status: 503}; // 기기 줄에 남겨 두고 다음에 다시 확인
          if (t.bad || t.sku !== b.sku) return {...this.view(), error: 'bad', status: 400};
        }
        else { // MS 스토어(PWA)는 서버에서 확인할 공식 방법이 없어서, 확인 안 된 지급은 하루 5건까지만 받아요
          const day = Date.now() - 864e5; w.msBuys = (w.msBuys || []).filter((t) => t > day);
          if (w.msBuys.length >= 5) return {...this.view(), error: 'pending', status: 429};
          w.msBuys = [...w.msBuys, Date.now()];
        }
        const owner = await this.env.USER.get(this.env.USER.idFromName('__orders__')).claimOrder(id, u.pid).catch(() => u.pid);
        if (owner !== u.pid) return {...this.view(), error: 'bad', status: 400}; // 다른 계정이 이미 받은 주문
        w.orders = [...w.orders, id].slice(-500); this.addChips(chips, true); extra.granted = chips;
        if (VIP_PACKS[b.sku]) { const v = u.vip = u.vip || {}; v.bought = true; v.until = Math.max(Date.now(), v.until || 0) + VIP_PACKS[b.sku] * 864e5; extra.vipDays = VIP_PACKS[b.sku]; } break;
      }
      case 'import': { // 로그인 전 이 기기에 모은 칩을 처음 한 번 계정으로 옮겨요 (최대 3,000, 선물은 안 되는 칩으로)
        if (w.imported) { extra.imported = 0; break; }
        const n = Math.max(0, Math.min(IMPORT_MAX, Math.trunc(Number(b.chips) || 0)));
        w.imported = true; this.addChips(n); extra.imported = n; break;
      }
      case 'save': { // 내 캐릭터·산 옷·방 꾸미기 같은 작은 저장 데이터 (기기를 바꿔도 유지)
        const k = String(b.key || ''); if (!['avatar', 'room'].includes(k)) return {error: 'bad', status: 400};
        const v = JSON.stringify(b.value ?? null); if (v.length > 6000) return {error: 'big', status: 400};
        const val = JSON.parse(v), prevOwned = (u.data[k] && Array.isArray(u.data[k].owned)) ? u.data[k].owned : []; // 선물 받은 아이템이 지워지지 않게 owned 는 합쳐요
        if (val && typeof val === 'object') val.owned = [...new Set([...prevOwned, ...(Array.isArray(val.owned) ? val.owned : [])])].slice(0, 300);
        u.data = {...u.data, [k]: val}; break;
      }
      // ── 친구 ──
      case 'request': {
        if (!PID_RE.test(to) || to === u.pid) return {error: 'bad', status: 400};
        if (u.friends[to]) break;
        if (u.inReq[to]) { await this.befriend(to, u.inReq[to].name); break; } // 서로 신청 = 바로 친구
        if (Object.keys(u.friends).length >= MAX_FRIENDS) return {error: 'full', status: 400};
        const r = await this.other(to).incoming(u.pid, u.name || '플레이어', !!u.toss);
        if (r.r === 'nouser') return {error: 'nouser', status: 400};
        if (r.r === 'friends') { delete u.outReq[to]; u.friends[to] = {name: r.name || '친구', at: Date.now(), toss: !!r.toss}; break; }
        if (r.r === 'full') return {error: 'theirfull', status: 400};
        u.outReq[to] = Date.now(); break;
      }
      case 'accept': { const r = u.inReq[to]; if (!r) return {error: 'gone', status: 400}; await this.befriend(to, r.name); break; }
      case 'decline': delete u.inReq[to]; break;
      case 'remove': if (u.friends[to]) { delete u.friends[to]; await this.other(to).unlink(u.pid); } break;
      // ── 선물: 충전(결제)한 칩만, 서버 지갑에서 바로 옮겨요 ──
      case 'gift': {
        const amount = Math.trunc(Number(b.amount)), id = String(b.id || '').slice(0, 40);
        if (!u.friends[to]) return {error: 'notfriend', status: 400};
        if (u.toss) return {error: 'nogift', status: 400};
        if (!GIFT_AMOUNTS.includes(amount) || !/^[a-zA-Z0-9_-]{8,40}$/.test(id)) return {error: 'bad', status: 400};
        if (u.sentIds.includes(id)) { extra.dup = true; break; }
        if (Math.min(w.paid, w.chips) < amount) return {...this.view(), error: 'paid', status: 400};
        if (u.sent.day !== today) u.sent = {day: today, total: 0};
        if (u.sent.total + amount > GIFT_DAILY_MAX) return {error: 'limit', status: 400};
        w.chips -= amount; w.paid -= amount; await this.save(); // 먼저 빼고, 상대가 못 받으면 돌려줘요
        const r = await this.other(to).receive({id, from: u.pid, name: u.name || '플레이어', amount, at: Date.now()});
        if (r !== 'ok') { w.chips += amount; w.paid += amount; await this.save(); return {error: r || 'fail', status: 400}; }
        u.sent.total += amount; u.sentIds = [...u.sentIds, id].slice(-100); break;
      }
      case 'giftItem': { // 친구에게 옷·가구 선물: 게임에서 번 칩으로도 돼요 (무료 칩부터 써요)
        const key = `${String(b.cat || '')}:${String(b.id || '')}`, item = ITEM_PRICES[key], gid = String(b.gid || '').slice(0, 40);
        if (!u.friends[to]) return {error: 'notfriend', status: 400};
        if (u.toss || u.friends[to].toss) return {error: 'nogift', status: 400};
        if (!item || !/^[a-zA-Z0-9_-]{8,40}$/.test(gid)) return {error: 'bad', status: 400};
        if (u.sentIds.includes(gid)) { extra.dup = true; break; }
        if (w.chips < item[0]) return {...this.view(), error: 'chips', status: 400};
        w.chips -= item[0]; w.paid = Math.min(w.paid, w.chips); await this.save();
        const r = await this.other(to).receiveItem({id: gid, from: u.pid, name: u.name || '플레이어', cat: b.cat, item: b.id, itemName: item[1], price: item[0], at: Date.now()});
        if (r !== 'ok') { w.chips += item[0]; await this.save(); return {error: r || 'fail', status: 400}; }
        u.sentIds = [...u.sentIds, gid].slice(-100); break;
      }
      case 'vip': { // VIP 입장권: 기간권(7·30일) · 횟수권(1회·10회) — 게임에서 번 칩으로도 살 수 있어요
        const plan = VIP_PLANS[b.plan]; if (!plan) return {error: 'bad', status: 400};
        if (w.chips < plan.price) return {...this.view(), error: 'chips', status: 400};
        w.chips -= plan.price; w.paid = Math.min(w.paid, w.chips); const v = u.vip = u.vip || {};
        extra.buyId = this.record({kind: 'vip', amount: plan.price, plan: b.plan, what: `vip:${b.plan}`});
        v.bought = true; if (plan.days) v.until = Math.max(Date.now(), v.until || 0) + plan.days * 864e5; else v.tickets = (v.tickets || 0) + plan.tickets; break;
      }
      case 'vipEnter': { // 뱃지·기간권이 있으면 그냥, 없으면 횟수권 1장 → 오늘 하루 자유 입장
        const v = this.vipView(); if (v.ok) break;
        if (!(u.vip?.tickets > 0)) return {...this.view(), error: 'novip', status: 400};
        u.vip.tickets -= 1; const kst = new Date(Date.now() + 9 * 3600e3); kst.setUTCHours(24, 0, 0, 0); u.vip.day = kst.getTime() - 9 * 3600e3; extra.usedTicket = true; break;
      }
      case 'superchat': { // 전광판 슈퍼챗: 라운지 모두에게 크게 떠요
        const tier = SC_TIERS[b.tier] ? b.tier : 'normal', price = SC_TIERS[tier].price, text = String(b.text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40), room = String(b.room || '');
        if (!text || !CODE_RE.test(room)) return {error: 'bad', status: 400};
        if (hasBad(text)) return {...this.view(), error: 'words', status: 400};
        if (Date.now() - (u.scAt || 0) < 10e3) return {...this.view(), error: 'slow', status: 429};
        if (w.chips < price) return {...this.view(), error: 'chips', status: 400};
        w.chips -= price; w.paid = Math.min(w.paid, w.chips); u.scAt = Date.now();
        await this.env.ROOM.get(this.env.ROOM.idFromName(room)).superchat({pid: u.pid, name: u.name || '플레이어', text, tier, ms: SC_TIERS[tier].ms, badges: badgesOf(u)}); break;
      }
      case 'skin': { // 한정판 비서 스킨: 사기 + 쓰기
        const id = String(b.id || ''), sk = SKINS[id]; if (!sk) return {error: 'bad', status: 400};
        const owned = u.skins || ['classic'];
        if (!owned.includes(id) && !this.isAdmin()) {
          if (sk.until && Date.now() > Date.parse(sk.until + 'T00:00:00+09:00')) return {error: 'soldout', status: 400};
          if (w.chips < sk.price) return {...this.view(), error: 'chips', status: 400};
          w.chips -= sk.price; w.paid = Math.min(w.paid, w.chips); u.skins = [...owned, id];
          // 새 옷을 받은 비서가 기분이 좋아서 답례 선물: 칩 일부 돌려주기 · VIP 1회권 · 깜짝 보너스 중 하나
          const roll = Math.random(), v = u.vip = u.vip || {};
          if (roll < 0.25) { v.tickets = (v.tickets || 0) + 1; extra.thanks = {kind: 'ticket', amount: 1}; }
          else if (roll < 0.35) { const n = Math.round(sk.price * 0.5); this.addChips(n); extra.thanks = {kind: 'jackpot', amount: n}; }
          else { const n = Math.round(sk.price * (0.1 + Math.random() * 0.15)); this.addChips(n); extra.thanks = {kind: 'chips', amount: n}; }
          extra.buyId = this.record({kind: 'skin', amount: sk.price, item: id, thanks: extra.thanks, what: `skin:${id}`}); }
        u.skin = id; break;
      }
      case 'invite': { // 친구 부르기 (롤처럼): 오프라인이어도 다음에 들어오면 보여요
        if (!u.friends[to]) return {error: 'notfriend', status: 400};
        const where = typeof b.room === 'string' && (b.room === '' || CODE_RE.test(b.room)) ? b.room : '';
        u.invSent = u.invSent || {}; if (Date.now() - (u.invSent[to] || 0) < 20e3) return {...this.view(), error: 'slow', status: 429};
        u.invSent[to] = Date.now(); const r = await this.other(to).invited({id: `${u.pid}:${Date.now()}`, from: u.pid, name: u.name || '친구', room: where, at: Date.now()});
        if (r !== 'ok') return {error: r, status: 400}; break;
      }
      case 'deleteAccount': { // 계정 삭제: 친구 관계를 끊고 저장된 정보를 모두 지워요. 다시 가입 보상을 받는 것만 막으려고 '삭제됨' 표시만 남겨요
        if (b.confirm !== 'DELETE') return {error: 'bad', status: 400};
        await Promise.all([...Object.keys(u.friends), ...Object.keys(u.outReq), ...Object.keys(u.inReq)].map((f) => this.other(f).unlink(u.pid).catch(() => {})));
        const keep = {pid: u.pid, acct: u.acct, platform: u.platform, toss: u.toss};
        this.u = Object.assign(freshUser(), keep, {deletedAt: Date.now()}); this.u.w.chips = 0; this.u.w.welcomed = true; this.u.w.orders = u.w.orders || []; this.u.paidLog = (u.w.orders || []).length; await this.save(); // 결제 주문번호는 법정 보관 + 같은 주문 재지급 방지용으로 남겨요
        return {ok: true, deleted: true};
      }
      case 'seen': { const ids = new Set((Array.isArray(b.ids) ? b.ids : []).map(String)); u.gifts = u.gifts.filter((g) => !ids.has(g.id)); u.invites = (u.invites || []).filter((i) => !ids.has(i.id)); break; } // 받은 선물 알림 확인
      default: return {error: 'op', status: 400};
    }
    await this.save(); return this.view(extra);
  }
  async befriend(pid, name) {
    const u = this.u; delete u.inReq[pid]; delete u.outReq[pid];
    u.friends[pid] = {name: name || '친구', at: Date.now()};
    const r = await this.other(pid).link(u.pid, u.name || '플레이어', !!u.toss); u.friends[pid].toss = !!r?.toss;
  }
  // ── 다른 User 가 부르는 내부 메서드 ──
  async incoming(from, name, toss = false) {
    const u = this.u; if (!u.pid) return {r: 'nouser'}; // 로그인한 적 없는 사람
    const me = {name: u.name || '플레이어', toss: !!u.toss};
    if (u.friends[from]) return {r: 'friends', ...me};
    if (u.outReq[from]) { delete u.outReq[from]; u.friends[from] = {name: cleanName(name), at: Date.now(), toss}; await this.save(); return {r: 'friends', ...me}; } // 나도 신청해 뒀으면 바로 친구
    if (!u.inReq[from] && Object.keys(u.inReq).length >= MAX_INBOX) return {r: 'full'};
    u.inReq[from] = {name: cleanName(name), at: Date.now()}; await this.save(); return {r: 'ok'};
  }
  async link(pid, name, toss = false) { const u = this.u; delete u.inReq[pid]; delete u.outReq[pid]; u.friends[pid] = {name: cleanName(name), at: u.friends[pid]?.at || Date.now(), toss}; await this.save(); return {r: 'ok', toss: !!u.toss}; }
  async presence(pid, seen, where) { const f = this.u.friends[pid]; if (f) { f.seen = seen; f.where = where; await this.save(); } return 'ok'; }
  async invited(i) { const u = this.u; if (!u.friends[i.from]) return 'notfriend';
    u.invites = [...(u.invites || []).filter((x) => x.from !== i.from && Date.now() - x.at < INVITE_TTL), {...i, name: cleanName(i.name)}].slice(-20); await this.save(); return 'ok'; }
  async rename(pid, name) { const f = this.u.friends[pid]; if (f) { f.name = cleanName(name); await this.save(); } return 'ok'; }
  async unlink(pid) { delete this.u.friends[pid]; delete this.u.inReq[pid]; delete this.u.outReq[pid]; await this.save(); return 'ok'; }
  async receiveItem(g) { // 받은 옷·가구는 바로 내 옷장/방 보관함에
    const u = this.u; if (!u.friends[g.from]) return 'notfriend';
    if (u.toss) return 'nogift';
    if (u.gifts.some((x) => x.id === g.id)) return 'ok';
    const slot = AVATAR_CATS.includes(g.cat) ? 'avatar' : 'room', data = {...(u.data[slot] || {})}, owned = Array.isArray(data.owned) ? data.owned : [], key = `${g.cat}:${g.item}`;
    if (owned.includes(key)) return 'owned';
    data.owned = [...owned, key]; u.data = {...u.data, [slot]: data}; u.friends[g.from].name = cleanName(g.name);
    u.gifts = [...u.gifts, {id: g.id, type: 'item', from: g.from, name: cleanName(g.name), cat: g.cat, item: g.item, itemName: g.itemName, amount: 0, at: g.at}].slice(-MAX_INBOX); await this.save(); return 'ok';
  }
  async receive(g) { // 받은 선물은 바로 지갑에 (다시 선물할 수 없는 칩) + 알림
    const u = this.u; if (!u.friends[g.from]) return 'notfriend';
    if (u.toss) return 'nogift';
    if (u.gifts.some((x) => x.id === g.id)) return 'ok';
    u.friends[g.from].name = cleanName(g.name); this.addChips(g.amount);
    u.gifts = [...u.gifts, {id: g.id, from: g.from, name: cleanName(g.name), amount: g.amount, at: g.at}].slice(-MAX_INBOX); await this.save(); return 'ok';
  }
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get('s')) || this.fresh();
    });
  }
  // 미니홈피처럼: 방마다 TODAY / TOTAL 방문자 수와 방명록 (방 코드 = 그 사람 방)
  visit(pid) {
    const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), hp = this.s.hp || (this.s.hp = {day: d, seen: [], today: 0, total: 0, gb: []});
    if (hp.day !== d) { hp.day = d; hp.seen = []; hp.today = 0; }
    if (!hp.seen.includes(pid)) { hp.seen = [...hp.seen, pid].slice(-300); hp.today += 1; hp.total += 1; }
  }
  hpView() { const hp = this.s.hp || {}; return {t: 'hp', today: hp.today || 0, total: hp.total || 0, gb: hp.gb || []}; }
  fresh() { return {code: '', phase: 'lobby', game: 'flip', level: 'normal', seed: '', round: 0, startAt: 0, players: {}, chat: [], series: null}; }
  online() { const ids = new Set(); for (const ws of this.ctx.getWebSockets()) { if (ws.readyState !== 1) continue; const a = ws.deserializeAttachment(); if (a?.pid) ids.add(a.pid); }
    if (ids.size) for (const id of Object.keys(this.s.players)) if (isBot(id)) ids.add(id); // AI 는 사람이 있을 때만 '접속 중'
    return ids; }
  humans() { const ids = new Set(); for (const ws of this.ctx.getWebSockets()) { if (ws.readyState !== 1) continue; const a = ws.deserializeAttachment(); if (a?.pid) ids.add(a.pid); } return ids; }
  setBots(n) { const s = this.s; n = Math.max(0, Math.min(3, Math.trunc(Number(n) || 0)));
    for (const b of BOTS) { const want = BOTS.indexOf(b) < n; if (want && !s.players[b.pid]) s.players[b.pid] = {pid: b.pid, name: b.name, look: b.look, deco: '', joinedAt: Date.now() + 1e9, ready: true, score: 0, done: false, inRound: false, bot: true}; if (!want) delete s.players[b.pid]; }
    if (n) this.sysChat(`🤖 AI ${n}명이 빈자리를 채웠어요`); }
  hostId(on = this.online()) { return Object.values(this.s.players).filter((p) => on.has(p.pid) && !isBot(p.pid)).sort((a, b) => a.joinedAt - b.joinedAt)[0]?.pid || null; }
  view(viewer) {
    const on = this.online(), host = this.hostId(on);
    const players = Object.values(this.s.players).filter((p) => on.has(p.pid) || (this.s.phase !== 'lobby' && p.inRound))
      .sort((a, b) => a.joinedAt - b.joinedAt).map((p) => ({pid: p.pid, name: p.name, badges: p.badges || [], bot: isBot(p.pid), ready: p.ready, score: p.score, done: p.done, inRound: p.inRound, online: on.has(p.pid), host: p.pid === host, look: p.look || '', deco: p.deco || '', pos: this.pos?.[p.pid] || null}));
    const {code, phase, game, level, seed, round, startAt} = this.s;
    let fh = null;
    if (game === 'forehead' && this.s.fh && phase !== 'lobby') {
      const f = this.s.fh, words = {};
      for (const id of Object.keys(f.words)) words[id] = id === viewer && phase === 'playing' && !f.solved[id] ? null : f.words[id];
      fh = {cat: f.cat, endAt: f.endAt, words, solved: f.solved, wrong: f.wrong, next: f.next[viewer] || 0, pending: !!f.pending,
        assignTo: f.pending ? f.assign?.[viewer] || null : null, assigned: f.pending ? Object.keys(f.words).length : 0};
    }
    let party = null;
    const P = this.s.party;
    if (P && P.kind === game && phase !== 'lobby') {
      const end = phase === 'result' || P.over;
      if (P.kind === 'liar') party = {kind: 'liar', stage: P.stage, cat: P.cat, word: viewer === P.liar && !end ? null : P.word, amLiar: viewer === P.liar, liar: end ? P.liar : null,
        order: P.order, turn: P.turn, laps: P.laps, hints: P.hints, deadline: P.deadline, voted: Object.keys(P.votes), myVote: P.votes[viewer] || null, votes: end ? P.votes : null, accused: P.accused, guess: end ? P.guess : null, winner: P.winner};
      else if (P.kind === 'nunchi') party = {kind: 'nunchi', next: P.next, calls: P.calls, pend: P.pend, out: P.out, safe: P.safe, deadline: P.deadline, over: P.over};
      else if (P.kind === 'tele') party = {kind: 'tele', idx: P.idx, rounds: P.rounds, stage: P.stage, prompt: P.prompts[P.idx], deadline: P.deadline, answered: Object.keys(P.answers), myAnswer: P.answers[viewer] ?? null, history: P.history, team: P.team};
      else if (P.kind === 'mind') party = {kind: 'mind', level: P.level, maxLevel: P.maxLevel, lives: P.lives, stage: P.stage, deadline: P.deadline, hand: P.hands[viewer] || [], counts: Object.fromEntries(Object.entries(P.hands).map(([k, v]) => [k, v.length])), played: P.played, team: P.team, result: P.result};
      else if (P.kind === 'onecard') party = {kind: 'onecard', order: P.order, turn: P.turn, cur: P.order[P.turn], dir: P.dir, top: P.top, suit: P.suit, attack: P.attack, deadline: P.deadline, hand: P.hands[viewer] || [],
        counts: Object.fromEntries(Object.entries(P.hands).map(([k, v]) => [k, v.length])), broke: P.broke, one: P.one, log: P.log.slice(-6), places: P.places, deckLeft: P.deck.length};
      else if (P.kind === 'vote') party = {kind: 'vote', idx: P.idx, rounds: P.rounds, stage: P.stage, topic: P.topics[P.idx], deadline: P.deadline, voted: Object.keys(P.votes), myVote: P.votes[viewer] ?? null, history: P.history};
    }
    const duel = TURN.includes(game) && this.s.duel && phase !== 'lobby' ? this.s.duel : null;
    const T = this.s.turns, turns = T && phase !== 'lobby' ? {order: T.order, idx: T.idx, startAt: T.startAt, deadline: T.deadline} : null;
    return {t: 'state', code, phase, game, level, seed, round, startAt, serverNow: Date.now(), players, fh, party, duel, series: this.s.series, fhTopic: this.s.fhTopic || 'random', turnMode: this.s.turnMode !== false, turns, endAt: !T && phase === 'playing' ? this.s.endAt || 0 : 0};
  }
  async save() { await this.ctx.storage.put('s', this.s); }
  broadcast(msg) { const text = JSON.stringify(msg); for (const ws of this.ctx.getWebSockets()) { try { ws.send(text); } catch {} } }
  async sync() {
    this.tickParty(); this.checkRound(); await this.save(); await this.arm();
    for (const ws of this.ctx.getWebSockets()) { const pid = ws.deserializeAttachment()?.pid; try { ws.send(JSON.stringify(this.view(pid))); } catch {} }
  }
  sysChat(text) { const item = {pid: 'system', name: '', text, at: Date.now(), sys: true}; this.s.chat = [...(this.s.chat || []).slice(-29), item]; this.broadcast({t: 'chat', ...item}); }
  async alarm() { this.tickParty(); await this.sync(); }
  async arm() {
    const t = [], s = this.s;
    if (s.phase === 'playing') {
      if (s.fh?.endAt) t.push(s.fh.endAt + 200);
      if (s.turns?.deadline) t.push(s.turns.deadline + 1600); if (s.endAt) t.push(s.endAt + 1600);
      if (s.party && !s.party.over) { if (s.party.deadline) t.push(s.party.deadline + 50); if (s.party.kind === 'nunchi' && s.party.pend) t.push(s.party.pend.at + 470);
        const bt = this.nextBotAt(); if (bt) t.push(bt + 10); if (Object.values(s.players).some((q) => q.inRound && isBot(q.pid))) t.push(Math.max(Date.now() + 400, s.startAt + 50)); } // AI 가 있으면 자주 깨워요
    }
    if (t.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 20, Math.min(...t)));
  }
  // A round ends when everybody still connected who started it has finished.
  nextTurn() { // 다음 사람 차례 (나간 사람은 건너뛰어요)
    const s = this.s, T = s.turns, on = this.online(); if (!T) return;
    do { T.idx += 1; } while (T.idx < T.order.length && (!on.has(T.order[T.idx]) || s.players[T.order[T.idx]]?.done));
    T.startAt = Date.now() + 3300; T.deadline = T.startAt + limitMs(s.game); this.lastSnap = null;
    if (T.idx < T.order.length) this.sysChat(`🎮 이제 ${s.players[T.order[T.idx]]?.name || '?'}님 차례!`);
  }
  checkRound() {
    if (this.s.phase !== 'playing') return;
    const on = this.online(), live = Object.values(this.s.players).filter((p) => p.inRound && on.has(p.pid));
    const T = this.s.turns, now = Date.now();
    if (T && T.idx < T.order.length && now >= this.s.startAt && (!on.has(T.order[T.idx]) || (T.deadline && now >= T.deadline + 1500))) { // 나갔거나 시간 초과 → 지금 점수로 마감
      const cur = this.s.players[T.order[T.idx]]; if (cur) { cur.done = true; if (on.has(cur.pid)) this.sysChat(`⏰ ${cur.name}님 시간 끝! ${cur.score}점으로 마감`); } this.nextTurn(); }
    if (!T && this.s.endAt && now >= this.s.endAt + 1500) { let any = false; for (const q of live) if (!q.done) { q.done = true; any = true; } if (any) this.sysChat('⏰ 시간 끝! 지금 점수로 마감해요'); }
    if (Date.now() < this.s.startAt) {
      if (live.length < 2) { this.s.phase = 'lobby'; for (const p of Object.values(this.s.players)) { p.inRound = false; p.ready = false; } }
      return;
    }
    if (this.s.game === 'forehead' && this.s.fh) {
      const unsolved = live.filter((p) => !this.s.fh.solved[p.pid]);
      if (this.s.fh.pending) { if (live.length < 2) this.finishRound(); return; }
      if (Date.now() >= this.s.fh.endAt || unsolved.length <= (live.length > 1 ? 1 : 0)) {
        for (const p of unsolved) { p.done = true; }
        this.finishRound();
        if (unsolved.length) this.sysChat(`게임 끝! 못 맞힌 단어: ${unsolved.map((p) => `${p.name}=${this.s.fh.words[p.pid]}`).join(', ')}`);
      }
      return;
    }
    if (this.s.party && !this.s.party.over) { if (live.length < 1) this.finishRound(); return; }
    if (this.s.duel) for (const bd of this.s.duel.boards) if (!bd.over && Date.now() >= this.s.startAt) {
      const gone = bd.players.filter((id) => !on.has(id));
      if (gone.length && gone.length < bd.players.length) { bd.over = true; bd.forfeit = gone[0];
        for (const id of bd.players) { const p = this.s.players[id]; if (p) { p.done = true; p.score = gone.includes(id) ? 0 : 100; } }
        this.sysChat(`🏳 ${this.s.players[gone[0]]?.name || '상대'}님이 나가서 기권패!`); }
    }
    if (live.every((p) => p.done)) this.finishRound();
  }
  // ── 실시간 파티 게임: 거짓말쟁이 찾기(liar) · 눈치게임(nunchi) · 사람 소수결(vote) ──
  racers() { const on = this.online(); return Object.values(this.s.players).filter((p) => p.inRound && on.has(p.pid)); }
  startParty(kind) {
    const s = this.s, ids = Object.values(s.players).filter((q) => q.inRound).map((q) => q.pid).sort(() => Math.random() - 0.5), now = s.startAt;
    if (kind === 'liar') {
      const cats = BASE_CATS(), cat = cats[Math.floor(Math.random() * cats.length)], word = FH_WORDS[cat][Math.floor(Math.random() * FH_WORDS[cat].length)];
      s.party = {kind, stage: 'hint', cat, word, liar: ids[Math.floor(Math.random() * ids.length)], order: ids, turn: 0, laps: ids.length <= 4 ? 2 : 1, hints: [], votes: {}, accused: null, guess: null, winner: null, deadline: now + 30000, over: false};
    } else if (kind === 'nunchi') {
      s.party = {kind, next: 1, calls: [], pend: null, out: [], safe: [], deadline: now + 25000, over: false};
    } else if (kind === 'tele') {
      s.party = {kind, idx: 0, rounds: 5, stage: 'answer', prompts: [...TELE_PROMPTS].sort(() => Math.random() - 0.5).slice(0, 5), answers: {}, history: [], team: 0, deadline: now + 25000, over: false};
    } else if (kind === 'mind') {
      s.party = {kind, ids, level: 1, maxLevel: 3, lives: 3, stage: 'play', hands: {}, played: [], team: 0, result: null, deadline: 0, over: false};
      this.mindDeal();
    } else if (kind === 'onecard') {
      const deck = ocDeck(), n = ids.length <= 3 ? 7 : ids.length === 4 ? 6 : 5, hands = {};
      for (const id of ids) hands[id] = deck.splice(0, n);
      let top = deck.shift(); while (top[0] === 'X' || ocPower(top)) { deck.push(top); top = deck.shift(); } // 첫 카드는 평범한 카드로
      s.party = {kind, order: ids, turn: 0, dir: 1, hands, deck, pile: [top], top, suit: top[0], attack: 0, out: [], broke: [], one: null, log: [], deadline: now + OC_TURN_MS, over: false, places: null};
    } else if (kind === 'vote') {
      s.party = {kind, idx: 0, rounds: 5, stage: 'vote', topics: [...DILEMMAS].sort(() => Math.random() - 0.5).slice(0, 5), votes: {}, history: [], deadline: now + 15000, over: false};
    }
  }
  mindDeal() {
    const P = this.s.party, deck = Array.from({length: 100}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    P.hands = {}; for (const id of P.ids) P.hands[id] = deck.splice(0, P.level).sort((a, b) => a - b);
    P.played = []; P.stage = 'play'; P.deadline = Date.now() + 90000 + P.level * 30000;
  }
  mindEnd(win) {
    const P = this.s.party; P.result = win ? 'win' : 'lose';
    P.team = (win ? P.maxLevel : P.level - 1) * 100 + (win ? P.lives * 30 : 0);
    for (const p of Object.values(this.s.players)) if (p.inRound) p.score = P.team;
    this.sysChat(win ? `🎉 협동 성공! 모든 단계 클리어 · 팀 점수 ${P.team}` : `💔 실패… ${P.level}단계에서 멈췄어요 · 팀 점수 ${P.team}`);
    this.endParty();
  }
  endParty() {
    const P = this.s.party; if (!P || P.over) return; P.over = true; P.deadline = 0;
    for (const p of Object.values(this.s.players)) if (p.inRound) p.done = true;
    this.finishRound();
  }
  // Advances timers. Safe to call often.
  tickParty() {
    const s = this.s, P = s.party, now = Date.now();
    if (s.phase !== 'playing' || !P || P.over || now < s.startAt) return;
    this.botsAct(now); if (P.over) return;
    if (P.kind === 'onecard') { if (P.one && !P.one.said && now > P.one.until + 500) P.one = null; if (now >= P.deadline) { const cur = P.order[P.turn]; P.log.push(`⏰ ${s.players[cur]?.name} 시간 초과`); this.ocDraw(cur); } return; }
    const name = (id) => s.players[id]?.name || '?';
    if (P.kind === 'liar') {
      if (P.stage === 'hint' && now >= P.deadline) { P.hints.push({pid: P.order[P.turn % P.order.length], text: '(패스)'}); this.liarNextHint(); }
      else if (P.stage === 'vote' && now >= P.deadline) this.liarTally();
      else if (P.stage === 'lastguess' && now >= P.deadline) this.liarFinish(false);
    } else if (P.kind === 'nunchi') {
      if (P.pend && now - P.pend.at >= 450) { P.safe.push(P.pend.pid); P.calls.push({...P.pend, ok: true}); P.next = P.pend.n + 1; P.pend = null; }
      const left = this.racers().filter((p) => !P.safe.includes(p.pid) && !P.out.includes(p.pid));
      if (!P.pend && (left.length <= 1 || now >= P.deadline)) {
        for (const p of left) { P.out.push(p.pid); P.calls.push({pid: p.pid, n: P.next, at: now, ok: false, last: true}); }
        if (left.length) this.sysChat(left.length === 1 ? `😵 ${name(left[0].pid)}님 마지막까지 못 외쳤어요!` : `⏰ 시간 끝! ${left.map((p) => name(p.pid)).join(', ')} 탈락`);
        for (const p of Object.values(s.players)) if (p.inRound) p.score = P.safe.includes(p.pid) ? 100 : 0;
        this.endParty();
      }
    } else if (P.kind === 'tele') {
      const racers = this.racers();
      if (P.stage === 'answer' && (now >= P.deadline || (racers.length && racers.every((p) => p.pid in P.answers)))) {
        const groups = {}; for (const [id, a] of Object.entries(P.answers)) { const k = norm(a); if (k) (groups[k] = groups[k] || []).push(id); }
        const best = Math.max(0, ...Object.values(groups).map((g) => g.length)), all = best === racers.length && best > 1;
        const pts = best > 1 ? best * 20 + (all ? 40 : 0) : 0; P.team += pts;
        for (const p of Object.values(s.players)) if (p.inRound) p.score = P.team;
        P.history.push({prompt: P.prompts[P.idx], answers: {...P.answers}, best, pts, all});
        this.sysChat(`🔮 '${P.prompts[P.idx]}' → ${best > 1 ? `${best}명 일치! +${pts}${all ? ' (전원 일치 보너스!)' : ''}` : '아무도 안 맞았어요 😅'}`);
        P.stage = 'reveal'; P.deadline = now + 6000;
      } else if (P.stage === 'reveal' && now >= P.deadline) {
        P.idx += 1; P.answers = {};
        if (P.idx >= P.rounds) { this.sysChat(`팀 점수 ${P.team}점!`); this.endParty(); } else { P.stage = 'answer'; P.deadline = now + 25000; }
      }
    } else if (P.kind === 'mind') {
      if (P.stage === 'between' && now >= P.deadline) this.mindDeal();
      else if (P.stage === 'play' && now >= P.deadline) { P.lives -= 1; this.sysChat('⏰ 너무 오래 기다렸어요! 목숨 -1'); if (P.lives <= 0) this.mindEnd(false); else this.mindDeal(); }
    } else if (P.kind === 'vote') {
      const racers = this.racers();
      if (P.stage === 'vote' && (now >= P.deadline || (racers.length && racers.every((p) => p.pid in P.votes)))) {
        const c = [0, 0]; for (const v of Object.values(P.votes)) c[v]++;
        const minority = c[0] === c[1] || !c[0] || !c[1] ? null : c[0] < c[1] ? 0 : 1;
        for (const [id, v] of Object.entries(P.votes)) if (minority !== null && v === minority && s.players[id]) s.players[id].score += 20;
        P.history.push({topic: P.topics[P.idx], count: c, minority, votes: {...P.votes}});
        const [a, b] = P.topics[P.idx];
        this.sysChat(`🗳 '${a}' ${c[0]}명 vs '${b}' ${c[1]}명 → ${minority === null ? '동점! 아무도 점수 없음' : `'${minority ? b : a}' 쪽 +20점`}`);
        P.stage = 'reveal'; P.deadline = now + 4500;
      } else if (P.stage === 'reveal' && now >= P.deadline) {
        P.idx += 1; P.votes = {};
        if (P.idx >= P.rounds) this.endParty(); else { P.stage = 'vote'; P.deadline = now + 15000; }
      }
    }
  }
  // AI 차례 처리: 각 AI 마다 '다음에 움직일 시각'(P.bt)을 정해 두고, 그 시각이 되면 행동해요
  botsAct(now) {
    const s = this.s, P = s.party; if (!P || P.over) return;
    const bots = Object.values(s.players).filter((q) => q.inRound && isBot(q.pid)); if (!bots.length) return;
    P.bt = P.bt || {}; const due = (id, a, b) => { if (P.bt[id] === undefined) P.bt[id] = now + rnd(a, b); return now >= P.bt[id]; }, clear = (id) => { delete P.bt[id]; };
    if (P.kind === 'liar') {
      if (P.stage === 'hint') { const cur = P.order[P.turn % P.order.length]; if (isBot(cur) && due(cur + ':h' + P.turn, 2500, 5000)) {
        const len = [...String(P.word).replace(/\s/g, '')].length, liar = cur === P.liar;
        const text = liar ? (Math.random() < 0.5 ? pickR(LIAR_BLUFF) : `${pickR([2, 3, 3, 4])}글자… 맞나? ㅎㅎ`) : (Math.random() < 0.55 ? `${len}글자예요 · ${pickR(LIAR_FEEL[P.cat] || LIAR_BLUFF)}` : pickR(LIAR_FEEL[P.cat] || LIAR_BLUFF));
        P.hints.push({pid: cur, text}); this.liarNextHint(); } }
      else if (P.stage === 'vote') for (const b of bots) { if (P.votes[b.pid] || !due(b.pid + ':v', 3000, 9000)) continue;
        const others = P.order.filter((id) => id !== b.pid), sus = b.pid !== P.liar && Math.random() < 0.38 ? P.liar : pickR(others); P.votes[b.pid] = sus;
        if (this.racers().every((q) => P.votes[q.pid])) { this.liarTally(); return; } }
      else if (P.stage === 'lastguess' && isBot(P.liar) && due(P.liar + ':g', 3000, 6000)) { P.guess = pickR(FH_WORDS[P.cat] || [P.word]); this.sysChat(`🤖 ${s.players[P.liar]?.name}: '${P.guess}'?`); this.liarFinish(norm(P.guess) === norm(P.word)); }
    } else if (P.kind === 'nunchi') {
      for (const b of bots) { if (P.safe.includes(b.pid) || P.out.includes(b.pid) || P.pend?.pid === b.pid) continue;
        if (P.bt[b.pid] === undefined) P.bt[b.pid] = s.startAt + rnd(1200, Math.max(2500, P.deadline - s.startAt - 1500));
        if (now >= P.bt[b.pid]) { clear(b.pid); this.nunchiCall(b.pid, now); } }
    } else if (P.kind === 'tele') {
      if (P.stage === 'answer') for (const b of bots) { if (b.pid in P.answers || !due(b.pid + ':t' + P.idx, 3000, 12000)) continue; P.answers[b.pid] = pickR(TELE_ANSWERS[P.prompts[P.idx]] || ['몰라요']); }
    } else if (P.kind === 'mind') {
      if (P.stage !== 'play') return;
      const top = P.played.length ? P.played[P.played.length - 1].n : 0; P.lastAt = P.lastAt || now;
      for (const b of bots) { const h = P.hands[b.pid]; if (!h?.length) continue;
        const key = `${b.pid}:m${h[0]}:${top}`; if (P.bt[key] === undefined) P.bt[key] = Math.max(now, P.lastAt) + 1400 + (h[0] - top) * rnd(110, 170);
        if (now >= P.bt[key]) { delete P.bt[key]; this.mindPlay(b.pid); P.lastAt = Date.now(); return; } }
    } else if (P.kind === 'onecard') {
      if (P.one && !P.one.said) { // 원카드 외치기: 주인이면 금방, 남이면 조금 늦게 (사람에게 기회를 줘요)
        for (const b of bots) { const mine = P.one.pid === b.pid; if (due(`${b.pid}:one:${P.one.until}`, mine ? 600 : 1300, mine ? 1500 : 2700)) { this.ocOne(b.pid); break; } } }
      const cur = P.order[P.turn]; if (!isBot(cur) || P.broke.includes(cur)) return;
      if (!due(`${cur}:oc${P.turn}:${P.pile.length}:${P.attack}`, 1100, 2400)) return;
      const h = P.hands[cur], ok = h.filter((c) => this.ocCanPlay(c)), nxt = P.order[(P.turn + P.dir + P.order.length) % P.order.length], danger = (P.hands[nxt]?.length || 9) <= 2;
      if (!ok.length) return this.ocDraw(cur);
      const plain = ok.filter((c) => !ocPower(c) && c[0] !== 'X'), atk = ok.filter((c) => ocPower(c));
      let card = P.attack ? atk.sort((a, b) => ocPower(a) - ocPower(b))[0] : danger && (atk.length || ok.some((c) => c[1] === 'J')) ? (atk[0] || ok.find((c) => c[1] === 'J')) : (plain.find((c) => c[1] !== '7') || plain[0] || ok[0]);
      const counts = {}; for (const c of h) if (c !== card && c[0] !== 'X') counts[c[0]] = (counts[c[0]] || 0) + 1;
      const suit = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || card[0];
      return this.ocPlay(cur, card, suit);
    } else if (P.kind === 'vote') {
      if (P.stage === 'vote') for (const b of bots) { if (b.pid in P.votes || !due(b.pid + ':s' + P.idx, 2000, 9000)) continue; P.votes[b.pid] = Math.random() < 0.5 ? 0 : 1; }
    }
  }
  nextBotAt() { const P = this.s.party; if (!P?.bt || P.over) return null; const t = Object.values(P.bt).filter((x) => x > Date.now() - 5000); return t.length ? Math.min(...t) : null; }
  nunchiCall(pid, now) { // 눈치 게임: 숫자 외치기 (사람·AI 공통)
    const s = this.s, P = s.party, p = s.players[pid]; if (!P || !p) return;
    if (P.pend && now - P.pend.at < 450) { // 동시에 외침! 둘 다 탈락, 번호는 그대로
      P.out.push(P.pend.pid, pid); P.calls.push({...P.pend, ok: false, clash: true}, {pid, n: P.pend.n, at: now, ok: false, clash: true});
      this.sysChat(`💥 ${s.players[P.pend.pid]?.name}·${p.name} 동시에 ${P.pend.n}! 둘 다 탈락`); P.next = P.pend.n; P.pend = null;
    } else {
      if (P.pend) { P.safe.push(P.pend.pid); P.calls.push({...P.pend, ok: true}); P.next = P.pend.n + 1; }
      P.pend = {pid, n: P.next, at: now};
    }
  }
  mindPlay(pid) { // 타이밍 맞추기: 가장 작은 카드 내기 (사람·AI 공통)
    const s = this.s, P = s.party, p = s.players[pid], hand = P?.hands?.[pid]; if (!hand?.length) return;
    const card = hand.shift(), lower = [];
    for (const [id, h] of Object.entries(P.hands)) while (h.length && h[0] < card) lower.push({pid: id, n: h.shift()});
    P.played.push({pid, n: card, ok: !lower.length});
    if (lower.length) {
      P.lives -= 1; for (const c of lower) P.played.push({...c, ok: false, burned: true});
      this.sysChat(`💥 ${p.name}님 ${card}! 더 작은 수 ${lower.map((c) => c.n).join(', ')}이(가) 남아 있었어요. 목숨 -1`);
      if (P.lives <= 0) { this.mindEnd(false); return; }
    }
    if (Object.values(P.hands).every((h) => !h.length)) {
      if (P.level >= P.maxLevel) { this.mindEnd(true); return; }
      P.level += 1; P.stage = 'between'; P.deadline = Date.now() + 3500; this.sysChat(`✅ ${P.level - 1}단계 성공! 다음은 한 사람당 ${P.level}장`);
    }
  }
  // ── 원카드 진행 ──
  ocCanPlay(c) { const P = this.s.party, top = P.top;
    if (P.attack > 0) { const pw = ocPower(c); if (!pw || pw < ocPower(top)) return false; return c[0] === 'X' || top[0] === 'X' || c[0] === P.suit || c[1] === top[1]; } // 공격 받는 중: 같거나 센 공격 카드로만 막아요
    if (c[0] === 'X' || top[0] === 'X') return true;
    return c[0] === P.suit || c[1] === top[1]; }
  ocTake(pid, n) { const P = this.s.party, h = P.hands[pid];
    for (let i = 0; i < n; i++) { if (!P.deck.length) { const keep = P.pile.pop(); P.deck = P.pile.sort(() => Math.random() - 0.5); P.pile = [keep]; } if (!P.deck.length) break; h.push(P.deck.shift()); }
    if (h.length > OC_BROKE && !P.broke.includes(pid)) { P.broke.push(pid); P.log.push(`💥 ${this.s.players[pid]?.name} 파산! (카드 ${h.length}장)`); P.pile.unshift(...h); P.hands[pid] = []; } }
  ocAdvance(skip = 0) { const P = this.s.party; const alive = () => P.order.filter((id) => !P.broke.includes(id));
    if (alive().length <= 1) return this.ocEnd(alive()[0] || null);
    let i = P.turn; for (let k = 0; k <= skip; k++) { do { i = (i + P.dir + P.order.length) % P.order.length; } while (P.broke.includes(P.order[i])); }
    P.turn = i; P.deadline = Date.now() + OC_TURN_MS; if (P.bt) for (const k of Object.keys(P.bt)) if (k.includes(':oc')) delete P.bt[k]; }
  ocDraw(pid) { const P = this.s.party, n = P.attack || 1, nm = this.s.players[pid]?.name;
    this.ocTake(pid, n); P.log.push(P.attack ? `🩸 ${nm} 공격 받아 ${n}장 먹음` : `🃏 ${nm} 한 장 받음`); P.attack = 0; if (P.one?.pid === pid) P.one = null;
    if (!P.over) this.ocAdvance(); }
  ocPlay(pid, card, suit) { const P = this.s.party, h = P.hands[pid], i = h.indexOf(card), nm = this.s.players[pid]?.name; if (i < 0 || !this.ocCanPlay(card)) return;
    h.splice(i, 1); P.pile.push(card); P.top = card; P.suit = card[0] === 'X' ? P.suit : card[0];
    const pw = ocPower(card); let skip = 0, again = false;
    if (pw) { P.attack += pw; P.log.push(`⚔ ${nm} ${ocLabel(card)} 공격! 누적 +${P.attack}`); }
    else if (card[1] === 'J') { skip = 1; P.log.push(`⏭ ${nm} J — 다음 사람 건너뛰기`); }
    else if (card[1] === 'Q') { P.dir *= -1; P.log.push(`🔄 ${nm} Q — 방향 반대로`); }
    else if (card[1] === 'K') { again = true; P.log.push(`👑 ${nm} K — 한 번 더!`); }
    else if (card[1] === '7') { P.suit = OC_SUITS.includes(suit) ? suit : card[0]; P.log.push(`🎨 ${nm} 7 — 무늬를 ${SUIT_KO[P.suit]}(으)로`); }
    else P.log.push(`${nm} ${ocLabel(card)}`);
    if (!h.length) return this.ocEnd(pid);
    if (h.length === 1) P.one = {pid, until: Date.now() + OC_ONE_MS, said: false};
    if (again) { P.deadline = Date.now() + OC_TURN_MS; return; }
    this.ocAdvance(skip); }
  ocOne(pid) { const P = this.s.party, o = P.one; if (!o || o.said || Date.now() > o.until + 500) return;
    const owner = this.s.players[o.pid]?.name;
    if (pid === o.pid) { o.said = true; P.log.push(`☝ ${owner} "원카드!"`); this.sysChat(`☝ ${owner}: 원카드!`); }
    else { o.said = true; this.ocTake(o.pid, 1); P.log.push(`🚨 ${this.s.players[pid]?.name}님이 먼저 외쳐서 ${owner} 한 장 받음`); this.sysChat(`🚨 ${this.s.players[pid]?.name}: 원카드! (${owner} 벌칙 +1장)`); } }
  ocEnd(winner) { const P = this.s.party; if (P.over) return;
    const rest = P.order.filter((id) => id !== winner && !P.broke.includes(id)).sort((a, b) => P.hands[a].length - P.hands[b].length), pts = [100, 60, 40, 25, 15, 10, 5, 5];
    P.places = [winner, ...rest, ...P.broke].filter(Boolean);
    P.places.forEach((id, k) => { const q = this.s.players[id]; if (q) q.score = P.broke.includes(id) ? 0 : pts[k] ?? 5; });
    this.sysChat(winner ? `🏆 ${this.s.players[winner]?.name}님이 카드를 다 털었어요! 원카드 승리` : '원카드 끝!');
    this.endParty(); }
  liarNextHint() {
    const P = this.s.party; P.turn += 1;
    if (P.turn >= P.order.length * P.laps) { P.stage = 'vote'; P.deadline = Date.now() + 40000; this.sysChat('🕵️ 설명 끝! 거짓말쟁이라고 생각하는 사람에게 투표하세요.'); }
    else P.deadline = Date.now() + 30000;
  }
  liarTally() {
    const P = this.s.party, s = this.s, name = (id) => s.players[id]?.name || '?', c = {};
    for (const t of Object.values(P.votes)) c[t] = (c[t] || 0) + 1;
    const max = Math.max(0, ...Object.values(c)), top = Object.keys(c).filter((k) => c[k] === max);
    if (!max || top.length > 1) { this.sysChat('🤝 표가 갈렸어요! 아무도 지목되지 않았어요.'); return this.liarFinish(true); }
    P.accused = top[0];
    if (P.accused !== P.liar) { this.sysChat(`❌ ${name(P.accused)}님은 거짓말쟁이가 아니었어요!`); return this.liarFinish(true); }
    P.stage = 'lastguess'; P.deadline = Date.now() + 25000;
    this.sysChat(`🎯 ${name(P.liar)}님이 거짓말쟁이! 마지막 기회: 제시어를 맞히면 역전승!`);
  }
  liarFinish(liarWins) {
    const P = this.s.party, s = this.s, name = (id) => s.players[id]?.name || '?';
    P.winner = liarWins ? 'liar' : 'citizens'; P.stage = 'end';
    for (const p of Object.values(s.players)) if (p.inRound) p.score = p.pid === P.liar ? (liarWins ? 150 : 0) : (liarWins ? 20 : 100) + (P.votes[p.pid] === P.liar ? 20 : 0);
    this.sysChat(`${liarWins ? `😈 거짓말쟁이 ${name(P.liar)}님 승리!` : '🎉 시민 승리!'} 제시어는 '${P.word}'였어요.`);
    this.endParty();
  }
  // ── 1위 뽑기: 탈락전(survival) · 리그(league) · 토너먼트(tournament) ──
  newSeries(kind, len) {
    if (!['survival', 'league', 'tournament'].includes(kind)) return null;
    return {kind, len: kind === 'league' ? (len === 5 ? 5 : 3) : 0, idx: 0, started: false, members: [], alive: [], pts: {}, wins: {}, log: [], bracket: [], stage: 0, done: false, champion: []};
  }
  startSeries(on) {
    const sr = this.s.series; if (!sr || sr.started) return;
    sr.started = true; sr.members = Object.values(this.s.players).filter((q) => on.has(q.pid)).sort(() => Math.random() - 0.5).map((q) => q.pid);
    sr.alive = [...sr.members]; for (const id of sr.members) { sr.pts[id] = 0; sr.wins[id] = 0; }
    if (sr.kind === 'tournament') sr.bracket = [this.pairUp(sr.members)];
  }
  // Who plays this round: survival → only the alive; tournament → players with a match this stage.
  pairUp(ids) {
    const out = []; for (let i = 0; i < ids.length; i += 2) out.push({a: ids[i], b: ids[i + 1] ?? null, w: null, sa: 0, sb: 0});
    const label = out.length === 1 ? '결승' : out.length === 2 ? '준결승' : `${out.length * 2}강`;
    for (const m of out) m.label = label; return out;
  }
  playsRound(pid) {
    const sr = this.s.series; if (!sr || !sr.started) return true;
    if (sr.kind === 'survival') return sr.alive.includes(pid);
    if (sr.kind === 'tournament') return (sr.bracket[sr.stage] || []).some((mt) => mt.a === pid || mt.b === pid);
    return sr.members.includes(pid);
  }
  async superchat(sc) { const item = {t: 'sc', ...sc, at: Date.now()}; this.s.sc = [...(this.s.sc || []).filter((x) => Date.now() - x.at < 60e3), item].slice(-3); this.broadcast(item); this.sysChat(`📢 ${sc.name}: ${sc.text}`); await this.save(); return 'ok'; }
  // 뱃지용 기록: 사람 2명 이상이 함께한 판의 단독 1등 = 1승, 사람 3명 이상 시리즈 우승 = 우승 1회 (로그인한 계정만)
  award(pid, kind) { if (!/^[a-f0-9]{24}$/.test(pid) || !this.env.USER) return; try { const p = this.env.USER.get(this.env.USER.idFromName(pid)).award(kind); this.ctx.waitUntil?.(p.catch(() => {})); p.catch?.(() => {}); } catch {} }
  finishRound() {
    const s = this.s; s.phase = 'result';
    { const hum = Object.values(s.players).filter((p) => p.inRound && !isBot(p.pid));
      if (hum.length >= 2) { const all = Object.values(s.players).filter((p) => p.inRound), top = Math.max(...all.map((p) => p.score || 0)), best = all.filter((p) => (p.score || 0) === top);
        if (best.length === 1 && !isBot(best[0].pid) && top > 0) this.award(best[0].pid, 'win'); } }
    const sr = s.series; if (!sr || !sr.started || sr.done) return;
    const racers = Object.values(s.players).filter((p) => p.inRound), name = (id) => s.players[id]?.name || '?';
    const sorted = [...racers].sort((a, b) => b.score - a.score);
    const rankOf = (p) => 1 + sorted.filter((q) => q.score > p.score).length;
    const entry = {game: s.game, scores: Object.fromEntries(racers.map((p) => [p.pid, p.score]))};
    if (sr.kind === 'league') {
      const n = racers.length;
      for (const p of racers) { const r = rankOf(p); sr.pts[p.pid] = (sr.pts[p.pid] || 0) + (n - r + 1); if (r === 1) sr.wins[p.pid] = (sr.wins[p.pid] || 0) + 1; }
      sr.idx += 1; sr.log.push(entry);
      if (sr.idx >= sr.len) { const best = Math.max(...sr.members.map((id) => sr.pts[id] || 0)); let top = sr.members.filter((id) => (sr.pts[id] || 0) === best);
        if (top.length > 1) { const w = Math.max(...top.map((id) => sr.wins[id] || 0)); top = top.filter((id) => (sr.wins[id] || 0) === w); }
        sr.done = true; sr.champion = top; this.sysChat(`🏆 리그 종료! 1위: ${top.map(name).join(', ')} (${best}점)`); }
      else this.sysChat(`리그 ${sr.idx}/${sr.len}판 끝 · 선두 ${name(sr.members.reduce((a, b) => ((sr.pts[b] || 0) > (sr.pts[a] || 0) ? b : a)))}`);
    } else if (sr.kind === 'survival') {
      const alive = racers.filter((p) => sr.alive.includes(p.pid));
      // Anyone who left mid-round is out first.
      const gone = sr.alive.filter((id) => !alive.some((p) => p.pid === id));
      let out = gone;
      if (!out.length && alive.length > 1) { const low = Math.min(...alive.map((p) => p.score)); out = alive.filter((p) => p.score === low).map((p) => p.pid); if (out.length === alive.length) out = []; }
      sr.alive = sr.alive.filter((id) => !out.includes(id)); sr.idx += 1; entry.out = out; sr.log.push(entry);
      if (out.length) this.sysChat(`💀 탈락: ${out.map(name).join(', ')} · 생존 ${sr.alive.length}명`); else this.sysChat('동점! 이번 판은 탈락자 없음');
      if (sr.alive.length <= 1) { sr.done = true; sr.champion = sr.alive.length ? sr.alive : out; this.sysChat(`🏆 최후의 1인: ${sr.champion.map(name).join(', ')}`); }
    } else if (sr.kind === 'tournament') {
      const stage = sr.bracket[sr.stage] || [];
      for (const mt of stage) {
        mt.sa = entry.scores[mt.a] ?? 0; mt.sb = mt.b ? (entry.scores[mt.b] ?? 0) : -1;
        const aIn = mt.a in entry.scores, bIn = mt.b && mt.b in entry.scores;
        mt.w = !mt.b ? mt.a : !bIn ? mt.a : !aIn ? mt.b : mt.sa > mt.sb ? mt.a : mt.sb > mt.sa ? mt.b : (Math.random() < 0.5 ? mt.a : mt.b);
      }
      sr.idx += 1; sr.log.push(entry);
      const final = stage.find((mt) => mt.label === '결승');
      if (final) { sr.done = true; sr.champion = [final.w]; this.sysChat(`🏆 토너먼트 우승: ${name(final.w)}!`); }
      else {
        const main = stage.filter((mt) => mt.label !== '3·4위전'), l = (mt) => (mt.w === mt.a ? mt.b : mt.a);
        const next = this.pairUp(main.map((mt) => mt.w));
        if (main.length === 2 && l(main[0]) && l(main[1])) next.push({a: l(main[0]), b: l(main[1]), w: null, sa: 0, sb: 0, label: '3·4위전'});
        sr.bracket.push(next); sr.stage += 1;
        this.sysChat(`${next[0].label} 진출: ${next.filter((m) => m.label !== '3·4위전').map((m) => `${name(m.a)}${m.b ? ` vs ${name(m.b)}` : ''}`).join(' / ')}`);
      }
    }
    if (sr.done && sr.members.filter((id) => !isBot(id)).length >= 3) for (const id of sr.champion || []) if (!isBot(id)) this.award(id, 'champ');
    // Next round of a series gets a fresh random game (host can still change it).
    if (!sr.done) { const pool = GAMES.filter((g) => !PARTY.includes(g) && !TURN.includes(g) && !RETIRED.includes(g) && g !== s.game); s.game = pool[Math.floor(Math.random() * pool.length)]; }
  }
  async fetch(req) {
    const url = new URL(req.url);
    const code = (url.pathname.split('/').pop() || '').toUpperCase();
    const pid = (url.searchParams.get('pid') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    const name = cleanName(url.searchParams.get('name'));
    const {0: client, 1: server} = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    if (!pid) { server.send(JSON.stringify({t: 'error', code: 'bad'})); server.close(4000, 'bad'); return new Response(null, {status: 101, webSocket: client}); }
    // Drop a stale socket from the same player (e.g. reconnect after network change).
    for (const ws of this.ctx.getWebSockets()) { if (ws !== server && ws.deserializeAttachment()?.pid === pid) { try { ws.close(4001, 'replaced'); } catch {} } }
    const on = this.online();
    if (!this.s.players[pid] && on.size >= (code.startsWith('LNG') ? LOUNGE_MAX : MAX_PLAYERS)) { server.send(JSON.stringify({t: 'error', code: 'full'})); server.close(4002, 'full'); return new Response(null, {status: 101, webSocket: client}); }
    if (!this.humans().size && this.s.phase !== 'lobby') { const hp = this.s.hp; this.s = this.fresh(); if (hp) this.s.hp = hp; } // everyone had left: start over (방명록·방문자 수는 남겨요)
    this.s.code = code;
    const p = this.s.players[pid] || {pid, joinedAt: Date.now(), ready: false, score: 0, done: false, inRound: false};
    const badges = (req.headers.get('x-tc-badges') || '').split(',').filter((b) => BADGE_IDS.includes(b));
    this.s.players[pid] = {...p, name, badges, look: cleanLook(url.searchParams.get('look')), deco: cleanDeco(url.searchParams.get('deco'))};
    // Forget players who left long ago so the room does not fill with ghosts.
    for (const [id, q] of Object.entries(this.s.players)) if (id !== pid && !on.has(id) && !q.inRound && !isBot(id)) delete this.s.players[id];
    server.serializeAttachment({pid});
    this.visit(pid);
    await this.sync();
    try { server.send(JSON.stringify({t: 'chatlog', items: this.s.chat || []})); server.send(JSON.stringify(this.hpView())); for (const sc of (this.s.sc || []).filter((x) => Date.now() - x.at < (x.ms || 8000))) server.send(JSON.stringify(sc)); } catch {}
    return new Response(null, {status: 101, webSocket: client});
  }
  async webSocketMessage(ws, raw) {
    const pid = ws.deserializeAttachment()?.pid, p = pid && this.s.players[pid];
    if (!p || typeof raw !== 'string' || raw.length > 24000 || (raw.length > 500 && !raw.startsWith('{"t":"snap"'))) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const isHost = this.hostId() === pid, s = this.s;
    switch (m.t) {
      case 'ping': ws.send(JSON.stringify({t: 'pong', serverNow: Date.now()})); return;
      case 'snap': { // 차례대로 모드: 지금 차례인 사람의 게임 화면 상태를 다른 사람에게 그대로 중계 (저장하지 않아요)
        const T = s.turns; if (s.phase !== 'playing' || !T || T.order[T.idx] !== pid) return;
        this.lastSnap = {pid, d: m.d, k: m.k}; const out = JSON.stringify({t: 'snap', pid, d: m.d, k: m.k});
        for (const w of this.ctx.getWebSockets()) { if (w === ws) continue; try { w.send(out); } catch {} } return;
      }
      case 'turnmode': if (!isHost || s.phase === 'playing') return; s.turnMode = !!m.v; break;
      case 'mode':
        if (!isHost || s.phase === 'playing') return;
        s.series = m.kind === 'single' ? null : this.newSeries(m.kind, m.len);
        if (s.series && PARTY.includes(s.game)) s.game = 'flip';
        for (const q of Object.values(s.players)) q.ready = false;
        s.phase = 'lobby'; break;
      case 'bots': // 방장: 파티 게임 빈자리를 AI 로 채우기 (0~3명)
        if (!isHost || s.phase === 'playing') return;
        if (!BOT_GAMES.includes(s.game)) { this.sysChat('AI 는 거짓말쟁이·눈치·소수결·마음 맞추기·타이밍 게임에서만 같이 할 수 있어요.'); return; }
        this.setBots(m.n); break;
      case 'pick':
        if (!isHost || s.phase === 'playing') return;
        if (GAMES.includes(m.game)) s.game = m.game;
        if (!BOT_GAMES.includes(s.game)) this.setBots(0); // AI 는 파티 게임에서만
        if (LEVELS.includes(m.level)) s.level = m.level;
        if (FH_TOPICS.includes(m.topic)) s.fhTopic = m.topic;
        for (const q of Object.values(s.players)) q.ready = false;
        s.phase = 'lobby'; break;
      case 'ready': {
        if (s.phase === 'playing') return;
        if (s.phase === 'result') { s.phase = 'lobby'; for (const q of Object.values(s.players)) { q.ready = false; } }
        p.ready = !!m.v; for (const q of Object.values(s.players)) if (isBot(q.pid)) q.ready = true;
        const on = this.online(), here = Object.values(s.players).filter((q) => on.has(q.pid));
        if (s.series?.done) s.series = this.newSeries(s.series.kind, s.series.len); // champion decided → a new series on the next start
        if (here.length >= 2 && here.every((q) => q.ready) && here.length < (MIN_PLAYERS[s.game] || 2)) { for (const q of here) q.ready = false; this.sysChat(`이 게임은 ${MIN_PLAYERS[s.game]}명 이상 있어야 시작할 수 있어요.`); break; }
        if (here.length >= 2 && here.every((q) => q.ready)) {
          this.startSeries(on);
          s.round += 1; s.phase = 'playing'; s.seed = `live-${crypto.randomUUID().slice(0, 8)}`; s.startAt = Date.now() + COUNTDOWN_MS;
          for (const q of Object.values(s.players)) { const inR = on.has(q.pid) && this.playsRound(q.pid); Object.assign(q, {ready: false, score: 0, done: false, inRound: inR}); }
          for (const id of Object.keys(s.players)) if (!s.players[id].inRound && !on.has(id)) delete s.players[id];
          if (s.game === 'forehead') {
            const cats = Object.keys(FH_WORDS), cat = cats[Math.floor(Math.random() * cats.length)];
            const pool = [...FH_WORDS[cat]].sort(() => Math.random() - 0.5), words = {};
            Object.values(s.players).filter((q) => q.inRound).forEach((q, i) => { words[q.pid] = pool[i]; });
            s.fh = {cat, words, solved: {}, wrong: {}, next: {}, endAt: s.startAt + FH_TIME};
            const topic = s.fhTopic || 'random', ids = Object.values(s.players).filter((q) => q.inRound).map((q) => q.pid);
            if (topic === 'people' || topic === 'tales') {
              const list = [...FH_WORDS[topic === 'people' ? '__people' : '__tales']].sort(() => Math.random() - 0.5);
              s.fh.cat = topic === 'people' ? '역사 속 인물' : '동화·전래 캐릭터'; s.fh.words = Object.fromEntries(ids.map((id, i) => [id, list[i]]));
            } else if (topic === 'custom') { // 친구가 정해주기: each player writes the word for the next player in the ring
              const ring = [...ids].sort(() => Math.random() - 0.5);
              s.fh.cat = '친구가 정한 단어'; s.fh.words = {}; s.fh.pending = true; s.fh.endAt = 0;
              s.fh.assign = Object.fromEntries(ring.map((id, i) => [id, ring[(i + 1) % ring.length]]));
            }
            s.party = null;
          } else if (PARTY.includes(s.game)) { s.fh = null; this.startParty(s.game); }
          else { s.fh = null; s.party = null; }
          s.duel = null; s.turns = null; this.lastSnap = null;
          s.endAt = !TURN.includes(s.game) && !PARTY.includes(s.game) && s.game !== 'forehead' ? s.startAt + limitMs(s.game) : 0; // 동시에 모드 마감
          if (s.turnMode !== false && !TURN.includes(s.game) && !PARTY.includes(s.game) && s.game !== 'forehead') { // 차례대로: 한 사람씩, 나머지는 관전
            const order = Object.values(s.players).filter((q) => q.inRound && !isBot(q.pid)).map((q) => q.pid).sort(() => Math.random() - 0.5);
            s.turns = {order, idx: 0, startAt: s.startAt, deadline: s.startAt + limitMs(s.game)};
          }
          if (TURN.includes(s.game)) {
            const sr = s.series, ids = Object.values(s.players).filter((q) => q.inRound).sort((a, b) => a.joinedAt - b.joinedAt).map((q) => q.pid);
            const pairs = sr?.kind === 'tournament' && sr.started ? (sr.bracket[sr.stage] || []).map((m) => [m.a, m.b]) : ids.reduce((acc, id, i) => (i % 2 ? acc[acc.length - 1].push(id) : acc.push([id]), acc), []);
            s.duel = {boards: pairs.map((pl) => ({players: Math.random() < 0.5 ? pl : [...pl].reverse(), moves: [], toMove: 0, over: pl.length < 2 || !pl[1]}))};
            for (const bd of s.duel.boards) if (bd.over) for (const id of bd.players) if (id && s.players[id]) { s.players[id].done = true; s.players[id].score = 100; } // 부전승
          }
        }
        break;
      }
      case 'progress': case 'done':
        if (s.phase !== 'playing' || !p.inRound || p.done || m.round !== s.round) return;
        if (s.turns && s.turns.order[s.turns.idx] !== pid) return; // 차례대로: 내 차례에만
        p.score = Math.max(0, Math.min(100000, Math.round(Number(m.score) || 0)));
        if (m.t === 'done') { p.done = true; if (s.turns) this.nextTurn(); }
        break;
      case 'move': {
        const bd = s.duel?.boards?.[m.b];
        if (s.phase !== 'playing' || !bd || bd.over || Date.now() < s.startAt) return;
        if (bd.players[bd.toMove] !== pid || m.n !== bd.moves.length || !Number.isInteger(m.i) || m.i < 0 || m.i > 400 || bd.moves.includes(m.i)) return;
        bd.moves.push(m.i); bd.toMove = m.next === 1 ? 1 : 0; if (m.over) bd.over = true;
        break;
      }
      case 'assign': {
        const f = s.fh;
        if (s.phase !== 'playing' || s.game !== 'forehead' || !f?.pending || !f.assign?.[pid]) return;
        const w = cleanChat(m.text).slice(0, 20); if (!w) return;
        f.words[f.assign[pid]] = w;
        if (Object.keys(f.assign).every((id) => f.words[f.assign[id]])) { f.pending = false; f.endAt = Date.now() + FH_TIME; this.sysChat('✍️ 모든 단어가 정해졌어요! 질문하고 맞혀 보세요.'); }
        break;
      }
      case 'hint': {
        const P = s.party; if (s.phase !== 'playing' || P?.kind !== 'liar' || P.stage !== 'hint' || Date.now() < s.startAt) return;
        if (P.order[P.turn % P.order.length] !== pid) return;
        const text = cleanChat(m.text).slice(0, 40); if (!text) return;
        P.hints.push({pid, text}); this.liarNextHint(); break;
      }
      case 'accuse': {
        const P = s.party; if (s.phase !== 'playing' || P?.kind !== 'liar' || P.stage !== 'vote' || !p.inRound || !P.order.includes(m.target) || m.target === pid) return;
        P.votes[pid] = m.target;
        if (this.racers().every((q) => P.votes[q.pid])) this.liarTally();
        break;
      }
      case 'liarguess': {
        const P = s.party; if (s.phase !== 'playing' || P?.kind !== 'liar' || P.stage !== 'lastguess' || pid !== P.liar) return;
        P.guess = cleanChat(m.text).slice(0, 20); this.liarFinish(norm(P.guess) === norm(P.word)); break;
      }
      case 'call': {
        const P = s.party, now = Date.now(); if (s.phase !== 'playing' || P?.kind !== 'nunchi' || P.over || now < s.startAt || !p.inRound) return;
        if (P.safe.includes(pid) || P.out.includes(pid) || P.pend?.pid === pid) return;
        this.nunchiCall(pid, now); break;
      }
      case 'tele': {
        const P = s.party; if (s.phase !== 'playing' || P?.kind !== 'tele' || P.stage !== 'answer' || !p.inRound || Date.now() < s.startAt) return;
        const a = cleanChat(m.text).slice(0, 20); if (!a) return; P.answers[pid] = a; break;
      }
      case 'oc': { // 원카드: {a:'play', card, suit} / {a:'draw'} / {a:'one'}
        const P = s.party; if (s.phase !== 'playing' || P?.kind !== 'onecard' || P.over || !p.inRound || Date.now() < s.startAt) return;
        if (m.a === 'one') { this.ocOne(pid); break; }
        if (P.order[P.turn] !== pid) return;
        if (m.a === 'draw') this.ocDraw(pid); else if (m.a === 'play') this.ocPlay(pid, String(m.card || ''), String(m.suit || ''));
        break;
      }
      case 'mindplay': {
        const P = s.party, hand = P?.hands?.[pid];
        if (s.phase !== 'playing' || P?.kind !== 'mind' || P.stage !== 'play' || !hand?.length || Date.now() < s.startAt) return;
        this.mindPlay(pid); P.lastAt = Date.now(); break;
      }
      case 'side': {
        const P = s.party; if (s.phase !== 'playing' || P?.kind !== 'vote' || P.stage !== 'vote' || !p.inRound || ![0, 1].includes(m.v) || Date.now() < s.startAt) return;
        P.votes[pid] = m.v; break;
      }
      case 'guess': {
        const f = s.fh, now = Date.now();
        if (s.phase !== 'playing' || s.game !== 'forehead' || !f || f.pending || !p.inRound || f.solved[pid] || now < s.startAt) return;
        if (now < (f.next[pid] || 0)) return;
        const g = cleanChat(m.text).slice(0, 20); if (!g) return;
        if (norm(g) === norm(f.words[pid])) {
          const rank = Object.keys(f.solved).length + 1;
          f.solved[pid] = {rank, at: now}; p.done = true; p.score = FH_POINTS[rank - 1] ?? 20;
          this.sysChat(`🎉 ${p.name}님 정답! 내 단어는 '${f.words[pid]}' (${rank}등)`);
        } else {
          f.wrong[pid] = (f.wrong[pid] || 0) + 1; f.next[pid] = now + FH_COOLDOWN;
          this.sysChat(`❌ ${p.name}님 '${g}' 도전… 땡! (${FH_COOLDOWN / 1000}초 뒤 다시)`);
        }
        break;
      }
      case 'chat': {
        let text = maskBad(cleanChat(m.text)); const now = Date.now();
        if (s.phase === 'playing' && s.party?.kind === 'mind' && !s.party.over) text = text.replace(/[0-9０-９]/g, '＊'); // 숫자 말하면 반칙!
        this.lastChat = this.lastChat || {};
        if (!text || now - (this.lastChat[pid] || 0) < 600) return; // light flood guard
        this.lastChat[pid] = now;
        const item = {pid, name: p.name, text, at: now};
        s.chat = [...(s.chat || []).slice(-29), item];
        await this.save();
        this.broadcast({t: 'chat', ...item});
        return;
      }
      case 'pose': { // 라운지에서 걷는 위치. 저장하지 않고 메모리에만 두고 바로 중계해요.
        const x = Math.max(-12, Math.min(12, Number(m.x) || 0)), z = Math.max(-12, Math.min(12, Number(m.z) || 0));
        this.pos = this.pos || {}; this.pos[pid] = {x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100};
        if (['sit', 'lie', 'stand'].includes(m.act)) Object.assign(this.pos[pid], {act: m.act, ry: Math.round((Number(m.ry) || 0) * 100) / 100, y: Math.max(0, Math.min(1.2, Number(m.y) || 0)), arms: m.arms ? 1 : 0}); // 가구 쓰는 자세
        this.broadcast({t: 'pose', pid, ...this.pos[pid]});
        return;
      }
      case 'look':
        p.look = cleanLook(m.look); break;
      case 'gb': { // 방명록 한 줄 남기기 (10초에 한 번)
        const text = cleanChat(m.text).slice(0, 60), now = Date.now(); this.lastGb = this.lastGb || {};
        if (!text || now - (this.lastGb[pid] || 0) < 10000) return; this.lastGb[pid] = now;
        const hp = this.s.hp || (this.visit(pid), this.s.hp);
        hp.gb = [{name: p.name, look: p.look || '', text, at: now}, ...(hp.gb || [])].slice(0, 30);
        await this.save(); this.broadcast(this.hpView()); return;
      }
      case 'deco': // 내 방 꾸미기 (친구 방 방장의 방이 모두에게 보여요)
        p.deco = cleanDeco(m.deco); break; // 드레스룸에서 갈아입으면 모두에게 새 모습으로
      case 'emoji':
        if (EMOJIS.includes(m.e)) this.broadcast({t: 'emoji', pid, e: m.e});
        return;
      default: return;
    }
    await this.sync();
  }
  async webSocketClose(ws) { try { ws.close(); } catch {} await this.sync(); }
  async webSocketError(ws) { await this.sync(); }
}
