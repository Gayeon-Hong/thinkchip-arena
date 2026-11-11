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
  function addChips(n) { const p = profile(); p.chips = Math.max(0, Math.trunc((Number(p.chips) || 0) + n)); saveProfile(p); return p.chips; }
  function pid() { try { let id = localStorage.getItem('thinkchip:pid'); if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24); localStorage.setItem('thinkchip:pid', id); } return id; } catch (e) { return 'guest' + Math.floor(Math.random() * 1e6); } }
  const ME = pid();
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
    c.fillText(`● ONLINE ${online.size + 1}`, 48, 312); c.fillStyle = '#f7ce55'; c.fillText(`⬡ ${fmt(p.chips)}`, 360, 312);
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
  let me = spawn(ME, myName(), mine.look, (Math.random() - 0.5) * 5, 6 + Math.random() * 2, true);
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
    const lim = ROOM - 1.2; p.target = {x: Math.max(-lim, Math.min(lim, x)), z: Math.max(-lim, Math.min(lim, z)), then};
  }

  // ───────── 카메라 (내 캐릭터를 따라감, 드래그로 회전, 핀치/휠로 확대) ─────────
  const camState = {yaw: Math.PI / 4, pitch: 0.82, dist: 15, focus: new THREE.Vector3(0, 1, 2), closeUp: false};
  function placeCamera(snap) {
    const want = camState.closeUp ? new THREE.Vector3(me.av.position.x, 1.35, me.av.position.z) : new THREE.Vector3(me.av.position.x * 0.6, 1, me.av.position.z * 0.6 + 1);
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
  let drag = null, pinch0 = 0, dist0 = 0;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture?.(e.pointerId); pointers.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (pointers.size === 1) drag = {x: e.clientX, y: e.clientY, yaw: camState.yaw, pitch: camState.pitch, cy: camState.closeYaw || 0, moved: false}; if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = camState.dist; drag = null; } });
  canvas.addEventListener('pointermove', (e) => { if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); camState.dist = Math.max(9, Math.min(34, dist0 * (pinch0 / Math.max(1, d)))); return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 6) drag.moved = true; if (drag.moved && camState.closeUp) camState.closeYaw = drag.cy - dx * 0.01; // 꾸미는 중엔 캐릭터 둘레를 돌며 보기
      if (drag.moved && !camState.closeUp) { camState.yaw = drag.yaw - dx * 0.006; camState.pitch = Math.max(0.12, Math.min(1.35, drag.pitch + dy * 0.004)); } } }); // 좌우로 밀면 회전, 위아래로 밀면 눕혀 보기·내려다보기
  const up = (e) => { const wasTap = drag && !drag.moved && pointers.size === 1; pointers.delete(e.pointerId); if (wasTap) onTap(e.clientX, e.clientY); if (pointers.size === 0) drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); camState.dist = Math.max(9, Math.min(34, camState.dist + e.deltaY * 0.01)); }, {passive: false});
  function onTap(cx, cy) {
    hideHint();
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(clickables, false)[0];
    if (hit) { goToZone(hit.object.userData.zone); return; }
    const fh = ray.intersectObject(floor, false)[0];
    if (fh) { walkTo(me, fh.point.x, fh.point.z); sendPose(); }
  }
  function goToZone(zone) {
    const [x, z] = zone.pos, toMe = Math.atan2(me.av.position.x - x, me.av.position.z - z);
    const r = zone.main ? 2.8 : zone.party ? 2.6 : 2.3;
    walkTo(me, x + Math.sin(toMe) * r, z + Math.cos(toMe) * r, () => openZone(zone)); sendPose();
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
        if (d < 0.05) { const then = p.target.then; p.target = null; p.state = 'idle'; then && then(); }
        else { const step = Math.min(d, dt * 3.4); pos.x += (dx / d) * step; pos.z += (dz / d) * step; p.state = 'walk';
          const want = Math.atan2(dx, dz); let diff = want - p.av.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); p.av.rotation.y += diff * Math.min(1, dt * 10); }
      }
      if (!p.target && !(p === me && camState.closeUp)) { // 서 있을 땐 카메라(또는 방금 말한 사람) 쪽으로 천천히 몸을 돌려요 — 말풍선과 표정이 잘 보이게
        const f = lookAtSpeaker && lookAtSpeaker.id !== p.id && t - lookAtSpeaker.at < 4 ? lookAtSpeaker.av.position : camera.position;
        let diff = Math.atan2(f.x - pos.x, f.z - pos.z) - p.av.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        p.av.rotation.y += diff * Math.min(1, dt * 2.5);
        for (const q of players.values()) { if (q === p) continue; const dx = pos.x - q.av.position.x, dz = pos.z - q.av.position.z, d = Math.hypot(dx, dz); if (d > 0.001 && d < 1.15) { pos.x += (dx / d) * (1.15 - d) * dt * 2; pos.z += (dz / d) * (1.15 - d) * dt * 2; } } // 겹치지 않게 살짝 비켜서기
      }
      A.animateAvatar(p.av, t, p.target ? 'walk' : p.mood || 'idle', p.phase);
      project({x: pos.x, z: pos.z}, 2.75, p.tag); project({x: pos.x, z: pos.z}, 3.15, p.bubble);
    }
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
    const total = due.reduce((a, b) => a + b.price, 0), chips = profile().chips;
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
      if (b.id === 'decoSave') { if (total > profile().chips) return toast('씽크칩이 부족해요'); if (total) addChips(-total);
        myRoom.owned = [...new Set([...myRoom.owned, ...due.map((x) => `${x.cat}:${x.id}`)])]; myRoom.deco = JSON.parse(JSON.stringify(d)); store.set(ROOM_KEY, myRoom);
        if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'deco', deco: encodeDeco(myRoom.deco)}));
        toast(total ? `구매 완료! -${total} 씽크칩` : '방을 저장했어요'); decoDraft = null; closeSheet(); drawBoard(); setTicker(); }
    };
  }
  let hostDeco = null; // 친구 방 방장이 꾸민 방
  // ───────── UI ─────────
  function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }
  function renderChips() { $('chips').textContent = fmt(profile().chips); }
  function hideHint() { $('hint').classList.add('hide'); }
  setTimeout(hideHint, 7000);
  function chatLine(name, text, sys) {
    const el = document.createElement('div'); el.className = 'msg' + (sys ? ' sys' : ''); el.innerHTML = sys ? esc(text) : `<b>${esc(name)}</b>${esc(text).replace(JOIN_RE, (_, code, id) => `<a class="join-btn" href="${tableHref(id, code)}">🎮 참가하기</a>`)}`;
    const log = $('chatLog'); log.appendChild(el); while (log.children.length > 30) log.firstChild.remove();
    news.unshift(sys ? text : `${name}: ${String(text).replace(JOIN_RE, '').trim()}`); news = news.slice(0, 5); drawBoard();
  }
  function setTicker() {
    const g = dailyGame(), p = profile(), best = Object.entries(p.best || {}).sort((a, b) => b[1] - a[1])[0];
    const parts = [g ? `오늘의 메인 매치 · ${g.title}` : null, `접속 ${online.size + 1}명`, `내 씽크칩 ⬡${fmt(p.chips)}`, best && GAME[best[0]] ? `내 최고 기록 · ${GAME[best[0]].title} ${fmt(best[1])}점` : null, news[0] || null].filter(Boolean);
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
  const openHref = (id) => new URL(`?open=${encodeURIComponent(id)}&from=lounge`, ARENA).href;
  const partyHref = (id) => new URL(`?party=${encodeURIComponent(id)}${room.code && !room.public ? `&room=${room.code}` : ''}&from=lounge`, ARENA).href;
  // 테이블에서 '같이' 하기: 실시간 방을 열고 라운지 채팅에 참가 버튼을 올려요 (방 코드는 친구 방이면 그 코드, 공개 라운지면 새 코드)
  // 테이블 시트: 라운지 안에서 먼저 '같이 / 혼자' 를 고르고, 같이면 파티원이 올 때까지 여기서 기다려요
  let pending = null; // 내가 연 테이블 {code, id, joined:Set, timer}
  function othersHere() { return [...players.values()].filter((p) => p.id && p.id !== ME).map((p) => p.name); }
  function openTable(zone, mode) {
    const list = zone.games.map((id) => GAME[id]).filter(Boolean), others = othersHere();
    const tabs = `<div class="seg"><button class="${mode === 'team' ? 'on' : ''}" data-mode="team">👥 같이 하기${others.length ? ` · ${others.length}명` : ''}</button><button class="${mode === 'solo' ? 'on' : ''}" data-mode="solo">🤖 혼자 · AI</button></div>`;
    const who = mode === 'team' ? `<p class="table-note">${others.length ? `라운지에 있는 <b>${others.slice(0, 6).map(esc).join(', ')}${others.length > 6 ? ` 외 ${others.length - 6}명` : ''}</b>에게 초대가 가요. 게임을 고르면 파티원이 올 때까지 여기서 기다려요.` : '지금은 라운지에 다른 사람이 없어요. 게임을 고르면 초대를 걸어 두고 누가 들어올 때까지 기다려요. 친구 방 코드로 친구를 불러도 좋아요.'}</p>` : '<p class="table-note">혼자 연습하거나 AI 와 바로 붙어요.</p>';
    const items = list.map((g) => mode === 'team'
      ? `<button class="game-btn" data-team="${g.id}"><i style="background:${COLOR[g.color] || '#7c8cff'}">${esc(g.symbol)}</i><span><b>${esc(g.title)}</b><small>${esc(g.short || '')}</small></span></button>`
      : gameButton(g, openHref(g.id))).join('');
    openSheet({kicker: zone.sub, title: `${zone.icon} ${zone.title}`, html: `${tabs}${who}<div class="game-list table-games">${items}</div>`});
    $('sheetBody').querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => openTable(zone, b.dataset.mode); });
    $('sheetBody').querySelectorAll('[data-team]').forEach((b) => { b.onclick = () => startWaiting(zone, b.dataset.team); });
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
    $('waitAi').onclick = () => { const id = pending.id; cancelWaiting(); location.href = openHref(id); };
  }
  function cancelWaiting(silent) { if (!pending) return; clearTimeout(pending.timer); if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'chat', text: `[[cancel:${pending.code}]]`})); pending = null; if (!silent) toast('초대를 취소했어요'); }
  // 카톡 등으로 '같이 하자' 링크 보내기. 브라우저 공유창이 없으면(토스 앱 안) 게임 방으로 먼저 들어가 토스 공유로 보내요
  async function shareTable() {
    if (!pending) return; const g = GAME[pending.id], url = tableHref(pending.id, pending.code);
    const text = `${myName()}님이 씽크칩 아레나에서 '${g.title}' 같이 하재요! 지금 들어와 🎮 (방 코드 ${pending.code})`;
    if (navigator.share && !/^(localhost|127\.)/.test(location.hostname)) {
      try { await navigator.share({title: '씽크칩 아레나 같이 하자!', text, url}); toast('초대를 보냈어요. 여기서 기다릴게요'); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    pending.going = true; location.href = url + '&invite=1';
  }
  function goTable() { if (!pending) return; pending.going = true; clearTimeout(pending.timer); location.href = tableHref(pending.id, pending.code); }
  // 다른 사람의 초대 팝업
  let inviteShown = null;
  function showInvite(fromName, code, id) {
    const g = GAME[id]; if (!g || pending) return;
    inviteShown = code;
    let el = $('invitePop'); if (!el) { el = document.createElement('div'); el.id = 'invitePop'; el.className = 'invite-pop'; document.body.appendChild(el); }
    el.innerHTML = `<div class="ip-ico" style="background:${COLOR[g.color] || '#7c8cff'}">${esc(g.symbol)}</div><div class="ip-txt"><b>${esc(fromName)}님이 같이 하재요</b><small>${esc(g.title)}</small></div><button class="btn ghost" data-ip="no">괜찮아요</button><button class="btn gold" data-ip="yes">참가</button>`;
    el.hidden = false;
    el.onclick = (e) => { const b = e.target.closest('[data-ip]'); if (!b) return; el.hidden = true;
      if (b.dataset.ip === 'yes') { if (conn && conn.readyState === 1) conn.send(JSON.stringify({t: 'chat', text: `[[ok:${code}]]`})); setTimeout(() => { location.href = tableHref(id, code); }, 300); } };
  }
  function hideInvite(code) { const el = $('invitePop'); if (el && inviteShown === code) el.hidden = true; }
  // 채팅으로 오가는 초대 신호 처리. 화면에 보일 채팅이면 true
  function handleSignal(m) {
    const t = String(m.text || ''); let x;
    if ((x = /^\[\[ok:([A-Z0-9]{4,6})\]\]$/.exec(t))) { if (pending && pending.code === x[1] && m.pid !== ME) { pending.joined.add(otherName(m)); renderWaiting(); clearTimeout(pending.timer); pending.timer = setTimeout(goTable, 2500); } return false; }
    if ((x = /^\[\[cancel:([A-Z0-9]{4,6})\]\]$/.exec(t))) { hideInvite(x[1]); return false; }
    JOIN_RE.lastIndex = 0; if ((x = JOIN_RE.exec(t)) && m.pid !== ME) showInvite(otherName(m), x[1], x[2]);
    JOIN_RE.lastIndex = 0; return true;
  }
  function openZone(zone) {
    if (zone.closet) return openCloset();
    if (zone.desk) return openDesk();
    if (zone.main) { const g = dailyGame(); return openSheet({kicker: "TODAY'S MAIN MATCH", title: g ? `${g.symbol} ${g.title}` : '메인 매치', html: g ? `<div class="card"><p>${esc(g.short)}</p></div><a class="btn gold full" style="display:grid;place-items:center;text-decoration:none" href="${openHref(g.id)}">메인 매치 입장</a>` : ''}); }
    if (zone.party) return openSheet({kicker: 'PARTY · LIVE', title: '🎉 파티 라운지', html: `<p style="font-size:12.5px;color:var(--muted);margin:0 0 10px">친구들과 같은 방에서 실시간으로 해요. ${room.public ? '누르면 방이 만들어지고 초대 링크를 보낼 수 있어요.' : `지금 친구 방(${room.code}) 사람들과 바로 시작해요.`}</p><div class="game-list">${CFG.PARTY.map((g) => gameButton(g, partyHref(g.id))).join('')}</div>`});
    return openTable(zone, players.size > 1 ? 'team' : 'solo');
  }
  function openGames() {
    const html = ZONES.filter((z) => z.games || z.party).map((z) => `<div class="zone"><h3>${z.icon} ${esc(z.title)} <small>${esc(z.sub)}</small></h3><div class="game-list">${(z.party ? CFG.PARTY : z.games.map((id) => GAME[id]).filter(Boolean)).map((g) => gameButton(g, z.party ? partyHref(g.id) : openHref(g.id))).join('')}</div></div>`).join('');
    openSheet({kicker: 'ALL GAMES', title: '어떤 승부를 할까요?', html});
  }

  // 비서 데스크: 출석 보너스(진짜 칩 지급) + 내 기록
  const ATTEND = 30;
  function openDesk() {
    const p = profile(), L = store.get(LOUNGE_KEY, {}), done = L.attend === today(), plays = (p.history || []).length;
    const wins = (p.history || []).filter((h) => h.victory).length, bestList = Object.entries(p.best || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
    setExpr(players.get(ME), 'happy'); say({av: secretary, bubble: deskBubble, tag: npcTag}, done ? '오늘 출석은 이미 챙기셨어요!' : `어서 오세요, ${myName()}님! 출석 보너스 받아 가세요.`);
    openSheet({kicker: 'CONCIERGE', title: '💁 비서 데스크', html: `
      <div class="card reward"><div><h3>오늘의 출석 보너스</h3><p>${done ? '내일 다시 받을 수 있어요' : '하루 한 번 받을 수 있어요'}</p></div><strong>+${ATTEND}</strong></div>
      <button class="btn gold full" id="attendBtn" ${done ? 'disabled' : ''}>${done ? '오늘은 받았어요 ✓' : '출석 보너스 받기'}</button>
      <div class="card" style="margin-top:12px"><h3>내 기록</h3><div class="stats"><div><b>${fmt(p.chips)}</b><small>씽크칩</small></div><div><b>${plays}</b><small>최근 플레이</small></div><div><b>${wins}</b><small>최근 승리</small></div></div>
      ${bestList.length ? `<p style="margin-top:10px">${bestList.map(([id, s]) => `${esc(GAME[id]?.title || id)} <b style="color:var(--gold)">${fmt(s)}</b>`).join(' · ')}</p>` : '<p style="margin-top:10px">아직 기록이 없어요. 테이블에서 한 판 해볼까요?</p>'}</div>
      <div class="name-row" style="margin:12px 0"><div class="label-row">내 이름 <small style="color:var(--muted);font-weight:600">· 바꾸면 바로 머리 위 이름이 바뀌어요</small></div><input id="deskName" maxlength="12" value="${esc(p.nickname || '')}" placeholder="라운지에서 보일 이름"></div>
      <div class="card"><h3>비서의 팁</h3><p>${['심리전 테이블에선 채팅 이모티콘으로 표정을 바꿔 블러핑해 보세요 😏', '드레스룸에서 얼굴은 무료로 바꿀 수 있어요.', '친구 방을 만들면 라운지와 파티 게임을 같은 사람들과 할 수 있어요.', '메인 매치는 매일 자정에 바뀌어요.'][new Date().getDate() % 4]}</p></div>`});
    $('deskName').onchange = (e) => { const q = profile(); q.nickname = e.target.value.trim().slice(0, 12); saveProfile(q); me.tag.textContent = myName(); reconnect(); toast('이름을 바꿨어요'); };
    const b = $('attendBtn'); if (b) b.onclick = () => { const L2 = store.get(LOUNGE_KEY, {}); if (L2.attend === today()) return; L2.attend = today(); store.set(LOUNGE_KEY, L2); addChips(ATTEND); toast(`출석 보너스 +${ATTEND} 씽크칩!`); setExpr(me, 'laugh'); drawBoard(); setTicker(); openDesk(); };
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
    const d = draft, due = unpaid(d), total = due.reduce((a, b) => a + b.price, 0), chips = profile().chips;
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
    if (total > profile().chips) { toast('씽크칩이 부족해요. 게임으로 모아 보세요!'); return; }
    if (total) addChips(-total);
    mine.owned = [...new Set([...mine.owned, ...due.map((x) => `${x.cat}:${x.id}`)])]; mine.look = Object.assign({}, draft); A.saveMine(mine);
    me.look = A.encodeLook(mine.look); sendLook();
    toast(total ? `구매 완료! -${total} 씽크칩` : '저장했어요'); setExpr(me, 'laugh');
    draft = null; camState.closeUp = false; closeSheet(); rebuildMe(); drawBoard(); setTicker();
  }

  // 친구 방: 같은 코드로 들어온 사람들만 보이는 라운지 (파티 게임도 같은 방으로 이어져요)
  function openFriends() {
    openSheet({kicker: 'FRIENDS', title: '👥 친구 방', html: `
      ${room.public ? '<div class="card"><h3>지금은 공개 라운지예요</h3><p>친구 방을 만들면 코드로 들어온 친구들만 같은 라운지에 모여요. 파티 게임을 고르면 그 친구들과 바로 같은 방에서 시작해요.</p></div>'
        : `<div class="card"><h3>친구 방 코드</h3><div class="big-code">${room.code}</div><p>이 코드나 링크를 보내면 같은 라운지로 들어와요.</p></div><button class="btn gold full" id="shareBtn">초대 링크 보내기</button>`}
      <div class="code-row"><input id="codeInput" maxlength="6" placeholder="코드 입력" autocapitalize="characters"><button class="btn ghost" id="joinBtn">입장</button></div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn ${room.public ? 'gold' : 'ghost'} full" id="newRoomBtn">새 친구 방 만들기</button>${room.public ? '' : '<button class="btn ghost full" id="publicBtn">공개 라운지로</button>'}</div>
      <div class="name-row" style="margin-top:14px"><div class="label-row">내 이름</div><input id="nameInput" maxlength="12" value="${esc(profile().nickname || '')}" placeholder="라운지에서 보일 이름"></div>`});
    $('codeInput').oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    $('joinBtn').onclick = () => { const c = $('codeInput').value; if (c.length < 4) return toast('코드 4자리를 입력해 주세요'); switchRoom(c); closeSheet(); };
    $('newRoomBtn').onclick = () => { switchRoom(newCode()); openFriends(); };
    if ($('publicBtn')) $('publicBtn').onclick = () => { switchRoom(null); closeSheet(); };
    if ($('shareBtn')) $('shareBtn').onclick = shareRoom;
    $('nameInput').onchange = (e) => { const p = profile(); p.nickname = e.target.value.trim().slice(0, 12); saveProfile(p); me.tag.textContent = myName(); reconnect(); toast('이름을 바꿨어요'); };
  }
  async function shareRoom() {
    const url = new URL(`?room=${room.code}`, location.href).href, text = `씽크칩 라운지에서 만나요! 방 코드 ${room.code}`;
    try { if (navigator.share) { await navigator.share({title: '씽크칩 라운지', text, url}); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('초대 링크를 복사했어요'); } catch (e) { toast(`방 코드: ${room.code}`); }
  }
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from({length: 4}, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

  document.querySelector('.dock-right').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; ({games: openGames, closet: () => goToZone(ZONES.find((z) => z.closet)), desk: () => goToZone(ZONES.find((z) => z.desk)), friends: openFriends, room: openRoomDeco})[b.dataset.open]?.(); };
  $('chipsBtn').onclick = openDesk;
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
    document.body.dataset.theme = t; const day = t === 'day'; $('themeBtn').textContent = day ? '☀' : '☾';
    scene.background = new THREE.Color(day ? 0xdfe5f2 : 0x070b16); scene.fog = new THREE.Fog(day ? 0xdfe5f2 : 0x070b16, 26, 60);
    mats.wall.color.setHex(day ? mats.wallDay : 0x141c33); mats.floor.color.setHex(day ? mats.floorDay : 0x7a5a43);
    hemi.intensity = day ? 0.85 : 0.5; sun.intensity = day ? 1.0 : 0.75; renderer.toneMappingExposure = day ? 0.9 : 1.0;
    if (typeof applyDecor === 'function' && shownDeco) applyDecor(shownDeco);
  }

  // 채팅 & 이모티콘
  $('chatForm').onsubmit = (e) => { e.preventDefault(); const v = $('chatInput').value.trim(); if (!v) return; $('chatInput').value = ''; sendChat(v); };
  $('emotes').onclick = (e) => { const b = e.target.closest('[data-emote]'); if (b) sendChat(b.dataset.emote); };
  function sendChat(text) {
    if (conn && conn.readyState === 1) { conn.send(JSON.stringify({t: 'chat', text})); }
    else { chatLine(myName(), text); say(me, text); } // 오프라인이면 내 화면에만
  }

  // ───────── 실시간 접속 (live-server 재사용: 방 = 라운지) ─────────
  const params = new URLSearchParams(location.search);
  const room = {code: null, public: true};
  const online = new Map();
  let conn = null, retry = 0, retryTimer = 0, pingTimer = 0, gotFirstState = false;
  function switchRoom(code) {
    room.public = !code; room.code = code || 'LNG1';
    $('roomLabel').textContent = room.public ? '공개 라운지' : `친구 방 · ${room.code}`;
    const u = new URL(location.href); if (room.public) u.searchParams.delete('room'); else u.searchParams.set('room', room.code); history.replaceState(null, '', u);
    for (const id of [...players.keys()]) if (id !== ME) despawn(id); online.clear(); $('chatLog').innerHTML = ''; gotFirstState = false;
    reconnect();
  }
  function reconnect() { clearTimeout(retryTimer); if (conn) { conn.onclose = null; try { conn.close(); } catch (e) {} } retry = 0; connect(); }
  function connect() {
    if (!CFG.LIVE_URL) { setOnline(false); return; }
    let ws; const q = new URLSearchParams({pid: ME, name: myName(), look: A.encodeLook(mine.look), deco: encodeDeco(myRoom.deco)});
    try { ws = new WebSocket(`${CFG.LIVE_URL}/${room.code}?${q}`); } catch (e) { setOnline(false); return; }
    conn = ws;
    ws.onopen = () => { retry = 0; setOnline(true); sendPose(); clearInterval(pingTimer); pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('{"t":"ping"}'); }, 20000); };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } handle(m); };
    ws.onclose = () => { if (conn !== ws) return; setOnline(false); if (retry < 6) retryTimer = setTimeout(connect, Math.min(8000, 700 * 2 ** retry++)); };
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
    else if (m.t === 'chatlog') { (m.items || []).filter((c) => !/^\[\[(ok|cancel):/.test(c.text || '')).slice(-6).forEach((c) => chatLine(c.sys ? '' : otherName(c), c.text, c.sys)); }
    else if (m.t === 'error' && m.code === 'full') { toast('공개 라운지가 꽉 차서 옆 라운지로 옮겨요'); const n = Number((room.code || 'LNG1').slice(3)) || 1; switchRoom(null); room.code = `LNG${Math.min(9, n + 1)}`; reconnect(); }
  }

  // ───────── 시작 ─────────
  setTheme(store.get(LOUNGE_KEY, {}).theme === 'day' ? 'day' : 'night');
  renderChips(); drawBoard(); setTicker(); setInterval(setTicker, 15000);
  const startCode = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  switchRoom(startCode.length >= 4 ? startCode : null);
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
