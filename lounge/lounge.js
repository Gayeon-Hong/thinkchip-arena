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
  // 비서 데스크 + 비서 NPC
  let secretary;
  (function desk() {
    const z = ZONES.find((x) => x.desk), g = new THREE.Group(); g.position.set(z.pos[0], 0, z.pos[1]); g.rotation.y = -Math.PI / 2; scene.add(g);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.05, 40, 1, false, 0, Math.PI), mats.panel); d.position.set(0, 0.52, 0.3); d.rotation.y = -Math.PI / 2; d.castShadow = true; g.add(d);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 40, 1, false, 0, Math.PI), mats.wood); top.position.set(0, 1.07, 0.3); top.rotation.y = -Math.PI / 2; g.add(top);
    box(0.5, 0.32, 0.04, M(0x0b1222, {emissive: 0x2a4a9a, emissiveIntensity: 0.6}), 0.4, 1.3, 0.6, g);
    const sign = neon('💁 비서 데스크', '#7c8cff', 2.6); sign.position.set(0, 3.0, -0.5); g.add(sign); z.sign = sign;
    secretary = A.buildAvatar({hair: 'long', hairColor: 0x2b211d, top: 'suit', topColor: 0x1b2742, bottom: 'skirt', bottomColor: 0x1b2742, shoes: 'loafer', acc: 'headset', skin: 0xffe1cf});
    secretary.position.set(0, 0, -0.6); secretary.rotation.y = 0; g.add(secretary); secretary.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    registerClick(g, z);
  })();
  // 화분 · 스탠드 조명 장식
  function plant(x, z, s = 1) { cyl(0.32 * s, 0.25 * s, 0.6 * s, mats.pot, x, 0.3 * s, z, 20); for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, 16, 12), mats.plant); l.position.set(x + Math.cos(i * 1.3) * 0.22 * s, (0.95 + (i % 3) * 0.22) * s, z + Math.sin(i * 1.3) * 0.22 * s); l.scale.y = 1.3; l.castShadow = true; scene.add(l); } }
  plant(-9.8, -9.8, 1.4); plant(9.6, -9.6, 1.2); plant(-9.8, 9.2, 1.1); plant(3.6, -9.6, 0.9); plant(-3.6, -9.6, 0.9);
  function floorLamp(x, z) { cyl(0.2, 0.25, 0.05, mats.gold, x, 0.03, z, 16); cyl(0.03, 0.03, 2.2, mats.gold, x, 1.1, z, 8); const shade = cyl(0.25, 0.4, 0.4, M(0xfff1d6, {emissive: 0xffd28a, emissiveIntensity: 0.7}), x, 2.3, z, 20); const l = new THREE.PointLight(0xffc874, 0.5, 6, 2); l.position.set(x, 2.1, z); scene.add(l); }
  floorLamp(-9.6, -3.2); floorLamp(9.6, 4.8);

  // ───────── 캐릭터 ─────────
  const labels = $('labels');
  const OBST = ZONES.filter((z) => z.games || z.main).map((z) => ({x: z.pos[0], z: z.pos[1], r: z.main ? 2.0 : 1.55})); // 캐릭터가 못 지나가는 테이블 (원)
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
    const lim = ROOM - 1.2; p.target = {x: Math.max(-lim, Math.min(lim, x)), z: Math.max(-lim, Math.min(lim, z)), then};
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
    const n = k === 'heart' ? 5 : k === 'boo' ? 3 : 3;
    for (let i = 0; i < n; i++) { const sp = emojiSprite(r.e); sp.scale.setScalar(0.01); flyers.push({sp, a, b, t: -i * 0.12, dur: 0.85 + Math.random() * 0.25, side: (Math.random() - 0.5) * 1.4, k}); }
    if (k === 'boo') { a.av.userData.armPose = {r: [-1.2, 0], l: [-1.2, 0]}; setTimeout(() => { if (!a.hs) a.av.userData.armPose = null; }, 900); }
    else { a.av.userData.armPose = {r: [-2.3, 0]}; setTimeout(() => { if (!a.hs) a.av.userData.armPose = null; }, 700); } // 던지는 손짓
    setTimeout(() => { if (!players.has(b.id)) return; setExpr(b, r.expr, 3500); say(b, r.say); }, 900);
    if (fromId === ME || toId === ME) chatLine('', `${fromId === ME ? '나' : otherName({pid: a.id, name: a.name})} → ${toId === ME ? '나' : otherName({pid: b.id, name: b.name})} ${r.e} ${r.label}`, true);
  }
  function stepFlyers(dt) {
    for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt; if (f.t < 0) continue;
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
  function placeCamera(snap) {
    // 카메라는 내 캐릭터를 중심으로 돌아요 (두 손가락으로 옮긴 만큼 pan)
    const want = camState.closeUp ? new THREE.Vector3(me.av.position.x, 1.35, me.av.position.z) : new THREE.Vector3(me.av.position.x + camState.pan.x, 1, me.av.position.z + camState.pan.z);
    camState.focus.lerp(want, snap ? 1 : 0.08);
    const sheetCover = camState.closeUp && !$('sheet').hidden ? Math.min($('sheet').getBoundingClientRect().height, innerHeight * 0.6) : 0, d = camState.closeUp ? 7.2 * Math.max(1, Math.min(2.4, innerHeight / Math.max(1, innerHeight - sheetCover))) * 0.82 : camState.dist, pitch = camState.closeUp ? 0.22 : camState.pitch, yaw = camState.closeUp ? (camState.closeBase || 0) + (camState.closeYaw || 0) : camState.yaw;
    camera.position.set(camState.focus.x + Math.sin(yaw) * Math.cos(pitch) * d, camState.focus.y + Math.sin(pitch) * d, camState.focus.z + Math.cos(yaw) * Math.cos(pitch) * d);
    camera.lookAt(camState.focus.x, camState.focus.y + (camState.closeUp ? -0.15 : 0), camState.focus.z);
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
    const hit = ray.intersectObjects(clickables, false)[0];
    if (hit) { goToZone(hit.object.userData.zone); return; }
    const fh = ray.intersectObject(floor, false)[0];
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
      if (!p.target && !p.hs && !(p === me && camState.closeUp)) { // 서 있을 땐 카메라(또는 방금 말한 사람) 쪽으로 천천히 몸을 돌려요 — 말풍선과 표정이 잘 보이게
        const f = lookAtSpeaker && lookAtSpeaker.id !== p.id && t - lookAtSpeaker.at < 4 ? lookAtSpeaker.av.position : camera.position;
        let diff = Math.atan2(f.x - pos.x, f.z - pos.z) - p.av.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        p.av.rotation.y += diff * Math.min(1, dt * 2.5);
        for (const q of players.values()) { if (q === p) continue; const dx = pos.x - q.av.position.x, dz = pos.z - q.av.position.z, d = Math.hypot(dx, dz); if (d > 0.001 && d < 1.15) { pos.x += (dx / d) * (1.15 - d) * dt * 2; pos.z += (dz / d) * (1.15 - d) * dt * 2; } } // 겹치지 않게 살짝 비켜서기
      }
      A.animateAvatar(p.av, t, p.target ? 'walk' : p.mood || 'idle', p.phase);
      project({x: pos.x, z: pos.z}, 2.75, p.tag); project({x: pos.x, z: pos.z}, 3.15, p.bubble);
    }
    stepHandshake(dt); stepFlyers(dt);
    if (secretary) { A.animateAvatar(secretary, t, 'idle', 1.3); const wp = new THREE.Vector3(); secretary.getWorldPosition(wp); project({x: wp.x, z: wp.z}, 2.75, npcTag); project({x: wp.x, z: wp.z}, 3.15, deskBubble); }
    const mz = ZONES.find((z) => z.main); if (mz.spin) mz.spin.rotation.y += dt * 0.6;
    if (furniture.tank && furniture.tank.visible) furniture.tank.children.forEach((c) => { if (c.userData.swim != null) c.position.x = Math.sin(t * 0.8 + c.userData.swim * 2) * 0.7; });
    for (const z of ZONES) if (z.sign) z.sign.visible = !camState.closeUp && (camState.pitch > 0.5 || z.sign.getWorldPosition(v3).distanceTo(camera.position) > 7); // 클로즈업·눈높이 보기에선 가까운 간판이 화면을 가리지 않게
    for (const z of ZONES) if (z.sign) z.sign.lookAt(camera.position.x, z.sign.getWorldPosition(v3).y, camera.position.z);
    placeCamera(false);
    backWallG.visible = camera.position.z > -ROOM + 0.5; leftWallG.visible = camera.position.x > -ROOM + 0.5;
    renderer.render(scene, camera);
  }


  // ───────── 방 꾸미기 (씽크칩으로 벽지·바닥·러그·가구 구매) ─────────
  // 내가 꾸민 방은 내 화면에 늘 보이고, 내가 만든 친구 방에선 들어온 친구들에게도 그대로 보여요 (미니홈피처럼).
  const DECOR = {
    wall: [{id: 'navy', name: '네이비', price: 0, c: 0x141c33}, {id: 'cream', name: '크림', price: 60, c: 0xe9dfc9}, {id: 'mint', name: '민트', price: 60, c: 0x9fd8c8}, {id: 'pink', name: '체리 핑크', price: 60, c: 0xf2b6c6}, {id: 'black', name: '블랙', price: 80, c: 0x0b0b10}, {id: 'sky', name: '하늘', price: 60, c: 0xa9c8f0}],
    floor: [{id: 'oak', name: '원목', price: 0, c: 0x7a5a43}, {id: 'white', name: '화이트 우드', price: 80, c: 0xd9cdbd}, {id: 'marble', name: '대리석', price: 100, c: 0xcfd2d8}, {id: 'walnut', name: '월넛', price: 70, c: 0x4a3326}, {id: 'pinktile', name: '핑크 타일', price: 80, c: 0xe9b7c4}],
    rug: [{id: 'navy', name: '네이비', price: 0, c: 0x1c2747}, {id: 'red', name: '레드', price: 40, c: 0x7a1f2b}, {id: 'green', name: '포레스트', price: 40, c: 0x1f5a3e}, {id: 'purple', name: '퍼플', price: 40, c: 0x4a2f7a}, {id: 'beige', name: '베이지', price: 40, c: 0xcdb99a}],
    items: [{id: 'arcade', name: '아케이드 기계', price: 150}, {id: 'trophy', name: '트로피 장식장', price: 120}, {id: 'tank', name: '어항', price: 130}, {id: 'piano', name: '피아노', price: 200}, {id: 'tree', name: '반짝이 트리', price: 90}, {id: 'bean', name: '빈백 소파', price: 70}, {id: 'neon', name: '네온 하트', price: 60}, {id: 'plants', name: '화분 세트', price: 50}],
  };
  const ROOM_KEY = 'thinkchip:room:v1';
  const DEFAULT_DECO = {wall: 'navy', floor: 'oak', rug: 'navy', items: []};
  const encodeDeco = (d) => [d.wall, d.floor, d.rug, (d.items || []).join('_')].join('.');
  const decodeDeco = (str) => { const [w, f, r, it] = String(str || '').split('.'); const ok = (cat, v) => DECOR[cat].some((x) => x.id === v);
    return {wall: ok('wall', w) ? w : 'navy', floor: ok('floor', f) ? f : 'oak', rug: ok('rug', r) ? r : 'navy', items: String(it || '').split(/[_+]/).filter((x) => DECOR.items.some((y) => y.id === x))}; };
  let myRoom = (() => { const v = store.get(ROOM_KEY, null); return v && v.deco ? {deco: Object.assign({}, DEFAULT_DECO, v.deco), owned: Array.isArray(v.owned) ? v.owned : []} : {deco: {...DEFAULT_DECO}, owned: []}; })();
  let shownDeco = myRoom.deco; // 지금 화면에 보이는 방 (친구 방이면 방장 방)
  const furniture = {};
  (function buildFurniture() {
    const G = (id, x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.visible = false; scene.add(g); furniture[id] = g; return g; };
    let g = G('arcade', -9.4, 6.6, Math.PI / 2); box(1.1, 2.2, 0.9, M(0x2b2f8a), 0, 1.1, 0, g); box(0.9, 0.7, 0.05, M(0x0b1430, {emissive: 0x5b6cff, emissiveIntensity: 0.9}), 0, 1.6, 0.46, g); box(1.0, 0.12, 0.5, M(0x1a1d55), 0, 1.05, 0.6, g); cyl(0.06, 0.06, 0.16, M(0xff4d5e), -0.2, 1.17, 0.62, 12, g); cyl(0.05, 0.05, 0.05, M(0xf7ce55), 0.2, 1.13, 0.62, 12, g);
    g = G('trophy', 2.2, -10.3); box(2.2, 2.4, 0.5, mats.wood, 0, 1.2, 0, g); for (let i = 0; i < 3; i++) box(2.0, 0.05, 0.45, mats.gold, 0, 0.5 + i * 0.7, 0.03, g); for (let i = 0; i < 4; i++) { cyl(0.12, 0.08, 0.3, mats.gold, -0.75 + i * 0.5, 1.37, 0.05, 12, g); cyl(0.05, 0.05, 0.08, mats.gold, -0.75 + i * 0.5, 1.2, 0.05, 8, g); }
    g = G('tank', 9.5, -6.2, -Math.PI / 2); box(2.0, 0.8, 0.8, mats.wood, 0, 0.4, 0, g); const w = box(1.9, 1.0, 0.7, new THREE.MeshPhysicalMaterial({color: 0x7fd3ff, transparent: true, opacity: 0.45, roughness: 0.05}), 0, 1.3, 0, g); w.castShadow = false;
      [0xff8a4c, 0xf7ce55, 0xff6fc8].forEach((c, i) => { const fsh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M(c)); fsh.scale.x = 1.6; fsh.position.set(-0.5 + i * 0.5, 1.2 + (i % 2) * 0.25, 0); fsh.userData.swim = i; g.add(fsh); });
    g = G('piano', 6.5, 9.4, Math.PI); box(2.0, 1.1, 0.7, M(0x0b0b10, {roughness: 0.2}), 0, 0.85, 0, g); box(1.9, 0.06, 0.35, M(0xffffff), 0, 1.0, 0.45, g); for (let i = 0; i < 9; i++) box(0.06, 0.06, 0.2, M(0x0b0b10), -0.8 + i * 0.2, 1.04, 0.38, g); box(0.9, 0.5, 0.4, M(0x0b0b10), 0, 0.25, 0.9, g);
    g = G('tree', -9.2, -9.2); cyl(0.12, 0.15, 0.6, mats.wood, 0, 0.3, 0, 8, g); [[1.0, 1.0], [0.8, 1.7], [0.55, 2.3]].forEach(([r, y]) => { const cn = new THREE.Mesh(new THREE.ConeGeometry(r, 1.0, 16), M(0x2f8f5b)); cn.position.y = y; cn.castShadow = true; g.add(cn); });
      const star = cyl(0.18, 0.18, 0.06, M(0xf7ce55, {emissive: 0xf7ce55, emissiveIntensity: 0.8}), 0, 2.95, 0, 5, g); star.rotation.x = Math.PI / 2; for (let i = 0; i < 10; i++) { const bl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M([0xff4d5e, 0xf7ce55, 0x5b6cff][i % 3], {emissive: [0xff4d5e, 0xf7ce55, 0x5b6cff][i % 3], emissiveIntensity: 0.6})); const a = i * 2.1, y = 0.9 + (i / 10) * 1.6, r = 0.95 - (i / 10) * 0.6; bl.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.add(bl); }
    g = G('bean', -3.4, 9.0); [[-0.9, 0xff8a4c], [0.9, 0x8b7bff]].forEach(([x, c]) => { const bb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), M(c, {roughness: 0.9})); bb.scale.y = 0.6; bb.position.set(x, 0.45, 0); bb.castShadow = true; g.add(bb); });
    g = G('neon', -10.7, 2.8, Math.PI / 2); const hs = new THREE.Shape(); hs.moveTo(0, -0.6); hs.bezierCurveTo(-1.2, 0.2, -0.5, 1.0, 0, 0.45); hs.bezierCurveTo(0.5, 1.0, 1.2, 0.2, 0, -0.6);
      const heart = new THREE.Mesh(new THREE.ShapeGeometry(hs), new THREE.MeshBasicMaterial({color: 0xff4d8d, toneMapped: false})); heart.position.y = 3.6; g.add(heart); const hl = new THREE.PointLight(0xff4d8d, 0.6, 5, 2); hl.position.set(0, 3.6, 0.5); g.add(hl);
    g = G('plants', 9.4, 9.4); [[0, 0, 1.2], [-1.1, 0.3, 0.8], [0.4, -1.1, 0.9]].forEach(([x, z, sc]) => { cyl(0.3 * sc, 0.24 * sc, 0.55 * sc, mats.pot, x, 0.28 * sc, z, 16, g); for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.34 * sc, 12, 10), mats.plant); l.position.set(x + Math.cos(i * 1.6) * 0.18 * sc, (0.85 + (i % 2) * 0.25) * sc, z + Math.sin(i * 1.6) * 0.18 * sc); l.scale.y = 1.3; l.castShadow = true; g.add(l); } });
  })();
  const pick = (cat, id) => DECOR[cat].find((x) => x.id === id) || DECOR[cat][0];
  function applyDecor(d) {
    shownDeco = d;
    const day = document.body.dataset.theme === 'day';
    mats.wall.color.setHex(d.wall === 'navy' && day ? mats.wallDay : pick('wall', d.wall).c);
    mats.floor.color.setHex(d.floor === 'oak' && day ? mats.floorDay : pick('floor', d.floor).c);
    mats.rug.color.setHex(pick('rug', d.rug).c);
    for (const [id, g] of Object.entries(furniture)) g.visible = (d.items || []).includes(id);
  }
  const decoOwned = (cat, id) => (DECOR[cat].find((x) => x.id === id)?.price || 0) === 0 || myRoom.owned.includes(`${cat}:${id}`);
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
    openSheet({kicker: 'MY ROOM', title: '🏠 방 꾸미기', cls: 'closet', onClose: () => { decoDraft = null; applyDecor(room.public ? myRoom.deco : (hostDeco || myRoom.deco)); }, html: `
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
        b.disabled = true; payChips(total, '방 꾸미기를 사려면 ').then((ok) => { b.disabled = false; if (!ok) return;
        myRoom.owned = [...new Set([...myRoom.owned, ...due.map((x) => `${x.cat}:${x.id}`)])]; myRoom.deco = JSON.parse(JSON.stringify(d)); store.set(ROOM_KEY, myRoom);
        if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'deco', deco: encodeDeco(myRoom.deco)}));
        toast(total ? `구매 완료! -${total} 씽크칩` : '방을 저장했어요'); decoDraft = null; closeSheet(); drawBoard(); setTicker(); pushData('room'); }); }
    };
  }
  let hostDeco = null; // 친구 방 방장이 꾸민 방
  // ───────── UI ─────────
  function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }
  function renderChips() { $('chips').textContent = acctOn() && !loggedIn() ? '로그인' : fmt(myChips()); }
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
  function openSheet({kicker = '', title = '', html = '', cls = '', onClose = null}) {
    $('sheetKicker').textContent = kicker; $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html;
    $('sheet').className = 'sheet ' + cls; $('sheet').hidden = false; $('backdrop').hidden = cls === 'closet'; sheetOnClose = onClose;
  }
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
      <div class="card" style="margin-top:12px"><h3>내 기록</h3><div class="stats"><div><b>${acctOn() && !loggedIn() ? '-' : fmt(myChips())}</b><small>씽크칩</small></div><div><b>${plays}</b><small>최근 플레이</small></div><div><b>${wins}</b><small>최근 승리</small></div></div>
      ${bestList.length ? `<p style="margin-top:10px">${bestList.map(([id, s]) => `${esc(GAME[id]?.title || id)} <b style="color:var(--gold)">${fmt(s)}</b>`).join(' · ')}</p>` : '<p style="margin-top:10px">아직 기록이 없어요. 테이블에서 한 판 해볼까요?</p>'}</div>
      <a class="btn ghost full" style="display:grid;place-items:center;text-decoration:none;color:inherit;margin-top:8px" href="${new URL('?wallet=1&from=lounge', ARENA).href}">⬡ 씽크칩 충전 · 지갑</a>
      ${acctOn() ? (loggedIn() ? `<p class="table-note" style="text-align:center">${ACC.state.platform === 'toss' ? '토스' : '카카오'} 계정으로 로그인됨 ${IN_TOSS ? '' : '· <a href="#" id="logoutBtn" style="color:var(--muted)">로그아웃</a>'}</p>` : '<button class="btn kakao full" id="deskLogin" style="margin-top:8px">🔑 로그인하고 칩 모으기</button>') : ''}
      <div class="name-row" style="margin:12px 0"><div class="label-row">내 이름 <small style="color:var(--muted);font-weight:600">· 바꾸면 바로 머리 위 이름이 바뀌어요</small></div><input id="deskName" maxlength="12" value="${esc(p.nickname || '')}" placeholder="라운지에서 보일 이름"></div>
      <div class="card"><h3>비서의 팁</h3><p>${['심리전 테이블에선 채팅 이모티콘으로 표정을 바꿔 블러핑해 보세요 😏', '드레스룸에서 얼굴은 무료로 바꿀 수 있어요.', '친구 방을 만들면 라운지와 파티 게임을 같은 사람들과 할 수 있어요.', '메인 매치는 매일 자정에 바뀌어요.'][new Date().getDate() % 4]}</p></div>`});
    $('deskName').onchange = (e) => { const q = profile(); q.nickname = e.target.value.trim().slice(0, 12); saveProfile(q); me.tag.textContent = myName(); reconnect(); if (loggedIn()) ACC.call('hello', {name: myName()}).catch(() => {}); toast('이름을 바꿨어요'); };
    if ($('deskLogin')) $('deskLogin').onclick = () => openLogin();
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
  const owned = (cat, id) => priceOf(cat, id) === 0 || mine.owned.includes(`${cat}:${id}`);
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
    if (closetTab === 'face') body = `<div class="label-row">피부</div>${swatches('skin', W.colors.skin)}<div class="label-row">눈</div><div class="items">${W.eyes.map((it) => itemBtn('eyes', it, d.eyes === it.id)).join('')}</div>
      <div class="label-row">눈썹</div><div class="items">${W.brows.map((it) => itemBtn('brows', it, d.brows === it.id)).join('')}</div>
      <div class="label-row">볼터치</div><div class="items"><button class="item ${d.blush ? 'on' : ''}" data-blush="1">있음<span class="price free">무료</span></button><button class="item ${!d.blush ? 'on' : ''}" data-blush="0">없음<span class="price free">무료</span></button></div>`;
    else {
      const colorKey = {hair: 'hairColor', top: 'topColor', bottom: 'bottomColor', shoes: 'shoeColor'}[closetTab];
      body = `<div class="items">${W[closetTab].map((it) => itemBtn(closetTab, it, d[closetTab] === it.id)).join('')}</div>${colorKey ? `<div class="label-row">색상 (무료)</div>${swatches(colorKey, closetTab === 'hair' ? W.colors.hair : W.colors.cloth)}` : ''}`;
    }
    openSheet({kicker: 'DRESS ROOM', title: '👕 드레스룸', cls: 'closet', onClose: () => { camState.closeUp = false; draft = null; rebuildMe(); }, html: `
      <div class="tabs">${TABS.map((t) => `<button data-tab="${t.id}" class="${closetTab === t.id ? 'on' : ''}">${t.name}${t.free ? ' · 무료' : ''}</button>`).join('')}</div>${body}
      <div class="closet-foot"><span class="sum">${total ? (total > chips ? `👀 미리보기 중 · <b>⬡${fmt(total - chips)}</b> 더 모으면 살 수 있어요` : `새로 살 것 ${due.length}개 · <b>⬡${total}</b> (보유 ⬡${fmt(chips)})`) : '바꾼 모습을 저장할 수 있어요'}</span>
      <button class="btn gold" id="wearBtn" ${total > chips ? 'disabled' : ''}>${total ? (total > chips ? '씽크칩 부족' : '구매하고 입기') : '저장하기'}</button></div>`});
    $('sheetBody').onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { closetTab = b.dataset.tab; renderCloset(); return; }
      if (b.dataset.cat) { draft[b.dataset.cat] = b.dataset.id; }
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
    if (wear.busy) return; wear.busy = true;
    payChips(total, '옷을 사려면 ').then((ok) => { wear.busy = false; if (ok) wearDone(due, total); });
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
    const base = room.public ? '공개 라운지' : `친구 방 · ${room.code}`;
    $('roomLabel').innerHTML = hp && !room.public ? `${esc(room.code)} · <span class="hp-count">TODAY <b>${hp.today}</b> · TOTAL <b>${hp.total}</b></span>` : esc(base);
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
    box.onchange = (e) => { if (e.target.id !== 'nameInput') return; const p = profile(); p.nickname = e.target.value.trim().slice(0, 12); saveProfile(p); me.tag.textContent = myName(); reconnect(); if (loggedIn()) ACC.call('hello', {name: myName()}).catch(() => {}); toast('이름을 바꿨어요'); };
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
    openSheet({kicker: 'LOGIN', title: '🔑 로그인', html: `
      <div class="card"><h3>${esc(why)}로그인이 필요해요</h3><p>로그인하면 씽크칩·산 옷과 가구·친구가 계정에 저장돼서 폰을 바꾸거나 앱을 지워도 그대로예요.</p></div>
      ${IN_TOSS ? '<button class="btn gold full" id="loginGo">토스 계정으로 계속하기</button>' : '<button class="btn kakao full" id="loginGo">카카오로 로그인</button>'}
      <p class="table-note" style="text-align:center">로그인 없이도 라운지 구경과 혼자 하는 게임은 할 수 있어요.</p>`});
    $('loginGo').onclick = () => {
      if (IN_TOSS) { location.href = ARENA.href; return; } // 토스 앱: 메인 앱이 토스 계정으로 로그인하고 라운지로 돌려보내요
      if (!ACC || !ACC.loginKakao()) toast('지금은 로그인할 수 없어요. 인터넷 연결을 확인해 주세요');
    };
  }
  // 칩 쓰기: 로그인 상태면 서버 지갑에서, 오프라인 데모면 이 기기 지갑에서. 성공하면 true
  async function payChips(total, why) {
    if (!total) return true;
    if (!acctOn()) { if (total > myChips()) { toast('씽크칩이 부족해요'); return false; } addChips(-total); return true; }
    if (!loggedIn()) { openLogin(why); return false; }
    try { const r = await ACC.call('spend', {amount: total}); if (r.ok) return true; toast(r.error === 'chips' ? '씽크칩이 부족해요' : '잠시 후 다시 시도해 주세요'); }
    catch (e) { toast('인터넷 연결을 확인해 주세요'); }
    return false;
  }
  // 내 캐릭터·방을 계정에 저장 (기기를 바꿔도 산 옷·가구 유지)
  function pushData(key) { if (!loggedIn()) return; const value = key === 'avatar' ? {look: mine.look, owned: mine.owned} : {deco: myRoom.deco, owned: myRoom.owned}; ACC.call('save', {key, value}).catch(() => {}); }
  let pulledData = false;
  function pullData() { // 로그인 후 처음: 계정에 저장된 게 있으면 가져오고, 없으면 이 기기 것을 올려요
    if (pulledData || !loggedIn() || !st().wallet) return; pulledData = true; const d = st().data || {};
    if (d.avatar && d.avatar.look) { const owned = [...new Set([...(d.avatar.owned || []), ...mine.owned])]; mine = {look: Object.assign({}, A.DEFAULT_LOOK, d.avatar.look), owned}; A.saveMine(mine); me.look = A.encodeLook(mine.look); rebuildMe(); sendLook(); if (owned.length > (d.avatar.owned || []).length) pushData('avatar'); }
    else if (localStorage.getItem('thinkchip:avatar:v1')) pushData('avatar');
    if (d.room && d.room.deco) { myRoom = {deco: Object.assign({}, DEFAULT_DECO, d.room.deco), owned: [...new Set([...(d.room.owned || []), ...myRoom.owned])]}; store.set(ROOM_KEY, myRoom); if (!decoDraft) applyDecor(room.public ? myRoom.deco : (hostDeco || myRoom.deco)); if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'deco', deco: encodeDeco(myRoom.deco)})); }
    else if (myRoom.owned.length) pushData('room');
  }
  async function sendGift(f, amount) {
    const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    let r; try { r = await ACC.call('gift', {to: f.pid, amount, id}); } catch (e) { r = {error: 'net'}; }
    if (r.ok) { toast(`🎁 ${f.name}님에게 ⬡${fmt(amount)}을 선물했어요`); setExpr(me, 'happy'); chatLine('', `🎁 ${f.name}님에게 ⬡${fmt(amount)} 선물을 보냈어요`, true); }
    else toast(`선물하지 못했어요 · ${socialMsg(r.error)}`);
    drawBoard(); closeSheet(); openFriends();
  }
  const socialMsg = (e) => ({nogift: '토스 앱에서 접속한 친구에게는 선물할 수 없어요', paid: '선물할 수 있는 충전 칩이 부족해요', limit: '오늘 선물 한도를 넘었어요 (하루 ⬡5,000)', notfriend: '친구에게만 선물할 수 있어요', theirfull: '상대가 받은 신청이 너무 많아요', gone: '이미 처리된 신청이에요', nouser: '아직 로그인한 적 없는 사람이에요', net: '인터넷 연결을 확인해 주세요'}[e] || '잠시 후 다시 시도해 주세요');
  let seenReq = -1;
  function afterSync() { // 서버 상태가 바뀔 때마다: 받은 선물 알림, 새 친구 신청, 배지, 화면
    if (!loggedIn()) { renderChips(); renderSocialBadge(); return; }
    if (st().pid && st().pid !== ME) { location.reload(); return; } // 방금 로그인: 계정 id 로 다시 접속
    if (st().welcomeBonus) { const n = st().welcomeBonus; ACC.clearWelcome(); setTimeout(() => { toast(`🎉 가입 축하 보너스 +${n} 씽크칩!`); setExpr(me, 'laugh'); }, 600); }
    const so = social(), got = so.gifts || [];
    if (got.length && !afterSync.busy) { afterSync.busy = true;
      for (const g of got) chatLine('', `🎁 ${g.name}님에게 ⬡${fmt(g.amount)} 선물을 받았어요`, true);
      const from = [...new Set(got.map((g) => g.name))]; toast(`🎁 ${from.slice(0, 2).join(', ')}${from.length > 2 ? ` 외 ${from.length - 2}명` : ''}님이 ⬡${fmt(got.reduce((a, g) => a + g.amount, 0))}을 선물했어요!`); setExpr(me, 'happy');
      ACC.call('seen', {ids: got.map((g) => g.id)}).catch(() => {}).finally(() => { afterSync.busy = false; }); }
    const nReq = (so.requests || []).length; if (seenReq >= 0 && nReq > seenReq) toast(`📩 친구 신청이 ${nReq}개 와 있어요 · 👥 친구에서 확인`); seenReq = nReq;
    syncName(); pullData(); renderChips(); renderSocialBadge(); drawBoard(); renderSocial();
  }
  let nameSynced = false;
  function syncName() { // 새 기기에서 처음이면 계정 이름을 쓰고, 아니면 이 기기에서 정한 이름을 계정에 올려요
    if (nameSynced || !st().wallet) return; nameSynced = true; const server = st().name || '';
    if (firstName && server) { const p = profile(); p.nickname = server; saveProfile(p); me.tag.textContent = myName(); reconnect(); }
    else if (server !== myName()) ACC.call('hello', {name: myName()}).catch(() => {});
  }
  function syncSocial() { if (loggedIn()) ACC.refresh(); }
  function renderSocialBadge() { const b = document.querySelector('.dock-right [data-open="friends"]'); if (b) b.classList.toggle('has-badge', loggedIn() && (social().requests || []).length > 0); }
  function renderSocial() {
    const box = $('socialBox'); if (!box || $('sheet').hidden) return;
    if (document.activeElement && document.activeElement.id === 'nameInput') return; // 이름 입력 중엔 다시 그리지 않아요
    const nameRow = `<div class="name-row" style="margin:0 0 12px"><div class="label-row">내 이름 <small style="color:var(--muted);font-weight:600">· 바꾸면 머리 위 이름과 친구 목록 이름이 바뀌어요</small></div><input id="nameInput" maxlength="12" value="${esc(profile().nickname || '')}" placeholder="라운지에서 보일 이름"></div>`;
    if (!acctOn()) { box.innerHTML = nameRow + '<div class="card"><p>오프라인이라 친구 기능을 쓸 수 없어요.</p></div>'; return; }
    if (!loggedIn()) { box.innerHTML = nameRow + `<div class="card"><h3>👥 친구</h3><p>로그인하면 친구를 맺고, 손인사하고, ${IN_TOSS ? '함께 놀 수 있어요' : '칩을 선물할 수 있어요'}.</p></div><button class="btn kakao full" id="socialLogin" style="margin-bottom:16px">🔑 로그인하기</button>`; return; }
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
  function openGift(f) {
    if (IN_TOSS || !loggedIn()) return;
    const so = social(), paid = giftable(), left = Math.max(0, (so.giftMax || 5000) - (so.sentToday || 0));
    const can = (a) => a <= paid && a <= left;
    openSheet({kicker: 'GIFT', title: `🎁 ${f.name}님에게 선물`, html: `
      <div class="card"><p>선물할 수 있는 칩 <b style="color:var(--gold)">⬡${fmt(paid)}</b></p>
        <p style="font-size:11.5px;margin-top:4px">충전(결제)한 칩만 선물할 수 있어요. 게임·광고로 번 칩, 선물 받은 칩은 선물할 수 없어요. 오늘 남은 선물 한도 ⬡${fmt(left)}</p></div>
      <div class="gift-grid">${GIFT_AMOUNTS.map((a) => `<button class="btn ${can(a) ? 'gold' : 'ghost'}" data-amt="${a}" ${can(a) ? '' : 'disabled'}>⬡${fmt(a)}</button>`).join('')}</div>
      ${paid < GIFT_AMOUNTS[0] ? '<button class="btn ghost full" id="giftCharge" style="margin-top:10px">💳 씽크칩 충전하러 가기</button>' : ''}
      <button class="btn ghost full" id="giftBack" style="margin-top:8px">← 친구 목록</button>
      <p class="table-note">보낸 선물은 되돌릴 수 없어요.</p>`});
    $('sheetBody').querySelector('.gift-grid').onclick = (e) => { const b = e.target.closest('[data-amt]'); if (!b || b.disabled) return; const a = Number(b.dataset.amt);
      if (confirm(`${f.name}님에게 ⬡${fmt(a)} 씽크칩을 선물할까요?\n보낸 선물은 되돌릴 수 없어요.`)) { b.disabled = true; sendGift(f, a); } };
    if ($('giftCharge')) $('giftCharge').onclick = () => { location.href = new URL('../index.html?wallet=1&from=lounge', location.href).href; };
    $('giftBack').onclick = () => { closeSheet(); openFriends(); };
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

  document.querySelector('.dock-right').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; ({games: openGames, closet: () => goToZone(ZONES.find((z) => z.closet)), desk: () => goToZone(ZONES.find((z) => z.desk)), friends: openFriends, room: openRoomDeco})[b.dataset.open]?.(); };
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
    mats.wall.color.setHex(day ? mats.wallDay : 0x141c33); mats.floor.color.setHex(day ? mats.floorDay : 0x7a5a43);
    hemi.intensity = day ? 0.85 : 0.5; sun.intensity = day ? 1.0 : 0.75; renderer.toneMappingExposure = day ? 0.9 : 1.0;
    if (typeof applyDecor === 'function' && shownDeco) applyDecor(shownDeco);
  }

  // 채팅 & 이모티콘
  $('chatForm').onsubmit = (e) => { e.preventDefault(); const v = $('chatInput').value.trim(); if (!v) return; $('chatInput').value = ''; sendChat(v); };
  $('emotes').onclick = (e) => { const b = e.target.closest('[data-emote]'); if (b) sendChat(b.dataset.emote); };
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
  let conn = null, retry = 0, retryTimer = 0, pingTimer = 0, gotFirstState = false;
  function switchRoom(code) {
    room.public = !code; room.code = code || 'LNG1';
    hp = null; renderRoomLabel();
    const u = new URL(location.href); if (room.public) u.searchParams.delete('room'); else u.searchParams.set('room', room.code); history.replaceState(null, '', u);
    for (const id of [...players.keys()]) if (id !== ME) despawn(id); online.clear(); $('chatLog').innerHTML = ''; gotFirstState = false;
    reconnect();
  }
  // 폰에서 앱을 내렸다 올리거나 인터넷이 돌아오면 바로 다시 연결
  const wake = () => { if (!document.hidden && (!conn || conn.readyState > 1)) reconnect(); };
  document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
  function reconnect() { clearTimeout(retryTimer); if (conn) { conn.onclose = null; try { conn.close(); } catch (e) {} } retry = 0; connect(); }
  function connect() {
    if (!CFG.LIVE_URL) { setOnline(false); return; }
    let ws; const q = new URLSearchParams({pid: ME, name: myName(), look: A.encodeLook(mine.look), deco: encodeDeco(myRoom.deco)});
    try { ws = new WebSocket(`${CFG.LIVE_URL}/${room.code}?${q}`); } catch (e) { setOnline(false); return; }
    conn = ws;
    ws.onopen = () => { retry = 0; setOnline(true); sendPose(); flushChat(); clearInterval(pingTimer); pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('{"t":"ping"}'); }, 20000); };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } handle(m); };
    ws.onclose = () => { if (conn !== ws) return; setOnline(false); retryTimer = setTimeout(connect, Math.min(10000, 700 * 2 ** Math.min(retry++, 4))); }; // 끊기면 계속 다시 붙어요
  }
  function setOnline(on) { $('online').classList.toggle('off', !on); $('online').innerHTML = on ? `<i></i><b>${online.size + 1}</b>명` : '<i></i><b>오프라인</b>'; }
  function sendPose() { const t = me.target || me.av.position; if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'pose', x: Math.round(t.x * 100) / 100, z: Math.round(t.z * 100) / 100})); }
  function sendLook() { if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'look', look: A.encodeLook(mine.look)})); }
  function handle(m) {
    if (m.t === 'state') {
      const seen = new Set();
      for (const p of m.players || []) {
        if (p.pid === ME || !p.online) continue; seen.add(p.pid);
        let pl = players.get(p.pid);
        if (pl && pl.look !== (p.look || '')) { const pos = pl.av.position.clone(); despawn(p.pid); pl = null; spawn(p.pid, otherName(p), p.look || '', pos.x, pos.z); }
        else if (!pl) { const pos = p.pos || {x: (Math.random() - 0.5) * 6, z: 4 + Math.random() * 2}; pl = spawn(p.pid, otherName(p), p.look || '', pos.x, pos.z); if (!online.has(p.pid) && gotFirstState) chatLine('', `${otherName(p)}님이 라운지에 들어왔어요`, true); }
        pl.tag.textContent = p.name; online.set(p.pid, p.name);
      }
      for (const id of [...online.keys()]) if (!seen.has(id)) { chatLine('', `${online.get(id)}님이 나갔어요`, true); online.delete(id); despawn(id); }
      const host = (m.players || []).find((p) => p.host);
      hostDeco = !room.public && host && host.pid !== ME && host.deco ? decodeDeco(host.deco) : null; // 친구 방이면 방장이 꾸민 방을 보여줘요
      if (!decoDraft) applyDecor(hostDeco || myRoom.deco);
      gotFirstState = true; setOnline(true); drawBoard(); setTicker();
    } else if (m.t === 'pose') { const p = players.get(m.pid); if (p && m.pid !== ME) walkTo(p, m.x, m.z); }
    else if (m.t === 'chat') { const p = players.get(m.pid); if (m.sys) chatLine('', m.text, true); else if (handleSignal(m)) { chatLine(otherName(m), m.text); say(p, m.text); } }
    else if (m.t === 'hp') { hp = m; renderRoomLabel(); if ($('gbList')) renderGuestbook(); }
    else if (m.t === 'chatlog') { (m.items || []).filter((c) => !/^\[\[(ok|cancel|hs|rx):/.test(c.text || '')).slice(-6).forEach((c) => chatLine(c.sys ? '' : otherName(c), c.text, c.sys)); }
    else if (m.t === 'error' && m.code === 'full') { toast('공개 라운지가 꽉 차서 옆 라운지로 옮겨요'); const n = Number((room.code || 'LNG1').slice(3)) || 1; switchRoom(null); room.code = `LNG${Math.min(9, n + 1)}`; reconnect(); }
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
  if (ACC && ACC.state.loginError) setTimeout(() => toast(ACC.state.loginError === 'cancel' ? '로그인을 취소했어요' : '로그인하지 못했어요. 다시 시도해 주세요'), 800);
  if (ACC && ACC.state.justLoggedIn) setTimeout(() => toast('로그인했어요! 이제 칩과 친구가 계정에 저장돼요 🎉'), 1200);
  setInterval(() => { if (!document.hidden) syncSocial(); }, 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSocial(); });
  if (!localStorage.getItem('thinkchip:avatar:v1')) setTimeout(() => { toast('처음 오셨네요! 드레스룸에서 내 캐릭터를 꾸며 보세요'); }, 1200);
  addEventListener('storage', (e) => { if (e.key === PROFILE_KEY) { renderChips(); drawBoard(); } });
  // 자동 테스트·영상 녹화용 (읽기 + 이동만). 게임 데이터나 칩은 바꾸지 않아요.
  window.__lounge = {
    me: () => ({x: me.av.position.x, z: me.av.position.z, expr: me.av.userData.face.expr, walking: !!me.target}),
    players: () => [...players.values()].map((p) => ({id: p.id, name: p.name, x: p.av.position.x, z: p.av.position.z, expr: p.av.userData.face.expr})),
    screenOf: (x, z, y = 0.9) => { const v = new THREE.Vector3(x, y, z).project(camera); return {x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight}; },
    zones: () => ZONES.map((z) => ({id: z.id, x: z.pos[0], z: z.pos[1]})),
    walkTo: (x, z) => { walkTo(me, x, z); sendPose(); },
    goZone: (id) => goToZone(ZONES.find((z) => z.id === id)),
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
