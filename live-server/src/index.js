// Real-time rooms for 씽크칩 아레나. One Durable Object per room code relays a tiny shared state:
// who is in the room, which game the host picked, a shared seed + start time, and everyone's live score.
// Every player plays the same seeded board at the same moment; the server only coordinates and relays.
import {DurableObject} from 'cloudflare:workers';

const MAX_PLAYERS = 8, LOUNGE_MAX = 20; // LNG* = 3D 라운지 공개방 (게임 대신 함께 돌아다니는 공간)
const cleanLook = (v) => String(v || '').replace(/[^a-z0-9.]/g, '').slice(0, 300); // lounge/avatar.js encodeLook
const GAMES = ['flip', 'blind', 'triad', 'trust', 'baseball', 'nim', 'auction', 'maze', 'draw', 'marbles', 'redlight', 'bridge', 'minority', 'forehead', 'liar', 'nunchi', 'vote', 'sudoku', 'merge', 'stroop', 'gomoku', 'dots', 'tele', 'mind'];
const TURN = ['gomoku', 'dots']; // 1:1 turn games: the server relays moves between the two players of each board
const PARTY = ['forehead', 'liar', 'nunchi', 'vote', 'tele', 'mind'];
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
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(req);
    }
    if (url.pathname === '/' || url.pathname === '/health') return new Response('thinkchip-live ok', {headers: {'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*'}});
    return new Response('not found', {status: 404});
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get('s')) || this.fresh();
    });
  }
  fresh() { return {code: '', phase: 'lobby', game: 'flip', level: 'normal', seed: '', round: 0, startAt: 0, players: {}, chat: [], series: null}; }
  online() { const ids = new Set(); for (const ws of this.ctx.getWebSockets()) { if (ws.readyState !== 1) continue; const a = ws.deserializeAttachment(); if (a?.pid) ids.add(a.pid); } return ids; }
  hostId(on = this.online()) { return Object.values(this.s.players).filter((p) => on.has(p.pid)).sort((a, b) => a.joinedAt - b.joinedAt)[0]?.pid || null; }
  view(viewer) {
    const on = this.online(), host = this.hostId(on);
    const players = Object.values(this.s.players).filter((p) => on.has(p.pid) || (this.s.phase !== 'lobby' && p.inRound))
      .sort((a, b) => a.joinedAt - b.joinedAt).map((p) => ({pid: p.pid, name: p.name, ready: p.ready, score: p.score, done: p.done, inRound: p.inRound, online: on.has(p.pid), host: p.pid === host, look: p.look || '', pos: this.pos?.[p.pid] || null}));
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
      else if (P.kind === 'vote') party = {kind: 'vote', idx: P.idx, rounds: P.rounds, stage: P.stage, topic: P.topics[P.idx], deadline: P.deadline, voted: Object.keys(P.votes), myVote: P.votes[viewer] ?? null, history: P.history};
    }
    const duel = TURN.includes(game) && this.s.duel && phase !== 'lobby' ? this.s.duel : null;
    return {t: 'state', code, phase, game, level, seed, round, startAt, serverNow: Date.now(), players, fh, party, duel, series: this.s.series, fhTopic: this.s.fhTopic || 'random'};
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
      if (s.party && !s.party.over) { if (s.party.deadline) t.push(s.party.deadline + 50); if (s.party.kind === 'nunchi' && s.party.pend) t.push(s.party.pend.at + 470); }
    }
    if (t.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 20, Math.min(...t)));
  }
  // A round ends when everybody still connected who started it has finished.
  checkRound() {
    if (this.s.phase !== 'playing') return;
    const on = this.online(), live = Object.values(this.s.players).filter((p) => p.inRound && on.has(p.pid));
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
  finishRound() {
    const s = this.s; s.phase = 'result';
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
    // Next round of a series gets a fresh random game (host can still change it).
    if (!sr.done) { const pool = GAMES.filter((g) => !PARTY.includes(g) && !TURN.includes(g) && g !== s.game); s.game = pool[Math.floor(Math.random() * pool.length)]; }
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
    if (!on.size && this.s.phase !== 'lobby') { this.s = this.fresh(); } // everyone had left: start over
    this.s.code = code;
    const p = this.s.players[pid] || {pid, joinedAt: Date.now(), ready: false, score: 0, done: false, inRound: false};
    this.s.players[pid] = {...p, name, look: cleanLook(url.searchParams.get('look'))};
    // Forget players who left long ago so the room does not fill with ghosts.
    for (const [id, q] of Object.entries(this.s.players)) if (id !== pid && !on.has(id) && !q.inRound) delete this.s.players[id];
    server.serializeAttachment({pid});
    await this.sync();
    try { server.send(JSON.stringify({t: 'chatlog', items: this.s.chat || []})); } catch {}
    return new Response(null, {status: 101, webSocket: client});
  }
  async webSocketMessage(ws, raw) {
    const pid = ws.deserializeAttachment()?.pid, p = pid && this.s.players[pid];
    if (!p || typeof raw !== 'string' || raw.length > 500) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const isHost = this.hostId() === pid, s = this.s;
    switch (m.t) {
      case 'ping': ws.send(JSON.stringify({t: 'pong', serverNow: Date.now()})); return;
      case 'mode':
        if (!isHost || s.phase === 'playing') return;
        s.series = m.kind === 'single' ? null : this.newSeries(m.kind, m.len);
        if (s.series && PARTY.includes(s.game)) s.game = 'flip';
        for (const q of Object.values(s.players)) q.ready = false;
        s.phase = 'lobby'; break;
      case 'pick':
        if (!isHost || s.phase === 'playing') return;
        if (GAMES.includes(m.game)) s.game = m.game;
        if (LEVELS.includes(m.level)) s.level = m.level;
        if (FH_TOPICS.includes(m.topic)) s.fhTopic = m.topic;
        for (const q of Object.values(s.players)) q.ready = false;
        s.phase = 'lobby'; break;
      case 'ready': {
        if (s.phase === 'playing') return;
        if (s.phase === 'result') { s.phase = 'lobby'; for (const q of Object.values(s.players)) { q.ready = false; } }
        p.ready = !!m.v;
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
          s.duel = null;
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
        p.score = Math.max(0, Math.min(100000, Math.round(Number(m.score) || 0)));
        if (m.t === 'done') p.done = true;
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
        if (P.pend && now - P.pend.at < 450) { // 동시에 외침! 둘 다 탈락, 번호는 그대로
          P.out.push(P.pend.pid, pid); P.calls.push({...P.pend, ok: false, clash: true}, {pid, n: P.pend.n, at: now, ok: false, clash: true});
          this.sysChat(`💥 ${s.players[P.pend.pid]?.name}·${p.name} 동시에 ${P.pend.n}! 둘 다 탈락`); P.next = P.pend.n; P.pend = null;
        } else {
          if (P.pend) { P.safe.push(P.pend.pid); P.calls.push({...P.pend, ok: true}); P.next = P.pend.n + 1; }
          P.pend = {pid, n: P.next, at: now};
        }
        break;
      }
      case 'tele': {
        const P = s.party; if (s.phase !== 'playing' || P?.kind !== 'tele' || P.stage !== 'answer' || !p.inRound || Date.now() < s.startAt) return;
        const a = cleanChat(m.text).slice(0, 20); if (!a) return; P.answers[pid] = a; break;
      }
      case 'mindplay': {
        const P = s.party, hand = P?.hands?.[pid];
        if (s.phase !== 'playing' || P?.kind !== 'mind' || P.stage !== 'play' || !hand?.length || Date.now() < s.startAt) return;
        const card = hand.shift(), lower = [];
        for (const [id, h] of Object.entries(P.hands)) while (h.length && h[0] < card) lower.push({pid: id, n: h.shift()});
        P.played.push({pid, n: card, ok: !lower.length});
        if (lower.length) {
          P.lives -= 1; for (const c of lower) P.played.push({...c, ok: false, burned: true});
          this.sysChat(`💥 ${p.name}님 ${card}! 더 작은 수 ${lower.map((c) => c.n).join(', ')}이(가) 남아 있었어요. 목숨 -1`);
          if (P.lives <= 0) { this.mindEnd(false); break; }
        }
        if (Object.values(P.hands).every((h) => !h.length)) {
          if (P.level >= P.maxLevel) { this.mindEnd(true); break; }
          P.level += 1; P.stage = 'between'; P.deadline = Date.now() + 3500; this.sysChat(`✅ ${P.level - 1}단계 성공! 다음은 한 사람당 ${P.level}장`);
        }
        break;
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
        let text = cleanChat(m.text); const now = Date.now();
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
        this.broadcast({t: 'pose', pid, ...this.pos[pid]});
        return;
      }
      case 'look':
        p.look = cleanLook(m.look); break; // 드레스룸에서 갈아입으면 모두에게 새 모습으로
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
