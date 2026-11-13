/* THINKCHIP LOUNGE — 데블스 플랜 생활동 같은 3D 라운지.
 * 내 캐릭터로 걸어 다니고, 같은 라운지에 있는 사람들과 채팅(말풍선+표정)하고,
 * 게임 테이블을 눌러 바로 아레나 게임으로 들어가요. 씽크칩/기록은 메인 앱과 같은 저장소를 써요.
 */
(function () {
  'use strict';
  const THREE = window.THREE, A = window.ThinkChipAvatar, CFG = window.THINKCHIP_CONFIG || {GAMES: [], PARTY: [], LIVE_URL: ''};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const ARENA = new URL('../index.html', location.href); // 메인 앱(게임 아레나). 토스 앱 안에서는 폴더 주소(../)가 index.html 로 안 열려서 파일명까지 적어요
  const ARENA_HOME = new URL('../index.html?home=1', location.href).href; // 메인 앱 홈 (첫 화면 라운지로 다시 안 넘어오게)
  const JOIN_RE = /\[\[join:([A-Z0-9]{4,6}):([a-z]{2,12})\]\]/g;
  const tableHref = (id, code) => new URL(`?party=${encodeURIComponent(id)}&room=${encodeURIComponent(code)}&from=lounge`, ARENA).href;

  // ───────── 저장소 (메인 앱과 공유) ─────────
  const PROFILE_KEY = 'brain-arena:mvp:v2', LOUNGE_KEY = 'thinkchip:lounge:v1';
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  function profile() { const p = store.get(PROFILE_KEY, null); return p && typeof p === 'object' ? p : {version: 2, nickname: '', chips: 100, best: {}, completed: {}, history: [], earnings: {}, adCount: {}, demoGift: false}; }
  function saveProfile(p) { store.set(PROFILE_KEY, p); renderChips(); }
  function addChips(n) { const p = profile(); p.chips = Math.max(0, Math.trunc((Number(p.chips) || 0) + n)); p.paid = Math.min(Number(p.paid) || 0, p.chips); saveProfile(p); return p.chips; } // 쓸 때는 무료 칩부터, 충전 칩(paid)은 선물용으로 남아요
  // ── 계정 (public/account.js): 로그인하면 칩·산 옷·친구가 계정(서버)에 저장돼요. 로그인 안 하면 둘러보기만 ──
  const ACC = window.ThinkChipAccount || null; if (ACC) ACC.init(CFG.LIVE_URL);
  const acctOn = () => !!(ACC && ACC.api); // 서버 계정 사용 (오프라인 데모면 예전처럼 이 기기 지갑)
  const loggedIn = () => acctOn() && ACC.state.loggedIn;
  const IN_TOSS = !!CFG.TOSS; // 토스 앱 빌드: 토스 계정으로 자동 로그인, 칩 선물 없음
  const myChips = () => acctOn() ? (loggedIn() && ACC.state.wallet ? ACC.state.wallet.chips : 0) : (Number(profile().chips) || 0);
  const giftable = () => acctOn() ? (loggedIn() && ACC.state.wallet ? ACC.state.wallet.paid : 0) : Math.max(0, Math.min(Number(profile().paid) || 0, Number(profile().chips) || 0));
  function pid() { try { let id = localStorage.getItem('thinkchip:pid'); if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24); localStorage.setItem('thinkchip:pid', id); } return id; } catch (e) { return 'guest' + Math.floor(Math.random() * 1e6); } }
  const ME = (ACC && ACC.state.loggedIn && ACC.state.pid) || pid(); // 로그인하면 계정 id (친구 목록과 라운지 캐릭터를 맞춰요)
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  let mine = A.loadMine();

  // ───────── 게임 카탈로그 (config.js 에서 메인 앱 catalog 로부터 생성) ─────────
  const COLOR = {violet: '#8b7bff', amber: '#ffb020', teal: '#21c7b0', rose: '#ff6f91', green: '#3fcf8e', sky: '#38bdf8', coral: '#ff8a4c', lime: '#a3d13a', pink: '#ff6fc8', indigo: '#6c7bff', red: '#ff4d5e', cyan: '#22cfe6', plum: '#b569ff'};
  const ZONES = [
    {id: 'psych', title: '심리전 테이블', sub: '블러핑 · 배신 · 눈치', icon: '🃏', games: ['blind', 'trust', 'auction', 'marbles', 'minority'], pos: [-6.2, -3.6], color: 0xff6f91},
    {id: 'brain', title: '추리 테이블', sub: '숫자 · 논리 · 수 싸움', icon: '🧩', games: ['baseball', 'nim'], pos: [6.2, -3.6], color: 0x38bdf8},
    {id: 'reflex', title: '서바이벌 존', sub: '술래 · 징검다리', icon: '⚡', games: ['redlight', 'bridge'], pos: [-6.2, 4.2], color: 0xa3d13a},
    {id: 'duel', title: '1:1 전략석', sub: 'AI 또는 친구와 맞대결', icon: '⚔️', games: ['gomoku', 'dots'], pos: [6.2, 4.2], color: 0xb569ff},
    {id: 'party', title: '파티 라운지', sub: '친구들과 실시간 파티·협동', icon: '🎉', party: true, pos: [0, -6.4], color: 0xf7ce55},
    {id: 'main', title: '오늘의 메인 매치', sub: '매일 바뀌는 게임', icon: '🏆', main: true, pos: [0, 0], color: 0xf7ce55},
    {id: 'closet', title: '드레스룸', sub: '옷·소품 꾸미기', icon: '👕', closet: true, pos: [-8.6, 0.4], color: 0xffffff},
    {id: 'desk', title: '비서 데스크', sub: '출석 보너스 · 내 기록', icon: '💁', desk: true, pos: [8.6, 0.4], color: 0x7c8cff},
    {id: 'showcase', title: '뱃지 진열장', sub: '모은 뱃지 전시', icon: '🏅', showcase: true, pos: [0, -10.3], color: 0xf7ce55},
    {id: 'door', title: '내 방 문', sub: '라운지 ↔ 내 방', icon: '🚪', door: true, pos: [-9.7, -3.0], color: 0xf7ce55},
    {id: 'vip', title: 'VIP 라운지', sub: '뱃지·입장권이 있어야 들어가요', icon: '👑', vip: true, pos: [-8.4, -6.6], color: 0xb569ff},
  ];
  const GAME = Object.fromEntries([...CFG.GAMES, ...CFG.PARTY].map((g) => [g.id, g]));
  function dailyGame() { const d = new Date(), k = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate(); const list = CFG.GAMES; return list.length ? list[(k * 7 + 3) % list.length] : null; }

  // ───────── 3D 장면 ─────────
  const canvas = $('scene');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'}); }
  catch (e) { document.body.insertAdjacentHTML('beforeend', `<div class="nowebgl"><h2>이 기기에서는 3D 라운지를 열 수 없어요</h2><p>게임은 그대로 즐길 수 있어요.</p><a class="btn gold" href="${ARENA_HOME}">게임 아레나로 가기</a></div>`); $('loading').classList.add('done'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
  const hemi = new THREE.HemisphereLight(0xdfe6ff, 0x3a2c22, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.9); sun.position.set(10, 18, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50}); sun.shadow.bias = -0.0005; scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.25); fill.position.set(-10, 8, 6); scene.add(fill);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color, roughness: 0.6, metalness: 0}, o));
  const mats = {
    floor: M(0x7a5a43, {roughness: 0.55}), floorDay: 0xb08b6b, rug: M(0x1c2747, {roughness: 0.95}), rugTrim: M(0xf7ce55, {roughness: 0.4, metalness: 0.6}),
    wall: M(0x141c33, {roughness: 0.8}), wallDay: 0xe9e3d8, panel: M(0x1b2644, {roughness: 0.5}), gold: M(0xf7ce55, {metalness: 0.85, roughness: 0.25}),
    wood: M(0x3a2a20, {roughness: 0.45}), table: M(0x101727, {roughness: 0.25, metalness: 0.3}), felt: M(0x1e5a46, {roughness: 0.9}),
    sofa: M(0x2a3a66, {roughness: 0.75}), cushion: M(0xf2e6d0, {roughness: 0.9}), plant: M(0x2f8f5b, {roughness: 0.7}), pot: M(0xe8e1d4, {roughness: 0.5}),
    glass: new THREE.MeshPhysicalMaterial({color: 0xbfd6ff, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.55}),
  };
  function box(w, h, d, m, x, y, z, parent = scene) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
  function cyl(rt, rb, h, m, x, y, z, seg = 32, parent = scene) { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }

  // 바닥 · 벽 · 러그
  const ROOM = 11;
  const floor = box(ROOM * 2, 0.3, ROOM * 2, mats.floor, 0, -0.15, 0); floor.name = 'floor';
  for (let i = -ROOM + 1; i < ROOM; i += 2) box(0.02, 0.005, ROOM * 2, M(0x5b4231, {roughness: 0.6}), i, 0.002, 0).castShadow = false; // 마루 결
  const rug = cyl(5.2, 5.2, 0.04, mats.rug, 0, 0.02, 0, 64); rug.castShadow = false;
  const rugRing = new THREE.Mesh(new THREE.TorusGeometry(5.05, 0.05, 8, 96), mats.rugTrim); rugRing.rotation.x = Math.PI / 2; rugRing.position.y = 0.05; scene.add(rugRing);
  // 벽은 그룹으로 묶어서, 카메라가 벽 뒤로 돌아가면 그 벽만 숨겨요 (방을 어느 각도에서든 볼 수 있게)
  const backWallG = new THREE.Group(), leftWallG = new THREE.Group(); scene.add(backWallG, leftWallG);
  box(ROOM * 2, 6.5, 0.4, mats.wall, 0, 3.1, -ROOM, backWallG); box(0.4, 6.5, ROOM * 2, mats.wall, -ROOM, 3.1, 0, leftWallG);
  for (let x = -ROOM + 2; x < ROOM; x += 4) box(0.08, 6, 0.12, mats.gold, x, 3, -ROOM + 0.25, backWallG); // 벽 골드 라인
  for (let z = -ROOM + 2; z < ROOM; z += 4) box(0.12, 6, 0.08, mats.gold, -ROOM + 0.25, 3, z, leftWallG);
  box(ROOM * 2, 0.08, 0.1, mats.gold, 0, 0.35, -ROOM + 0.25, backWallG); box(0.1, 0.08, ROOM * 2, mats.gold, -ROOM + 0.25, 0.35, 0, leftWallG);

  // 전광판 (진짜 데이터: 오늘의 메인 매치, 내 칩, 접속자, 최근 소식)
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 1536; boardCanvas.height = 384;
  const bctx = boardCanvas.getContext('2d'); const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.encoding = THREE.sRGBEncoding;
  box(11.4, 3.0, 0.25, M(0x05070d, {roughness: 0.3}), 0, 4.0, -ROOM + 0.45, backWallG);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75), new THREE.MeshBasicMaterial({map: boardTex, toneMapped: false}));
  screenMesh.position.set(0, 4.0, -ROOM + 0.6); backWallG.add(screenMesh);
  let news = [];
  function drawBoard() {
    const c = bctx, W = 1536, H = 384, g = dailyGame(), p = profile();
    c.fillStyle = '#060a14'; c.fillRect(0, 0, W, H);
    const gr = c.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(124,140,255,.18)'); gr.addColorStop(1, 'rgba(247,206,85,.10)'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(247,206,85,.5)'; c.lineWidth = 4; c.strokeRect(10, 10, W - 20, H - 20);
    c.fillStyle = '#f7ce55'; c.font = '900 34px system-ui, sans-serif'; c.fillText('THINKCHIP ARENA · MAIN MATCH', 48, 72);
    c.fillStyle = '#ffffff'; c.font = '900 92px system-ui, sans-serif'; c.fillText(g ? `${g.symbol}  ${g.title}` : '오늘의 매치', 48, 178);
    c.fillStyle = '#a9b4d0'; c.font = '600 34px system-ui, sans-serif'; c.fillText(g ? (g.short || '').slice(0, 34) : '', 48, 232);
    c.fillStyle = '#41d38a'; c.font = '800 34px ui-monospace, monospace';
    c.fillText(`● ONLINE ${online.size + 1}`, 48, 312); c.fillStyle = '#f7ce55'; c.fillText(acctOn() && !loggedIn() ? '⬡ 로그인' : `⬡ ${fmt(myChips())}`, 360, 312);
    c.fillStyle = '#cbd5e1'; c.font = '600 30px system-ui, sans-serif'; c.fillText((news[0] || '테이블을 눌러 게임을 시작하세요').slice(0, 38), 620, 312);
    boardTex.needsUpdate = true;
  }

  // 네온 사인 (스테이션 이름) — 캔버스 텍스처 판
  function neon(text, color, w = 2.6) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x = cv.getContext('2d');
    x.fillStyle = 'rgba(8,10,20,.85)'; x.beginPath(); (x.roundRect ? x.roundRect(4, 4, 504, 120, 30) : x.rect(4, 4, 504, 120)); x.fill();
    x.strokeStyle = color; x.lineWidth = 6; x.shadowColor = color; x.shadowBlur = 18; x.stroke(); x.shadowBlur = 12;
    x.fillStyle = '#fff'; x.font = '900 54px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 68);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({map: t, transparent: true, toneMapped: false}));
    return m;
  }

  // 스테이션 소품
  const clickables = []; // {mesh, zone}
  function registerClick(obj, zone) { obj.traverse((o) => { if (o.isMesh) { o.userData.zone = zone; clickables.push(o); } }); }
  function chipStack(x, z, n, y = 0.82, parent = scene) { for (let i = 0; i < n; i++) cyl(0.14, 0.14, 0.035, mats.gold, x, y + i * 0.037, z, 20, parent); }
  function gameTable(zone) {
    const g = new THREE.Group(); const [x, z] = zone.pos; g.position.set(x, 0, z); scene.add(g);
    cyl(1.35, 1.35, 0.1, mats.table, 0, 0.78, 0, 48, g); cyl(1.2, 1.2, 0.02, mats.felt, 0, 0.84, 0, 48, g).material = M(zone.color, {roughness: 0.85});
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.33, 0.035, 8, 64), mats.gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.84; g.add(ring);
    cyl(0.18, 0.5, 0.78, mats.wood, 0, 0.39, 0, 24, g);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; const st = cyl(0.32, 0.28, 0.12, mats.sofa, Math.cos(a) * 1.9, 0.5, Math.sin(a) * 1.9, 20, g); cyl(0.06, 0.06, 0.45, mats.gold, Math.cos(a) * 1.9, 0.22, Math.sin(a) * 1.9, 8, g); }
    chipStack(-0.3, 0.1, 5, 0.86, g); chipStack(0.35, -0.2, 8, 0.86, g);
    const card = box(0.35, 0.02, 0.5, M(0xffffff), 0.1, 0.86, 0.45, g); card.rotation.y = 0.4;
    const sign = neon(`${zone.icon} ${zone.title.replace(' 테이블', '')}`, '#' + zone.color.toString(16).padStart(6, '0')); sign.position.set(0, 2.55, 0); g.add(sign); zone.sign = sign;
    const lamp = new THREE.PointLight(zone.color, 0.6, 5, 2); lamp.position.set(0, 2.2, 0); g.add(lamp);
    registerClick(g, zone); return g;
  }
  ZONES.filter((z) => z.games).forEach(gameTable);
  // 메인 매치 테이블 (가운데, 크게)
  (function mainTable() {
    const z = ZONES.find((x) => x.main), g = new THREE.Group(); scene.add(g);
    cyl(2.0, 2.0, 0.14, mats.table, 0, 0.82, 0, 64, g); cyl(1.85, 1.85, 0.02, M(0x13203d, {roughness: 0.4, metalness: 0.4}), 0, 0.9, 0, 64, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.98, 0.05, 8, 96), mats.gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.9; g.add(ring);
    cyl(0.3, 0.75, 0.82, mats.wood, 0, 0.41, 0, 32, g);
    const hex = cyl(0.55, 0.55, 0.12, mats.gold, 0, 1.0, 0, 6, g); hex.rotation.y = Math.PI / 6; z.spin = hex;
    chipStack(-0.9, 0.5, 9, 0.92, g); chipStack(0.9, 0.6, 6, 0.92, g); chipStack(0.2, -0.9, 11, 0.92, g);
    const sign = neon('🏆 메인 매치', '#f7ce55', 3); sign.position.set(0, 2.9, 0); g.add(sign); z.sign = sign;
    const light = new THREE.SpotLight(0xffe4a3, 1.0, 14, Math.PI / 6, 0.5, 1.5); light.position.set(0, 9, 0); light.target = hex; scene.add(light);
    registerClick(g, z);
  })();
  // 파티 라운지 (소파)
  (function partyCorner() {
    const z = ZONES.find((x) => x.party), g = new THREE.Group(); g.position.set(z.pos[0], 0, z.pos[1]); scene.add(g);
    const sofa = (x, rz) => { const s = new THREE.Group(); s.position.set(x, 0, 0); s.rotation.y = rz; g.add(s);
      box(3.2, 0.45, 1.1, mats.sofa, 0, 0.42, 0, s); box(3.2, 0.9, 0.3, mats.sofa, 0, 0.85, -0.5, s); box(0.3, 0.7, 1.1, mats.sofa, -1.6, 0.6, 0, s); box(0.3, 0.7, 1.1, mats.sofa, 1.6, 0.6, 0, s);
      for (const cx of [-0.9, 0.9]) { const c = box(0.6, 0.5, 0.18, mats.cushion, cx, 0.88, -0.28, s); c.rotation.x = -0.2; } };
    sofa(-2.1, 0.25); sofa(2.1, -0.25);
    cyl(0.9, 0.9, 0.06, mats.glass, 0, 0.5, 1.1, 32, g); cyl(0.05, 0.05, 0.46, mats.gold, 0, 0.24, 1.1, 8, g);
    const sign = neon('🎉 파티 라운지', '#f7ce55', 3); sign.position.set(0, 2.7, -0.3); g.add(sign); z.sign = sign;
    registerClick(g, z);
  })();
  // 드레스룸 (전신 거울 + 행거)
  (function closet() {
    const z = ZONES.find((x) => x.closet), g = new THREE.Group(); g.position.set(z.pos[0], 0, z.pos[1]); g.rotation.y = Math.PI / 2; scene.add(g);
    box(1.4, 2.6, 0.12, mats.gold, 0, 1.4, -0.3, g); const mirror = box(1.22, 2.42, 0.05, new THREE.MeshStandardMaterial({color: 0xdfe8f5, metalness: 0.25, roughness: 0.12, emissive: 0x31405f, emissiveIntensity: 0.35}) /* 환경맵이 없어 금속 100%면 검게 보여서 은빛으로 */, 0, 1.4, -0.22, g);
    box(2.4, 0.06, 0.06, mats.gold, 2.0, 2.1, 0, g); box(0.06, 2.1, 0.06, mats.gold, 0.8, 1.05, 0, g); box(0.06, 2.1, 0.06, mats.gold, 3.2, 1.05, 0, g);
    [0x9d86ff, 0x3fcf9a, 0xffb34d, 0xff7a8a, 0x2c3550].forEach((c, i) => { const t = box(0.34, 0.7, 0.1, M(c, {roughness: 0.8}), 1.15 + i * 0.45, 1.65, 0, g); t.rotation.y = 0.3; });
    const sign = neon('👕 드레스룸', '#ffffff', 2.4); sign.position.set(0.9, 3.0, 0); g.add(sign); z.sign = sign;
    registerClick(g, z);
  })();
  // 비서 데스크 + 비서 NPC (한정판 스킨으로 옷을 바꿔 입어요)
  let secretary, deskG, homeSec, homeSecSkin = '';
  const SEC_SKINS = {
    classic: {name: '클래식 비서', price: 0, look: {hair: 'long', hairColor: 0x2b211d, top: 'suit', topColor: 0x1b2742, bottom: 'skirt', bottomColor: 0x1b2742, shoes: 'loafer', acc: 'headset', skin: 0xffe1cf}},
    idol: {name: '아이돌 무대', price: 300, look: {hair: 'wave', hairColor: 0xff9ec7, top: 'crop', topColor: 0xff6fc8, bottom: 'mini', bottomColor: 0xffffff, shoes: 'chunky', shoeColor: 0xffffff, acc: 'hairpin', skin: 0xffe1cf}},
    gold: {name: '골드 VIP', price: 600, look: {hair: 'hime', hairColor: 0x111111, top: 'suit', topColor: 0x0b0b10, bottom: 'longskirt', bottomColor: 0x0b0b10, shoes: 'loafer', acc: 'crown', skin: 0xffe1cf}},
    winter: {name: '윈터 홀리데이', price: 400, until: '2027-01-01', look: {hair: 'bob', hairColor: 0x6b3a22, top: 'puffer', topColor: 0xd8262f, bottom: 'skirt', bottomColor: 0xffffff, shoes: 'boots', acc: 'beanie', skin: 0xffe1cf}},
    hanbok: {name: '설날 한복풍', price: 400, until: '2027-02-28', look: {hair: 'buns', hairColor: 0x1d1512, top: 'cardigan', topColor: 0xe8456b, bottom: 'longskirt', bottomColor: 0x3b5bdb, shoes: 'loafer', acc: 'hairpin', skin: 0xffe1cf}},
  };
  const skinOn = (id) => SEC_SKINS[id] ? id : 'classic';
  function mySkin() { try { return skinOn((ACC && ACC.state.loggedIn && ACC.state.skin) || store.get('thinkchip:skin', 'classic')); } catch (e) { return 'classic'; } }
  function setSecretary(id) {
    if (!deskG) return; if (secretary) deskG.remove(secretary);
    secretary = A.buildAvatar(SEC_SKINS[skinOn(id)].look); secretary.position.set(0, 0, -0.6); deskG.add(secretary); secretary.traverse((o) => { if (o.isMesh) o.castShadow = true; }); secretary.userData.skin = skinOn(id);
  }
  function setHomeSecretary(id) { // 내 방(또는 놀러 간 친구 방)에 서 있는 비서 — 방 주인의 스킨
    id = id ? skinOn(id) : ''; if (id === homeSecSkin) return; homeSecSkin = id; if (homeSec) { scene.remove(homeSec); homeSec = null; }
    if (!id || id === 'classic') return;
    homeSec = A.buildAvatar(SEC_SKINS[id].look); homeSec.position.set(7.4, 0, -6.2); homeSec.rotation.y = -0.6; scene.add(homeSec); homeSec.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  (function desk() {
    const z = ZONES.find((x) => x.desk), g = new THREE.Group(); g.position.set(z.pos[0], 0, z.pos[1]); g.rotation.y = -Math.PI / 2; scene.add(g);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.05, 40, 1, false, 0, Math.PI), mats.panel); d.position.set(0, 0.52, 0.3); d.rotation.y = -Math.PI / 2; d.castShadow = true; g.add(d);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 40, 1, false, 0, Math.PI), mats.wood); top.position.set(0, 1.07, 0.3); top.rotation.y = -Math.PI / 2; g.add(top);
    box(0.5, 0.32, 0.04, M(0x0b1222, {emissive: 0x2a4a9a, emissiveIntensity: 0.6}), 0.4, 1.3, 0.6, g);
    const sign = neon('💁 비서 데스크', '#7c8cff', 2.6); sign.position.set(0, 3.0, -0.5); g.add(sign); z.sign = sign;
    deskG = g; setSecretary(mySkin());
    registerClick(g, z);
  })();
  // VIP 게이트: 금색 기둥 + 벨벳 로프 + 검은 문 (라운지 ↔ VIP 라운지)
  (function vipGate() {
    const z = ZONES.find((x) => x.vip), g = new THREE.Group(); g.position.set(z.pos[0], 0, z.pos[1]); g.rotation.y = Math.PI / 4; scene.add(g);
    box(2.2, 3.0, 0.25, M(0x0b0b10, {roughness: 0.3}), 0, 1.5, -0.4, g); box(1.5, 2.4, 0.05, M(0x2a0f3d, {emissive: 0x6c2bd9, emissiveIntensity: 0.35}), 0, 1.25, -0.26, g);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 10, 40, Math.PI), mats.gold); arch.position.set(0, 3.0, -0.25); g.add(arch);
    for (const x of [-1.2, 1.2]) { cyl(0.09, 0.12, 1.0, mats.gold, x, 0.5, 0.6, 12, g); const k = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mats.gold); k.position.set(x, 1.05, 0.6); g.add(k); }
    const rope = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.045, 8, 30, Math.PI), M(0x9b1b30, {roughness: 0.9})); rope.position.set(0, 0.98, 0.6); rope.rotation.z = Math.PI; rope.scale.y = 0.35; g.add(rope);
    const rug = cyl(1.3, 1.3, 0.02, M(0x9b1b30, {roughness: 0.95}), 0, 0.012, 0.6, 32, g); rug.scale.z = 0.6;
    const l = new THREE.PointLight(0xb569ff, 0.7, 5, 2); l.position.set(0, 2.2, 0.6); g.add(l);
    const sign = neon('👑 VIP 라운지', '#d9a6ff', 2.8); sign.position.set(0, 3.7, 0); g.add(sign); z.sign = sign;
    registerClick(g, z);
  })();
  // 뱃지: 모아서 내 방 진열장에 전시 (주니어 네이버 동물농장처럼). 🎟 표시는 VIP 라운지 무료 입장
  const BADGES = {
    first: {e: '🥉', name: '첫 승리', how: '친구와 함께한 판에서 처음 1등', need: (s) => [s.wins || 0, 1]},
    win10: {e: '🥈', name: '10승', how: '1등 10번', need: (s) => [s.wins || 0, 10]},
    win50: {e: '🏅', name: '50승', how: '1등 50번', vip: true, need: (s) => [s.wins || 0, 50]},
    win100: {e: '🎖️', name: '100승', how: '1등 100번', need: (s) => [s.wins || 0, 100]},
    champ: {e: '🏆', name: '우승자', how: '3명 이상 토너먼트·서바이벌·리그 우승', vip: true, need: (s) => [s.champs || 0, 1]},
    champ3: {e: '💎', name: '3회 우승', how: '우승 3번', need: (s) => [s.champs || 0, 3]},
    mvp: {e: '👑', name: 'MVP', how: '우승 5번 또는 1등 200번', vip: true, need: (s) => [Math.max((s.champs || 0) * 40, s.wins || 0), 200]},
    friend5: {e: '🤝', name: '인싸', how: '친구 5명 사귀기', need: () => [(social().friends || []).length, 5]},
    attend7: {e: '📅', name: '개근상', how: '비서 데스크 출석 7번', need: (s) => [s.attend || 0, 7]},
    vip: {e: '💜', name: 'VIP 회원', how: 'VIP 입장권 구매', need: () => [0, 1]},
    patron: {e: '💐', name: '비서의 단골', how: '비서에게 스킨 선물하기', need: () => [0, 1]},
  };
  const BADGE_ORDER = ['mvp', 'champ3', 'champ', 'win100', 'win50', 'win10', 'first'];
  const badgeIcons = (list) => { const top = BADGE_ORDER.filter((b) => (list || []).includes(b)).slice(0, 2).map((b) => BADGES[b].e).join(''); return top ? top + ' ' : ''; }; // 이름 앞엔 대표 뱃지 2개만
  // 내 방 뱃지 진열장: 벽에 건 유리 장식장, 칸마다 메달 (없는 뱃지는 흐린 물음표)
  const showcaseSlots = [];
  (function showcase() {
    const z = ZONES.find((x) => x.showcase), g = new THREE.Group(); g.position.set(z.pos[0], 0, z.pos[1]); scene.add(g);
    box(4.2, 2.6, 0.35, mats.wood, 0, 1.75, 0, g); box(4.0, 2.4, 0.05, M(0x241a12, {roughness: 0.8}), 0, 1.75, 0.16, g);
    for (let r = 0; r < 2; r++) box(4.0, 0.06, 0.3, mats.gold, 0, 0.98 + r * 1.15, 0.05, g);
    const gl = box(4.0, 2.4, 0.03, new THREE.MeshPhysicalMaterial({color: 0xcfe3ff, transparent: true, opacity: 0.12, roughness: 0.05}), 0, 1.75, 0.34, g); gl.castShadow = false;
    const ids = Object.keys(BADGES);
    ids.forEach((id, i) => { const row = i < 6 ? 0 : 1, col = row ? i - 6 : i, n = row ? ids.length - 6 : 6;
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.26, 32), new THREE.MeshBasicMaterial({map: tex, transparent: true, toneMapped: false}));
      m.position.set((col - (n - 1) / 2) * 0.62, 2.62 - row * 1.15 - 0.3, 0.2); g.add(m); showcaseSlots.push({id, cv, tex, m}); });
    const sign = neon('🏅 뱃지 진열장', '#f7ce55', 2.6); sign.position.set(0, 3.5, 0.2); g.add(sign); z.sign = sign;
    registerClick(g, z);
  })();
  const SC_HOME = [0, -10.3, 0];
  function placeShowcase(sc) { const z = ZONES.find((x) => x.showcase); if (!z || !z.group) return; const [x, zz, r] = Array.isArray(sc) && sc.length === 3 ? sc : SC_HOME;
    z.group.position.set(x, 0, zz); z.group.rotation.y = fromQ(snapQ(r)); z.pos = [x, zz]; }
  let placingSc = false;
  function drawShowcase(have) {
    for (const sl of showcaseSlots) { const x = sl.cv.getContext('2d'), on = (have || []).includes(sl.id); x.clearRect(0, 0, 128, 128);
      x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fillStyle = on ? '#f7ce55' : '#3a3f52'; x.fill(); x.beginPath(); x.arc(64, 64, 48, 0, Math.PI * 2); x.fillStyle = on ? '#fff6d8' : '#262a38'; x.fill();
      x.font = `${on ? 58 : 48}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.globalAlpha = on ? 1 : 0.35; x.fillStyle = '#8a90a6'; x.fillText(on ? BADGES[sl.id].e : '?', 64, 70); x.globalAlpha = 1; sl.tex.needsUpdate = true; }
  }
  // 내 방 문: 왼쪽 벽에 달린 나무 문. 라운지에선 '내 방', 내 방에선 '라운지로' (걸어가서 문을 열고 들어가요)
  (function doorG() {
    const z = ZONES.find((x) => x.door), g = new THREE.Group(); g.position.set(-ROOM + 0.12, 0, z.pos[1]); g.rotation.y = Math.PI / 2; scene.add(g);
    box(1.9, 3.1, 0.18, mats.gold, 0, 1.55, 0, g); box(1.7, 2.95, 0.2, M(0x2a1d14), 0, 1.5, 0.01, g);
    const hinge = new THREE.Group(); hinge.position.set(-0.8, 0, 0.12); g.add(hinge); z.leaf = hinge;
    const leaf = box(1.6, 2.85, 0.1, M(0xb07a4a, {roughness: 0.55}), 0.8, 1.45, 0, hinge);
    for (const [y, h] of [[2.2, 0.9], [0.9, 1.1]]) { const pnl = box(1.1, h, 0.04, M(0x9a6438, {roughness: 0.6}), 0.8, y, 0.06, hinge); pnl.castShadow = false; }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), mats.gold); knob.position.set(1.38, 1.4, 0.12); hinge.add(knob);
    const plate = box(0.9, 0.28, 0.03, M(0xfff6d8, {emissive: 0xf7ce55, emissiveIntensity: 0.25}), 0.8, 2.55, 0.09, hinge); plate.castShadow = false;
    const mat = cyl(0.9, 0.9, 0.02, M(0x9b1b30, {roughness: 0.95}), 0, 0.012, 1.0, 28, g); mat.scale.z = 0.55;
    const l = new THREE.PointLight(0xffd59a, 0.5, 4, 2); l.position.set(0, 3.2, 0.6); g.add(l);
    const sign = neon('🏠 내 방', '#f7ce55', 2.2); sign.position.set(0, 3.75, 0.2); g.add(sign); z.sign = sign;
    registerClick(g, z);
  })();
  function openDoor(then) { const z = ZONES.find((x) => x.door); if (!z || !z.leaf) return then && then(); let k = 0; const step = () => { k += 0.08; z.leaf.rotation.y = -Math.sin(Math.min(1, k) * Math.PI / 2) * 1.4; if (k < 1) requestAnimationFrame(step); else setTimeout(() => { then && then(); z.leaf.rotation.y = 0; }, 150); }; step(); }
  // 화분 · 스탠드 조명 장식
  function plant(x, z, s = 1) { cyl(0.32 * s, 0.25 * s, 0.6 * s, mats.pot, x, 0.3 * s, z, 20); for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, 16, 12), mats.plant); l.position.set(x + Math.cos(i * 1.3) * 0.22 * s, (0.95 + (i % 3) * 0.22) * s, z + Math.sin(i * 1.3) * 0.22 * s); l.scale.y = 1.3; l.castShadow = true; scene.add(l); } }
  plant(-9.8, -9.8, 1.4); plant(9.6, -9.6, 1.2); plant(-9.8, 9.2, 1.1); plant(3.6, -9.6, 0.9); plant(-3.6, -9.6, 0.9);
  function floorLamp(x, z) { cyl(0.2, 0.25, 0.05, mats.gold, x, 0.03, z, 16); cyl(0.03, 0.03, 2.2, mats.gold, x, 1.1, z, 8); const shade = cyl(0.25, 0.4, 0.4, M(0xfff1d6, {emissive: 0xffd28a, emissiveIntensity: 0.7}), x, 2.3, z, 20); const l = new THREE.PointLight(0xffc874, 0.5, 6, 2); l.position.set(x, 2.1, z); scene.add(l); }
  floorLamp(-9.6, -3.2); floorLamp(9.6, 4.8);

  // ───────── 캐릭터 ─────────
  const labels = $('labels');
  for (const z of ZONES) z.group = z.sign && z.sign.parent; // 라운지 ↔ 내 방 전환 때 통째로 숨기고 보여요
  const LOUNGE_OBST = ZONES.filter((z) => z.games || z.main || z.vip).map((z) => ({x: z.pos[0], z: z.pos[1], r: z.main ? 2.0 : z.vip ? 1.1 : 1.55})); // 캐릭터가 못 지나가는 테이블 (원)
  const OBST = [...LOUNGE_OBST];
  // 테이블을 뚫지 않고 가장자리를 따라 돌아가요. 도는 방향은 부딪힌 순간 한 번만 정해서 (매 프레임 바뀌면 제자리에서 떨어요)
  function avoid(p, pos, dx, dz, step) {
    for (const o of OBST) {
      const ox = pos.x - o.x, oz = pos.z - o.z, od = Math.hypot(ox, oz); if (od >= o.r) continue;
      const nx = od > 1e-3 ? ox / od : 1, nz = od > 1e-3 ? oz / od : 0;
      const t = p.target; if (t && (t.side == null || t.ob !== o)) { const c = nx * dz - nz * dx; t.side = Math.abs(c) < 0.05 * Math.hypot(dx, dz) ? 1 : Math.sign(c); t.ob = o; }
      const side = t ? t.side : 1;
      pos.x = o.x + nx * o.r - nz * side * step; pos.z = o.z + nz * o.r + nx * side * step;
    }
  }
  const players = new Map(); // pid -> {av, name, tag, bubble, pos, target, state, bubbleTimer, exprTimer}
  let lookAtSpeaker = null; // 최근에 말한 사람 → 다른 캐릭터들이 그쪽을 봐요
  function makeTag(text, cls) { const el = document.createElement('div'); el.className = 'name-tag ' + (cls || ''); el.textContent = text; labels.appendChild(el); return el; }
  function makeBubble() { const el = document.createElement('div'); el.className = 'bubble'; labels.appendChild(el); return el; }
  function spawn(id, name, look, x = 0, z = 3, isMe = false) {
    const av = A.buildAvatar(typeof look === 'string' ? A.decodeLook(look) : look);
    av.position.set(x, 0, z); av.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(av);
    const p = {id, av, name, look: typeof look === 'string' ? look : A.encodeLook(look), tag: makeTag(name, isMe ? 'me' : ''), bubble: makeBubble(), target: null, state: 'idle', phase: Math.random() * 5, isMe};
    players.set(id, p); return p;
  }
  function despawn(id) { const p = players.get(id); if (!p) return; scene.remove(p.av); p.tag.remove(); p.bubble.remove(); players.delete(id); }
  // 이름을 안 정한 사람은 모두 '나'로 보여서 헷갈렸어요 → 처음 들어올 때 '손님 NN' 같은 이름을 하나 정해 저장해요
  const NAME_POOL = ['여우', '수달', '판다', '고양이', '펭귄', '다람쥐', '토끼', '부엉이', '돌고래', '햄스터', '알파카', '코알라'];
  function myName() {
    const p = profile(); let n = (p.nickname || '').trim();
    if (!n || n === '나') { n = `${NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]}${Math.floor(Math.random() * 90) + 10}`; p.nickname = n; store.set(PROFILE_KEY, p); firstName = true; }
    return n;
  }
  let firstName = false;
  const otherName = (p) => (p.pid === ME ? myName() : (!p.name || p.name === '나' || p.name === '플레이어') ? `손님${String(p.pid || '').replace(/[^0-9]/g, '').slice(-2) || ''}` : p.name);
  // 게임에서 돌아오면 그 게임 테이블 앞에 서요 (?back=게임&won=번 칩)
  const backQ = new URLSearchParams(location.search), backGame = backQ.get('back'), backWon = Math.max(0, Math.min(999, Number(backQ.get('won')) || 0));
  const backZone = backGame ? (ZONES.find((z) => z.games && z.games.includes(backGame)) || (CFG.PARTY.some((g) => g.id === backGame) ? ZONES.find((z) => z.party) : null)) : null;
  if (backGame) { backQ.delete('back'); backQ.delete('won'); try { history.replaceState(null, '', location.pathname + (backQ.toString() ? `?${backQ}` : '')); } catch (e) {} }
  const startAt = backZone ? [backZone.pos[0] * 0.72, backZone.pos[1] * 0.72 + 0.4] : [(Math.random() - 0.5) * 5, 6 + Math.random() * 2];
  let me = spawn(ME, myName(), mine.look, startAt[0], startAt[1], true);
  if (backZone) setTimeout(() => { const g = GAME[backGame]; toast(backWon ? `${g ? g.title : '게임'} 끝! +${backWon} 씽크칩 🎉` : `${backZone.title}에서 돌아왔어요`); setExpr(me, backWon ? 'laugh' : 'happy'); }, 1200);
  if (firstName) setTimeout(() => toast(`'${myName()}' 으로 입장했어요 · 비서 데스크에서 이름을 바꿀 수 있어요`), 2500);
  try { localStorage.setItem('thinkchip:look', A.encodeLook(mine.look)); } catch (e) {} // 메인 앱 실시간 방에서도 이 모습으로
  const npcTag = makeTag('비서 · 미소', 'npc');

  function say(p, text) {
    if (!p) return;
    p.bubble.textContent = String(text).replace(JOIN_RE, '👉 같이 하기').slice(0, 70); p.bubble.classList.add('show');
    p.bubbleUntil = simT + 6; if (!p.id) setTimeout(() => p.bubble.classList.remove('show'), 6000); // 비서처럼 players 밖의 말풍선 // 시간은 화면 시간(simT)으로 재요 — 영상 녹화(수동 프레임)에서도 똑같이 보이게
    if (p.id) lookAtSpeaker = {id: p.id, av: p.av, at: simT};
    const expr = A.exprFromText(text); if (expr) setExpr(p, expr);
  }
  function setExpr(p, expr, ms = 5000) {
    p.av.userData.face.set(expr); p.mood = expr === 'laugh' || expr === 'happy' ? 'cheer' : expr === 'hmm' ? 'think' : null;
    p.exprUntil = simT + ms / 1000;
  }
  function walkTo(p, x, z, then) {
    for (const o of OBST) { const ox = x - o.x, oz = z - o.z, od = Math.hypot(ox, oz); if (od < o.r + 0.1) { const k = (o.r + 0.1) / (od || 1); x = o.x + (od ? ox : 1) * k; z = o.z + (od ? oz : 0) * k; } } // 테이블 한가운데를 찍으면 가장자리까지만
    const lim = ROOM - 1.2; p.target = {x: Math.max(-lim, Math.min(lim, x)), z: Math.max(-lim, Math.min(lim, z)), then}; if (!p.keepAct) p.act = null;
  }

  // ───────── 친구 손인사 (영화 속 비밀 악수처럼: 하이파이브 → 손바닥 → 손등 → 로우파이브 → 주먹 → 펑!) ─────────
  // a 의 오른손은 마주 선 b 의 왼손과 같은 쪽이라, (a.r, b.l) / (a.l, b.r) 짝으로 부딪혀요. 값 = 어깨 회전 [앞뒤, 옆]
  const HS_BEAT = 0.42, HS_GAP = 1.05;
  const HS_BEATS = [
    {a: {r: [-2.65, 0], l: [-2.65, 0]}, b: {r: [-2.65, 0], l: [-2.65, 0]}, hit: [['r', 'l'], ['l', 'r']], big: true}, // 양손 하이파이브
    {a: {r: [-1.45, 0]}, b: {l: [-1.45, 0]}, hit: [['r', 'l']]}, // 손바닥
    {a: {l: [-1.45, 0]}, b: {r: [-1.45, 0]}, hit: [['l', 'r']]}, // 손등
    {a: {r: [-1.45, 0]}, b: {l: [-1.45, 0]}, hit: [['r', 'l']]}, // 다시 손바닥
    {a: {r: [-0.7, 0], l: [-0.7, 0]}, b: {r: [-0.7, 0], l: [-0.7, 0]}, hit: [['r', 'l'], ['l', 'r']]}, // 로우파이브
    {a: {r: [-1.55, 0]}, b: {l: [-1.55, 0]}, hit: [['r', 'l']], fist: true}, // 주먹 맞대기
    {a: {r: [-2.8, -0.75], l: [-2.8, 0.75]}, b: {r: [-2.8, -0.75], l: [-2.8, 0.75]}, boom: true}, // 펑! 양팔 활짝
  ];
  let hs = null; // {a, b, t0, stage: 'go'|'dance', beat}
  const sparks = [];
  const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.translate(32, 32);
    x.strokeStyle = '#fff6c9'; x.lineCap = 'round'; for (let i = 0; i < 8; i++) { x.lineWidth = i % 2 ? 3 : 5; x.beginPath(); x.moveTo(0, 7); x.lineTo(0, i % 2 ? 22 : 29); x.stroke(); x.rotate(Math.PI / 4); }
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 12); g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(247,206,85,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 12, 0, Math.PI * 2); x.fill();
    return new THREE.CanvasTexture(c); })();
  function spark(at, big) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: sparkTex, color: big ? 0xffe9a0 : 0xffffff, transparent: true, depthWrite: false, depthTest: false}));
    sp.position.copy(at); sp.renderOrder = 10; scene.add(sp); sparks.push({sp, t: 0, size: big ? 1.1 : 0.7});
    clap(big);
  }
  let audio = null;
  function clap(big) { // 짧은 '짝' 소리 (소리를 낼 수 없는 환경이면 조용히 넘어가요)
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume();
      const n = Math.floor(audio.sampleRate * 0.09), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, big ? 3 : 5);
      const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain(); f.type = 'bandpass'; f.frequency.value = big ? 1500 : 2200; g.gain.value = big ? 0.55 : 0.4;
      src.buffer = buf; src.connect(f); f.connect(g); g.connect(audio.destination); src.start(); } catch (e) {}
  }
  function startHandshake(idA, idB) {
    const a = players.get(idA), b = players.get(idB); if (!a || !b || a === b) return false;
    if (hs) endHandshake();
    const pa = a.av.position, pb = b.av.position, dx = pb.x - pa.x, dz = pb.z - pa.z, d = Math.hypot(dx, dz) || 1, mx = (pa.x + pb.x) / 2, mz = (pa.z + pb.z) / 2;
    hs = {a, b, t0: simT, stage: 'go', beat: -1}; a.hs = b.hs = hs;
    walkTo(a, mx - (dx / d) * HS_GAP / 2, mz - (dz / d) * HS_GAP / 2); walkTo(b, mx + (dx / d) * HS_GAP / 2, mz + (dz / d) * HS_GAP / 2);
    if (a === me || b === me) sendPose();
    return true;
  }
  function endHandshake() { if (!hs) return; for (const p of [hs.a, hs.b]) { p.hs = null; p.av.userData.armPose = null; } hs = null; }
  function stepHandshake(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t += dt; const k = s.t / 0.35; s.sp.scale.setScalar(s.size * (0.4 + k)); s.sp.material.opacity = Math.max(0, 1 - k); s.sp.material.rotation = k;
      if (k >= 1) { scene.remove(s.sp); s.sp.material.dispose(); sparks.splice(i, 1); } }
    if (!hs) return;
    const {a, b} = hs;
    if (!players.has(a.id) || !players.has(b.id)) return endHandshake();
    if (hs.stage === 'go') { if ((!a.target && !b.target) || simT - hs.t0 > 3.5) { a.target = b.target = null; hs.stage = 'dance'; hs.t1 = simT; } else return; }
    for (const [p, q] of [[a, b], [b, a]]) { // 서로 마주 보기
      let diff = Math.atan2(q.av.position.x - p.av.position.x, q.av.position.z - p.av.position.z) - p.av.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); p.av.rotation.y += diff * Math.min(1, dt * 12); }
    const el = simT - hs.t1 - 0.25; if (el < 0) return; // 마주 보고 잠깐 숨 고르기
    const i = Math.floor(el / HS_BEAT), f = el / HS_BEAT - i;
    if (i >= HS_BEATS.length) { if (el > HS_BEATS.length * HS_BEAT + 0.5) endHandshake(); return; }
    const B = HS_BEATS[i], w = f < 0.55 ? 1 : 1 - 0.4 * ((f - 0.55) / 0.45); // 뻗었다가 부딪힌 뒤 살짝 거두기
    const scale = (pose) => { const o = {}; for (const k in pose) o[k] = [pose[k][0] * w, pose[k][1] * w]; return o; };
    a.av.userData.armPose = scale(B.a); b.av.userData.armPose = scale(B.b);
    if (f >= 0.5 && hs.beat !== i) { hs.beat = i; // 부딪히는 순간
      if (B.boom) { for (const p of [a, b]) { setExpr(p, 'laugh', 2500); p.av.position.y = 0; } const at = a.av.position.clone().lerp(b.av.position, 0.5); at.y = 2.6; spark(at, true); setTimeout(() => spark(at.clone().add(new THREE.Vector3(0.3, -0.3, 0)), true), 90); }
      else for (const [sa, sb] of B.hit) { const pa = A.handWorld(a.av, sa), pb = A.handWorld(b.av, sb); if (pa && pb) spark(pa.lerp(pb, 0.5), B.big || B.fist); }
    }
  }
  // 손인사 신호: 채팅으로 [[hs:a,b]] 를 보내면 같은 라운지의 모두가 두 캐릭터의 손인사를 봐요
  const HS_RE = /^\[\[hs:([a-zA-Z0-9_-]{1,32}),([a-zA-Z0-9_-]{1,32})\]\]$/;
  // ───────── 리액션: 캐릭터에게 다가가서 누르면 하트·장미·박수·야유 ─────────
  const RX = {heart: {e: '❤️', label: '하트', expr: 'happy', say: '💕'}, rose: {e: '🌹', label: '장미', expr: 'wink', say: '🌹'}, clap: {e: '👏', label: '박수', expr: 'laugh', say: '👏👏'},
    boo: {e: '👎', label: '우우~', expr: 'angry', say: '우우우~'}, lol: {e: '😂', label: 'ㅋㅋㅋ', expr: 'laugh', say: 'ㅋㅋㅋ'}};
  const RX_RE = /^\[\[rx:([a-zA-Z0-9_-]{1,32}),([a-zA-Z0-9_-]{1,32}),([a-z]{2,8})\]\]$/;
  let rxTarget = null, rxLast = 0;
  const rxBar = document.createElement('div'); rxBar.className = 'rx-bar'; rxBar.hidden = true; labels.appendChild(rxBar);
  function approachFor(p) {
    const a = me.av.position, b = p.av.position, d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > 2.6) { const k = (d - 1.6) / d; walkTo(me, a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, () => showRx(p)); sendPose(); toast(`${p.name}님에게 다가가는 중…`); }
    else showRx(p);
  }
  function showRx(p) {
    if (!players.has(p.id)) return; rxTarget = p; rxBar.hidden = false;
    const fr = loggedIn() && (social().friends || []).some((f) => f.pid === p.id), canAdd = loggedIn() && !fr && !(social().pending || []).includes(p.id);
    rxBar.innerHTML = `<b>${esc(p.name)}</b><div>${Object.entries(RX).map(([k, r]) => `<button data-rx="${k}" aria-label="${r.label}">${r.e}<small>${r.label}</small></button>`).join('')}${fr ? '<button data-rx-hs="1">🤝<small>손인사</small></button>' : ''}${canAdd ? '<button data-rx-add="1">👥<small>친구</small></button>' : ''}</div>`;
    clearTimeout(showRx.t); showRx.t = setTimeout(hideRx, 9000);
  }
  function hideRx() { rxTarget = null; rxBar.hidden = true; clearTimeout(showRx.t); }
  rxBar.addEventListener('pointerdown', (e) => e.stopPropagation());
  rxBar.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || !rxTarget) return; const p = rxTarget;
    clearTimeout(showRx.t); showRx.t = setTimeout(hideRx, 9000);
    if (b.dataset.rxHs) { hideRx(); return requestHandshake(p.id); }
    if (b.dataset.rxAdd) { try { const r = await ACC.call('request', {to: p.id}); toast(r.ok ? (r.friends.some((f) => f.pid === p.id) ? '친구가 됐어요! 🎉' : '친구 신청을 보냈어요') : socialMsg(r.error)); if (r.ok && r.friends.some((f) => f.pid === p.id)) celebrate(p.id); } catch (er) { toast('인터넷 연결을 확인해 주세요'); } return showRx(p); }
    const k = b.dataset.rx; if (!RX[k]) return;
    if (Date.now() - rxLast < 900) return; rxLast = Date.now(); // 연타 방지
    if (!conn || conn.readyState !== 1) { playRx(ME, p.id, k); return; } // 오프라인이면 나만 봐요
    sendChat(`[[rx:${ME},${p.id},${k}]]`);
  });
  // 날아가는 이모지: 보내는 사람 머리 위 → 받는 사람 머리 위로 포물선, 도착하면 톡 터져요
  const emojiTex = {};
  function emojiSprite(ch) {
    if (!emojiTex[ch]) { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); x.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 48, 54); emojiTex[ch] = new THREE.CanvasTexture(c); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: emojiTex[ch], transparent: true, depthWrite: false})); sp.renderOrder = 9; scene.add(sp); return sp;
  }
  const flyers = [];
  function playRx(fromId, toId, k) {
    const a = players.get(fromId), b = players.get(toId), r = RX[k]; if (!a || !b || !r) return;
    if (k === 'rose') return playRose(a, b);
    const n = k === 'heart' ? 5 : k === 'boo' ? 3 : 3;
    for (let i = 0; i < n; i++) { const sp = emojiSprite(r.e); sp.scale.setScalar(0.01); flyers.push({sp, a, b, t: -i * 0.12, dur: 0.85 + Math.random() * 0.25, side: (Math.random() - 0.5) * 1.4, k}); }
    if (k === 'boo') { a.av.userData.armPose = {r: [-1.2, 0], l: [-1.2, 0]}; setTimeout(() => { if (!a.hs) a.av.userData.armPose = null; }, 900); }
    else { a.av.userData.armPose = {r: [-2.3, 0]}; setTimeout(() => { if (!a.hs) a.av.userData.armPose = null; }, 700); } // 던지는 손짓
    setTimeout(() => { if (!players.has(b.id)) return; setExpr(b, r.expr, 3500); say(b, r.say); }, 900);
    if (fromId === ME || toId === ME) chatLine('', `${fromId === ME ? '나' : otherName({pid: a.id, name: a.name})} → ${toId === ME ? '나' : otherName({pid: b.id, name: b.name})} ${r.e} ${r.label}`, true);
  }
  // 장미: 상대를 바라보고 한쪽 무릎을 꿇은 채 장미를 내밀었다가 → 장미가 날아가 안기고 → 일어나요
  function playRose(a, b) {
    clearTimeout(a.roseT); a.target = null;
    a.av.rotation.y = Math.atan2(b.av.position.x - a.av.position.x, b.av.position.z - a.av.position.z);
    a.av.userData.kneel = true; a.kneelUntil = simT + 2.6; a.av.userData.armPose = {r: [-1.5, 0.15]}; setExpr(a, 'wink', 3000);
    const sp = emojiSprite('🌹'); sp.scale.setScalar(0.42); flyers.push({sp, a, b, t: -1.3, dur: 1.0, side: 0.25, k: 'rose', hold: true});
    a.roseT = setTimeout(() => { a.av.userData.kneel = false; if (!a.hs) a.av.userData.armPose = null; }, 2600);
    setTimeout(() => { if (!players.has(b.id)) return; setExpr(b, 'happy', 4000); say(b, '🌹💕'); }, 2300);
    if (a.id === ME || b.id === ME) chatLine('', `${a.id === ME ? '나' : otherName({pid: a.id, name: a.name})} → ${b.id === ME ? '나' : otherName({pid: b.id, name: b.name})} 🌹 무릎 꿇고 장미`, true);
  }
  const handV = new THREE.Vector3();
  function stepFlyers(dt) {
    for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt; if (f.t < 0) { if (f.hold) { const h = A.handWorld(f.a.av, 'r', handV); if (h) f.sp.position.set(h.x, h.y + 0.25, h.z); } continue; }
      const u = Math.min(1, f.t / f.dur), pa = f.a.av.position, pb = f.b.av.position;
      if (!players.has(f.a.id) || !players.has(f.b.id) || u >= 1) { if (u >= 1 && players.has(f.b.id)) { const at = pb.clone(); at.y = 2.4; spark(at, f.k === 'heart'); } scene.remove(f.sp); f.sp.material.dispose(); flyers.splice(i, 1); continue; }
      const dx = pb.x - pa.x, dz = pb.z - pa.z, len = Math.hypot(dx, dz) || 1;
      f.sp.position.set(pa.x + dx * u + (-dz / len) * f.side * Math.sin(u * Math.PI) * 0.5, 2.3 + Math.sin(u * Math.PI) * (f.k === 'boo' ? 0.4 : 1.3), pa.z + dz * u + (dx / len) * f.side * Math.sin(u * Math.PI) * 0.5);
      f.sp.scale.setScalar(0.35 + 0.35 * Math.sin(Math.min(1, u * 3) * Math.PI / 2)); }
    if (rxTarget) { if (!players.has(rxTarget.id) || Math.hypot(rxTarget.av.position.x - me.av.position.x, rxTarget.av.position.z - me.av.position.z) > 5) hideRx(); else project({x: rxTarget.av.position.x, z: rxTarget.av.position.z}, 3.55, rxBar); }
  }

  function requestHandshake(pid) {
    if (!players.has(pid)) return toast('같은 라운지에 있을 때만 손인사할 수 있어요');
    if (!conn || conn.readyState !== 1) return toast('연결된 뒤에 할 수 있어요');
    sendChat(`[[hs:${ME},${pid}]]`);
  }

  // ───────── 카메라 (내 캐릭터를 따라감, 드래그로 회전, 핀치/휠로 확대) ─────────
  const camState = {yaw: Math.PI / 4, pitch: 0.82, dist: 15, focus: new THREE.Vector3(0, 1, 2), closeUp: false, pan: new THREE.Vector3()};
  let booth = null; // 📸 인생네컷 촬영 중일 때 {center, yaw, dist}. placeCamera 가 시작할 때부터 쓰므로 여기서 선언해요
  function placeCamera(snap) {
    if (booth) return boothCamera(); // 📸 인생네컷 촬영 중
    // 카메라는 내 캐릭터를 중심으로 돌아요 (두 손가락으로 옮긴 만큼 pan)
    const want = camState.closeUp ? new THREE.Vector3(me.av.position.x, 1.35, me.av.position.z) : new THREE.Vector3(me.av.position.x + camState.pan.x, 1, me.av.position.z + camState.pan.z);
    camState.focus.lerp(want, snap ? 1 : 0.08);
    const sheetCover = camState.closeUp && !$('sheet').hidden ? Math.min($('sheet').getBoundingClientRect().height, innerHeight * 0.6) : 0, d = camState.closeUp ? 7.2 * Math.max(1, Math.min(2.4, innerHeight / Math.max(1, innerHeight - sheetCover))) * 0.82 : camState.dist, pitch = camState.closeUp ? 0.22 : camState.pitch, yaw = camState.closeUp ? (camState.closeBase || 0) + (camState.closeYaw || 0) : camState.yaw;
    camera.position.set(camState.focus.x + Math.sin(yaw) * Math.cos(pitch) * d, camState.focus.y + Math.sin(pitch) * d, camState.focus.z + Math.cos(yaw) * Math.cos(pitch) * d);
    camera.lookAt(camState.focus.x, camState.focus.y + (camState.closeUp ? -0.15 : 0), camState.focus.z);
    if (scene.fog) { scene.fog.near = d + 14; scene.fog.far = d + 70; } // 멀리서 볼 때(축소) 안개 때문에 화면이 어두워지지 않게 카메라 거리만큼 밀어요
    // 드레스룸·방 꾸미기 창이 아래를 가리면, 그만큼 화면을 위로 밀어서 캐릭터가 창 위 빈 곳 가운데 오게
    const sheetEl = $('sheet'), cover = !sheetEl.hidden ? sheetEl.getBoundingClientRect().height : 0, offY = (camState.closeUp || sheetEl.classList.contains('closet')) ? Math.min(cover, innerHeight * 0.6) / 2 : 0;
    if (offY !== camState.offY) { camState.offY = offY; if (offY) camera.setViewOffset(innerWidth, innerHeight, 0, offY, innerWidth, innerHeight); else camera.clearViewOffset(); }
  }
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < h ? 50 : 36; camState.dist = w < h ? 27 : 22; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize(); placeCamera(true);

  // 입력: 탭 = 이동/선택, 드래그 = 회전, 핀치/휠 = 확대
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pointers = new Map();
  // 한 손가락: 캐릭터를 중심으로 시점 돌리기(좌우) · 기울이기(위아래) / 두 손가락: 벌리고 오므려 확대·축소 + 같이 밀면 화면을 옆으로 옮기기
  let drag = null, pinch0 = 0, dist0 = 0, mid0 = null;
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gHit = new THREE.Vector3();
  function groundAt(cx, cy) { ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(groundPlane, gHit) ? gHit.clone() : null; }
  const midOf = () => { const [a, b] = [...pointers.values()]; return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y)}; };
  canvas.addEventListener('pointerdown', (e) => { try { canvas.setPointerCapture?.(e.pointerId); } catch (er) {} pointers.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (pointers.size === 1) drag = {x: e.clientX, y: e.clientY, yaw: camState.yaw, pitch: camState.pitch, cy: camState.closeYaw || 0, moved: false}; if (pointers.size === 2) { const m = midOf(); pinch0 = m.d; dist0 = camState.dist; mid0 = m; drag = null; } });
  canvas.addEventListener('pointermove', (e) => { if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.size >= 2) { const m = midOf();
      // 확대·축소: 손가락 사이가 10% 넘게 벌어지거나 오므려졌을 때만 (옮기는 중에 화면이 출렁이지 않게)
      if (mid0 && (mid0.zoom || Math.abs(m.d / Math.max(1, pinch0) - 1) > 0.1)) { mid0.zoom = true; camState.dist = Math.max(9, Math.min(34, dist0 * (pinch0 / Math.max(1, m.d)))); }
      // 옮기기: 두 손가락이 짚은 바닥 지점이 손가락을 그대로 따라오게 (시점은 그대로)
      if (mid0 && !camState.closeUp) { const a = groundAt(mid0.x, mid0.y), b = groundAt(m.x, m.y);
        if (a && b) { const dx = a.x - b.x, dz = a.z - b.z; camState.pan.x += dx; camState.pan.z += dz; camState.focus.x += dx; camState.focus.z += dz;
          const len = Math.hypot(camState.pan.x, camState.pan.z); if (len > 16) { camState.pan.x *= 16 / len; camState.pan.z *= 16 / len; } placeCamera(false); } }
      mid0 = Object.assign(m, {zoom: mid0 && mid0.zoom}); return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 6) drag.moved = true; if (drag.moved && camState.closeUp) camState.closeYaw = drag.cy - dx * 0.01; // 꾸미는 중엔 캐릭터 둘레를 돌며 보기
      if (drag.moved && !camState.closeUp) { camState.yaw = drag.yaw - dx * 0.007; camState.pitch = Math.max(0.1, Math.min(1.4, drag.pitch + dy * 0.005)); } } }); // 좌우로 밀면 회전, 위아래로 밀면 눕혀 보기·내려다보기
  const up = (e) => { const wasTap = drag && !drag.moved && pointers.size === 1; pointers.delete(e.pointerId); if (wasTap) onTap(e.clientX, e.clientY); if (pointers.size < 2) mid0 = null; if (pointers.size === 0) drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); camState.dist = Math.max(9, Math.min(34, camState.dist + e.deltaY * 0.01)); }, {passive: false});
  function onTap(cx, cy) {
    hideHint(); if (me.hs) endHandshake();
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    // 다른 캐릭터를 누르면: 다가가서 하트·박수·야유 같은 리액션을 보낼 수 있어요
    const others = [...players.values()].filter((p) => p !== me), ph = ray.intersectObjects(others.map((p) => p.av), true)[0];
    if (ph) { let o = ph.object; while (o && !others.some((p) => p.av === o)) o = o.parent; const who = others.find((p) => p.av === o); if (who) { approachFor(who); return; } }
    hideRx(); camState.pan.set(0, 0, 0); // 걸어가면 다시 내 캐릭터 중심으로 (손인사 중에 바닥을 누르면 멈추고 걸어가요)
    const hit = ray.intersectObjects(clickables.filter((o) => o.userData.zone.group?.visible !== false), false)[0];
    if (hit) { const zz = hit.object.userData.zone; if (!zz.furn) { goToZone(zz); return; } if (!placingSc) return openFurniture(zz.furn); }
    const fh = ray.intersectObject(floor, false)[0];
    if (placingSc && fh) { const what = placingSc; placingSc = false; const x = Math.round(Math.max(-9.9, Math.min(9.9, fh.point.x)) * 10) / 10, z = Math.round(Math.max(-10.3, Math.min(9.9, fh.point.z)) * 10) / 10;
      if (what === true) { const cur = myRoom.deco.sc || SC_HOME; myRoom.deco.sc = [x, z, cur[2] || 0]; placeShowcase(myRoom.deco.sc); }
      else { const lay = myRoom.deco.lay = myRoom.deco.lay || {}, g = furniture[what], cur = lay[what] || g.userData.home; lay[what] = [x, z, cur[2]]; placeFurniture(lay); }
      saveRoomLayout(); toast('📍 옮겼어요'); return; }
    if (fh) { walkTo(me, fh.point.x, fh.point.z); sendPose(); }
  }
  // 게임으로 들어갈 때: 내 캐릭터가 폴짝 뛰고 화면이 라운지 색으로 덮인 뒤 넘어가요 (뚝 끊기지 않게)
  function enterGame(url) { let v = $('veil'); if (!v) { v = document.createElement('div'); v.id = 'veil'; v.className = 'veil'; v.innerHTML = '<div class="veil-mark">⬡</div><b>게임 테이블에 앉는 중…</b>'; document.body.appendChild(v); }
    try { setExpr(me, 'happy'); } catch (e) {} requestAnimationFrame(() => v.classList.add('show')); setTimeout(() => { location.href = url; }, 380); }
  window.addEventListener('pageshow', (e) => { if (e.persisted) { const v = $('veil'); if (v) v.classList.remove('show'); } });
  function goToZone(zone, then) {
    const [x, z] = zone.pos, toMe = Math.atan2(me.av.position.x - x, me.av.position.z - z);
    const r = zone.main ? 2.8 : zone.party ? 2.6 : 2.3;
    walkTo(me, x + Math.sin(toMe) * r, z + Math.cos(toMe) * r, then || (() => openZone(zone))); sendPose();
  }

  // ───────── 루프 ─────────
  const clock = new THREE.Clock(), v3 = new THREE.Vector3();
  function project(obj, y, el) {
    v3.set(obj.x, y, obj.z).project(camera);
    if (v3.z > 1) { el.style.display = 'none'; return; }
    el.style.display = ''; el.style.left = ((v3.x + 1) / 2) * innerWidth + 'px'; el.style.top = ((1 - v3.y) / 2) * innerHeight + 'px';
  }
  let simT = 0, manual = false;
  function tick() {
    if (manual) return; // 녹화 모드: __lounge.step() 이 한 프레임씩 그려요
    requestAnimationFrame(tick);
    frame(Math.min(0.05, clock.getDelta()));
  }
  function frame(dt) {
    simT += dt; const t = simT;
    for (const p of players.values()) {
      if (p.bubbleUntil && t > p.bubbleUntil) { p.bubble.classList.remove('show'); p.bubbleUntil = 0; }
      if (p.exprUntil && t > p.exprUntil) { p.av.userData.face.set('happy'); p.mood = null; p.exprUntil = 0; }
      const pos = p.av.position;
      if (p.target) {
        const dx = p.target.x - pos.x, dz = p.target.z - pos.z, d = Math.hypot(dx, dz);
        p.target.age = (p.target.age || 0) + dt;
        if (d < 0.05 || p.target.age > 9) { const then = p.target.then; p.target = null; p.state = 'idle'; then && then(); } // 9초 안에 못 가면 거기서 멈추고 도착 처리
        else { const step = Math.min(d, dt * 3.4); pos.x += (dx / d) * step; pos.z += (dz / d) * step; p.state = 'walk';
          avoid(p, pos, dx, dz, step);
          const want = Math.atan2(dx, dz); let diff = want - p.av.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); p.av.rotation.y += diff * Math.min(1, dt * 10); }
      }
      if (p.act && !p.target) { pos.y = p.act.y; p.av.rotation.y = p.act.ry; p.av.userData.pose = p.act.kind; if (p.act.arms) p.av.userData.armPose = p.act.arms === 'play' ? {r: [-1.15 + Math.sin(t * 9) * 0.12, 0.1], l: [-1.15 + Math.cos(t * 8) * 0.12, -0.1]} : p.act.arms; }
      else if (pos.y || p.av.userData.pose) { pos.y = 0; p.av.userData.pose = null; if (p.actArms) { p.av.userData.armPose = null; p.actArms = false; } }
      if (p.act && p.act.arms) p.actArms = true;
      if (!p.target && !p.hs && !p.act && !p.av.userData.kneel && !(p === me && camState.closeUp)) { // 서 있을 땐 카메라(또는 방금 말한 사람) 쪽으로 천천히 몸을 돌려요 — 말풍선과 표정이 잘 보이게
        const f = lookAtSpeaker && lookAtSpeaker.id !== p.id && t - lookAtSpeaker.at < 4 ? lookAtSpeaker.av.position : camera.position;
        let diff = Math.atan2(f.x - pos.x, f.z - pos.z) - p.av.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        p.av.rotation.y += diff * Math.min(1, dt * 2.5);
        for (const q of players.values()) { if (q === p) continue; const dx = pos.x - q.av.position.x, dz = pos.z - q.av.position.z, d = Math.hypot(dx, dz); if (d > 0.001 && d < 1.15) { pos.x += (dx / d) * (1.15 - d) * dt * 2; pos.z += (dz / d) * (1.15 - d) * dt * 2; } } // 겹치지 않게 살짝 비켜서기
      }
      A.animateAvatar(p.av, t, p.target ? 'walk' : p.mood || 'idle', p.phase);
      project({x: pos.x, z: pos.z}, 2.75, p.tag); project({x: pos.x, z: pos.z}, 3.15, p.bubble);
    }
    stepHandshake(dt); stepFlyers(dt);
    if (secretary && !secretary.parent.visible) { npcTag.style.display = 'none'; deskBubble.style.display = 'none'; }
    else if (secretary) { A.animateAvatar(secretary, t, 'idle', 1.3); const wp = new THREE.Vector3(); secretary.getWorldPosition(wp); project({x: wp.x, z: wp.z}, 2.75, npcTag); project({x: wp.x, z: wp.z}, 3.15, deskBubble); }
    const mz = ZONES.find((z) => z.main); if (mz.spin) mz.spin.rotation.y += dt * 0.6;
    if (furniture.tank && furniture.tank.visible) { const sp = furniture.tank.userData.fed > simT ? 2.6 : 0.8; furniture.tank.children.forEach((c) => { if (c.userData.swim != null) c.position.x = Math.sin(t * sp + c.userData.swim * 2) * 0.7; }); }
    if (furniture.tv && furniture.tv.visible && !furniture.tv.userData.off) furniture.tv.traverse((o) => { if (o.material && o.material.emissive && o.material.emissive.getHex() !== 0) o.material.emissive.setHSL((t * 0.15) % 1, 0.6, 0.45); });
    for (const k of ['plants', 'tree']) { const g = furniture[k]; if (g && g.userData.grow) { g.userData.grow = Math.max(0, g.userData.grow - dt * 1.2); g.scale.setScalar(1 + Math.sin(g.userData.grow * Math.PI) * 0.12); } }
    for (const z of ZONES) if (z.sign) z.sign.visible = !camState.closeUp && (camState.pitch > 0.5 || z.sign.getWorldPosition(v3).distanceTo(camera.position) > 7); // 클로즈업·눈높이 보기에선 가까운 간판이 화면을 가리지 않게
    for (const z of ZONES) if (z.sign) z.sign.lookAt(camera.position.x, z.sign.getWorldPosition(v3).y, camera.position.z);
    placeCamera(false);
    backWallG.visible = camera.position.z > -ROOM + 0.5; leftWallG.visible = camera.position.x > -ROOM + 0.5;
    renderer.render(scene, camera);
  }


  // ───────── 방 꾸미기 (씽크칩으로 벽지·바닥·러그·가구 구매) ─────────
  // 내가 꾸민 방은 내 화면에 늘 보이고, 내가 만든 친구 방에선 들어온 친구들에게도 그대로 보여요 (미니홈피처럼).
  const DECOR = {
    wall: [{id: 'navy', name: '네이비', price: 0, c: 0x1e2a4a}, {id: 'cream', name: '크림', price: 60, c: 0xe9dfc9}, {id: 'mint', name: '민트', price: 60, c: 0x9fd8c8}, {id: 'pink', name: '체리 핑크', price: 60, c: 0xf2b6c6}, {id: 'black', name: '블랙', price: 80, c: 0x0b0b10}, {id: 'sky', name: '하늘', price: 60, c: 0xa9c8f0}],
    floor: [{id: 'oak', name: '원목', price: 0, c: 0x7a5a43}, {id: 'white', name: '화이트 우드', price: 80, c: 0xd9cdbd}, {id: 'marble', name: '대리석', price: 100, c: 0xcfd2d8}, {id: 'walnut', name: '월넛', price: 70, c: 0x4a3326}, {id: 'pinktile', name: '핑크 타일', price: 80, c: 0xe9b7c4}],
    rug: [{id: 'navy', name: '네이비', price: 0, c: 0x26345e}, {id: 'red', name: '레드', price: 40, c: 0x7a1f2b}, {id: 'green', name: '포레스트', price: 40, c: 0x1f5a3e}, {id: 'purple', name: '퍼플', price: 40, c: 0x4a2f7a}, {id: 'beige', name: '베이지', price: 40, c: 0xcdb99a}],
    items: [{id: 'arcade', name: '아케이드 기계', price: 150}, {id: 'trophy', name: '트로피 장식장', price: 120}, {id: 'tank', name: '어항', price: 130}, {id: 'piano', name: '피아노', price: 200}, {id: 'tree', name: '반짝이 트리', price: 90}, {id: 'bean', name: '빈백 소파', price: 70}, {id: 'neon', name: '네온 하트', price: 60}, {id: 'plants', name: '화분 세트', price: 50},
      {id: 'sofa', name: '2인 소파', price: 120}, {id: 'bed', name: '침대', price: 150}, {id: 'desk', name: '책상 세트', price: 100}, {id: 'tv', name: 'TV', price: 130}, {id: 'shelf', name: '책장', price: 80}, {id: 'lamp', name: '무드등', price: 40}],
  };
  const ROOM_KEY = 'thinkchip:room:v1';
  const DEFAULT_DECO = {wall: 'navy', floor: 'oak', rug: 'navy', items: []};
  const encodeDeco = (d) => [d.wall, d.floor, d.rug, (d.items || []).join('_'), mySkin(), (loggedIn() ? st().badges || [] : []).join('_'), encodeLay(d)].join('.');
  const decodeDeco = (str) => { const [w, f, r, it] = String(str || '').split('.'); const ok = (cat, v) => DECOR[cat].some((x) => x.id === v);
    return {wall: ok('wall', w) ? w : 'navy', floor: ok('floor', f) ? f : 'oak', rug: ok('rug', r) ? r : 'navy', items: String(it || '').split(/[_+]/).filter((x) => DECOR.items.some((y) => y.id === x)), skin: skinOn(String(str || '').split('.')[4]), badges: String(String(str || '').split('.')[5] || '').split('_').filter((b) => BADGES[b]), ...(() => { const L = decodeLay(String(str || '').split('.')[6]); const sc = L.sc || null; delete L.sc; return {sc, lay: L}; })()}; };
  let myRoom = (() => { const v = store.get(ROOM_KEY, null); return v && v.deco ? {deco: Object.assign({}, DEFAULT_DECO, v.deco), owned: Array.isArray(v.owned) ? v.owned : []} : {deco: {...DEFAULT_DECO}, owned: []}; })();
  let shownDeco = myRoom.deco; // 지금 화면에 보이는 방 (친구 방이면 방장 방)
  const furniture = {};
  (function buildFurniture() {
    const G = (id, x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.visible = false; scene.add(g); furniture[id] = g; return g; };
    let g = G('arcade', -9.4, 6.6, Math.PI / 2); box(1.1, 2.2, 0.9, M(0x2b2f8a), 0, 1.1, 0, g); box(0.9, 0.7, 0.05, M(0x0b1430, {emissive: 0x5b6cff, emissiveIntensity: 0.9}), 0, 1.6, 0.46, g); box(1.0, 0.12, 0.5, M(0x1a1d55), 0, 1.05, 0.6, g); cyl(0.06, 0.06, 0.16, M(0xff4d5e), -0.2, 1.17, 0.62, 12, g); cyl(0.05, 0.05, 0.05, M(0xf7ce55), 0.2, 1.13, 0.62, 12, g);
    g = G('trophy', 5.6, -10.3); box(2.2, 2.4, 0.5, mats.wood, 0, 1.2, 0, g); for (let i = 0; i < 3; i++) box(2.0, 0.05, 0.45, mats.gold, 0, 0.5 + i * 0.7, 0.03, g); for (let i = 0; i < 4; i++) { cyl(0.12, 0.08, 0.3, mats.gold, -0.75 + i * 0.5, 1.37, 0.05, 12, g); cyl(0.05, 0.05, 0.08, mats.gold, -0.75 + i * 0.5, 1.2, 0.05, 8, g); }
    g = G('tank', 9.5, -6.2, -Math.PI / 2); box(2.0, 0.8, 0.8, mats.wood, 0, 0.4, 0, g); const w = box(1.9, 1.0, 0.7, new THREE.MeshPhysicalMaterial({color: 0x7fd3ff, transparent: true, opacity: 0.45, roughness: 0.05}), 0, 1.3, 0, g); w.castShadow = false;
      [0xff8a4c, 0xf7ce55, 0xff6fc8].forEach((c, i) => { const fsh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M(c)); fsh.scale.x = 1.6; fsh.position.set(-0.5 + i * 0.5, 1.2 + (i % 2) * 0.25, 0); fsh.userData.swim = i; g.add(fsh); });
    g = G('piano', 6.5, 9.4, Math.PI); box(2.0, 1.1, 0.7, M(0x0b0b10, {roughness: 0.2}), 0, 0.85, 0, g); box(1.9, 0.06, 0.35, M(0xffffff), 0, 1.0, 0.45, g); for (let i = 0; i < 9; i++) box(0.06, 0.06, 0.2, M(0x0b0b10), -0.8 + i * 0.2, 1.04, 0.38, g); box(0.9, 0.5, 0.4, M(0x0b0b10), 0, 0.25, 0.9, g);
    g = G('tree', -9.2, -9.2); cyl(0.12, 0.15, 0.6, mats.wood, 0, 0.3, 0, 8, g); [[1.0, 1.0], [0.8, 1.7], [0.55, 2.3]].forEach(([r, y]) => { const cn = new THREE.Mesh(new THREE.ConeGeometry(r, 1.0, 16), M(0x2f8f5b)); cn.position.y = y; cn.castShadow = true; g.add(cn); });
      const star = cyl(0.18, 0.18, 0.06, M(0xf7ce55, {emissive: 0xf7ce55, emissiveIntensity: 0.8}), 0, 2.95, 0, 5, g); star.rotation.x = Math.PI / 2; for (let i = 0; i < 10; i++) { const bl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M([0xff4d5e, 0xf7ce55, 0x5b6cff][i % 3], {emissive: [0xff4d5e, 0xf7ce55, 0x5b6cff][i % 3], emissiveIntensity: 0.6})); const a = i * 2.1, y = 0.9 + (i / 10) * 1.6, r = 0.95 - (i / 10) * 0.6; bl.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.add(bl); }
    g = G('bean', -3.4, 9.0); [[-0.9, 0xff8a4c], [0.9, 0x8b7bff]].forEach(([x, c]) => { const bb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), M(c, {roughness: 0.9})); bb.scale.y = 0.6; bb.position.set(x, 0.45, 0); bb.castShadow = true; g.add(bb); });
    g = G('neon', -10.7, 2.8, Math.PI / 2); const hs = new THREE.Shape(); hs.moveTo(0, -0.6); hs.bezierCurveTo(-1.2, 0.2, -0.5, 1.0, 0, 0.45); hs.bezierCurveTo(0.5, 1.0, 1.2, 0.2, 0, -0.6);
      const heart = new THREE.Mesh(new THREE.ShapeGeometry(hs), new THREE.MeshBasicMaterial({color: 0xff4d8d, toneMapped: false})); heart.position.y = 3.6; g.add(heart); const hl = new THREE.PointLight(0xff4d8d, 0.6, 5, 2); hl.position.set(0, 3.6, 0.5); g.add(hl);
    g = G('plants', 9.4, 9.4); [[0, 0, 1.2], [-1.1, 0.3, 0.8], [0.4, -1.1, 0.9]].forEach(([x, z, sc]) => { cyl(0.3 * sc, 0.24 * sc, 0.55 * sc, mats.pot, x, 0.28 * sc, z, 16, g); for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.34 * sc, 12, 10), mats.plant); l.position.set(x + Math.cos(i * 1.6) * 0.18 * sc, (0.85 + (i % 2) * 0.25) * sc, z + Math.sin(i * 1.6) * 0.18 * sc); l.scale.y = 1.3; l.castShadow = true; g.add(l); } });
    g = G('sofa', -6.0, 5.4, Math.PI / 2); { const c = M(0xd98c6a, {roughness: 0.8}); box(2.6, 0.45, 1.0, c, 0, 0.4, 0, g); box(2.6, 0.8, 0.28, c, 0, 0.85, -0.42, g); for (const x of [-1.25, 1.25]) box(0.26, 0.65, 1.0, c, x, 0.6, 0, g); for (const x of [-0.6, 0.6]) { const cu = box(0.9, 0.18, 0.75, M(0xf2e6d0, {roughness: 0.9}), x, 0.7, 0.05, g); cu.castShadow = false; } }
    g = G('bed', 6.6, 3.0, -Math.PI / 2); box(2.0, 0.4, 3.0, mats.wood, 0, 0.25, 0, g); box(1.9, 0.25, 2.8, M(0xf6f3ec, {roughness: 0.9}), 0, 0.55, 0.05, g); box(1.92, 0.2, 1.7, M(0x9fb7d9, {roughness: 0.9}), 0, 0.62, 0.55, g); box(2.0, 1.1, 0.15, mats.wood, 0, 0.75, -1.5, g); for (const x of [-0.5, 0.5]) { const pl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), M(0xffffff, {roughness: 0.9})); pl.scale.set(1.2, 0.45, 0.8); pl.position.set(x, 0.8, -1.05); g.add(pl); }
    g = G('desk', -6.6, -4.4, Math.PI / 2); box(2.0, 0.08, 0.9, mats.wood, 0, 1.0, 0, g); for (const [x, z] of [[-0.9, -0.38], [0.9, -0.38], [-0.9, 0.38], [0.9, 0.38]]) box(0.07, 1.0, 0.07, mats.wood, x, 0.5, z, g); box(0.7, 0.45, 0.04, M(0x0b1222, {emissive: 0x3a5ad9, emissiveIntensity: 0.6}), 0, 1.3, -0.25, g); box(0.6, 0.06, 0.6, M(0x2a3a66), 0, 0.55, 0.85, g); box(0.6, 0.6, 0.06, M(0x2a3a66), 0, 0.85, 1.12, g);
    g = G('tv', 0, 9.6, Math.PI); box(2.4, 0.5, 0.6, mats.wood, 0, 0.25, 0, g); box(2.2, 1.25, 0.08, M(0x0b0b10, {roughness: 0.2}), 0, 1.25, 0, g); box(2.05, 1.1, 0.02, M(0x101a33, {emissive: 0x3a6ad9, emissiveIntensity: 0.5}), 0, 1.25, 0.05, g);
    g = G('shelf', 9.9, -2.6, -Math.PI / 2); box(1.8, 2.4, 0.45, mats.wood, 0, 1.2, 0, g); for (let r = 0; r < 4; r++) { box(1.7, 0.05, 0.4, M(0x2a1d14), 0, 0.3 + r * 0.6, 0.02, g); for (let k = 0; k < 6; k++) box(0.14, 0.42, 0.3, M([0xff7a8a, 0x5aa9ff, 0xf7ce55, 0x3fcf9a, 0x9d86ff][(r + k) % 5], {roughness: 0.8}), -0.65 + k * 0.24 + (r % 2) * 0.05, 0.53 + r * 0.6, 0.04, g); }
    g = G('lamp', 9.4, 6.4); cyl(0.2, 0.25, 0.05, mats.gold, 0, 0.03, 0, 16, g); cyl(0.03, 0.03, 1.6, mats.gold, 0, 0.8, 0, 8, g); { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), M(0xffe2b8, {emissive: 0xffb45a, emissiveIntensity: 0.9})); sh.position.y = 1.75; g.add(sh); const l = new THREE.PointLight(0xffb45a, 0.6, 6, 2); l.position.y = 1.7; g.add(l); }
  })();
  for (const [id, g] of Object.entries(furniture)) { g.userData.home = [g.position.x, g.position.z, g.rotation.y]; const zone = {furn: id, group: g, pos: [g.position.x, g.position.z]}; registerClick(g, zone); }
  // 가구·진열장 배치: lay = {id: [x, z, 회전]} (방 주인이 놓은 자리. 친구가 놀러 와도 같은 자리에 보여요)
  function placeFurniture(lay) { for (const [id, g] of Object.entries(furniture)) { const p = (lay && lay[id]) || g.userData.home; g.position.set(p[0], 0, p[1]); g.rotation.y = lay && lay[id] ? fromQ(snapQ(p[2])) : p[2]; } }
  const encodeLay = (d) => { const L = {...(d.lay || {})}; if (Array.isArray(d.sc)) L.sc = d.sc; return Object.entries(L).filter(([k, v]) => /^[a-z]+$/.test(k) && Array.isArray(v)).map(([k, [x, z, r]]) => `${k}${Math.round(x * 10) + 200}y${Math.round(z * 10) + 200}q${snapQ(r)}`).join('_'); };
  // 회전은 벽 기준 45° 단위로만 (0·45·90…): q = 0~7 칸. 예전 형식 r(라디안×10)도 읽어서 가장 가까운 칸으로 맞춰요
  function snapQ(r) { return ((Math.round((Number(r) || 0) / (Math.PI / 4)) % 8) + 8) % 8; }
  function fromQ(q) { return q * (Math.PI / 4); }
  const decodeLay = (str) => { const out = {}; for (const m of String(str || '').matchAll(/([a-z]+)(\d+)y(\d+)([qr])(\d+)/g)) out[m[1]] = [Math.max(-10.5, Math.min(10.5, (Number(m[2]) - 200) / 10)), Math.max(-10.5, Math.min(10.5, (Number(m[3]) - 200) / 10)), m[4] === 'q' ? fromQ(Number(m[5]) % 8) : fromQ(snapQ(Number(m[5]) / 10))]; return out; };
  const pick = (cat, id) => DECOR[cat].find((x) => x.id === id) || DECOR[cat][0];
  function applyDecor(d) {
    shownDeco = d;
    const day = document.body.dataset.theme === 'day';
    mats.wall.color.setHex(d.wall === 'navy' && day ? mats.wallDay : pick('wall', d.wall).c);
    mats.floor.color.setHex(d.floor === 'oak' && day ? mats.floorDay : pick('floor', d.floor).c);
    mats.rug.color.setHex(pick('rug', d.rug).c);
    for (const [id, g] of Object.entries(furniture)) g.visible = (d.items || []).includes(id);
    placeFurniture(d.lay);
  }
  const isAdmin = () => loggedIn() && !!st().admin; // 관리자 계정: 옷·가구 전부 열림
  const decoOwned = (cat, id) => isAdmin() || (DECOR[cat].find((x) => x.id === id)?.price || 0) === 0 || myRoom.owned.includes(`${cat}:${id}`);
  let decoDraft = null, decoTab = 'wall';
  function openRoomDeco() {
    decoDraft = decoDraft || JSON.parse(JSON.stringify(myRoom.deco)); applyDecor(decoDraft);
    const d = decoDraft, due = [];
    for (const cat of ['wall', 'floor', 'rug']) if (!decoOwned(cat, d[cat])) due.push({cat, id: d[cat], price: pick(cat, d[cat]).price});
    for (const id of d.items) if (!decoOwned('items', id)) due.push({cat: 'items', id, price: DECOR.items.find((x) => x.id === id).price});
    const total = due.reduce((a, b) => a + b.price, 0), chips = myChips();
    const tabs = [['wall', '벽지'], ['floor', '바닥'], ['rug', '러그'], ['items', '가구·소품']];
    const btn = (cat, it) => { const on = cat === 'items' ? d.items.includes(it.id) : d[cat] === it.id; const own = decoOwned(cat, it.id);
      const sw = it.c != null ? `<i style="display:block;width:100%;height:16px;border-radius:6px;margin-bottom:5px;background:#${it.c.toString(16).padStart(6, '0')}"></i>` : '';
      return `<button class="item ${on ? 'on' : ''}" data-dcat="${cat}" data-did="${it.id}">${sw}${esc(it.name)}<span class="price ${it.price === 0 ? 'free' : own ? 'owned' : ''}">${it.price === 0 ? '기본' : own ? '보유' : `⬡${it.price}`}</span></button>`; };
    openSheet({kicker: 'MY ROOM', title: '🏠 방 꾸미기', cls: 'closet', onClose: () => { decoDraft = null; applyDecor(currentDeco()); }, html: `
      <div class="tabs">${tabs.map(([id, n]) => `<button data-dtab="${id}" class="${decoTab === id ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="items">${DECOR[decoTab].map((it) => btn(decoTab, it)).join('')}</div>
      <p style="font-size:11.5px;color:var(--muted);margin:10px 2px 0">${decoTab === 'items' ? '눌러서 놓기 / 빼기. ' : ''}꾸민 방은 내가 만든 친구 방에 들어온 친구들에게도 보여요.</p>
      <div class="closet-foot"><span class="sum">${total ? (total > chips ? `👀 미리보기 중 · <b>⬡${fmt(total - chips)}</b> 더 모으면 살 수 있어요` : `새로 살 것 ${due.length}개 · <b>⬡${total}</b> (보유 ⬡${fmt(chips)})`) : '바꾼 방을 저장할 수 있어요'}</span>
      <button class="btn gold" id="decoSave" ${total > chips ? 'disabled' : ''}>${total ? (total > chips ? '씽크칩 부족' : '구매하고 꾸미기') : '저장하기'}</button></div>`});
    $('sheetBody').onclick = (e) => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.dtab) { decoTab = b.dataset.dtab; openRoomDeco(); return; }
      if (b.dataset.dcat === 'items') { const i = d.items.indexOf(b.dataset.did); if (i >= 0) d.items.splice(i, 1); else d.items.push(b.dataset.did); openRoomDeco(); return; }
      if (b.dataset.dcat) { d[b.dataset.dcat] = b.dataset.did; openRoomDeco(); return; }
      if (b.id === 'decoSave') { if (total > myChips() && !(acctOn() && !loggedIn())) return toast('씽크칩이 부족해요');
        (async () => { if (total && !(await confirmBuy({title: `🛋️ ${due.length}개를 사서 꾸밀까요?`, desc: due.map((x) => pick(x.cat, x.id).name).join(', '), price: total}))) return;
        b.disabled = true; const ok = await payChips(total, '방 꾸미기를 사려면 ', due.map((x) => `${x.cat}:${x.id}`).join(',')); b.disabled = false; if (!ok) return; const bid = payChips.lastId;
        myRoom.owned = [...new Set([...myRoom.owned, ...due.map((x) => `${x.cat}:${x.id}`)])]; myRoom.deco = JSON.parse(JSON.stringify(d)); store.set(ROOM_KEY, myRoom);
        if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'deco', deco: encodeDeco(myRoom.deco)}));
        toast(total ? `구매 완료! -${total} 씽크칩` : '방을 저장했어요'); decoDraft = null; closeSheet(); drawBoard(); setTicker(); pushData('room'); if (bid) showUndo(bid, `가구·벽지 ${due.length}개`, total); })(); }
    };
  }
  let hostDeco = null, homeOwner = ''; // 놀러 간 친구 방 주인이 꾸민 방
  // ───────── 라운지 ↔ 내 방 ─────────
  // 라운지: 게임 테이블·파티·비서 데스크 (모두 같은 기본 인테리어)
  // 내 방: 내가 꾸민 벽지·바닥·가구 + 드레스룸. 친구는 친구 목록에서 '놀러가기'로 들어와요 (방 코드 H + 내 ID 앞 5자리)
  const homeCode = (id) => 'H' + String(id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5).padEnd(5, '0');
  const isHome = () => !room.public && /^H[A-Z0-9]{5}$/.test(room.code || '');
  const myHome = () => isHome() && room.code === homeCode(ME);
  const isVip = () => /^VIP\d$/.test(room.code || '');
  const VIP_DECO = {wall: 'black', floor: 'marble', rug: 'purple', items: ['piano', 'trophy', 'neon', 'plants']};
  function currentDeco() { if (decoDraft) return decoDraft; if (isVip()) return VIP_DECO; if (!isHome()) return DEFAULT_DECO; return myHome() ? myRoom.deco : (hostDeco || DEFAULT_DECO); }
  function applyMode() {
    const home = isHome();
    for (const z of ZONES) if (z.group && !z.door) z.group.visible = z.closet || z.showcase ? home : !home;
    { const dz = ZONES.find((z) => z.door); if (dz && dz.group && dz.doorHome !== home) { dz.doorHome = home; const old = dz.sign, ns = neon(home ? '🏛️ 라운지로' : '🏠 내 방', '#f7ce55', 2.2); ns.position.copy(old.position); dz.group.remove(old); dz.group.add(ns); dz.sign = ns; } }
    if (home) { drawShowcase(myHome() ? (loggedIn() ? st().badges : []) : (hostDeco && hostDeco.badges) || []); placeShowcase(myHome() ? myRoom.deco.sc : hostDeco && hostDeco.sc); }
    OBST.length = 0; if (!home) OBST.push(...LOUNGE_OBST);
    if (!home) homeOwner = '';
    if (!decoDraft) applyDecor(currentDeco()); renderDock(); renderRoomLabel();
    setHomeSecretary(home ? (myHome() ? mySkin() : (hostDeco && hostDeco.skin) || '') : '');
    const vz = ZONES.find((z) => z.vip); if (vz && vz.group && vz.signVip !== isVip()) { vz.signVip = isVip(); const old = vz.sign, ns = neon(isVip() ? '🚪 라운지로' : '👑 VIP 라운지', '#d9a6ff', 2.8); ns.position.copy(old.position); vz.group.remove(old); vz.group.add(ns); vz.sign = ns; }
    $('hint').textContent = home ? (myHome() ? '여기는 내 방이에요 · 꾸미기·드레스룸은 오른쪽 메뉴에서' : '친구 방에 놀러 왔어요 · 캐릭터를 눌러 인사해 보세요') : '바닥을 눌러 걸어가고, 테이블을 눌러 게임을 골라요';
  }
  function goHome(then) { if (!myHome()) { switchRoom(homeCode(ME)); me.av.position.set(0, 0, 3); toast('🏠 내 방에 들어왔어요'); } if (then) setTimeout(then, 450); }
  function goLounge(then) { if (isHome()) { switchRoom(null); me.av.position.set(0, 0, 4); toast('🏛 라운지로 나왔어요'); } if (then) setTimeout(then, 450); }
  function goRoom(code) { if (!code || /^LNG\d$/.test(code)) { if (isHome() || !room.public) switchRoom(null); return; } if (code !== room.code) { switchRoom(code); me.av.position.set(0, 0, 4); } }
  function renderDock() {
    const home = isHome(), items = home
      ? [...(myHome() ? [['deco', '🛋️', '꾸미기'], ['closet', '👕', '드레스룸']] : []), ['games', '🎮', '게임'], ['booth', '📸', '네컷'], ['friends', '👥', '친구']]
      : [['games', '🎮', '게임'], ['booth', '📸', '네컷'], ['desk', '💁', '비서'], ['friends', '👥', '친구']];
    const wt = $('whereToggle'); if (wt) { wt.querySelector('[data-w="lounge"]').classList.toggle('on', !home); wt.querySelector('[data-w="home"]').classList.toggle('on', myHome()); wt.querySelector('[data-w="lounge"] span').textContent = isVip() ? 'VIP' : '라운지'; }
    document.querySelector('.dock-right').innerHTML = items.map(([k, e, n]) => `<button data-open="${k}"><span>${e}</span>${n}</button>`).join('');
    renderSocialBadge();
  }
  // ───────── UI ─────────
  function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }
  function renderChips() { $('chips').textContent = acctOn() && !loggedIn() ? (IN_TOSS ? '…' : '로그인') : fmt(myChips()); }
  function hideHint() { $('hint').classList.add('hide'); }
  setTimeout(hideHint, 7000);
  function chatLine(name, text, sys) {
    const el = document.createElement('div'); el.className = 'msg' + (sys ? ' sys' : ''); el.innerHTML = sys ? esc(text) : `<b>${esc(name)}</b>${esc(text).replace(JOIN_RE, (_, code, id) => `<a class="join-btn" href="${tableHref(id, code)}">🎮 참가하기</a>`)}`;
    const log = $('chatLog'); const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.appendChild(el); while (log.children.length > 60) log.firstChild.remove();
    if (atBottom) log.scrollTop = log.scrollHeight;
    news.unshift(sys ? text : `${name}: ${String(text).replace(JOIN_RE, '').trim()}`); news = news.slice(0, 5); drawBoard();
  }
  function setTicker() {
    const g = dailyGame(), p = profile(), best = Object.entries(p.best || {}).sort((a, b) => b[1] - a[1])[0];
    const parts = [g ? `오늘의 메인 매치 · ${g.title}` : null, `접속 ${online.size + 1}명`, (acctOn() && !loggedIn() ? '로그인하면 씽크칩을 모을 수 있어요' : `내 씽크칩 ⬡${fmt(myChips())}`), best && GAME[best[0]] ? `내 최고 기록 · ${GAME[best[0]].title} ${fmt(best[1])}점` : null, news[0] || null].filter(Boolean);
    $('tickerText').textContent = parts.join('   ·   ');
  }

  // 시트 (바텀 시트 하나를 재사용)
  let sheetOnClose = null;
  function showName() { const l = document.getElementById('nameLabel'); if (l && typeof myName === 'function') l.textContent = myName(); }
  function editName() { openFriends(); setTimeout(() => { const i = document.getElementById('nameInput'); if (i) { i.focus(); i.select(); } }, 80); }
  function openSheet({kicker = '', title = '', html = '', cls = '', onClose = null}) {
    if (sheetOnClose && !$('sheet').hidden && $('sheetKicker').textContent !== kicker) { const f = sheetOnClose; sheetOnClose = null; f(); } // 다른 창으로 바뀌면 앞 창 정리 (꾸미기 미리보기 등)
    $('sheetKicker').textContent = kicker; $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html;
    const keepPeek = !$('sheet').hidden && $('sheet').classList.contains('peek') && $('sheet').dataset.cls === cls; $('sheet').dataset.cls = cls;
    $('sheet').className = 'sheet ' + cls + (keepPeek ? ' peek' : ''); $('sheet').style.transform = ''; $('sheet').hidden = false; $('backdrop').hidden = cls === 'closet'; sheetOnClose = onClose;
  }
  // 아래 창 손잡이: 살짝 내리면 작게 접혀서 캐릭터·방이 크게 보이고, 다시 올리면 펼쳐져요. 끝까지 내리면 닫혀요
  (function sheetDrag() {
    const sh = $('sheet'); let y0 = null, dy = 0, t0 = 0;
    const start = (e) => { if (e.target.closest('button,input')) return; y0 = e.clientY; dy = 0; t0 = Date.now(); sh.classList.add('dragging'); try { e.target.setPointerCapture(e.pointerId); } catch (er) {} };
    const move = (e) => { if (y0 == null) return; dy = e.clientY - y0; const peek = sh.classList.contains('peek'); sh.style.transform = `translateY(${Math.max(peek ? -40 : -24, dy)}px)`; };
    const end = () => { if (y0 == null) return; y0 = null; sh.classList.remove('dragging'); sh.style.transform = ''; const peek = sh.classList.contains('peek'), fast = Date.now() - t0 < 250;
      if (Math.abs(dy) < 6) { if (peek) sh.classList.remove('peek'); return; } // 접힌 상태에서 톡 누르면 펼치기
      if (peek) { if (dy < -20) sh.classList.remove('peek'); else if (dy > 60) closeSheet(); }
      else if (dy > 220 || (fast && dy > 120)) closeSheet(); else if (dy > 40) sh.classList.add('peek'); };
    for (const el of [sh.querySelector('.sheet-grip'), sh.querySelector('.sheet-head')]) { if (!el) continue; el.style.touchAction = 'none'; el.addEventListener('pointerdown', start); el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); }
  })();
  function closeSheet() { $('sheet').hidden = true; $('backdrop').hidden = true; const f = sheetOnClose; sheetOnClose = null; f && f(); }
  $('sheetClose').onclick = closeSheet; $('backdrop').onclick = closeSheet;

  function gameButton(g, href) {
    return `<a class="game-btn" href="${href}" style="text-decoration:none;color:inherit"><i style="background:${COLOR[g.color] || '#7c8cff'}">${esc(g.symbol)}</i><span><b>${esc(g.title)}</b><small>${esc(g.short || g.genre || '')}</small></span></a>`;
  }
  // 혼자 하기: 라운지에서 모드·난이도를 고르고 게임으로 바로 들어가요
  const LEVELS = [['easy', '쉬움', 10], ['normal', '보통', 18], ['hard', '어려움', 30], ['expert', '고수', 45], ['master', '지옥', 60]]; // 세 번째 값 = AI 를 이기면 받는 칩 (src/main.js AI_WIN 과 같게)
  const getLevel = () => { const v = store.get('thinkchip:level', 'normal'); return LEVELS.some((l) => l[0] === v) ? v : 'normal'; };
  const soloHref = (id, mode) => new URL(`?open=${encodeURIComponent(id)}&mode=${mode}&level=${getLevel()}&from=lounge`, ARENA).href;
  const levelRow = () => `<div class="lv-row"><span>AI 난이도<small>이기면 받는 칩</small></span>${LEVELS.map(([k, n, w]) => `<button data-lv="${k}" class="${getLevel() === k ? 'on' : ''}">${n}<em>+${w}</em></button>`).join('')}</div>`;
  function bindSolo(rerender) {
    $('sheetBody').querySelectorAll('[data-lv]').forEach((b) => { b.onclick = () => { store.set('thinkchip:level', b.dataset.lv); rerender(); }; });
    $('sheetBody').querySelectorAll('[data-solo]').forEach((b) => { b.onclick = () => { const [id, mode] = b.dataset.solo.split(':'); enterGame(soloHref(id, mode)); }; });
  }
  const zoneOf = (id) => ZONES.find((z) => z.games && z.games.includes(id)) || (CFG.PARTY.some((g) => g.id === id) ? ZONES.find((z) => z.party) : ZONES.find((z) => z.main));
  // 게임 하나를 골랐을 때 (전체 게임 목록·메인 매치): 같이 / AI / 연습을 여기서 정해요
  function openGamePick(id, kicker) {
    const g = GAME[id]; if (!g) return; const n = othersHere().length;
    openSheet({kicker: kicker || g.genre || 'GAME', title: `${g.symbol} ${g.title}`, html: `<div class="card"><p>${esc(g.short || '')}</p></div>
      <button class="btn gold full" id="pickTeam">👥 같이 하기${n ? ` · 라운지 ${n}명에게 초대` : ' · 친구 기다리기'}</button>
      ${g.min ? `<p class="table-note" style="margin-top:10px">🚫 혼자 할 수 없는 게임이에요 · <b>${g.min}명 이상</b> 필요</p>` : levelRow()}
      ${g.bonus ? `<p class="table-note">⬡ 이 게임은 보상 칩 <b>×${g.bonus}</b></p>` : ''}
      <div style="display:flex;gap:8px"><button class="btn ghost full" ${g.min ? 'disabled' : `data-solo="${g.id}:ai"`}>🤖 AI 대결</button><button class="btn ghost full" ${g.min ? 'disabled' : `data-solo="${g.id}:solo"`}>🎯 혼자 연습</button></div>`});
    $('pickTeam').onclick = () => startWaiting(zoneOf(id), id);
    bindSolo(() => openGamePick(id, kicker));
  }
  const openHref = (id) => new URL(`?open=${encodeURIComponent(id)}&from=lounge`, ARENA).href;
  const partyHref = (id) => new URL(`?party=${encodeURIComponent(id)}${room.code && !room.public ? `&room=${room.code}` : ''}&from=lounge`, ARENA).href;
  // 테이블에서 '같이' 하기: 실시간 방을 열고 라운지 채팅에 참가 버튼을 올려요 (방 코드는 친구 방이면 그 코드, 공개 라운지면 새 코드)
  // 테이블 시트: 라운지 안에서 먼저 '같이 / 혼자' 를 고르고, 같이면 파티원이 올 때까지 여기서 기다려요
  let pending = null; // 내가 연 테이블 {code, id, joined:Set, timer}
  function othersHere() { return [...players.values()].filter((p) => p.id && p.id !== ME).map((p) => p.name); }
  function openTable(zone, mode) {
    const list = (zone.party ? CFG.PARTY : zone.games.map((id) => GAME[id]).filter(Boolean)), others = othersHere();
    const badge = (g) => (g.min ? `<em class="gb">${g.min}명+</em>` : g.bonus ? `<em class="gb gold">칩 ×${g.bonus}</em>` : '');
    const tabs = `<div class="seg"><button class="${mode === 'team' ? 'on' : ''}" data-mode="team">👥 같이 하기${others.length ? ` · ${others.length}명` : ''}</button><button class="${mode === 'solo' ? 'on' : ''}" data-mode="solo">🤖 혼자 · AI</button></div>`;
    const who = mode === 'team' ? `<p class="table-note">${others.length ? `라운지에 있는 <b>${others.slice(0, 6).map(esc).join(', ')}${others.length > 6 ? ` 외 ${others.length - 6}명` : ''}</b>에게 초대가 가요. 게임을 고르면 파티원이 올 때까지 여기서 기다려요.` : '지금은 라운지에 다른 사람이 없어요. 게임을 고르면 초대를 걸어 두고 누가 들어올 때까지 기다려요. 친구 방 코드로 친구를 불러도 좋아요.'}</p>` : (zone.party ? '<p class="table-note">🚫 파티 게임은 <b>혼자 할 수 없어요.</b> 👥 같이 하기에서 친구를 불러 주세요.</p>' : `<p class="table-note">버튼을 누르면 바로 시작해요. 끝나면 이 테이블로 돌아와요.</p>${levelRow()}`);
    const items = list.map((g) => mode === 'team'
      ? `<button class="game-btn" data-team="${g.id}"><i style="background:${COLOR[g.color] || '#7c8cff'}">${esc(g.symbol)}</i><span><b>${esc(g.title)}${badge(g)}</b><small>${esc(g.short || '')}</small></span></button>`
      : `<div class="tg-row"><div class="game-btn"><i style="background:${COLOR[g.color] || '#7c8cff'}">${esc(g.symbol)}</i><span><b>${esc(g.title)}${badge(g)}</b><small>${g.min ? `혼자 불가 · ${g.min}명 이상 필요` : esc(g.short || '')}</small></span></div><button class="tg-b" ${g.min ? 'disabled' : `data-solo="${g.id}:solo"`}>연습</button><button class="tg-b ai" ${g.min ? 'disabled' : `data-solo="${g.id}:ai"`}>AI 대결</button></div>`).join('');
    openSheet({kicker: zone.sub, title: `${zone.icon} ${zone.title}`, html: `${tabs}${who}<div class="game-list table-games">${items}</div>`});
    $('sheetBody').querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => openTable(zone, b.dataset.mode); });
    $('sheetBody').querySelectorAll('[data-team]').forEach((b) => { b.onclick = () => startWaiting(zone, b.dataset.team); });
    bindSolo(() => openTable(zone, 'solo'));
  }
  function startWaiting(zone, id) {
    const g = GAME[id]; if (!g) return;
    pending = {code: room.public ? newCode() : room.code, id, zone, joined: new Set(), timer: null};
    sendChat(`${zone.title.replace(' 테이블', '')}에서 ${g.title} 같이 해요! [[join:${pending.code}:${id}]]`);
    renderWaiting();
  }
  function renderWaiting() {
    if (!pending) return; const g = GAME[pending.id], n = pending.joined.size;
    openSheet({kicker: 'WAITING', title: `${g.symbol} ${g.title}`, html: `
      <div class="wait-card"><div class="wait-dots"><i></i><i></i><i></i></div>
      <h3>${n ? `${[...pending.joined].map(esc).join(', ')}님이 들어왔어요!` : '파티원을 기다리는 중…'}</h3>
      <p>${n ? '곧 게임 방으로 같이 이동해요.' : '라운지 사람들에게 초대를 보냈어요. 누가 참가하면 바로 같이 들어가요.'}</p></div>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn ghost full" id="waitCancel">초대 취소</button><button class="btn gold full" id="waitGo" ${n ? '' : 'disabled'}>${n ? '지금 들어가기' : '1명 이상 오면 시작'}</button></div>
      <button class="btn kakao full" id="waitShare" style="margin-top:8px">📲 카톡으로 친구 부르기</button>
      <button class="btn ghost full" id="waitAi" style="margin-top:8px">기다리기 싫으면 AI 랑 먼저 하기</button>`, onClose: () => { if (pending && !pending.going) cancelWaiting(true); }});
    $('waitCancel').onclick = () => { cancelWaiting(); closeSheet(); };
    $('waitGo').onclick = goTable;
    $('waitShare').onclick = shareTable;
    $('waitAi').onclick = () => { const id = pending.id; cancelWaiting(); enterGame(soloHref(id, 'ai')); };
  }
  function cancelWaiting(silent) { if (!pending) return; clearTimeout(pending.timer); if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'chat', text: `[[cancel:${pending.code}]]`})); pending = null; if (!silent) toast('초대를 취소했어요'); }
  // 카톡 등으로 '같이 하자' 링크 보내기. 브라우저 공유창이 없으면(토스 앱 안) 게임 방으로 먼저 들어가 토스 공유로 보내요
  async function shareTable() {
    if (!pending) return; const g = GAME[pending.id], url = tableHref(pending.id, pending.code);
    const text = `${myName()}님이 씽크칩 아레나에서 '${g.title}' 같이 하재요! 지금 들어와 🎮 (방 코드 ${pending.code})`;
    if (navigator.share && !/^(localhost|127\.)/.test(location.hostname)) {
      try { await navigator.share({title: '씽크칩 아레나 같이 하자!', text, url}); toast('초대를 보냈어요. 여기서 기다릴게요'); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    pending.going = true; enterGame(url + '&invite=1');
  }
  function goTable() { if (!pending) return; pending.going = true; clearTimeout(pending.timer); enterGame(tableHref(pending.id, pending.code)); }
  // 다른 사람의 초대 팝업
  let inviteShown = null;
  function showInvite(fromName, code, id) {
    const g = GAME[id]; if (!g || pending) return;
    inviteShown = code;
    let el = $('invitePop'); if (!el) { el = document.createElement('div'); el.id = 'invitePop'; el.className = 'invite-pop'; document.body.appendChild(el); }
    el.innerHTML = `<div class="ip-ico" style="background:${COLOR[g.color] || '#7c8cff'}">${esc(g.symbol)}</div><div class="ip-txt"><b>${esc(fromName)}님이 같이 하재요</b><small>${esc(g.title)}</small></div><button class="btn ghost" data-ip="no">괜찮아요</button><button class="btn gold" data-ip="yes">참가</button>`;
    el.hidden = false;
    el.onclick = (e) => { const b = e.target.closest('[data-ip]'); if (!b) return; el.hidden = true;
      if (b.dataset.ip === 'yes') { if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'chat', text: `[[ok:${code}]]`})); setTimeout(() => { enterGame(tableHref(id, code)); }, 300); } };
  }
  function hideInvite(code) { const el = $('invitePop'); if (el && inviteShown === code) el.hidden = true; }
  // 채팅으로 오가는 초대 신호 처리. 화면에 보일 채팅이면 true
  function handleSignal(m) {
    const t = String(m.text || ''); let x;
    if ((x = /^\[\[ok:([A-Z0-9]{4,6})\]\]$/.exec(t))) { if (pending && pending.code === x[1] && m.pid !== ME) { pending.joined.add(otherName(m)); renderWaiting(); clearTimeout(pending.timer); pending.timer = setTimeout(goTable, 2500); } return false; }
    if ((x = /^\[\[cancel:([A-Z0-9]{4,6})\]\]$/.exec(t))) { hideInvite(x[1]); return false; }
    if ((x = RX_RE.exec(t))) { if (m.pid === x[1]) playRx(x[1], x[2], x[3]); return false; }
    if ((x = HS_RE.exec(t))) { if (m.pid === x[1] && startHandshake(x[1], x[2])) { const other = x[1] === ME ? x[2] : x[2] === ME ? x[1] : null; if (other) chatLine('', `🤝 ${otherName({pid: other, name: online.get(other)})}님과 손인사!`, true); } return false; }
    JOIN_RE.lastIndex = 0; if ((x = JOIN_RE.exec(t)) && m.pid !== ME) showInvite(otherName(m), x[1], x[2]);
    JOIN_RE.lastIndex = 0; return true;
  }
  function openZone(zone) {
    if (zone.door) return openDoor(() => { if (isHome()) goLounge(); else goHome(); me.av.position.set(-9.0, 0, zone.pos[1]); me.target = null; me.av.rotation.y = Math.PI / 2; sendPose(); }); // 문 앞에서 나와요
    if (zone.showcase) return openShowcase();
    if (zone.vip) return isVip() ? (switchRoom(null), toast('🏛 라운지로 나왔어요')) : openVip();
    if (zone.closet) return openCloset();
    if (zone.desk) return openDesk();
    if (zone.main) { const g = dailyGame(); return g ? openGamePick(g.id, "TODAY'S MAIN MATCH") : null; }
    if (zone.party) return openTable(zone, 'team');
    if (zone.party) return openSheet({kicker: 'PARTY · LIVE', title: '🎉 파티 라운지', html: `<p style="font-size:12.5px;color:var(--muted);margin:0 0 10px">친구들과 같은 방에서 실시간으로 해요. ${room.public ? '누르면 방이 만들어지고 초대 링크를 보낼 수 있어요.' : `지금 친구 방(${room.code}) 사람들과 바로 시작해요.`}</p><div class="game-list">${CFG.PARTY.map((g) => gameButton(g, partyHref(g.id))).join('')}</div>`});
    return openTable(zone, players.size > 1 ? 'team' : 'solo');
  }
  function openGames() {
    const html = ZONES.filter((z) => z.games || z.party).map((z) => `<div class="zone"><h3>${z.icon} ${esc(z.title)} <small>${esc(z.sub)}</small></h3><div class="game-list">${(z.party ? CFG.PARTY : z.games.map((id) => GAME[id]).filter(Boolean)).map((g) => `<button class="game-btn" data-pick="${g.id}"><i style="background:${COLOR[g.color] || '#7c8cff'}">${esc(g.symbol)}</i><span><b>${esc(g.title)}</b><small>${esc(g.short || g.genre || '')}</small></span></button>`).join('')}</div></div>`).join('');
    openSheet({kicker: 'ALL GAMES', title: '어떤 승부를 할까요?', html});
    $('sheetBody').querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => { const id = b.dataset.pick; closeSheet(); toast('테이블로 가는 중…'); goToZone(zoneOf(id), () => openGamePick(id)); }; }); // 걸어가서 도착하면 선택 시트
  }

  // 비서 데스크: 출석 보너스(진짜 칩 지급) + 내 기록
  const ATTEND = 30;
  function openDesk() {
    const p = profile(), L = store.get(LOUNGE_KEY, {}), done = acctOn() ? !!(loggedIn() && ACC.state.wallet && ACC.state.wallet.attended) : L.attend === today(), plays = (p.history || []).length;
    const wins = (p.history || []).filter((h) => h.victory).length, bestList = Object.entries(p.best || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
    setExpr(players.get(ME), 'happy'); say({av: secretary, bubble: deskBubble, tag: npcTag}, done ? '오늘 출석은 이미 챙기셨어요!' : `어서 오세요, ${myName()}님! 출석 보너스 받아 가세요.`);
    openSheet({kicker: 'CONCIERGE', title: '💁 비서 데스크', html: `
      <div class="card reward"><div><h3>오늘의 출석 보너스</h3><p>${done ? '내일 다시 받을 수 있어요' : '하루 한 번 받을 수 있어요'}</p></div><strong>+${ATTEND}</strong></div>
      <button class="btn gold full" id="attendBtn" ${done ? 'disabled' : ''}>${done ? '오늘은 받았어요 ✓' : '출석 보너스 받기'}</button>
      ${skinSection()}
      ${recentBuysHtml()}
      <div class="card" style="margin-top:12px"><h3>내 기록</h3><div class="stats"><div><b>${acctOn() && !loggedIn() ? '-' : fmt(myChips())}</b><small>씽크칩</small></div><div><b>${plays}</b><small>최근 플레이</small></div><div><b>${wins}</b><small>최근 승리</small></div></div>
      ${bestList.length ? `<p style="margin-top:10px">${bestList.map(([id, s]) => `${esc(GAME[id]?.title || id)} <b style="color:var(--gold)">${fmt(s)}</b>`).join(' · ')}</p>` : '<p style="margin-top:10px">아직 기록이 없어요. 테이블에서 한 판 해볼까요?</p>'}</div>
      <a class="btn ghost full" style="display:grid;place-items:center;text-decoration:none;color:inherit;margin-top:8px" href="${new URL('?wallet=1&from=lounge', ARENA).href}">⬡ 씽크칩 충전 · 지갑</a>
      ${loggedIn() ? `<p class="table-note" style="text-align:center;user-select:all;-webkit-user-select:all">내 ID ${esc(st().pid)}${isAdmin() ? ' · 👑 관리자' : ''}</p>` : ''}
      ${acctOn() && !IN_TOSS ? (loggedIn() ? `<p class="table-note" style="text-align:center">카카오 계정으로 로그인됨 · <a href="#" id="logoutBtn" style="color:var(--muted)">로그아웃</a> · <a href="#" id="deleteAcct" style="color:var(--muted)">계정 삭제</a></p>` : '<button class="btn kakao full" id="deskLogin" style="margin-top:8px">🔑 로그인하고 칩 모으기</button>') : IN_TOSS && loggedIn() ? '<p class="table-note" style="text-align:center"><a href="#" id="deleteAcct" style="color:var(--muted)">내 데이터 삭제</a></p>' : ''}
      <div class="name-row" style="margin:12px 0"><div class="label-row">내 이름 <small style="color:var(--muted);font-weight:600">· 바꾸면 바로 머리 위 이름이 바뀌어요</small></div><input id="deskName" maxlength="12" value="${esc(p.nickname || '')}" placeholder="라운지에서 보일 이름"></div>
      <div class="card"><h3>비서의 팁</h3><p>${['심리전 테이블에선 채팅 이모티콘으로 표정을 바꿔 블러핑해 보세요 😏', '드레스룸에서 얼굴은 무료로 바꿀 수 있어요.', '친구 방을 만들면 라운지와 파티 게임을 같은 사람들과 할 수 있어요.', '메인 매치는 매일 자정에 바뀌어요.'][new Date().getDate() % 4]}</p></div>`});
    $('deskName').onchange = (e) => { const q = profile(); q.nickname = e.target.value.trim().slice(0, 12); saveProfile(q); me.tag.textContent = myName(); showName(); reconnect(); if (loggedIn()) ACC.call('hello', {name: myName()}).catch(() => {}); toast('이름을 바꿨어요'); };
    $('sheetBody').querySelectorAll('[data-skin]').forEach((x) => { x.onclick = () => buySkin(x.dataset.skin); });
    $('sheetBody').querySelectorAll('[data-refund]').forEach((x) => { x.onclick = async () => { await refundBuy(x.dataset.refund); openDesk(); }; });
    if ($('deskLogin')) $('deskLogin').onclick = () => openLogin();
    if ($('deleteAcct')) $('deleteAcct').onclick = async (e) => { e.preventDefault();
      if (!confirm('계정을 삭제할까요?\n\n칩(산 칩 포함)·옷·가구·뱃지·친구가 모두 지워지고 되돌릴 수 없어요. 남은 유료 칩 환불은 삭제 전에 문의해 주세요.')) return;
      if (prompt('정말 삭제하려면 "삭제"라고 입력해 주세요') !== '삭제') return toast('삭제를 취소했어요');
      try { const r = await ACC.call('deleteAccount', {confirm: 'DELETE'}); if (!r.ok) return toast('삭제하지 못했어요');
        try { for (const k of [ROOM_KEY, 'thinkchip:avatar:v1', 'thinkchip:skin']) localStorage.removeItem(k); } catch (er) {}
        ACC.logout(); alert('계정을 삭제했어요. 이용해 주셔서 고마워요.'); location.reload(); } catch (er) { toast('인터넷 연결을 확인해 주세요'); } };
    if ($('logoutBtn')) $('logoutBtn').onclick = (e) => { e.preventDefault(); if (confirm('로그아웃할까요? 칩과 친구는 계정에 그대로 남아 있어요.')) { ACC.logout(); location.reload(); } };
    const b = $('attendBtn'); if (b) b.onclick = async () => {
      if (acctOn()) { if (!loggedIn()) return openLogin('출석 보너스를 받으려면 '); b.disabled = true;
        try { const r = await ACC.call('attend'); if (r.ok && r.earned) { toast(`출석 보너스 +${r.earned} 씽크칩!`); setExpr(me, 'laugh'); } else if (r.ok) toast('오늘은 이미 받았어요'); else toast('잠시 후 다시 시도해 주세요'); } catch (e) { toast('인터넷 연결을 확인해 주세요'); }
        drawBoard(); setTicker(); return openDesk(); }
      const L2 = store.get(LOUNGE_KEY, {}); if (L2.attend === today()) return; L2.attend = today(); store.set(LOUNGE_KEY, L2); addChips(ATTEND); toast(`출석 보너스 +${ATTEND} 씽크칩!`); setExpr(me, 'laugh'); drawBoard(); setTicker(); openDesk(); };
  }
  const deskBubble = makeBubble();

  // 드레스룸: 얼굴은 무료, 옷·소품은 씽크칩으로 구매
  const W = A.WARDROBE;
  const TABS = [
    {id: 'face', name: '얼굴', free: true}, {id: 'hair', name: '헤어'}, {id: 'top', name: '상의'}, {id: 'bottom', name: '하의'}, {id: 'shoes', name: '신발'}, {id: 'acc', name: '소품'},
  ];
  let closetTab = 'face', draft = null;
  const priceOf = (cat, id) => (W[cat] || []).find((x) => x.id === id)?.price || 0;
  const owned = (cat, id) => isAdmin() || priceOf(cat, id) === 0 || mine.owned.includes(`${cat}:${id}`);
  function unpaid(look) { return ['hair', 'top', 'bottom', 'shoes', 'acc'].filter((c) => !owned(c, look[c])).map((c) => ({cat: c, id: look[c], price: priceOf(c, look[c])})); }
  function rebuildMe() {
    const pos = me.av.position.clone(), ry = me.av.rotation.y; scene.remove(me.av);
    me.av = A.buildAvatar(draft || mine.look); me.av.position.copy(pos); me.av.rotation.y = ry; me.av.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(me.av);
  }
  function openCloset() {
    draft = draft || Object.assign({}, mine.look); if (!camState.closeUp) { camState.closeBase = camState.yaw; camState.closeYaw = 0; me.av.rotation.y = camState.yaw; } camState.closeUp = true;
    renderCloset();
  }
  function itemBtn(cat, it, on) { const p = it.price, own = owned(cat, it.id); return `<button class="item ${on ? 'on' : ''}" data-cat="${cat}" data-id="${it.id}">${esc(it.name)}<span class="price ${p === 0 ? 'free' : own ? 'owned' : ''}">${p === 0 ? '기본' : own ? '보유' : `⬡${p}`}</span></button>`; }
  function swatches(key, list) { return `<div class="swatches">${list.map((c) => `<button class="sw ${draft[key] === c ? 'on' : ''}" data-color="${key}" data-val="${c}" style="background:#${c.toString(16).padStart(6, '0')}" aria-label="색상"></button>`).join('')}</div>`; }
  function renderCloset() {
    const d = draft, due = unpaid(d), total = due.reduce((a, b) => a + b.price, 0), chips = myChips();
    let body = '';
    if (closetTab === 'face') body = `<div class="label-row">체형</div><div class="items">${W.body.map((it) => itemBtn('body', it, (d.body || 'f') === it.id)).join('')}</div><div class="label-row">피부</div>${swatches('skin', W.colors.skin)}<div class="label-row">눈</div><div class="items">${W.eyes.map((it) => itemBtn('eyes', it, d.eyes === it.id)).join('')}</div>
      <div class="label-row">눈썹</div><div class="items">${W.brows.map((it) => itemBtn('brows', it, d.brows === it.id)).join('')}</div>
      <div class="label-row">볼터치</div><div class="items"><button class="item ${d.blush ? 'on' : ''}" data-blush="1">있음<span class="price free">무료</span></button><button class="item ${!d.blush ? 'on' : ''}" data-blush="0">없음<span class="price free">무료</span></button></div>`;
    else {
      const colorKey = {hair: 'hairColor', top: 'topColor', bottom: 'bottomColor', shoes: 'shoeColor'}[closetTab];
      const fits = W[closetTab].filter((it) => (A.fitsBody ? A.fitsBody(it, d.body) : true) && (!it.hide || owned(closetTab, it.id) && it.price > 0 && mine.owned.includes(`${closetTab}:${it.id}`) || d[closetTab] === it.id));
      body = `<div class="label-row" style="margin-top:0">${(d.body || 'f') === 'm' ? '남자' : '여자'} 캐릭터 옷장 <small style="color:var(--muted);font-weight:600">· 체형은 얼굴 탭에서 바꿔요</small></div><div class="items">${fits.map((it) => itemBtn(closetTab, it, d[closetTab] === it.id)).join('')}</div>${colorKey ? `<div class="label-row">색상 (무료)</div>${swatches(colorKey, closetTab === 'hair' ? W.colors.hair : W.colors.cloth)}` : ''}`;
    }
    openSheet({kicker: 'DRESS ROOM', title: '👕 드레스룸', cls: 'closet', onClose: () => { camState.closeUp = false; draft = null; rebuildMe(); }, html: `
      <div class="tabs">${TABS.map((t) => `<button data-tab="${t.id}" class="${closetTab === t.id ? 'on' : ''}">${t.name}${t.free ? ' · 무료' : ''}</button>`).join('')}</div>${body}
      <div class="closet-foot"><span class="sum">${total ? (total > chips ? `👀 미리보기 중 · <b>⬡${fmt(total - chips)}</b> 더 모으면 살 수 있어요` : `새로 살 것 ${due.length}개 · <b>⬡${total}</b> (보유 ⬡${fmt(chips)})`) : '바꾼 모습을 저장할 수 있어요'}</span>
      <button class="btn gold" id="wearBtn" ${total > chips ? 'disabled' : ''}>${total ? (total > chips ? '씽크칩 부족' : '구매하고 입기') : '저장하기'}</button></div>`});
    $('sheetBody').onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { closetTab = b.dataset.tab; renderCloset(); return; }
      if (b.dataset.cat === 'body' && b.dataset.id !== (draft.body || 'f')) { // 남↔여 바꾸면 안 맞는 머리·옷은 그 체형 기본으로
        draft.body = b.dataset.id; const def = (A.GENDER_DEFAULT || {})[draft.body] || {};
        for (const c of ['hair', 'top', 'bottom', 'shoes', 'acc']) { const it = W[c].find((x) => x.id === draft[c]); if (it && A.fitsBody && !A.fitsBody(it, draft.body)) draft[c] = c === 'acc' ? 'none' : def[c] || W[c][0].id; }
        if (draft.body === 'm' && !['part', 'buzz', 'spiky', 'dandy', 'mperm', 'wolf'].includes(draft.hair)) draft.hair = def.hair; }
      else if (b.dataset.cat) { draft[b.dataset.cat] = b.dataset.id; }
      else if (b.dataset.color) { draft[b.dataset.color] = Number(b.dataset.val); }
      else if (b.dataset.blush) { draft.blush = b.dataset.blush === '1'; }
      else if (b.id === 'wearBtn') { wear(); return; }
      else return;
      rebuildMe(); renderCloset();
    };
  }
  function wear() {
    const due = unpaid(draft), total = due.reduce((a, b) => a + b.price, 0);
    if (total > myChips() && !(acctOn() && !loggedIn())) { toast('씽크칩이 부족해요. 게임으로 모아 보세요!'); return; }
    if (wear.busy) return;
    (async () => { if (total && !(await confirmBuy({title: `👕 ${due.length}개를 사서 입을까요?`, desc: due.map((x) => (W[x.cat].find((i) => i.id === x.id) || {}).name || x.id).join(', '), price: total}))) return;
      wear.busy = true; const what = due.map((x) => `${x.cat}:${x.id}`).join(','), ok = await payChips(total, '옷을 사려면 ', what); wear.busy = false;
      if (ok) { wearDone(due, total); if (payChips.lastId) showUndo(payChips.lastId, `옷 ${due.length}개`, total); } })();
  }
  function wearDone(due, total) {
    mine.owned = [...new Set([...mine.owned, ...due.map((x) => `${x.cat}:${x.id}`)])]; mine.look = Object.assign({}, draft); A.saveMine(mine);
    me.look = A.encodeLook(mine.look); sendLook();
    toast(total ? `구매 완료! -${total} 씽크칩` : '저장했어요'); setExpr(me, 'laugh');
    draft = null; camState.closeUp = false; closeSheet(); rebuildMe(); drawBoard(); setTicker(); pushData('avatar');
  }

  // 친구 방: 같은 코드로 들어온 사람들만 보이는 라운지 (파티 게임도 같은 방으로 이어져요)
  // ── 미니홈피 감성: 방마다 TODAY/TOTAL 방문자 수 + 방명록 ──
  let hp = null; // {today, total, gb:[{name, look, text, at}]}
  function renderRoomLabel() {
    const base = room.public ? '공개 라운지' : isVip() ? '👑 VIP 라운지' : isHome() ? (myHome() ? '🏠 내 방' : `🏠 ${homeOwner || '친구'}의 방`) : `친구 방 · ${room.code}`;
    $('roomLabel').innerHTML = hp && !room.public ? `${esc(isHome() ? base : room.code)} · <span class="hp-count">TODAY <b>${hp.today}</b> · TOTAL <b>${hp.total}</b></span>` : esc(base);
  }
  const ago = (t) => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`; };
  function renderGuestbook() {
    const list = (hp && hp.gb) || [];
    $('gbList').innerHTML = list.length ? list.map((g) => `<div class="gb-item"><b>${esc(g.name)}</b><span>${esc(g.text)}</span><small>${ago(g.at)}</small></div>`).join('') : '<p class="table-note" style="text-align:center;margin:14px 0">아직 방명록이 비어 있어요. 첫 글을 남겨 보세요 ✍️</p>';
  }
  function openGuestbook() {
    if (room.public) { toast('방명록은 친구 방에만 있어요 · 친구 방을 만들어 보세요'); return openFriends(); }
    openSheet({kicker: 'GUESTBOOK', title: `📖 ${room.code} 방명록`, html: `
      <div class="hp-strip">TODAY <b>${hp ? hp.today : 0}</b> &nbsp;|&nbsp; TOTAL <b>${hp ? hp.total : 0}</b></div>
      <form class="gb-form" id="gbForm"><input id="gbInput" maxlength="60" placeholder="다녀갑니다~ 한 줄 남기기" autocomplete="off"><button class="btn gold">남기기</button></form>
      <div class="gb-list" id="gbList"></div>`});
    renderGuestbook();
    $('gbForm').onsubmit = (e) => { e.preventDefault(); const v = $('gbInput').value.trim(); if (!v) return;
      if (!conn || conn.readyState !== 1) return toast('연결된 뒤에 남길 수 있어요');
      conn.send(JSON.stringify({t: 'gb', text: v})); $('gbInput').value = ''; toast('방명록을 남겼어요'); setExpr(me, 'happy'); };
  }
  function openFriends() {
    openSheet({kicker: 'FRIENDS', title: '👥 친구', html: `
      <div id="socialBox"></div>
      <h3 class="sheet-sub">친구 방 <small>· 코드로 들어온 사람끼리만 모이는 라운지</small></h3>
      ${room.public ? '<div class="card"><p>친구 방을 만들면 코드로 들어온 친구들만 같은 라운지에 모여요. 파티 게임을 고르면 그 친구들과 바로 같은 방에서 시작해요.</p></div>'
        : `<div class="card"><h3>친구 방 코드</h3><div class="big-code">${room.code}</div><p>이 코드나 링크를 보내면 같은 라운지로 들어와요.</p></div><button class="btn gold full" id="shareBtn">초대 링크 보내기</button>`}
      <div class="code-row"><input id="codeInput" maxlength="6" placeholder="코드 입력" autocapitalize="characters"><button class="btn ghost" id="joinBtn">입장</button></div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn ${room.public ? 'gold' : 'ghost'} full" id="newRoomBtn">새 친구 방 만들기</button>${room.public ? '' : '<button class="btn ghost full" id="publicBtn">공개 라운지로</button>'}</div>
      ${room.public ? '' : `<button class="btn ghost full" id="gbBtn" style="margin-top:8px">📖 방명록 · TODAY ${hp ? hp.today : 0}</button>`}`});
    $('codeInput').oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    $('joinBtn').onclick = () => { const c = $('codeInput').value; if (c.length < 4) return toast('코드 4자리를 입력해 주세요'); switchRoom(c); closeSheet(); };
    $('newRoomBtn').onclick = () => { switchRoom(newCode()); openFriends(); };
    if ($('publicBtn')) $('publicBtn').onclick = () => { switchRoom(null); closeSheet(); };
    if ($('shareBtn')) $('shareBtn').onclick = shareRoom;
    if ($('gbBtn')) $('gbBtn').onclick = openGuestbook;
    const box = $('socialBox');
    box.onchange = (e) => { if (e.target.id !== 'nameInput') return; const p = profile(); p.nickname = e.target.value.trim().slice(0, 12); saveProfile(p); me.tag.textContent = myName(); showName(); reconnect(); if (loggedIn()) ACC.call('hello', {name: myName()}).catch(() => {}); toast('이름을 바꿨어요'); };
    box.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
      if (b.id === 'friendLinkBtn') return shareFriendLink();
      if (b.id === 'socialRetry') return syncSocial();
      if (b.id === 'socialLogin') return openLogin();
      try {
        if (d.add) { b.disabled = true; const r = await ACC.call('request', {to: d.add}); const made = r.ok && r.friends.some((f) => f.pid === d.add); toast(r.ok ? (made ? '친구가 됐어요! 🎉' : '친구 신청을 보냈어요') : socialMsg(r.error)); if (made) celebrate(d.add); }
        else if (d.acc) { const r = await ACC.call('accept', {to: d.acc}); toast(r.ok ? '친구가 됐어요! 🎉' : socialMsg(r.error)); if (r.ok) celebrate(d.acc); }
        else if (d.hs) { closeSheet(); requestHandshake(d.hs); }
        else if (d.dec) { await ACC.call('decline', {to: d.dec}); }
        else if (d.del) { const f = social().friends.find((x) => x.pid === d.del); if (f && confirm(`${f.name}님을 친구에서 삭제할까요?`)) await ACC.call('remove', {to: d.del}); }
        else if (d.gift) { const f = social().friends.find((x) => x.pid === d.gift); if (f) return openGift(f); }
      } catch (err) { toast('인터넷 연결을 확인해 주세요'); }
      renderSocial();
    };
    renderSocial(); syncSocial();
  }

  // ───────── 로그인 · 서버 지갑 · 친구 · 칩 선물 (live-server User — 오프라인이어도 신청·선물이 도착해요) ─────────
  const GIFT_AMOUNTS = [100, 300, 1000, 3000];
  const st = () => (ACC && ACC.state) || {};
  const social = () => st().social || {friends: [], requests: [], pending: [], gifts: [], sentToday: 0, giftMax: 5000};
  function openLogin(why = '') {
    if (IN_TOSS) { tossAuto(); toast('잠시만요, 연결하는 중이에요'); return; } // 토스 앱은 로그인 화면 없이 자동
    openSheet({kicker: 'LOGIN', title: '🔑 로그인', html: `
      <div class="card"><h3>${esc(why)}로그인이 필요해요</h3><p>로그인하면 씽크칩·산 옷과 가구·친구가 계정에 저장돼서 폰을 바꾸거나 앱을 지워도 그대로예요.</p></div>
      ${IN_TOSS ? '<button class="btn gold full" id="loginGo">토스 계정으로 계속하기</button>' : '<button class="btn kakao full" id="loginGo">카카오로 로그인</button>'}
      <p class="table-note" style="text-align:center">로그인 없이도 라운지 구경과 혼자 하는 게임은 할 수 있어요.</p>`});
    $('loginGo').onclick = () => {
      if (IN_TOSS) { location.href = ARENA.href; return; } // 토스 앱: 메인 앱이 토스 계정으로 로그인하고 라운지로 돌려보내요
      if (!ACC || !ACC.loginKakao()) toast('지금은 로그인할 수 없어요. 인터넷 연결을 확인해 주세요');
    };
  }
  // 토스 앱: 로그인 없이 이 기기 계정으로 자동 연결 (메인 앱이 토스 계정으로 먼저 연결했으면 그대로 써요)
  let tossTried = 0;
  function tossAuto() { if (!IN_TOSS || !ACC || !acctOn() || ACC.hasSession() || Date.now() - tossTried < 5000) return; tossTried = Date.now(); ACC.loginDevice(myName()).then((ok) => { if (ok) afterSync(); }); }
  // 칩 쓰기: 로그인 상태면 서버 지갑에서, 오프라인 데모면 이 기기 지갑에서. 성공하면 true
  async function payChips(total, why, what) {
    payChips.lastId = null;
    if (!total) return true;
    if (!acctOn()) { if (total > myChips()) { toast('씽크칩이 부족해요'); return false; } addChips(-total); return true; }
    if (!loggedIn()) { openLogin(why); return false; }
    try { const r = await ACC.call('spend', {amount: total, what}); if (r.ok) { payChips.lastId = r.buyId || null; return true; } toast(r.error === 'chips' ? '씽크칩이 부족해요' : '잠시 후 다시 시도해 주세요'); }
    catch (e) { toast('인터넷 연결을 확인해 주세요'); }
    return false;
  }
  // 내 캐릭터·방을 계정에 저장 (기기를 바꿔도 산 옷·가구 유지)
  function pushData(key) { if (!loggedIn()) return; const value = key === 'avatar' ? {look: mine.look, owned: mine.owned} : {deco: myRoom.deco, owned: myRoom.owned}; ACC.call('save', {key, value}).catch(() => {}); }
  let pulledData = false;
  function pullData() { // 로그인 후 처음: 계정에 저장된 게 있으면 가져오고, 없으면 이 기기 것을 올려요
    if (pulledData || !loggedIn() || !st().wallet) return; pulledData = true; const d = st().data || {};
    if (d.avatar && d.avatar.look) { const owned = [...new Set([...(d.avatar.owned || []), ...mine.owned])]; mine = {look: Object.assign({}, A.DEFAULT_LOOK, d.avatar.look), owned}; A.saveMine(mine); me.look = A.encodeLook(mine.look); rebuildMe(); sendLook(); if (owned.length > (d.avatar.owned || []).length) pushData('avatar'); }
    else { if (d.avatar && Array.isArray(d.avatar.owned)) { mine.owned = [...new Set([...mine.owned, ...d.avatar.owned])]; A.saveMine(mine); } if (localStorage.getItem('thinkchip:avatar:v1')) pushData('avatar'); }
    if (d.room && d.room.deco) { myRoom = {deco: Object.assign({}, DEFAULT_DECO, d.room.deco), owned: [...new Set([...(d.room.owned || []), ...myRoom.owned])]}; store.set(ROOM_KEY, myRoom); if (!decoDraft) applyDecor(currentDeco()); if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'deco', deco: encodeDeco(myRoom.deco)})); }
    else { if (d.room && Array.isArray(d.room.owned)) { myRoom.owned = [...new Set([...myRoom.owned, ...d.room.owned])]; store.set(ROOM_KEY, myRoom); } if (myRoom.owned.length) pushData('room'); }
  }
  async function sendGift(f, amount) {
    const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    let r; try { r = await ACC.call('gift', {to: f.pid, amount, id}); } catch (e) { r = {error: 'net'}; }
    if (r.ok) { toast(`🎁 ${f.name}님에게 ⬡${fmt(amount)}을 선물했어요`); setExpr(me, 'happy'); chatLine('', `🎁 ${f.name}님에게 ⬡${fmt(amount)} 선물을 보냈어요`, true); }
    else toast(`선물하지 못했어요 · ${socialMsg(r.error)}`);
    drawBoard(); closeSheet(); openFriends();
  }
  const socialMsg = (e) => ({owned: '이미 가지고 있는 아이템이에요', nogift: '토스 앱에서 접속한 친구에게는 선물할 수 없어요', paid: '선물할 수 있는 충전 칩이 부족해요', limit: '오늘 선물 한도를 넘었어요 (하루 ⬡5,000)', notfriend: '친구에게만 선물할 수 있어요', theirfull: '상대가 받은 신청이 너무 많아요', gone: '이미 처리된 신청이에요', nouser: '아직 로그인한 적 없는 사람이에요', net: '인터넷 연결을 확인해 주세요'}[e] || '잠시 후 다시 시도해 주세요');
  let seenReq = -1;
  function afterSync() { // 서버 상태가 바뀔 때마다: 받은 선물 알림, 새 친구 신청, 배지, 화면
    if (!loggedIn()) { renderChips(); renderSocialBadge(); return; }
    if (st().pid && st().pid !== ME) { location.reload(); return; } // 방금 로그인: 계정 id 로 다시 접속
    if (st().welcomeBonus) { const n = st().welcomeBonus; ACC.clearWelcome(); setTimeout(() => { toast(`🎉 가입 축하 보너스 +${n} 씽크칩!`); setExpr(me, 'laugh'); }, 600); }
    const so = social(), got = so.gifts || [];
    if (got.length && !afterSync.busy) { afterSync.busy = true;
      const items = got.filter((g) => g.type === 'item'), chipsG = got.filter((g) => g.type !== 'item');
      for (const g of chipsG) chatLine('', `🎁 ${g.name}님에게 ⬡${fmt(g.amount)} 선물을 받았어요`, true);
      for (const g of items) { chatLine('', `🎁 ${g.name}님에게 '${g.itemName}' 선물을 받았어요`, true); const key = `${g.cat}:${g.item}`;
        if (['hair', 'top', 'bottom', 'shoes', 'acc'].includes(g.cat)) { if (!mine.owned.includes(key)) { mine.owned = [...mine.owned, key]; A.saveMine(mine); } } else if (!myRoom.owned.includes(key)) { myRoom.owned = [...myRoom.owned, key]; store.set(ROOM_KEY, myRoom); } }
      if (chipsG.length) { const from = [...new Set(chipsG.map((g) => g.name))]; toast(`🎁 ${from.slice(0, 2).join(', ')}${from.length > 2 ? ` 외 ${from.length - 2}명` : ''}님이 ⬡${fmt(chipsG.reduce((a, g) => a + g.amount, 0))}을 선물했어요!`); }
      else if (items.length) toast(`🎁 ${items[0].name}님이 '${items[0].itemName}'${items.length > 1 ? ` 외 ${items.length - 1}개` : ''}를 선물했어요! 드레스룸·방 꾸미기에서 써 보세요`);
      setExpr(me, 'happy');
      ACC.call('seen', {ids: got.map((g) => g.id)}).catch(() => {}).finally(() => { afterSync.busy = false; }); }
    const nReq = (so.requests || []).length; if (seenReq >= 0 && nReq > seenReq) toast(`📩 친구 신청이 ${nReq}개 와 있어요 · 👥 친구에서 확인`); seenReq = nReq;
    me.tag.textContent = badgeIcons(st().badges) + myName(); if (myHome()) drawShowcase(st().badges); if (secretary && secretary.userData.skin !== mySkin()) { setSecretary(mySkin()); if (myHome()) setHomeSecretary(mySkin()); }
    syncName(); pullData(); renderChips(); renderSocialBadge(); drawBoard(); renderSocial(); showCalls(); if (conn && conn.readyState === 1) setOnline(true); else renderPeople();
  }
  let nameSynced = false;
  function syncName() { // 새 기기에서 처음이면 계정 이름을 쓰고, 아니면 이 기기에서 정한 이름을 계정에 올려요
    if (nameSynced || !st().wallet) return; nameSynced = true; const server = st().name || '';
    if (firstName && server) { const p = profile(); p.nickname = server; saveProfile(p); me.tag.textContent = myName(); showName(); reconnect(); }
    else if (server !== myName()) ACC.call('hello', {name: myName()}).catch(() => {});
  }
  function syncSocial() { if (loggedIn()) ACC.refresh(); }
  function renderSocialBadge() { const b = document.querySelector('.dock-right [data-open="friends"]'); if (b) b.classList.toggle('has-badge', loggedIn() && (social().requests || []).length > 0); }
  function renderSocial() {
    const box = $('socialBox'); if (!box || $('sheet').hidden) return;
    if (document.activeElement && document.activeElement.id === 'nameInput') return; // 이름 입력 중엔 다시 그리지 않아요
    const nameRow = `<div class="name-row" style="margin:0 0 12px"><div class="label-row">내 이름 <small style="color:var(--muted);font-weight:600">· 바꾸면 머리 위 이름과 친구 목록 이름이 바뀌어요</small></div><input id="nameInput" maxlength="12" value="${esc(profile().nickname || '')}" placeholder="라운지에서 보일 이름"></div>`;
    if (!acctOn()) { box.innerHTML = nameRow + '<div class="card"><p>오프라인이라 친구 기능을 쓸 수 없어요.</p></div>'; return; }
    if (!loggedIn()) { box.innerHTML = nameRow + (IN_TOSS ? '<div class="card"><p>연결하는 중이에요… 잠시 후 다시 열어 주세요.</p></div>' : '<div class="card"><h3>👥 친구</h3><p>로그인하면 친구를 맺고, 손인사하고, 칩을 선물할 수 있어요.</p></div><button class="btn kakao full" id="socialLogin" style="margin-bottom:16px">🔑 로그인하기</button>'); if (IN_TOSS) tossAuto(); return; }
    const so = social(), fr = so.friends || [], rq = so.requests || [], known = new Set([...fr.map((f) => f.pid), ...(so.pending || [])]);
    const here = [...online.entries()].filter(([pid]) => pid !== ME && !known.has(pid) && !rq.some((r) => r.pid === pid));
    const pending = (so.pending || []).length, paid = giftable();
    box.innerHTML = nameRow + `
      ${st().wallet ? '' : `<div class="card"><p>${st().offline ? '친구 목록을 불러오지 못했어요.' : '불러오는 중…'}</p>${st().offline ? '<button class="btn ghost full" id="socialRetry" style="margin-top:8px">다시 불러오기</button>' : ''}</div>`}
      ${rq.length ? `<div class="card"><h3>📩 받은 친구 신청 ${rq.length}</h3>${rq.map((r) => `<div class="f-row"><b>${esc(r.name)}</b><span><button class="btn gold sm" data-acc="${esc(r.pid)}">수락</button><button class="btn ghost sm" data-dec="${esc(r.pid)}">거절</button></span></div>`).join('')}</div>` : ''}
      <div class="card"><h3>👥 내 친구 ${fr.length}</h3>
        ${fr.length ? fr.map((f) => `<div class="f-row"><b>${online.has(f.pid) ? '<i class="f-on" title="같은 라운지에 있어요"></i>' : ''}${esc(f.name)}</b><span>${players.has(f.pid) ? `<button class="btn ghost sm" data-hs="${esc(f.pid)}">🤝 손인사</button>` : ''}${IN_TOSS || f.nogift ? '' : `<button class="btn gold sm" data-gift="${esc(f.pid)}">🎁 선물</button>`}<button class="btn ghost sm" data-del="${esc(f.pid)}" aria-label="친구 삭제">✕</button></span></div>`).join('')
          : '<p>아직 친구가 없어요. 아래 라운지에 있는 사람에게 신청하거나 친구 추가 링크를 보내 보세요.</p>'}
        ${IN_TOSS ? '' : `<p style="margin-top:8px;font-size:11.5px">선물할 수 있는 칩 <b style="color:var(--gold)">⬡${fmt(paid)}</b> · 충전한 칩만 선물할 수 있어요</p>`}
        ${pending ? `<p style="margin-top:4px;font-size:11.5px">친구 신청 보낸 사람 ${pending}명 · 수락하면 친구가 돼요</p>` : ''}</div>
      ${here.length ? `<div class="card"><h3>지금 라운지에 있는 사람</h3>${here.slice(0, 12).map(([pid, name]) => `<div class="f-row"><b><i class="f-on"></i>${esc(otherName({pid, name}))}</b><button class="btn ghost sm" data-add="${esc(pid)}">+ 친구 신청</button></div>`).join('')}<p style="margin-top:6px;font-size:11px">로그인한 사람에게만 신청할 수 있어요.</p></div>` : ''}
      <button class="btn ghost full" id="friendLinkBtn" style="margin-bottom:16px">📲 친구 추가 링크 보내기</button>`;
  }
  let giftTab = 'item';
  function openGift(f) {
    if (IN_TOSS || !loggedIn()) return;
    const so = social(), paid = giftable(), left = Math.max(0, (so.giftMax || 5000) - (so.sentToday || 0)), chips = myChips();
    const can = (a) => a <= paid && a <= left;
    const AV = ['hair', 'top', 'bottom', 'shoes', 'acc'], RM = ['wall', 'floor', 'rug', 'items'], CK = {hair: '헤어', top: '상의', bottom: '하의', shoes: '신발', acc: '소품', wall: '벽지', floor: '바닥', rug: '러그', items: '가구'};
    const itemList = [...AV.flatMap((c) => W[c].filter((it) => it.price > 0).map((it) => ({c, ...it}))), ...RM.flatMap((c) => DECOR[c].filter((it) => it.price > 0).map((it) => ({c, ...it})))];
    const tabs = `<div class="tabs" style="margin-bottom:10px"><button data-gtab="item" class="${giftTab === 'item' ? 'on' : ''}">👕 옷·가구</button><button data-gtab="chips" class="${giftTab === 'chips' ? 'on' : ''}">⬡ 칩</button></div>`;
    const body = giftTab === 'item'
      ? `<div class="card"><p>게임에서 모은 칩으로도 선물할 수 있어요 · 내 칩 <b style="color:var(--gold)">⬡${fmt(chips)}</b></p><p style="font-size:11.5px;margin-top:4px">친구가 이미 가진 건 선물할 수 없어요 (칩은 돌려받아요).</p></div>
        <div class="items gift-items">${itemList.map((it) => `<button class="item" data-gi="${it.c}:${it.id}" ${it.price > chips ? 'disabled' : ''}><small style="color:var(--muted)">${CK[it.c]}</small> ${esc(it.name)}<span class="price">⬡${it.price}</span></button>`).join('')}</div>`
      : `<div class="card"><p>선물할 수 있는 칩 <b style="color:var(--gold)">⬡${fmt(paid)}</b></p><p style="font-size:11.5px;margin-top:4px">칩 선물은 충전(결제)한 칩만 돼요. 오늘 남은 한도 ⬡${fmt(left)}</p></div>
        <div class="gift-grid">${GIFT_AMOUNTS.map((a) => `<button class="btn ${can(a) ? 'gold' : 'ghost'}" data-amt="${a}" ${can(a) ? '' : 'disabled'}>⬡${fmt(a)}</button>`).join('')}</div>
        ${paid < GIFT_AMOUNTS[0] ? '<button class="btn ghost full" id="giftCharge" style="margin-top:10px">💳 씽크칩 충전하러 가기</button>' : ''}`;
    openSheet({kicker: 'GIFT', title: `🎁 ${f.name}님에게 선물`, html: `${tabs}${body}<button class="btn ghost full" id="giftBack" style="margin-top:8px">← 친구 목록</button><p class="table-note">보낸 선물은 되돌릴 수 없어요.</p>`});
    $('sheetBody').onclick = async (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.gtab) { giftTab = b.dataset.gtab; return openGift(f); }
      if (b.id === 'giftBack') { closeSheet(); return openFriends(); }
      if (b.id === 'giftCharge') { location.href = new URL('../index.html?wallet=1&from=lounge', location.href).href; return; }
      if (b.dataset.amt) { const a = Number(b.dataset.amt); if (await confirmBuy({title: `🎁 ${f.name}님에게 칩을 선물할까요?`, price: a, note: '보낸 선물은 취소할 수 없어요', cta: '선물하기'})) { b.disabled = true; sendGift(f, a); } return; }
      if (b.dataset.gi) { const [c, id] = b.dataset.gi.split(':'), it = itemList.find((x) => x.c === c && x.id === id); if (!it) return;
        if (!(await confirmBuy({title: `🎁 ${f.name}님에게 '${it.name}'을 선물할까요?`, price: it.price, note: '보낸 선물은 취소할 수 없어요', cta: '선물하기'}))) return; b.disabled = true;
        let r; try { r = await ACC.call('giftItem', {to: f.pid, cat: c, id, gid: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9)}); } catch (er) { r = {error: 'net'}; }
        if (r.ok) { toast(`🎁 ${f.name}님에게 '${it.name}'을 선물했어요`); setExpr(me, 'happy'); chatLine('', `🎁 ${f.name}님에게 '${it.name}' 선물을 보냈어요`, true); drawBoard(); closeSheet(); openFriends(); }
        else { toast(r.error === 'owned' ? `${f.name}님은 이미 가지고 있어요 (칩은 돌려받았어요)` : r.error === 'chips' ? '씽크칩이 부족해요' : `선물하지 못했어요 · ${socialMsg(r.error)}`); b.disabled = false; } }
    };
  }
  // ───────── 뱃지 · VIP 라운지 · 전광판 슈퍼챗 · 비서 스킨 ─────────
  const VIP_PLANS_UI = [['d7', '7일권', 500, '7일 동안 자유 입장'], ['d30', '30일권', 1500, '30일 동안 자유 입장 · 하루 50칩꼴'], ['one', '1회권', 100, '오늘 하루 입장'], ['ten', '10회권', 800, '1회권 10장 (20% 할인)']];
  const dateKo = (t) => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
  function openVip() {
    if (acctOn() && !loggedIn()) return openLogin('VIP 라운지에 들어가려면 ');
    if (!acctOn()) return toast('인터넷에 연결되면 들어갈 수 있어요');
    const v = st().vip || {}, stt = st().stats || {}, bs = st().badges || [];
    openSheet({kicker: 'VIP LOUNGE', title: '👑 VIP 라운지', html: `
      <div class="card vip-card"><p>우승자·고수들만 모이는 라운지예요. 아래 <b>뱃지</b> 중 하나라도 있으면 무료, 없으면 <b>입장권</b>으로 들어가요.</p></div>
      <div class="badge-grid">${Object.entries(BADGES).filter(([, b]) => b.vip).map(([k, b]) => `<div class="bdg ${bs.includes(k) ? 'on' : ''}"><i>${b.e}</i><b>${b.name}</b><small>${b.how}</small></div>`).join('')}</div>
      <p class="table-note" style="margin:6px 2px 12px">내 기록 · 1등 <b>${fmt(stt.wins || 0)}</b>번 · 우승 <b>${fmt(stt.champs || 0)}</b>번</p>
      <div class="card"><h3>내 입장권</h3><p>${v.badge ? '🎖 뱃지가 있어서 언제든 무료 입장!' : v.until > Date.now() ? `기간권 · ${dateKo(v.until)}까지` : v.day > Date.now() ? '오늘 하루 입장 중' : '기간권 없음'} · 1회권 ${v.tickets || 0}장</p></div>
      <button class="btn gold full" id="vipEnter" ${v.ok || v.tickets > 0 ? '' : 'disabled'}>${v.ok ? '👑 입장하기' : v.tickets > 0 ? '👑 1회권 쓰고 입장 (오늘 하루 자유 입장)' : '입장권이 필요해요'}</button>
      <div class="vip-plans">${VIP_PLANS_UI.map(([id, n, price, sub]) => `<button class="vip-plan" data-vplan="${id}"><b>${n}</b><span>⬡${fmt(price)}</span><small>${sub}</small></button>`).join('')}</div>
      <p class="table-note" style="margin-top:8px">게임에서 번 칩으로도 살 수 있어요. 지갑의 충전소에 'VIP 30일 패키지'가 보이면 현금으로도 살 수 있어요 (30일권 + ⬡500).</p>`});
    $('sheetBody').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'vipEnter') { b.disabled = true; try { const r = await ACC.call('vipEnter'); if (!r.ok) { b.disabled = false; return toast(r.error === 'novip' ? '입장권이 필요해요' : '입장하지 못했어요'); }
        closeSheet(); switchRoom('VIP1'); me.av.position.set(0, 0, 4); toast(r.usedTicket ? '👑 1회권을 썼어요 · 오늘 하루 자유 입장!' : '👑 VIP 라운지에 오신 걸 환영해요'); } catch (er) { b.disabled = false; toast('인터넷 연결을 확인해 주세요'); } return; }
      if (b.dataset.vplan) { const pl = VIP_PLANS_UI.find((x) => x[0] === b.dataset.vplan); if (myChips() < pl[2]) return toast(`씽크칩이 ⬡${fmt(pl[2] - myChips())} 부족해요`);
        if (!(await confirmBuy({title: `👑 VIP ${pl[1]}을 살까요?`, desc: pl[3], price: pl[2]}))) return;
        b.disabled = true; try { const r = await ACC.call('vip', {plan: pl[0]}); toast(r.ok ? `${pl[1]} 구매 완료! -${pl[2]} 씽크칩` : r.error === 'chips' ? '씽크칩이 부족해요' : '구매하지 못했어요'); if (r.ok) { openVip(); if (r.buyId) showUndo(r.buyId, `VIP ${pl[1]}`, pl[2]); } } catch (er) { toast('인터넷 연결을 확인해 주세요'); } b.disabled = false; } };
  }
  // 전광판 슈퍼챗: 화면 위에 크게 지나가요 (일반 8초 · 메가 20초)
  const scQueue = []; let scBusy = false;
  function showSuperchat(m) { scQueue.push(m); if (!scBusy) nextSc(); if (m.pid && players.has(m.pid)) { const p = players.get(m.pid); say(p, `📢 ${m.text}`); setExpr(p, 'laugh', 3000); } }
  function nextSc() {
    const m = scQueue.shift(), el = $('scBoard'); if (!m || !el) { scBusy = false; if (el) el.hidden = true; return; } scBusy = true;
    el.className = `sc-board ${m.tier === 'mega' ? 'mega' : ''}`; el.innerHTML = `<span class="sc-tag">📢 ${m.tier === 'mega' ? 'MEGA ' : ''}슈퍼챗</span><b>${esc(badgeIcons(m.badges) + m.name)}</b><span class="sc-text">${esc(m.text)}</span>`; el.hidden = false;
    const left = Math.max(2500, (m.ms || 8000) - (Date.now() - (m.at || Date.now()))); setTimeout(nextSc, Math.min(left, scQueue.length ? 5000 : left));
  }
  function openSuperchat() {
    if (acctOn() && !loggedIn()) return openLogin('전광판에 띄우려면 ');
    if (!conn || conn.readyState !== 1) return toast('연결된 뒤에 보낼 수 있어요');
    let tier = 'normal';
    const draw = () => openSheet({kicker: 'SUPER CHAT', title: '📢 전광판 슈퍼챗', html: `
      <p style="font-size:12.5px;color:var(--muted);margin:0 0 10px">지금 이 라운지 모두의 화면 맨 위에 크게 떠요. 응원·도발·고백 다 좋아요 (욕설·비방은 안 돼요).</p>
      <input id="scText" maxlength="40" placeholder="예) 오늘 원카드 우승은 내 거다 😎" style="width:100%">
      <div class="vip-plans" style="margin-top:10px"><button class="vip-plan ${tier === 'normal' ? 'on' : ''}" data-tier="normal"><b>일반</b><span>⬡50</span><small>8초 동안</small></button><button class="vip-plan ${tier === 'mega' ? 'on' : ''}" data-tier="mega"><b>🔥 메가</b><span>⬡200</span><small>20초 · 금색으로 번쩍</small></button></div>
      <button class="btn gold full" id="scSend" style="margin-top:10px">전광판에 띄우기</button>`});
    draw();
    $('sheetBody').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tier) { const t = $('scText').value; tier = b.dataset.tier; draw(); $('scText').value = t; return; }
      if (b.id === 'scSend') { const text = $('scText').value.trim(); if (!text) return toast('띄울 말을 써 주세요'); const price = tier === 'mega' ? 200 : 50; if (myChips() < price) return toast(`씽크칩이 ⬡${fmt(price - myChips())} 부족해요`);
        if (!(await confirmBuy({title: '📢 전광판에 띄울까요?', desc: `“${text}”`, price, note: '전광판에 뜬 슈퍼챗은 취소할 수 없어요', cta: '띄우기'}))) return;
        b.disabled = true; try { const r = await ACC.call('superchat', {text, tier, room: room.code}); if (r.ok) { closeSheet(); toast(`📢 전광판에 띄웠어요! -${price} 씽크칩`); } else { b.disabled = false; toast(r.error === 'slow' ? '10초에 한 번 보낼 수 있어요' : r.error === 'chips' ? '씽크칩이 부족해요' : '보내지 못했어요'); } } catch (er) { b.disabled = false; toast('인터넷 연결을 확인해 주세요'); } } };
  }
  // ───────── 가구 쓰기: 앉기·눕기·연주·켜고 끄기 (친구 방·VIP 라운지 가구도 쓸 수 있어요) ─────────
  // spot: 가구 기준 자리 [x, z], ry: 가구 기준 바라보는 방향, y: 몸 높이
  const FURN_USE = {
    sofa: {label: '🛋️ 앉기', act: 'sit', seats: [[-0.6, 0.15], [0.6, 0.15]], ry: 0, y: 0.32, say: '아~ 편하다 😌'},
    bean: {label: '🫘 앉기', act: 'sit', seats: [[-0.9, 0], [0.9, 0]], ry: 0, y: 0.18, say: '푹신푹신~'},
    bed: {label: '😴 눕기', act: 'lie', seats: [[0, 0.25]], ry: 0, y: 0.72, say: 'Zzz… 💤', expr: 'sleep'},
    desk: {label: '📚 공부하기', act: 'sit', seats: [[0, 0.95]], ry: Math.PI, y: 0.18, arms: 'play', say: '집중… ✏️', expr: 'hmm'},
    piano: {label: '🎹 연주하기', act: 'stand', seats: [[0, 0.75]], ry: Math.PI, y: 0, arms: 'play', music: true},
    arcade: {label: '🕹️ 게임하기', act: 'stand', seats: [[0, 0.95]], ry: Math.PI, y: 0, arms: 'play', games: true},
    tv: {label: '📺 켜기/끄기', toggle: true}, lamp: {label: '💡 켜기/끄기', toggle: true}, neon: {label: '💡 켜기/끄기', toggle: true},
    tank: {label: '🐟 먹이 주기', feed: true}, plants: {label: '💧 물 주기', water: true}, tree: {label: '💧 물 주기', water: true},
    trophy: {label: '🏆 뱃지 보기', showcase: true}, shelf: {label: '📖 책 읽기', act: 'stand', seats: [[0, 0.9]], ry: Math.PI, y: 0, arms: {r: [-1.2, 0.3], l: [-1.2, -0.3]}, say: '이 책 재밌네 📖', expr: 'hmm'},
  };
  const fv = new THREE.Vector3();
  function useFurniture(id) {
    const u = FURN_USE[id], g = furniture[id]; if (!u || !g) return;
    if (u.toggle) { g.userData.off = !g.userData.off; g.traverse((o) => { if (o.isLight) { if (o.userData.i0 == null) o.userData.i0 = o.intensity; o.intensity = g.userData.off ? 0 : o.userData.i0; }
        if (o.material && o.material.emissive) { if (o.material.userData.e0 == null) o.material.userData.e0 = o.material.emissiveIntensity; o.material.emissiveIntensity = g.userData.off ? 0.02 : o.material.userData.e0; } });
      toast(g.userData.off ? '꺼졌어요' : '켜졌어요 ✨'); return; }
    if (u.showcase) return openShowcase();
    if (u.feed || u.water) { g.getWorldPosition(fv); fv.y = u.feed ? 1.4 : 1.8; walkTo(me, fv.x + 0.9, fv.z + 0.9, () => { setExpr(me, 'happy', 2500); say(me, u.feed ? '냠냠 먹어~ 🐟' : '쑥쑥 자라라 🌱'); spark(fv.clone(), true); setTimeout(() => spark(fv.clone(), false), 400);
        if (u.water) { g.userData.grow = 1; } if (u.feed) g.userData.fed = simT + 6; }); sendPose(); return; }
    // 빈 자리 찾기 (다른 사람이 앉아 있으면 옆자리)
    const seat = u.seats.map(([x, z]) => g.localToWorld(new THREE.Vector3(x, 0, z))).find((w) => ![...players.values()].some((p) => p !== me && p.act && Math.hypot(p.av.position.x - w.x, p.av.position.z - w.z) < 0.5));
    if (!seat) return toast('다른 사람이 쓰고 있어요');
    const ry = g.rotation.y + u.ry;
    walkTo(me, seat.x, seat.z, () => { me.act = {kind: u.act, ry, y: u.y, arms: u.arms || null}; sendPose();
      if (u.say) say(me, u.say); if (u.expr) setExpr(me, u.expr, 6000);
      if (u.music) playTune(); if (u.games) setTimeout(openGames, 900); });
    sendPose(); closeSheet();
  }
  // 피아노: 짧은 즉흥 멜로디 (오음계라 아무렇게나 쳐도 듣기 좋아요)
  let audioCtx = null;
  function playTune() {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3], t0 = audioCtx.currentTime + 0.05; let k = 3;
    for (let i = 0; i < 12; i++) { k = Math.max(0, Math.min(scale.length - 1, k + [-2, -1, 1, 2, 0][Math.floor(Math.random() * 5)])); const f = i === 11 ? scale[5] : scale[k], o = audioCtx.createOscillator(), gn = audioCtx.createGain(), at = t0 + i * 0.28;
      o.type = 'triangle'; o.frequency.value = f; gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(0.18, at + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, at + (i === 11 ? 1.2 : 0.42)); o.connect(gn).connect(audioCtx.destination); o.start(at); o.stop(at + 1.3);
      setTimeout(() => { if (!me.act) return; const h = me.av.position.clone(); h.y = 2.4; h.x += (Math.random() - 0.5) * 0.8; spark(h, i % 3 === 0); }, i * 280); }
    say(me, '🎵 ♪ ♫'); setExpr(me, 'happy', 4000);
  }
  function openFurniture(id) {
    const it = DECOR.items.find((x) => x.id === id); if (!it) return; const u = FURN_USE[id], own = myHome();
    if (!own) { if (u) return useFurniture(id); return; } // 친구 방·VIP 라운지: 누르면 바로 쓰기
    openSheet({kicker: 'FURNITURE', title: `🛋️ ${it.name}`, html: `${u ? `<button class="btn gold full" data-fa="use" style="margin-bottom:10px">${u.label}</button>` : ''}<div class="vip-plans"><button class="vip-plan" data-fa="move"><b>📍 옮기기</b><small>바닥을 눌러 놓을 곳 고르기</small></button><button class="vip-plan" data-fa="rot"><b>↻ 돌리기</b><small>45°씩</small></button><button class="vip-plan" data-fa="reset"><b>↩ 원래 자리</b><small>처음 놓인 곳으로</small></button><button class="vip-plan" data-fa="hide"><b>📦 치우기</b><small>보관함으로 (꾸미기에서 다시 놓기)</small></button></div>`});
    $('sheetBody').onclick = (e) => { const b = e.target.closest('[data-fa]'); if (!b) return; if (b.dataset.fa === 'use') return useFurniture(id); const a = b.dataset.fa, lay = myRoom.deco.lay = myRoom.deco.lay || {}, g = furniture[id], cur = lay[id] || g.userData.home;
      if (a === 'move') { closeSheet(); placingSc = id; toast(`바닥을 눌러 ${it.name}을(를) 놓을 곳을 고르세요`); return; }
      if (a === 'rot') lay[id] = [cur[0], cur[1], fromQ((snapQ(cur[2]) + 1) % 8)];
      if (a === 'reset') delete lay[id];
      if (a === 'hide') { myRoom.deco.items = (myRoom.deco.items || []).filter((x) => x !== id); closeSheet(); }
      applyDecor(currentDeco()); saveRoomLayout(); toast(a === 'hide' ? '📦 치웠어요 · 꾸미기 > 가구에서 다시 놓을 수 있어요' : a === 'rot' ? '↻ 돌렸어요' : '↩ 원래 자리로'); };
  }
  function saveRoomLayout() { store.set(ROOM_KEY, myRoom); pushData('room'); if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'deco', deco: encodeDeco(myRoom.deco)})); }
  function openShowcase() {
    const mine = myHome(), have = mine ? (loggedIn() ? st().badges || [] : []) : (hostDeco && hostDeco.badges) || [], stt = mine && loggedIn() ? st().stats || {} : null;
    openSheet({kicker: 'BADGE COLLECTION', title: `🏅 ${mine ? '내' : `${homeOwner || '친구'}의`} 뱃지 진열장 · ${have.length}/${Object.keys(BADGES).length}`, html: `
      ${mine && !loggedIn() ? '<div class="card"><p>로그인하면 뱃지를 모아서 전시할 수 있어요.</p></div>' : ''}
      <div class="badge-grid">${Object.entries(BADGES).map(([k, b]) => { const on = have.includes(k), [cur, goal] = stt && !on ? b.need(stt) : [0, 0];
        return `<div class="bdg ${on ? 'on' : ''}"><i>${on ? b.e : '❔'}</i><b>${b.name}${b.vip ? ' 🎟' : ''}</b><small>${b.how}</small>${stt && !on && goal > 1 ? `<span class="bdg-bar"><em style="width:${Math.min(100, (cur / goal) * 100)}%"></em></span><small>${fmt(Math.min(cur, goal))}/${fmt(goal)}</small>` : ''}</div>`; }).join('')}</div>
      <p class="table-note" style="margin-top:8px">🎟 표시 뱃지가 있으면 VIP 라운지에 무료로 들어가요. 진열장은 내 방에 놀러 온 친구들에게도 보여요.</p>
      ${mine ? '<div class="vip-plans" style="margin-top:10px"><button class="vip-plan" data-sc-act="move"><b>📍 위치 옮기기</b><small>바닥을 눌러 놓을 곳 고르기</small></button><button class="vip-plan" data-sc-act="rot"><b>↻ 돌리기</b><small>45°씩 방향 바꾸기</small></button><button class="vip-plan" data-sc-act="reset"><b>↩ 원래 자리</b><small>뒷벽 가운데로</small></button></div>' : ''}`});
    $('sheetBody').onclick = (e) => { const b = e.target.closest('[data-sc-act]'); if (!b) return; const a = b.dataset.scAct;
      if (a === 'move') { closeSheet(); placingSc = true; toast('바닥을 눌러 진열장을 놓을 곳을 고르세요'); return; }
      if (a === 'rot') { const c = myRoom.deco.sc || SC_HOME; myRoom.deco.sc = [c[0], c[1], fromQ((snapQ(c[2] || 0) + 1) % 8)]; }
      if (a === 'reset') delete myRoom.deco.sc;
      placeShowcase(myRoom.deco.sc); saveRoomLayout(); toast(a === 'rot' ? '↻ 방향을 바꿨어요' : '↩ 원래 자리로 옮겼어요'); };
  }
  // 한정판 비서 스킨 (비서 데스크에서)
  function skinSection() {
    const owned = (loggedIn() && st().skins) || ['classic'], cur = mySkin(), now = Date.now();
    return `<div class="card" style="margin-top:12px"><h3>💁 비서 스킨 <small style="color:var(--muted);font-weight:600">· 바꾼 스킨은 내 방에도 서 있어요</small></h3><div class="items skin-items">${Object.entries(SEC_SKINS).map(([id, k]) => { const own = owned.includes(id) || isAdmin() || !k.price, gone = k.until && now > Date.parse(k.until + 'T00:00:00+09:00');
      return `<button class="item ${cur === id ? 'on' : ''}" data-skin="${id}" ${!own && gone ? 'disabled' : ''}>${esc(k.name)}${k.until ? `<em class="limited">${gone ? '판매 종료' : `한정 ~${dateKo(Date.parse(k.until) - 864e5)}`}</em>` : ''}<span class="price ${!k.price ? 'free' : own ? 'owned' : ''}">${!k.price ? '기본' : own ? (cur === id ? '사용 중' : '보유') : `⬡${k.price}`}</span></button>`; }).join('')}</div></div>`;
  }
  // 구매 취소: 산 지 10분 안에만 (서버가 시간을 확인해요). 산 직후엔 아래에 '구매 취소' 바가 잠깐 떠요
  function showUndo(id, label, amount) {
    let el = $('undoBar'); if (!el) { el = document.createElement('div'); el.id = 'undoBar'; el.className = 'undo-bar'; document.body.appendChild(el); }
    el.innerHTML = `<span>✓ ${esc(label)} 구매 완료 <small>· ${Math.round((st().refundMs || 600000) / 60000)}분 안에 취소 가능</small></span><button data-undo="${esc(id)}">구매 취소</button>`; el.hidden = false;
    clearTimeout(showUndo.t); showUndo.t = setTimeout(() => { el.hidden = true; }, 9000);
    el.onclick = (e) => { const b = e.target.closest('[data-undo]'); if (b) { el.hidden = true; refundBuy(b.dataset.undo); } };
  }
  async function refundBuy(id) {
    const it = (st().buys || []).find((x) => x.id === id), left = it ? (st().refundMs || 600000) - (Date.now() - it.at) : 0;
    if (it && left <= 0) return toast('취소할 수 있는 시간(10분)이 지났어요');
    if (!(await confirmBuy({title: '↩ 이 구매를 취소할까요?', desc: it ? whatText(it.what) : '', price: it ? it.amount : 0, note: '쓴 칩을 돌려받고, 산 물건은 빠져요', cta: '구매 취소'}))) return;
    let r; try { r = await ACC.call('refund', {id}); } catch (e) { return toast('인터넷 연결을 확인해 주세요'); }
    if (!r.ok) return toast(r.error === 'late' ? '취소할 수 있는 시간(10분)이 지났어요' : r.error === 'used' ? '이미 사용해서 취소할 수 없어요' : '취소할 수 없는 구매예요');
    const keys = String(r.refunded.what || '').split(',').filter(Boolean);
    const ak = keys.filter((k) => ['hair', 'top', 'bottom', 'shoes', 'acc'].includes(k.split(':')[0])), rk = keys.filter((k) => ['wall', 'floor', 'rug', 'items'].includes(k.split(':')[0]));
    if (ak.length) { mine.owned = mine.owned.filter((k) => !ak.includes(k)); const def = (A.GENDER_DEFAULT || {})[mine.look.body === 'm' ? 'm' : 'f'] || {};
      for (const k of ak) { const [c, i] = k.split(':'); if (mine.look[c] === i) mine.look[c] = c === 'acc' ? 'none' : def[c] || W[c][0].id; }
      A.saveMine(mine); me.look = A.encodeLook(mine.look); rebuildMe(); sendLook(); pushData('avatar'); }
    if (rk.length) { myRoom.owned = myRoom.owned.filter((k) => !rk.includes(k)); const d = myRoom.deco;
      for (const k of rk) { const [c, i] = k.split(':'); if (c === 'items') d.items = (d.items || []).filter((x) => x !== i); else if (d[c] === i) d[c] = DEFAULT_DECO[c]; }
      store.set(ROOM_KEY, myRoom); applyDecor(currentDeco()); saveRoomLayout(); }
    if (r.refunded.kind === 'skin') { setSecretary(mySkin()); if (myHome()) setHomeSecretary(mySkin()); }
    toast(`↩ 구매를 취소했어요 · ⬡${fmt(r.refunded.amount)} 돌려받았어요`); drawBoard(); renderChips();
  }
  function whatText(what) { return String(what || '').split(',').filter(Boolean).map((k) => { const [c, i] = k.split(':');
    if (c === 'vip') return `VIP ${(VIP_PLANS_UI.find((x) => x[0] === i) || [])[1] || ''}`; if (c === 'skin') return `비서 스킨 '${(SEC_SKINS[i] || {}).name || i}'`;
    if (W[c]) return (W[c].find((x) => x.id === i) || {}).name || i; if (DECOR[c]) return pick(c, i).name; return i; }).join(', '); }
  function recentBuysHtml() {
    const list = loggedIn() ? (st().buys || []).filter((x) => (st().refundMs || 600000) - (Date.now() - x.at) > 0) : []; if (!list.length) return '';
    return `<div class="card" style="margin-top:12px"><h3>↩ 최근 구매 <small style="color:var(--muted);font-weight:600">· 10분 안에만 취소할 수 있어요</small></h3>${list.map((x) => `<div class="pp-row"><div class="pp-name"><b>${esc(whatText(x.what))}</b><small>⬡${fmt(x.amount)} · ${Math.max(1, Math.ceil(((st().refundMs || 600000) - (Date.now() - x.at)) / 60000))}분 남음</small></div><button class="pp-btn ghost" data-refund="${esc(x.id)}">구매 취소</button></div>`).join('')}</div>`;
  }
  // 구매 확인 창: 칩을 쓰기 전에 한 번 더 물어봐요
  function confirmBuy({title, desc = '', price, note = '', cta = '구매하기'}) {
    return new Promise((res) => { let el = $('confirmPop'); if (!el) { el = document.createElement('div'); el.id = 'confirmPop'; el.className = 'confirm-pop'; document.body.appendChild(el); }
      el.innerHTML = `<div class="cp-card" role="dialog" aria-modal="true"><b>${esc(title)}</b>${desc ? `<p>${esc(desc)}</p>` : ''}<div class="cp-price">⬡ ${fmt(price)} <small>· 보유 ⬡${fmt(myChips())} → ⬡${fmt(Math.max(0, myChips() - price))}</small></div><p class="cp-note">${esc(note || (acctOn() && loggedIn() ? `산 뒤 ${Math.round((st().refundMs || 600000) / 60000)}분 안에는 구매를 취소할 수 있어요` : ''))}</p><div class="cp-btns"><button class="btn ghost" data-cb="no">취소</button><button class="btn gold" data-cb="yes">${esc(cta)}</button></div></div>`;
      el.hidden = false; el.onclick = (e) => { const b = e.target.closest('[data-cb]'); if (!b && e.target !== el) return; el.hidden = true; res(!!b && b.dataset.cb === 'yes'); }; });
  }
  async function buySkin(id) {
    if (acctOn() && !loggedIn()) return openLogin('비서 스킨을 사려면 ');
    const k = SEC_SKINS[id], owned = (st().skins || ['classic']).includes(id) || isAdmin() || !k.price;
    if (!owned && myChips() < k.price) return toast(`씽크칩이 ⬡${fmt(k.price - myChips())} 부족해요`);
    setSecretary(id); // 미리보기
    if (!owned && !(await confirmBuy({title: `💁 '${k.name}' 스킨을 살까요?`, desc: '비서가 이 옷으로 갈아입어요. 산 스킨은 언제든 다시 바꿔 입을 수 있어요.', price: k.price}))) { setSecretary(mySkin()); return; }
    try { const r = await ACC.call('skin', {id}); if (!r.ok) { setSecretary(mySkin()); return toast(r.error === 'soldout' ? '판매가 끝난 한정판이에요' : r.error === 'chips' ? '씽크칩이 부족해요' : '바꾸지 못했어요'); }
      store.set('thinkchip:skin', id); const th = r.thanks, sec = {av: secretary, bubble: deskBubble, tag: npcTag};
      if (th) { toast(th.kind === 'ticket' ? `💝 비서가 답례로 VIP 1회권을 줬어요!` : th.kind === 'jackpot' ? `🎉 비서가 엄청 기뻐해요! 답례로 ⬡${fmt(th.amount)}!` : `💝 비서가 고맙다며 ⬡${fmt(th.amount)}을 돌려줬어요`);
        say(sec, th.kind === 'jackpot' ? '꺄~ 너무 예뻐요!! 이거 받으세요 🎁✨' : th.kind === 'ticket' ? '고마워요! VIP 라운지에서 만나요 💜' : '어머, 저 주시는 거예요? 고마워요 💕');
        secretary.userData.armPose = {r: [-2.6, 0.2], l: [-2.6, -0.2]}; setTimeout(() => { secretary.userData.armPose = null; }, 1600); const at = new THREE.Vector3(); secretary.getWorldPosition(at); at.y = 2.6; spark(at, true); setTimeout(() => spark(at, true), 350); }
      else { toast(`비서가 '${k.name}'(으)로 갈아입었어요`); say(sec, '어때요? 잘 어울려요? 💕'); } if (myHome()) setHomeSecretary(id);
      if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'deco', deco: encodeDeco(myRoom.deco)})); openDesk(); if (r.buyId) setTimeout(() => showUndo(r.buyId, `'${k.name}' 스킨`, k.price), 2600); } catch (e) { setSecretary(mySkin()); toast('인터넷 연결을 확인해 주세요'); }
  }
  // ───────── 접속자 · 친구 패널 (상단 '○명' 을 누르면 펼쳐져요, 롤 친구 목록처럼) ─────────
  const ONLINE_MS = 3 * 60e3;
  const isOn = (f) => players.has(f.pid) || Date.now() - (f.seen || 0) < ONLINE_MS;
  function friendsOnline() { return loggedIn() ? (social().friends || []).filter(isOn).length : 0; }
  function whereText(f) { if (players.has(f.pid)) return '같은 방에 있어요'; if (!isOn(f)) return f.seen ? `오프라인 · ${ago(f.seen)}` : '오프라인';
    const w = f.where || ''; return !w || /^LNG\d$/.test(w) ? '온라인 · 공개 라운지' : w === homeCode(f.pid) ? '온라인 · 자기 방' : /^H/.test(w) ? '온라인 · 친구 방' : '온라인 · 친구 라운지'; }
  let peopleOpen = false;
  function togglePeople(on = !peopleOpen) { peopleOpen = on; $('people').hidden = !on; $('online').classList.toggle('open', on); if (on) { renderPeople(); syncSocial(); } }
  function renderPeople() {
    const box = $('people'); if (!box || box.hidden) return;
    const here = [...players.values()].filter((p) => p !== me), so = social(), fr = loggedIn() ? [...(so.friends || [])] : [], frIds = new Set(fr.map((f) => f.pid)), pend = new Set(so.pending || []);
    fr.sort((a, b) => (players.has(b.pid) - players.has(a.pid)) || (isOn(b) - isOn(a)) || (b.seen || 0) - (a.seen || 0));
    const row = (name, sub, dot, btns, attrs = '') => `<div class="pp-row" ${attrs}><i class="pp-dot ${dot}"></i><div class="pp-name"><b>${esc(name)}</b><small>${esc(sub)}</small></div>${btns}</div>`;
    box.innerHTML = `<div class="pp-head"><b>${esc(isHome() ? (myHome() ? '🏠 내 방' : `🏠 ${homeOwner || '친구'}의 방`) : room.public ? '🏛 공개 라운지' : '👥 친구 라운지')}</b><button class="pp-x" data-pp="close" aria-label="접기">✕</button></div>
      <div class="pp-sec">지금 여기 <span>${here.length + 1}</span></div>
      ${row(myName() + ' (나)', '', 'on', '')}
      ${here.map((p) => row(p.name, frIds.has(p.id) ? '친구' : '', 'on', loggedIn() && !frIds.has(p.id) ? (pend.has(p.id) ? '<span class="pp-tag">신청함</span>' : `<button class="pp-btn" data-padd="${esc(p.id)}">+ 친구</button>`) : '', `data-pme="${esc(p.id)}"`)).join('')}
      <div class="pp-sec">내 친구 <span>${fr.filter(isOn).length}/${fr.length}</span></div>
      ${!loggedIn() ? `<p class="pp-empty">로그인하면 친구 목록과 접속 상태가 보여요</p>${IN_TOSS ? '' : '<button class="btn kakao full" data-pp="login">🔑 로그인하기</button>'}`
        : fr.length ? fr.map((f) => { const here = players.has(f.pid), on = isOn(f), go = on && !here ? (f.where || room.code) : homeCode(f.pid), canGo = !here && go !== room.code;
          return row(f.name, whereText(f), here || on ? 'on' : 'off', `${here ? '' : `<button class="pp-btn" data-pinv="${esc(f.pid)}" title="지금 있는 곳으로 부르기">📨 초대</button>`}${canGo ? `<button class="pp-btn ghost" data-pgo="${esc(go)}" data-pn="${esc(f.name)}" title="${on ? '친구가 있는 곳으로' : '친구 방 구경'}">${on ? '따라가기' : '🏠 놀러가기'}</button>` : ''}`); }).join('')
        : '<p class="pp-empty">아직 친구가 없어요 · 위에서 + 친구를 눌러 보세요</p>'}
      ${loggedIn() && (so.requests || []).length ? `<button class="btn ghost full" data-pp="req" style="margin-top:8px">📩 받은 친구 신청 ${so.requests.length}개</button>` : ''}`;
  }
  async function sendInvite(pid) {
    const f = (social().friends || []).find((x) => x.pid === pid); if (!f) return;
    try { const r = await ACC.call('invite', {to: pid, room: room.code}); toast(r.ok ? `${f.name}님을 불렀어요 📨${isOn(f) ? '' : ' · 다음에 들어오면 알려 줄게요'}` : r.error === 'slow' ? '방금 불렀어요 · 조금 뒤에 다시 불러요' : socialMsg(r.error)); } catch (e) { toast('인터넷 연결을 확인해 주세요'); }
  }
  // 친구가 나를 부르면: 위에 '놀러가기' 알림 (오프라인일 때 온 것도 들어오면 보여요)
  const shownCalls = new Set();
  function showCalls() {
    const inv = (social().invites || []).filter((i) => !shownCalls.has(i.id)); if (!inv.length) return;
    const i = inv[inv.length - 1]; inv.forEach((x) => shownCalls.add(x.id));
    let el = $('callPop'); if (!el) { el = document.createElement('div'); el.id = 'callPop'; el.className = 'invite-pop call-pop'; document.body.appendChild(el); }
    const w = !i.room || /^LNG\d$/.test(i.room) ? '공개 라운지' : i.room === homeCode(i.from) ? `${i.name}님의 방` : /^H/.test(i.room) ? '친구 방' : '친구 라운지';
    const here = i.room === room.code || (!i.room && room.public);
    el.innerHTML = `<div class="ip-ico" style="background:#ff6f91">📨</div><div class="ip-txt"><b>${esc(i.name)}님이 불러요!</b><small>${esc(w)}${i.at ? ` · ${ago(i.at)}` : ''}</small></div><button class="btn ghost" data-cp="no">나중에</button>${here ? '' : '<button class="btn gold" data-cp="go">놀러가기</button>'}`;
    el.hidden = false; clearTimeout(showCalls.t); showCalls.t = setTimeout(() => { el.hidden = true; }, 15000);
    el.onclick = (e) => { const b = e.target.closest('[data-cp]'); if (!b) return; el.hidden = true; if (b.dataset.cp === 'go') { goRoom(i.room); toast(`${w}(으)로 가는 중…`); } };
    ACC.call('seen', {ids: inv.map((x) => x.id)}).catch(() => {});
  }
  function celebrate(pid) { if (players.has(pid)) setTimeout(() => requestHandshake(pid), 400); } // 친구가 되는 순간 같은 라운지면 손인사
  async function shareFriendLink() {
    if (!loggedIn()) return openLogin('친구 추가 링크를 보내려면 ');
    const u = new URL(location.pathname, location.href); u.searchParams.set('friend', ME); u.searchParams.set('fn', myName());
    const text = `씽크칩 라운지에서 ${myName()}님과 친구 해요!`;
    try { if (navigator.share) { await navigator.share({title: '씽크칩 친구 추가', text, url: u.href}); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text}\n${u.href}`); toast('친구 추가 링크를 복사했어요'); } catch (e) { toast('링크를 복사하지 못했어요'); }
  }
  async function shareRoom() {
    const url = new URL(`?room=${room.code}`, location.href).href, text = `씽크칩 라운지에서 만나요! 방 코드 ${room.code}`;
    try { if (navigator.share) { await navigator.share({title: '씽크칩 라운지', text, url}); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('초대 링크를 복사했어요'); } catch (e) { toast(`방 코드: ${room.code}`); }
  }
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from({length: 4}, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

  $('nameBtn').onclick = editName; showName();
  $('online').onclick = () => togglePeople();
  $('whereToggle').onclick = (e) => { const b = e.target.closest('[data-w]'); if (!b) return; if (b.dataset.w === 'home') goHome(); else if (isHome()) goLounge(); else if (isVip()) { switchRoom(null); toast('🏛 라운지로 나왔어요'); } };
  $('people').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('people').onclick = async (e) => { const b = e.target.closest('button,[data-pme]'); if (!b) return;
    if (b.dataset.pp === 'close') return togglePeople(false);
    if (b.dataset.pp === 'login') return openLogin('친구 목록을 보려면 ');
    if (b.dataset.pp === 'req') return openFriends();
    if (b.dataset.padd) { try { const r = await ACC.call('request', {to: b.dataset.padd}); const made = r.ok && r.friends.some((f) => f.pid === b.dataset.padd); toast(r.ok ? (made ? '친구가 됐어요! 🎉' : '친구 신청을 보냈어요') : socialMsg(r.error)); if (made) celebrate(b.dataset.padd); } catch (er) { toast('인터넷 연결을 확인해 주세요'); } return renderPeople(); }
    if (b.dataset.pinv) return sendInvite(b.dataset.pinv);
    if (b.dataset.pgo) { goRoom(b.dataset.pgo); toast(`${b.dataset.pn}님에게 가는 중…`); return togglePeople(false); }
    if (b.dataset.pme) { const p = players.get(b.dataset.pme); if (p) { togglePeople(false); approachFor(p); } } };
  // ───────── 📸 인생네컷 부스: 3초마다 한 장씩 네 장을 찍어 세로 띠 사진으로 만들어요 ─────────
  // 옆에 서 있는 사람(같은 라운지의 친구)도 같이 찍혀요. 사진 아래에 라운지 주소가 들어가서 공유하면 홍보가 돼요.
  // 기본 프레임은 무료, 스페셜 프레임은 찍을 때마다 칩을 써요(찍고 나면 취소 불가라 구매 기록을 남기지 않아요).
  const BOOTH_FRAMES = [
    {id: 'white', name: '화이트', bg: ['#ffffff', '#ffffff'], ink: '#1b2440', price: 0},
    {id: 'black', name: '블랙', bg: ['#14161f', '#14161f'], ink: '#ffffff', price: 0},
    {id: 'heart', name: '핑크 하트', bg: ['#ffd9e6', '#ffb3cf'], ink: '#8a1c4a', price: 20, deco: '💗'},
    {id: 'chip', name: '씽크칩 네온', bg: ['#2a1f6b', '#7660ff'], ink: '#ffffff', price: 20, deco: '⬡'},
  ];
  const BOOTH_POSES = [ // 컷마다 내 캐릭터의 표정·팔 동작
    {expr: 'happy', arms: {r: [-2.3, 0]}},
    {expr: 'laugh', arms: {r: [-2.6, 0.2], l: [-2.6, -0.2]}},
    {expr: 'wink', arms: {r: [-1.5, 0.15]}},
    {expr: 'happy', arms: {r: [-2.6, 0.2], l: [-1.2, 0]}},
  ];
  const BOOTH = {W: 800, H: 600, cellW: 600, cellH: 450, pad: 40, gap: 16, foot: 150};
  let boothFrame = 'white';
  const boothEl = document.createElement('div'); boothEl.className = 'booth-ui'; boothEl.hidden = true; document.body.appendChild(boothEl);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function boothAim() { // 나와 가까이(3칸 안) 서 있는 사람들이 한 화면에 들어오게
    const near = [...players.values()].filter((p) => p === me || p.av.position.distanceTo(me.av.position) < 3).slice(0, 6), c = new THREE.Vector3();
    for (const p of near) c.add(p.av.position); c.multiplyScalar(1 / near.length);
    return {center: c, yaw: camState.yaw, dist: 4.4 + 0.9 * (near.length - 1)};
  }
  function boothCamera() { const b = booth; camera.position.set(b.center.x + Math.sin(b.yaw) * b.dist, 1.55, b.center.z + Math.cos(b.yaw) * b.dist); camera.lookAt(b.center.x, 1.15, b.center.z); }
  function boothShot() { // 화면 크기와 상관없이 4:3 한 장을 그려서 돌려줘요. 같은 틱 안에서 그리고 바로 복사해야 빈 화면이 안 찍혀요
    const pr = renderer.getPixelRatio(), fov = camera.fov;
    renderer.setPixelRatio(1); renderer.setSize(BOOTH.W, BOOTH.H, false); camera.clearViewOffset(); camera.aspect = BOOTH.W / BOOTH.H; camera.fov = 34; camera.updateProjectionMatrix();
    boothCamera(); renderer.render(scene, camera);
    const c = document.createElement('canvas'); c.width = BOOTH.W; c.height = BOOTH.H; c.getContext('2d').drawImage(renderer.domElement, 0, 0, BOOTH.W, BOOTH.H);
    renderer.setPixelRatio(pr); camera.fov = fov; camState.offY = null; resize();
    return c;
  }
  function boothStrip(shots, frameId) {
    const f = BOOTH_FRAMES.find((x) => x.id === frameId) || BOOTH_FRAMES[0], {cellW, cellH, pad, gap, foot} = BOOTH, n = shots.length;
    const c = document.createElement('canvas'); c.width = cellW + pad * 2; c.height = pad + n * cellH + (n - 1) * gap + foot; const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, c.height); grad.addColorStop(0, f.bg[0]); grad.addColorStop(1, f.bg[1]); g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    if (f.deco) { g.globalAlpha = 0.5; g.font = '26px sans-serif'; g.textAlign = 'center'; g.fillStyle = f.ink; for (let y = 22; y < c.height; y += 96) { g.fillText(f.deco, 20, y + 10); g.fillText(f.deco, c.width - 20, y + 58); } g.globalAlpha = 1; }
    shots.forEach((s, i) => g.drawImage(s, pad, pad + i * (cellH + gap), cellW, cellH));
    const y0 = c.height - foot; g.fillStyle = f.ink; g.textAlign = 'center';
    g.font = '900 34px system-ui, sans-serif'; g.fillText('THINKCHIP LOUNGE', c.width / 2, y0 + 58);
    const d = new Date(), p2 = (v) => String(v).padStart(2, '0');
    g.font = '700 20px system-ui, sans-serif'; g.globalAlpha = 0.8; g.fillText(`${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} · ${myName()}`.slice(0, 40), c.width / 2, y0 + 92);
    g.font = '600 17px system-ui, sans-serif'; g.globalAlpha = 0.6; g.fillText('thinkchip-arena.pages.dev', c.width / 2, y0 + 122); g.globalAlpha = 1;
    return c;
  }
  function openBooth() {
    const btns = BOOTH_FRAMES.map((f) => `<button data-bf="${f.id}" class="booth-frame${f.id === boothFrame ? ' on' : ''}" style="background:linear-gradient(180deg,${f.bg[0]},${f.bg[1]});color:${f.ink}"><b>${esc(f.name)}</b><small>${f.price ? `⬡ ${f.price}` : '무료'}</small></button>`).join('');
    openSheet({kicker: 'PHOTO BOOTH', title: '📸 인생네컷', html: `<p class="booth-tip">3초마다 한 장씩, 네 장을 찍어요. <b>옆에 서 있는 친구도 같이 찍혀요.</b> 찍는 동안 이모티콘을 누르면 표정이 바뀌어요.</p><div class="booth-frames" id="boothFrames">${btns}</div><button class="btn gold booth-go" id="boothGo">촬영 시작</button>`});
    $('boothFrames').onclick = (e) => { const b = e.target.closest('[data-bf]'); if (!b) return; boothFrame = b.dataset.bf; for (const x of $('boothFrames').children) x.classList.toggle('on', x === b); };
    $('boothGo').onclick = () => startBooth();
  }
  async function startBooth(fast = false) {
    if (booth) return;
    const f = BOOTH_FRAMES.find((x) => x.id === boothFrame) || BOOTH_FRAMES[0];
    if (f.price) {
      if (acctOn() && !loggedIn()) return openLogin('스페셜 프레임을 쓰려면 ');
      if (myChips() < f.price) return toast(`씽크칩이 ⬡${fmt(f.price - myChips())} 부족해요`);
      if (!(await confirmBuy({title: `'${f.name}' 프레임으로 찍을까요?`, desc: '스페셜 프레임은 찍을 때마다 칩을 써요.', price: f.price, note: '촬영을 시작하면 취소할 수 없어요', cta: '찍기'}))) return;
      if (!(await payChips(f.price, '스페셜 프레임을 쓰려면 '))) return; renderChips();
    }
    closeSheet(); me.target = null; me.av.rotation.y = camState.yaw; booth = boothAim();
    if (!fast) sendChat('📸 인생네컷 찍어요! 옆으로 모여요~');
    const shots = [];
    try {
      for (let i = 0; i < BOOTH_POSES.length; i++) {
        const pose = BOOTH_POSES[i]; setExpr(me, pose.expr, 4500); me.av.userData.armPose = pose.arms;
        for (let s = 3; s > 0; s--) { boothEl.hidden = false; boothEl.innerHTML = `<div class="booth-count"><small>${i + 1} / ${BOOTH_POSES.length}</small><b>${s}</b></div>`; await sleep(fast ? 120 : 1000); }
        shots.push(boothShot()); boothEl.innerHTML = '<div class="booth-flash"></div>'; await sleep(fast ? 60 : 380);
      }
    } finally { boothEl.hidden = true; boothEl.innerHTML = ''; me.av.userData.armPose = null; booth = null; placeCamera(true); }
    const strip = boothStrip(shots, f.id), url = strip.toDataURL('image/jpeg', 0.92);
    openSheet({kicker: 'PHOTO BOOTH', title: '📸 인생네컷 완성!', html: `<div class="booth-result"><img id="boothImg" alt="방금 찍은 인생네컷" src="${url}"></div><p class="booth-tip">저장이 안 되면 사진을 길게 눌러 저장해요.</p><div class="booth-btns"><button class="btn ghost" id="boothAgain">다시 찍기</button><button class="btn gold" id="boothSave">저장 · 공유</button></div>`});
    $('boothAgain').onclick = openBooth;
    $('boothSave').onclick = () => strip.toBlob(async (blob) => { if (!blob) return toast('사진을 만들지 못했어요');
      const file = new File([blob], `thinkchip-4cut-${Date.now()}.jpg`, {type: 'image/jpeg'});
      try { if (navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], title: '씽크칩 라운지 인생네컷'}); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('사진을 저장했어요'); }, 'image/jpeg', 0.92);
    return strip;
  }
  document.querySelector('.dock-right').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; ({games: openGames, booth: openBooth, closet: () => goHome(() => goToZone(ZONES.find((z) => z.closet))), desk: () => goLounge(() => goToZone(ZONES.find((z) => z.desk))), friends: openFriends, deco: () => goHome(openRoomDeco), room: () => goHome(openRoomDeco), home: () => goHome(), lounge: () => goLounge()})[b.dataset.open]?.(); };
  $('chipsBtn').onclick = () => (acctOn() && !loggedIn() ? openLogin() : openDesk());
  // 왼쪽 위 로고: 라운지를 떠나지 않고 방 정보·이동 메뉴를 열어요 (예전엔 옛 홈으로 나가서 돌아올 길이 없었어요)
  $('brandBtn').onclick = (e) => { e.preventDefault(); openSheet({kicker: room.public ? 'PUBLIC LOUNGE' : 'FRIEND ROOM', title: room.public ? '🌐 공개 라운지' : `👥 친구 방 · ${room.code}`, html: `
    <div class="card"><p>${room.public ? '누구나 들어올 수 있는 라운지예요. 친구들끼리만 모이려면 친구 방을 만들어 보세요.' : '방 코드로 들어온 친구들만 있는 라운지예요. 방장이 꾸민 방이 보여요.'}</p></div>
    <div class="game-list">
      <button class="game-btn" data-go="games"><i style="background:#8b7bff">🎮</i><span><b>게임 고르기</b><small>테이블별 24가지 게임</small></span></button>
      <button class="game-btn" data-go="friends"><i style="background:#3fcf8e">👥</i><span><b>${room.public ? '친구 방 만들기 · 입장' : '친구 방 설정'}</b><small>방 코드로 같이 놀기</small></span></button>
      ${room.public ? '' : '<button class="game-btn" data-go="public"><i style="background:#38bdf8">🌐</i><span><b>공개 라운지로 가기</b><small>모두가 모이는 곳</small></span></button>'}
      <a class="game-btn" href="${ARENA_HOME}" style="text-decoration:none;color:inherit"><i style="background:#ffb020">📋</i><span><b>목록으로 보기</b><small>2D 게임 목록 화면 (아레나 입장 버튼으로 돌아와요)</small></span></a>
    </div>`});
    $('sheetBody').onclick = (ev) => { const b = ev.target.closest('[data-go]'); if (!b) return; const g = b.dataset.go; closeSheet(); if (g === 'games') openGames(); else if (g === 'friends') openFriends(); else if (g === 'public') switchRoom(null); };
  };
  const VIEWS = [{name: '전경', pitch: 0.82, dist: null}, {name: '눈높이', pitch: 0.28, dist: 11}, {name: '탑뷰', pitch: 1.3, dist: null}];
  let viewIdx = 0;
  if ($('viewBtn')) $('viewBtn').onclick = () => { viewIdx = (viewIdx + 1) % VIEWS.length; const v = VIEWS[viewIdx]; camState.pitch = v.pitch; if (v.dist) camState.dist = v.dist; else resize(); toast(`${v.name} 보기 · 화면을 밀어서 돌려 보세요`); };
  $('themeBtn').onclick = () => { const day = document.body.dataset.theme !== 'day'; setTheme(day ? 'day' : 'night'); store.set(LOUNGE_KEY, Object.assign(store.get(LOUNGE_KEY, {}), {theme: day ? 'day' : 'night'})); };
  function setTheme(t) {
    try { localStorage.setItem('brain-arena:theme:v1', t === 'day' ? 'light' : 'dark'); } catch (e) {} // 라운지가 기준: 게임 화면도 같은 낮/밤 모드로
    document.body.dataset.theme = t; const day = t === 'day'; $('themeBtn').textContent = day ? '☀' : '☾';
    scene.background = new THREE.Color(day ? 0xdfe5f2 : 0x070b16); scene.fog = new THREE.Fog(day ? 0xdfe5f2 : 0x070b16, 26, 60);
    mats.wall.color.setHex(day ? mats.wallDay : 0x1e2a4a); mats.floor.color.setHex(day ? mats.floorDay : 0x7a5a43);
    hemi.intensity = day ? 1.0 : 0.78; sun.intensity = day ? 1.1 : 0.95; fill.intensity = day ? 0.35 : 0.42; renderer.toneMappingExposure = day ? 1.05 : 1.22; // 폰 화면에서 어둡지 않게 조금 밝게
    if (typeof applyDecor === 'function' && shownDeco) applyDecor(shownDeco);
  }

  // 채팅 & 이모티콘
  $('chatForm').onsubmit = (e) => { e.preventDefault(); const v = $('chatInput').value.trim(); if (!v) return; $('chatInput').value = ''; sendChat(v); };
  $('emotes').onclick = (e) => { if (e.target.closest('[data-sc]')) return openSuperchat(); const b = e.target.closest('[data-emote]'); if (b) sendChat(b.dataset.emote); };
  // 채팅창 크기: 손잡이를 위로 끌면 크게, 아래로 내리면 작게, 끝까지 내리면 숨기고 💬 를 누르면 다시 떠요. 손잡이를 톡 누르면 작게↔크게
  const CHAT_MIN = 56, chatMax = () => Math.round(innerHeight * 0.62), CHAT_KEY = 'thinkchip:chatH';
  function setChatH(h) { const el = $('chatPanel'); if (h == null) { el.classList.remove('sized'); el.style.removeProperty('--chat-h'); return; } el.classList.add('sized'); el.style.setProperty('--chat-h', `${Math.round(Math.max(CHAT_MIN, Math.min(chatMax(), h)))}px`); }
  function hideChat() { $('chatPanel').hidden = true; $('chatReopen').hidden = false; store.set(CHAT_KEY, {h: store.get(CHAT_KEY, {}).h, hidden: true}); }
  function showChat() { $('chatPanel').hidden = false; $('chatReopen').hidden = true; const log = $('chatLog'); log.scrollTop = log.scrollHeight; store.set(CHAT_KEY, {h: store.get(CHAT_KEY, {}).h, hidden: false}); }
  { const saved = store.get(CHAT_KEY, {}); if (saved.h) setChatH(saved.h); if (saved.hidden) hideChat(); }
  { const grip = $('chatGrip'), panel = $('chatPanel'); let drag = null;
    grip.addEventListener('pointerdown', (e) => { drag = {y: e.clientY, h: $('chatLog').getBoundingClientRect().height, moved: false}; panel.classList.add('resizing'); try { grip.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); });
    grip.addEventListener('pointermove', (e) => { if (!drag) return; const dy = e.clientY - drag.y; if (Math.abs(dy) > 4) drag.moved = true; if (!drag.moved) return;
      const h = drag.h - dy; setChatH(h); panel.classList.toggle('will-hide', h < CHAT_MIN - 10); const log = $('chatLog'); log.scrollTop = log.scrollHeight; });
    const end = (e) => { if (!drag) return; const d = drag; drag = null; panel.classList.remove('resizing', 'will-hide');
      if (!d.moved) { const cur = $('chatLog').getBoundingClientRect().height, big = cur < innerHeight * 0.3; setChatH(big ? innerHeight * 0.45 : 110); store.set(CHAT_KEY, {h: big ? innerHeight * 0.45 : 110}); return; } // 톡: 작게↔크게
      const h = d.h - (e.clientY - d.y); if (h < CHAT_MIN - 10) { setChatH(d.h); hideChat(); toast('채팅을 숨겼어요 · 💬 를 누르면 다시 떠요'); return; }
      store.set(CHAT_KEY, {h: Math.max(CHAT_MIN, Math.min(chatMax(), h))}); };
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
    grip.addEventListener('keydown', (e) => { const cur = $('chatLog').getBoundingClientRect().height; if (e.key === 'ArrowUp') setChatH(cur + 40); else if (e.key === 'ArrowDown') { if (cur - 40 < CHAT_MIN) hideChat(); else setChatH(cur - 40); } });
    // 채팅 목록을 맨 아래까지 본 상태에서 한 번 더 아래로 쓸어내리면(손가락을 아래로) 채팅을 숨겨요
    const log = $('chatLog'); let sw = null;
    log.addEventListener('touchstart', (e) => { sw = log.scrollTop <= 0 || log.scrollHeight <= log.clientHeight + 2 ? {y: e.touches[0].clientY, t: Date.now()} : null; }, {passive: true});
    log.addEventListener('touchend', (e) => { if (!sw) return; const dy = (e.changedTouches[0] || {}).clientY - sw.y; if (dy > 70 && Date.now() - sw.t < 600) hideChat(); sw = null; }, {passive: true});
  }
  $('chatReopen').onclick = showChat;
  { const panel = $('chatPanel'); let tt = 0; const touched = () => { panel.classList.add('touched'); clearTimeout(tt); tt = setTimeout(() => panel.classList.remove('touched'), 2500); };
    panel.addEventListener('pointerdown', touched, true); $('chatInput').addEventListener('focus', touched); }
  // 채팅 보내기: 서버가 0.6초 안에 연달아 온 메시지를 버려서(도배 방지) 빠르게 치면 사라졌어요 → 줄 세워 0.7초 간격으로 보내요.
  // 연결이 끊겨 있으면 내 화면에 먼저 띄우고, 다시 연결되면 보내요.
  const outbox = []; let outTimer = null, lastSent = 0;
  function flushChat() {
    clearTimeout(outTimer); outTimer = null;
    if (!outbox.length || !conn || conn.readyState !== 1) return;
    const wait = lastSent + 700 - Date.now(); if (wait > 0) { outTimer = setTimeout(flushChat, wait); return; }
    conn.send(JSON.stringify({t: 'chat', text: outbox.shift()})); lastSent = Date.now();
    if (outbox.length) outTimer = setTimeout(flushChat, 700);
  }
  function sendChat(text) {
    text = String(text || '').trim().slice(0, 80); if (!text) return;
    outbox.push(text); if (outbox.length > 8) outbox.splice(0, outbox.length - 8);
    if (conn && conn.readyState === 1) flushChat();
    else if (!/^\[\[/.test(text)) { chatLine(myName(), text); say(me, text); toast(CFG.LIVE_URL ? '연결 중이에요 · 연결되면 다른 사람에게도 보내요' : '오프라인이라 나에게만 보여요'); }
  }

  // ───────── 실시간 접속 (live-server 재사용: 방 = 라운지) ─────────
  const params = new URLSearchParams(location.search);
  const room = {code: null, public: true};
  const online = new Map();
  let vipFail = 0;
  let conn = null, retry = 0, retryTimer = 0, pingTimer = 0, gotFirstState = false;
  function switchRoom(code) {
    room.public = !code || /^LNG\d$/.test(code); room.code = code || 'LNG1'; hostDeco = null; if (ACC) ACC.state.where = room.code;
    hp = null; renderRoomLabel();
    const u = new URL(location.href); if (room.public) u.searchParams.delete('room'); else u.searchParams.set('room', room.code); history.replaceState(null, '', u);
    for (const id of [...players.keys()]) if (id !== ME) despawn(id); online.clear(); $('chatLog').innerHTML = ''; gotFirstState = false;
    applyMode(); reconnect(); if (loggedIn()) ACC.call('hello').catch(() => {});
  }
  // 폰에서 앱을 내렸다 올리거나 인터넷이 돌아오면 바로 다시 연결
  const wake = () => { if (!document.hidden && (!conn || conn.readyState > 1)) reconnect(); };
  document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
  function reconnect() { clearTimeout(retryTimer); if (conn) { conn.onclose = null; try { conn.close(); } catch (e) {} } retry = 0; connect(); }
  function connect() {
    if (!CFG.LIVE_URL) { setOnline(false); return; }
    let ws; const q = new URLSearchParams({pid: ME, name: myName(), look: A.encodeLook(mine.look), deco: encodeDeco(myRoom.deco)}); try { const tk = loggedIn() && localStorage.getItem('thinkchip:session'); if (tk) q.set('token', tk); } catch (e) {}
    try { ws = new WebSocket(`${CFG.LIVE_URL}/${room.code}?${q}`); } catch (e) { setOnline(false); return; }
    conn = ws;
    ws.onopen = () => { ws.opened = true; vipFail = 0; retry = 0; setOnline(true); sendPose(); flushChat(); clearInterval(pingTimer); pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('{"t":"ping"}'); }, 20000); };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } handle(m); };
    ws.onclose = () => { if (conn !== ws) return; setOnline(false); if (isVip() && !ws.opened) { vipFail = (vipFail || 0) + 1; if (vipFail >= 2) { vipFail = 0; toast('VIP 라운지 입장권이 필요해요'); switchRoom(null); return; } } retryTimer = setTimeout(connect, Math.min(10000, 700 * 2 ** Math.min(retry++, 4))); }; // 끊기면 계속 다시 붙어요
  }
  function setOnline(on) { const fo = friendsOnline(); $('online').classList.toggle('off', !on); $('online').innerHTML = (on ? `<i></i><b>${online.size + 1}</b>명` : '<i></i><b>오프라인</b>') + (fo ? `<em>친구 ${fo}</em>` : '') + '<s>▾</s>'; renderPeople(); }
  function sendPose() { const t = me.target || me.av.position; if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'pose', x: Math.round(t.x * 100) / 100, z: Math.round(t.z * 100) / 100, ...(me.act && !me.target ? {act: me.act.kind, ry: Math.round(me.act.ry * 100) / 100, y: me.act.y, arms: me.act.arms === 'play' ? 1 : 0} : {})})); }
  function sendLook() { if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'look', look: A.encodeLook(mine.look)})); }
  function handle(m) {
    if (m.t === 'state') {
      const seen = new Set();
      for (const p of m.players || []) {
        if (p.pid === ME || !p.online) continue; seen.add(p.pid);
        let pl = players.get(p.pid);
        if (pl && pl.look !== (p.look || '')) { const pos = pl.av.position.clone(); despawn(p.pid); pl = null; spawn(p.pid, otherName(p), p.look || '', pos.x, pos.z); }
        else if (!pl) { const pos = p.pos || {x: (Math.random() - 0.5) * 6, z: 4 + Math.random() * 2}; pl = spawn(p.pid, otherName(p), p.look || '', pos.x, pos.z); if (!online.has(p.pid) && gotFirstState) chatLine('', `${otherName(p)}님이 라운지에 들어왔어요`, true); }
        pl.tag.textContent = badgeIcons(p.badges) + p.name; online.set(p.pid, p.name);
      }
      for (const id of [...online.keys()]) if (!seen.has(id)) { chatLine('', `${online.get(id)}님이 나갔어요`, true); online.delete(id); despawn(id); }
      const owner = isHome() && !myHome() ? (m.players || []).find((p) => homeCode(p.pid) === room.code) : null;
      hostDeco = owner && owner.deco ? decodeDeco(owner.deco) : null; homeOwner = owner ? otherName(owner) : homeOwner; // 친구 방에 놀러 가면 그 친구가 꾸민 방이 보여요
      if (!decoDraft) applyDecor(currentDeco()); if (isHome() && !myHome()) { setHomeSecretary((hostDeco && hostDeco.skin) || ''); drawShowcase((hostDeco && hostDeco.badges) || []); placeShowcase(hostDeco && hostDeco.sc); } renderRoomLabel(); renderPeople();
      gotFirstState = true; setOnline(true); drawBoard(); setTicker();
    } else if (m.t === 'pose') { const p = players.get(m.pid); if (p && m.pid !== ME) { walkTo(p, m.x, m.z, m.act ? () => { p.act = {kind: m.act, ry: m.ry || 0, y: m.y || 0, arms: m.arms ? 'play' : null}; } : null); } }
    else if (m.t === 'chat') { const p = players.get(m.pid); if (m.sys) chatLine('', m.text, true); else if (handleSignal(m)) { chatLine(otherName(m), m.text); say(p, m.text); } }
    else if (m.t === 'sc') showSuperchat(m);
    else if (m.t === 'hp') { hp = m; renderRoomLabel(); if ($('gbList')) renderGuestbook(); }
    else if (m.t === 'chatlog') { (m.items || []).filter((c) => !/^\[\[(ok|cancel|hs|rx):/.test(c.text || '')).slice(-6).forEach((c) => chatLine(c.sys ? '' : otherName(c), c.text, c.sys)); }
    else if (m.t === 'error' && m.code === 'full') { toast('공개 라운지가 꽉 차서 옆 라운지로 옮겨요'); const n = Number((room.code || 'LNG1').slice(3)) || 1; switchRoom(null); room.code = `LNG${Math.min(9, n + 1)}`; if (ACC) ACC.state.where = room.code; reconnect(); }
  }

  // ───────── 시작 ─────────
  setTheme(store.get(LOUNGE_KEY, {}).theme === 'day' ? 'day' : 'night');
  renderChips(); drawBoard(); setTicker(); setInterval(setTicker, 15000);
  const startCode = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  switchRoom(startCode.length >= 4 ? startCode : null);
  // 친구 추가 링크(?friend=pid)로 들어오면 그 사람에게 친구 신청 (로그인 전이면 기억해 뒀다가 로그인 후에)
  const PF_KEY = 'thinkchip:pendingFriend';
  { const friendTo = (params.get('friend') || '').replace(/[^a-f0-9]/g, '').slice(0, 24), friendName = (params.get('fn') || '').slice(0, 12);
    if (params.has('friend')) { const u = new URL(location.href); u.searchParams.delete('friend'); u.searchParams.delete('fn'); try { history.replaceState(null, '', u); } catch (e) {} }
    if (friendTo.length === 24) { store.set(PF_KEY, {to: friendTo, name: friendName}); if (acctOn() && !loggedIn()) setTimeout(() => openLogin(`${friendName || '친구'}님과 친구를 맺으려면 `), 900); } }
  async function pendingFriend() {
    const pf = store.get(PF_KEY, null); if (!pf || !loggedIn() || !st().wallet) return; store.set(PF_KEY, null); if (pf.to === ME) return;
    try { const r = await ACC.call('request', {to: pf.to}); const made = r.ok && r.friends.some((f) => f.pid === pf.to);
      toast(r.ok ? (made ? `${pf.name || '친구'}님과 친구가 됐어요! 🎉` : `${pf.name || '친구'}님에게 친구 신청을 보냈어요`) : socialMsg(r.error)); if (made) celebrate(pf.to); } catch (e) {}
  }
  if (ACC) ACC.onChange(() => { afterSync(); pendingFriend(); });
  if (IN_TOSS) setTimeout(tossAuto, 1500); // 토스 앱: 처음 열면 자동 연결
  if (ACC && ACC.state.loginError) setTimeout(() => toast(ACC.state.loginError === 'cancel' ? '로그인을 취소했어요' : '로그인하지 못했어요. 다시 시도해 주세요'), 800);
  if (ACC && ACC.state.justLoggedIn) setTimeout(() => toast('로그인했어요! 이제 칩과 친구가 계정에 저장돼요 🎉'), 1200);
  setInterval(() => { if (!document.hidden) syncSocial(); }, 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSocial(); });
  if (!localStorage.getItem('thinkchip:avatar:v1')) setTimeout(() => { toast('처음 오셨네요! 드레스룸에서 내 캐릭터를 꾸며 보세요'); }, 1200);
  addEventListener('storage', (e) => { if (e.key === PROFILE_KEY) { renderChips(); drawBoard(); } });
  // 자동 테스트·영상 녹화용 (읽기 + 이동만). 게임 데이터나 칩은 바꾸지 않아요.
  window.__lounge = {
    booth: {open: openBooth, shoot: (frame, fast = true) => { boothFrame = frame || 'white'; return startBooth(fast); }, frames: BOOTH_FRAMES},
    me: () => ({x: me.av.position.x, z: me.av.position.z, expr: me.av.userData.face.expr, walking: !!me.target}),
    players: () => [...players.values()].map((p) => ({id: p.id, name: p.name, x: p.av.position.x, z: p.av.position.z, expr: p.av.userData.face.expr})),
    screenOf: (x, z, y = 0.9) => { const v = new THREE.Vector3(x, y, z).project(camera); return {x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight}; },
    zones: () => ZONES.map((z) => ({id: z.id, x: z.pos[0], z: z.pos[1]})),
    walkTo: (x, z) => { walkTo(me, x, z); sendPose(); },
    goZone: (id) => goToZone(ZONES.find((z) => z.id === id)),
    openZone: (id) => openZone(ZONES.find((z) => z.id === id)),
    furniture: () => Object.entries(furniture).filter(([, g]) => g.visible).map(([id]) => id),
    room: () => ({...room}),
    // 영상 녹화용: 실시간 루프를 멈추고 dt 만큼씩 한 프레임 그리기
    manual: (on) => { manual = !!on; if (!manual) { clock.getDelta(); tick(); } },
    step: (dt) => frame(dt),
    sayAs: (name, text) => { const p = [...players.values()].find((q) => q.name === name); if (p) { say(p, text); if (p !== me) chatLine(name, text); } },
    walkOther: (name, x, z) => { const p = [...players.values()].find((q) => q.name === name); if (p) walkTo(p, x, z); },
    face: (yaw, dist, pitch) => { if (yaw != null) camState.yaw = yaw; if (dist != null) camState.dist = dist; if (pitch != null) camState.pitch = pitch; },
  };
  tick();
  setTimeout(() => $('loading').classList.add('done'), 300);
})();
