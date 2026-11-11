/* ThinkChip Lounge — 3D 토이 피규어 아바타 (three.js r128, 전역 THREE 사용)
 * buildAvatar(look) → THREE.Group. look 의 모든 항목은 꾸미기에서 바꿀 수 있어요.
 * 부위: 머리(헤어), 상의, 하의, 신발, 소품. 모든 파츠는 같은 비율(큰 머리 2.5등신)에 맞춰져 있어요.
 */
(function (global) {
  const THREE = global.THREE;

  // ── 꾸미기 카탈로그 (가격 0 = 기본 제공) ──
  const WARDROBE = {
    hair: [
      {id: 'bob', name: '단발', price: 0}, {id: 'part', name: '가르마', price: 0}, {id: 'buns', name: '양갈래 번', price: 0},
      {id: 'pony', name: '포니테일', price: 40}, {id: 'curly', name: '뽀글 펌', price: 60}, {id: 'long', name: '긴 생머리', price: 60},
      {id: 'buzz', name: '짧은 머리', price: 0}, {id: 'spiky', name: '삐죽 머리', price: 40},
    ],
    top: [
      {id: 'hoodie', name: '후디', price: 0}, {id: 'tee', name: '반팔 티', price: 0}, {id: 'knit', name: '꽈배기 니트', price: 50},
      {id: 'shirt', name: '셔츠 + 조끼', price: 80}, {id: 'jacket', name: '봄버 재킷', price: 90}, {id: 'suit', name: '블레이저', price: 120},
    ],
    bottom: [
      {id: 'jeans', name: '청바지', price: 0}, {id: 'shorts', name: '반바지', price: 0}, {id: 'skirt', name: '플리츠 스커트', price: 40},
      {id: 'jogger', name: '트레이닝 팬츠', price: 30},
    ],
    eyes: [{id: 'round', name: '동글눈', price: 0}, {id: 'sparkle', name: '반짝눈', price: 0}, {id: 'sleepy', name: '나른눈', price: 0}, {id: 'cat', name: '고양이눈', price: 0}, {id: 'dot', name: '점눈', price: 0}],
    brows: [{id: 'soft', name: '보통 눈썹', price: 0}, {id: 'bold', name: '진한 눈썹', price: 0}, {id: 'none', name: '눈썹 없음', price: 0}],
    shoes: [{id: 'sneaker', name: '스니커즈', price: 0}, {id: 'boots', name: '부츠', price: 40}, {id: 'loafer', name: '로퍼', price: 40}],
    acc: [
      {id: 'none', name: '없음', price: 0}, {id: 'glasses', name: '동그란 안경', price: 30}, {id: 'sunglass', name: '선글라스', price: 50},
      {id: 'beanie', name: '비니', price: 40}, {id: 'cap', name: '볼캡', price: 40}, {id: 'headset', name: '헤드셋', price: 70},
      {id: 'ribbon', name: '리본', price: 30}, {id: 'crown', name: '왕관 (우승자)', price: 300},
    ],
    colors: {
      hair: [0x2b211d, 0x4a2f26, 0x8a5a3c, 0xc99a6b, 0x1d1f2b, 0x9aa3b5, 0xd36b8c, 0x5b6cff],
      cloth: [0xf4f1ea, 0x9d86ff, 0x3fcf9a, 0xffb34d, 0xff7a8a, 0x5aa9ff, 0x2c3550, 0x1f2430, 0xe8d3b0, 0xc0392b],
      skin: [0xffe5d4, 0xffdcc5, 0xf1c6a5, 0xd9a37f, 0xa8714f, 0x7a4e35],
    },
  };
  const DEFAULT_LOOK = {eyes: 'round', brows: 'soft', blush: true, skin: 0xffe0cc, hair: 'bob', hairColor: 0x4a2f26, top: 'hoodie', topColor: 0x9d86ff, bottom: 'jeans', bottomColor: 0x2c3550, shoes: 'sneaker', shoeColor: 0xf4f1ea, acc: 'none'};

  // ── 지오메트리 도우미 ──
  const geoCache = new Map();
  const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
  function capsule(r, len) {
    return cached(`cap:${r}:${len}`, () => {
      const pts = [], seg = 12;
      for (let i = 0; i <= seg; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * (i / seg); pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r - len / 2)); }
      for (let i = 0; i <= seg; i++) { const a = (Math.PI / 2) * (i / seg); pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r + len / 2)); }
      return new THREE.LatheGeometry(pts, 28);
    });
  }
  const sphere = (r, ...rest) => cached(`sph:${r}:${rest.join(',')}`, () => new THREE.SphereGeometry(r, ...(rest.length ? rest : [32, 24])));
  const mat = (color, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({color, roughness: 0.5, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.35}, o));
  function add(parent, geo, material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }

  // ── 얼굴: 표정을 바꿀 수 있게 눈/입을 따로 보관 ──
  function buildFace(g, cy, cz, r, L = DEFAULT_LOOK) {
    const EYE = {round: {s: [0.82, 1.12], rz: 0, hi: 1}, sparkle: {s: [0.9, 1.25], rz: 0, hi: 1.5}, sleepy: {s: [0.85, 0.55], rz: 0, hi: 0.6}, cat: {s: [0.95, 0.9], rz: 0.35, hi: 1}, dot: {s: [0.5, 0.6], rz: 0, hi: 0}}[L.eyes] || {s: [0.82, 1.12], rz: 0, hi: 1};
    const dark = mat(0x1a1530, {roughness: 0.15, clearcoat: 1}), white = new THREE.MeshBasicMaterial({color: 0xffffff});
    const face = {eyes: [], mouths: {}};
    for (const s of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(s * r * 0.36, cy, cz); g.add(eye);
      const ball = add(eye, sphere(r * 0.17, 28, 28), dark); ball.scale.set(EYE.s[0], EYE.s[1], 0.42); eye.rotation.z = s * EYE.rz;
      if (EYE.hi) { add(eye, sphere(r * 0.06 * EYE.hi, 12, 12), white, r * 0.05, r * 0.07 * EYE.s[1], r * 0.07); add(eye, sphere(r * 0.03 * EYE.hi, 8, 8), white, -r * 0.05, -r * 0.06 * EYE.s[1], r * 0.07); }
      if (L.eyes === 'sleepy') { const lid = add(eye, sphere(r * 0.18, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(L.skin, {roughness: 0.55}), 0, r * 0.005, r * 0.01); lid.scale.set(0.95, 0.5, 0.5); }
      face.eyes.push(eye);
      const brow = add(g, capsule(r * (L.brows === 'bold' ? 0.04 : 0.025), r * 0.12), dark, s * r * 0.36, cy + r * 0.3, cz - r * 0.02); brow.rotation.z = Math.PI / 2 + s * 0.15; brow.userData.side = s; brow.visible = L.brows !== 'none';
      face.brows = face.brows || []; face.brows.push(brow);
      // 웃는 눈(^^): 감은 눈 아치. 평소엔 숨김
      const arc = add(g, new THREE.TorusGeometry(r * 0.11, r * 0.025, 8, 20, Math.PI), dark, s * r * 0.36, cy - r * 0.03, cz + r * 0.02); arc.visible = false;
      face.arcs = face.arcs || []; face.arcs.push(arc);
      const tear = add(g, sphere(r * 0.05, 12, 12), mat(0x8fd3ff, {roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85}), s * r * 0.42, cy - r * 0.22, cz + r * 0.02); tear.scale.set(0.8, 1.3, 0.6); tear.visible = false;
      face.tears = face.tears || []; face.tears.push(tear);
      const bl = add(g, cached(`blush:${r}`, () => new THREE.CircleGeometry(r * 0.13, 24)), new THREE.MeshBasicMaterial({color: 0xff8fa8, transparent: true, opacity: 0.5}), s * r * 0.56, cy - r * 0.22, cz - r * 0.08);
      bl.rotation.y = s * 0.5; bl.castShadow = false; bl.visible = L.blush !== false;
    }
    const mc = new THREE.MeshBasicMaterial({color: 0x40202a});
    const smile = add(g, new THREE.TorusGeometry(r * 0.08, r * 0.022, 8, 24, Math.PI), mc, 0, cy - r * 0.24, cz + r * 0.03); smile.rotation.z = Math.PI;
    const open = add(g, sphere(r * 0.07, 16, 16), mat(0x7a2a3a), 0, cy - r * 0.26, cz); open.scale.set(1, 1.2, 0.4);
    const flat = add(g, capsule(r * 0.018, r * 0.1), mc, 0, cy - r * 0.25, cz + r * 0.03); flat.rotation.z = Math.PI / 2;
    const frown = add(g, new THREE.TorusGeometry(r * 0.08, r * 0.022, 8, 24, Math.PI), mc, 0, cy - r * 0.3, cz + r * 0.03);
    const grin = add(g, sphere(r * 0.11, 20, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x7a2a3a), 0, cy - r * 0.2, cz - r * 0.01); grin.scale.set(1.1, 0.9, 0.45);
    face.mouths = {smile, open, flat, frown, grin};
    // 표정: happy(기본) · laugh(^^ 웃음) · wow(놀람) · hmm(고민) · wink(윙크) · sad(눈물) · angry(화남) · smug(의기양양)
    const MOUTH = {happy: 'smile', laugh: 'grin', wow: 'open', hmm: 'flat', wink: 'smile', sad: 'frown', angry: 'frown', smug: 'smile'};
    face.expr = 'happy';
    face.set = (expr) => {
      if (!MOUTH[expr]) expr = 'happy'; face.expr = expr;
      for (const m of Object.values(face.mouths)) m.visible = false;
      face.mouths[MOUTH[expr]].visible = true;
      const closed = expr === 'laugh';
      face.eyes.forEach((e, i) => { e.visible = !closed; e.scale.set(1, expr === 'wink' && i === 1 ? 0.12 : expr === 'wow' ? 1.3 : expr === 'smug' ? 0.55 : 1, 1); });
      face.brows.forEach((b) => { b.visible = L.brows !== 'none'; });
      face.arcs.forEach((a) => { a.visible = closed; });
      face.tears.forEach((t, i) => { t.visible = expr === 'sad' && i === 0; });
      face.brows.forEach((b) => { const s = b.userData.side; b.rotation.z = Math.PI / 2 + s * (expr === 'angry' ? -0.55 : expr === 'sad' ? 0.55 : expr === 'hmm' ? (s > 0 ? 0.4 : -0.1) : 0.15); b.position.y = cy + r * (expr === 'wow' ? 0.38 : expr === 'angry' ? 0.25 : 0.3); });
    };
    face.set('happy');
    return face;
  }

  // ── 헤어 (앞머리는 이마 위로 올려서 눈을 가리지 않음) ──
  function buildHair(g, cy, r, style, color) {
    const H = mat(color, {roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.3});
    const cap = () => { const c = add(g, sphere(r * 1.06, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.56), H, 0, cy + r * 0.04, -r * 0.06); c.rotation.x = -0.42; return c; };
    const bangs = (list) => list.forEach(([x, y, z, sx, sy, sz, rz, rx]) => {
      const b = add(g, sphere(r * 0.42, 32, 24), H, x * r, cy + (y + 0.14) * r, (z - 0.04) * r); b.scale.set(sx, sy * 0.78, sz); b.rotation.set((rx || 0.35) + 0.15, 0, rz || 0);
    });
    const backVol = (z = -0.3, sy = 0.98, y = -0.12) => { const b = add(g, sphere(r * 1.08, 40, 32), H, 0, cy + y * r, z * r); b.scale.set(1.06, sy, 0.74); return b; };
    if (style === 'buzz') { const c = add(g, sphere(r * 1.03, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.5), H, 0, cy + r * 0.02, -r * 0.04); c.rotation.x = -0.35; return; }
    cap();
    if (style === 'bob') { backVol(); for (const s of [-1, 1]) add(g, capsule(r * 0.24, r * 0.5), H, s * r * 0.88, cy - r * 0.3, -r * 0.02).scale.set(0.8, 1, 1);
      bangs([[-0.42, 0.5, 0.62, 1.0, 0.62, 0.55, 0.35], [0.05, 0.56, 0.68, 1.15, 0.6, 0.55, -0.05], [0.48, 0.48, 0.6, 0.95, 0.6, 0.55, -0.4]]); }
    if (style === 'long') { const b = backVol(-0.32, 1.4, -0.45); for (const s of [-1, 1]) add(g, capsule(r * 0.24, r * 1.0), H, s * r * 0.86, cy - r * 0.55, -r * 0.05);
      bangs([[-0.3, 0.55, 0.62, 1.2, 0.6, 0.55, 0.25], [0.35, 0.52, 0.6, 1.1, 0.6, 0.55, -0.3]]); }
    if (style === 'part') { bangs([[-0.15, 0.62, 0.6, 1.7, 0.62, 0.6, 0.32, 0.4], [0.62, 0.45, 0.5, 0.8, 0.62, 0.55, -0.6]]); const t = add(g, new THREE.ConeGeometry(r * 0.14, r * 0.4, 16), H, r * 0.1, cy + r * 1.12, r * 0.05); t.rotation.z = -0.5; }
    if (style === 'spiky') { for (let i = 0; i < 7; i++) { const c = add(g, new THREE.ConeGeometry(r * 0.24, r * 0.6, 12), H, (i - 3) * r * 0.24, cy + r * 0.95 + Math.cos((i - 3) * 0.5) * r * 0.1, r * 0.1 - Math.abs(i - 3) * r * 0.06); c.rotation.x = -0.2; c.rotation.z = -(i - 3) * 0.2; } }
    if (style === 'buns') { backVol(-0.28, 1, -0.02); for (const s of [-1, 1]) add(g, sphere(r * 0.36, 28, 24), H, s * r * 0.78, cy + r * 0.78, -r * 0.1);
      bangs([[-0.3, 0.55, 0.62, 1.1, 0.55, 0.55, 0.2], [0.3, 0.55, 0.62, 1.1, 0.55, 0.55, -0.2]]); }
    if (style === 'pony') { bangs([[0, 0.6, 0.6, 1.6, 0.55, 0.55, 0]]); const t = add(g, capsule(r * 0.2, r * 0.7), H, 0, cy + r * 0.1, -r * 1.08); t.rotation.x = 0.5;
      add(g, new THREE.TorusGeometry(r * 0.13, r * 0.05, 8, 20), mat(0xff6b8a), 0, cy + r * 0.62, -r * 0.9).rotation.x = 1.1; }
    if (style === 'curly') { for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; add(g, sphere(r * 0.3, 20, 16), H, Math.cos(a) * r * 0.82, cy + r * 0.55 + Math.sin(a * 2) * r * 0.06, Math.sin(a) * r * 0.75 - r * 0.12); }
      for (let i = 0; i < 5; i++) add(g, sphere(r * 0.3, 20, 16), H, (i - 2) * r * 0.34, cy + r * 0.98, (i % 2) * r * 0.1 - r * 0.05); }
  }

  // ── 상의 ──
  function buildTop(g, kind, color, skinM) {
    const C = mat(color, {roughness: kind === 'jacket' || kind === 'suit' ? 0.45 : 0.78, clearcoat: kind === 'jacket' ? 0.4 : 0.08});
    const torso = add(g, capsule(0.37, 0.28), C, 0, 0.86, 0); torso.scale.set(1, 1, 0.88);
    // 팔은 어깨(피벗) 그룹에 달아서 손인사·하이파이브 같은 동작을 할 수 있게 해요. s = -1 오른팔, +1 왼팔 (캐릭터 기준)
    const SH = {x: 0.4, y: 1.04}, arms = {};
    for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(s * SH.x, SH.y, 0); g.add(pv); arms[s] = pv; }
    const armAdd = (s, geo, m, x, y, z) => add(arms[s], geo, m, x - s * SH.x, y - SH.y, z);
    const sleeve = (len, armColorM) => { for (const s of [-1, 1]) { const a = armAdd(s, capsule(0.1, len), armColorM, s * 0.46, 0.92 - len / 2 + 0.1, 0); a.rotation.z = s * 0.35; } };
    const hands = () => { for (const s of [-1, 1]) arms[s].userData.hand = armAdd(s, sphere(0.1, 16, 16), skinM, s * 0.56, 0.66, 0.02); };
    g.userData.arms = {r: arms[-1], l: arms[1]};
    if (kind === 'hoodie') { sleeve(0.28, C); add(g, new THREE.TorusGeometry(0.27, 0.08, 12, 32), C, 0, 1.16, 0).rotation.x = Math.PI / 2;
      const pocket = add(g, new THREE.BoxGeometry(0.36, 0.13, 0.04), mat(color, {roughness: 0.85}), 0, 0.72, 0.3); pocket.castShadow = false;
      for (const s of [-1, 1]) add(g, capsule(0.012, 0.12), mat(0xffffff, {roughness: 0.6}), s * 0.07, 1.02, 0.32); }
    if (kind === 'tee') { for (const s of [-1, 1]) { const a = add(g, capsule(0.11, 0.06), C, s * 0.42, 1.0, 0); a.rotation.z = s * 0.6; const arm = armAdd(s, capsule(0.085, 0.24), skinM, s * 0.5, 0.82, 0); arm.rotation.z = s * 0.35; }
      add(g, new THREE.TorusGeometry(0.17, 0.025, 8, 32), mat(0xffffff, {roughness: 0.7}), 0, 1.13, 0.06).rotation.x = Math.PI / 2 - 0.25; }
    if (kind === 'knit') { sleeve(0.28, C); add(g, new THREE.TorusGeometry(0.22, 0.07, 12, 32), C, 0, 1.15, 0).rotation.x = Math.PI / 2;
      for (const x of [-0.13, 0.13]) for (let i = 0; i < 4; i++) add(g, sphere(0.045, 10, 8), C, x, 0.68 + i * 0.12, 0.33 - Math.abs(i - 1.5) * 0.008); }
    if (kind === 'shirt') { sleeve(0.28, mat(0xf6f3ec, {roughness: 0.75})); const vest = add(g, capsule(0.375, 0.2), C, 0, 0.82, 0.005); vest.scale.set(1.01, 1, 0.89);
      const collar = add(g, new THREE.ConeGeometry(0.15, 0.2, 3), mat(0xf6f3ec, {roughness: 0.7}), 0, 1.1, 0.25); collar.rotation.x = Math.PI; collar.scale.z = 0.35;
      for (let i = 0; i < 3; i++) add(g, sphere(0.022, 8, 8), mat(0xf7ce55, {metalness: 0.8, roughness: 0.3}), 0, 0.92 - i * 0.1, 0.33); }
    if (kind === 'jacket') { sleeve(0.3, C); add(g, new THREE.TorusGeometry(0.25, 0.07, 10, 32), mat(0x1f2430, {roughness: 0.8}), 0, 1.15, 0).rotation.x = Math.PI / 2;
      add(g, new THREE.TorusGeometry(0.34, 0.05, 10, 32), mat(0x1f2430, {roughness: 0.8}), 0, 0.6, 0).rotation.x = Math.PI / 2;
      add(g, new THREE.BoxGeometry(0.02, 0.48, 0.02), mat(0xd9dde6, {metalness: 0.9, roughness: 0.2}), 0, 0.86, 0.335); }
    if (kind === 'suit') { sleeve(0.3, C); const shirt = add(g, new THREE.ConeGeometry(0.15, 0.36, 3), mat(0xf6f3ec, {roughness: 0.7}), 0, 0.98, 0.26); shirt.rotation.x = Math.PI; shirt.scale.z = 0.3;
      add(g, new THREE.BoxGeometry(0.06, 0.24, 0.02), mat(0x8a1e2c, {roughness: 0.5}), 0, 0.95, 0.32); add(g, sphere(0.03, 8, 8), mat(0xf7ce55, {metalness: 0.9, roughness: 0.2}), 0.2, 0.98, 0.3); }
    hands();
  }

  // ── 하의 & 신발 ──
  function buildBottom(g, kind, color, skinM) {
    const C = mat(color, {roughness: 0.75, clearcoat: 0.05});
    if (kind === 'jeans' || kind === 'jogger') { for (const s of [-1, 1]) add(g, capsule(0.13, 0.24), C, s * 0.17, 0.34, 0);
      if (kind === 'jogger') for (const s of [-1, 1]) add(g, new THREE.TorusGeometry(0.12, 0.035, 8, 20), mat(0xffffff, {roughness: 0.7}), s * 0.17, 0.22, 0).rotation.x = Math.PI / 2; }
    if (kind === 'shorts') { for (const s of [-1, 1]) { add(g, capsule(0.14, 0.06), C, s * 0.17, 0.48, 0); add(g, capsule(0.09, 0.2), skinM, s * 0.17, 0.3, 0); } }
    if (kind === 'skirt') { const sk = add(g, new THREE.CylinderGeometry(0.33, 0.46, 0.3, 16, 1, true), mat(color, {roughness: 0.7, side: THREE.DoubleSide}), 0, 0.53, 0); sk.scale.z = 0.9;
      for (const s of [-1, 1]) add(g, capsule(0.085, 0.24), skinM, s * 0.16, 0.3, 0); }
  }
  function buildShoes(g, kind, color) {
    for (const s of [-1, 1]) {
      if (kind === 'boots') { add(g, capsule(0.15, 0.1), mat(0x5a3a28, {roughness: 0.4, clearcoat: 0.6}), s * 0.17, 0.16, 0.02); const t = add(g, sphere(0.16, 20, 16), mat(0x5a3a28, {roughness: 0.4, clearcoat: 0.6}), s * 0.17, 0.09, 0.08); t.scale.set(1, 0.6, 1.3); }
      else if (kind === 'loafer') { const t = add(g, sphere(0.16, 20, 16), mat(0x15161c, {roughness: 0.2, clearcoat: 1}), s * 0.17, 0.09, 0.06); t.scale.set(0.95, 0.55, 1.4); }
      else { const t = add(g, sphere(0.17, 20, 16), mat(color, {roughness: 0.35}), s * 0.17, 0.11, 0.06); t.scale.set(1, 0.7, 1.35); const sole = add(g, sphere(0.17, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xd9dde6, {roughness: 0.6}), s * 0.17, 0.11, 0.06); sole.scale.set(1.03, 0.6, 1.38); }
    }
  }
  function buildAcc(g, kind, cy, r) {
    const gold = mat(0xf7ce55, {metalness: 0.85, roughness: 0.22, clearcoat: 0.3});
    if (kind === 'glasses' || kind === 'sunglass') { const fm = mat(0x111827, {metalness: 0.5, roughness: 0.3});
      for (const s of [-1, 1]) { add(g, new THREE.TorusGeometry(r * 0.21, r * 0.03, 10, 32), fm, s * r * 0.36, cy, r * 0.95); if (kind === 'sunglass') add(g, new THREE.CircleGeometry(r * 0.2, 28), mat(0x111827, {roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.88}), s * r * 0.36, cy, r * 0.96); }
      add(g, new THREE.BoxGeometry(r * 0.16, r * 0.03, r * 0.03), fm, 0, cy + r * 0.03, r * 0.97); }
    if (kind === 'beanie') { const c = mat(0xff8fa3, {roughness: 0.95, clearcoat: 0}); const b = add(g, sphere(r * 1.12, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.45), c, 0, cy + r * 0.2, -r * 0.04); b.rotation.x = -0.3;
      const rim = add(g, new THREE.TorusGeometry(r * 0.98, r * 0.11, 12, 40), c, 0, cy + r * 0.5, r * 0.02); rim.rotation.x = Math.PI / 2 - 0.3; add(g, sphere(r * 0.2, 16, 16), mat(0xffffff, {roughness: 1, clearcoat: 0}), 0, cy + r * 1.28, -r * 0.3); }
    if (kind === 'cap') { const c = mat(0x23314f, {roughness: 0.6}); const b = add(g, sphere(r * 1.1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.42), c, 0, cy + r * 0.25, -r * 0.03); b.rotation.x = -0.25;
      const bill = add(g, new THREE.CylinderGeometry(r * 0.6, r * 0.6, r * 0.05, 32, 1, false, 0, Math.PI), c, 0, cy + r * 0.62, r * 0.66); bill.rotation.y = Math.PI / 2; bill.rotation.x = 0.12; }
    if (kind === 'headset') { const band = add(g, new THREE.TorusGeometry(r * 1.06, r * 0.06, 10, 48, Math.PI), gold, 0, cy + r * 0.05, 0); band.rotation.y = 0;
      for (const s of [-1, 1]) { const e = add(g, new THREE.CylinderGeometry(r * 0.2, r * 0.2, r * 0.14, 24), gold, s * r * 1.06, cy, 0); e.rotation.z = Math.PI / 2; }
      const mic = add(g, capsule(r * 0.025, r * 0.4), gold, r * 0.85, cy - r * 0.35, r * 0.4); mic.rotation.set(0.9, 0, 0.6); }
    if (kind === 'ribbon') { const rc = mat(0xff5c7a, {roughness: 0.4}); for (const s of [-1, 1]) { const w = add(g, new THREE.ConeGeometry(r * 0.18, r * 0.32, 12), rc, r * (0.5 + s * 0.17), cy + r * 1.02, r * 0.1); w.rotation.z = s * Math.PI / 2; } add(g, sphere(r * 0.08), rc, r * 0.5, cy + r * 1.02, r * 0.1); }
    if (kind === 'crown') { const gm = mat(0xf7ce55, {metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide}); add(g, new THREE.CylinderGeometry(r * 0.38, r * 0.42, r * 0.26, 6, 1, true), gm, 0, cy + r * 1.16, 0);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(g, new THREE.ConeGeometry(r * 0.07, r * 0.2, 8), gm, Math.sin(a) * r * 0.38, cy + r * 1.38, Math.cos(a) * r * 0.38); } }
  }

  function buildAvatar(look = {}) {
    const L = Object.assign({}, DEFAULT_LOOK, look);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const skinM = mat(L.skin, {roughness: 0.55, clearcoat: 0.3});
    buildShoes(body, L.shoes, L.shoeColor);
    buildBottom(body, L.bottom, L.bottomColor, skinM);
    buildTop(body, L.top, L.topColor, skinM);
    const r = 0.62, cy = 1.74, headG = new THREE.Group(); body.add(headG);
    const head = add(headG, sphere(r, 48, 40), skinM, 0, cy, 0); head.scale.set(1.04, 0.96, 0.98);
    for (const s of [-1, 1]) add(headG, sphere(0.1, 16, 16), skinM, s * 0.64, cy - 0.02, 0);
    const face = buildFace(headG, cy - 0.02, r * 0.93, r, L);
    buildHair(headG, cy, r, L.hair, L.hairColor);
    if (L.acc && L.acc !== 'none') buildAcc(headG, L.acc, cy - 0.02, r);
    root.userData = {look: L, body, head: headG, face, arms: body.userData.arms, armPose: null};
    return root;
  }

  // 대기 모션(숨쉬기) · 걷기 · 점프 · 손 흔들기를 시간 t 로 적용
  function animateAvatar(av, t, state = 'idle', phase = 0) {
    const {body, head} = av.userData; const k = t * 1 + phase;
    body.position.y = state === 'walk' ? Math.abs(Math.sin(k * 9)) * 0.08 : state === 'cheer' ? Math.abs(Math.sin(k * 6)) * 0.25 : Math.sin(k * 2) * 0.015;
    body.rotation.z = state === 'walk' ? Math.sin(k * 9) * 0.06 : 0;
    head.rotation.z = state === 'idle' ? Math.sin(k * 1.3) * 0.04 : 0;
    head.rotation.x = state === 'think' ? 0.12 : 0;
    // 팔: armPose = {r: [x, z], l: [x, z]} (어깨 회전, 라디안). 없으면 천천히 차렷 자세로 돌아와요.
    const arms = av.userData.arms; if (!arms) return; const pose = av.userData.armPose || {};
    for (const side of ['r', 'l']) { const want = pose[side] || [0, 0], a = arms[side];
      a.rotation.x += (want[0] - a.rotation.x) * 0.32; a.rotation.z += (want[1] - a.rotation.z) * 0.32; }
  }
  // 손 위치 (월드 좌표) — 하이파이브가 부딪히는 지점
  function handWorld(av, side, out) { const a = av.userData.arms && av.userData.arms[side]; if (!a || !a.userData.hand) return null; return a.userData.hand.getWorldPosition(out || new THREE.Vector3()); }

  // 채팅/이모티콘 → 표정. 심리전 채팅 칠 때 캐릭터 얼굴이 바뀌어요.
  const EXPR_RULES = [
    ['laugh', /😂|🤣|😆|😄|😁|ㅋㅋ|ㅎㅎ|lol/i], ['sad', /😭|😢|🥲|😿|ㅠㅠ|ㅜㅜ|흑/], ['wow', /😮|😲|😱|🤯|헐|대박|ㄷㄷ|!!/],
    ['angry', /😡|😠|🤬|💢|화나|짜증|ㅡㅡ/], ['hmm', /🤔|🧐|흠|글쎄|음\.\.|애매/], ['wink', /😉|😜|😘|윙크/],
    ['smug', /😏|😎|🤭|블러핑|훗|후훗|ㅋ{1}$/], ['happy', /😊|🙂|😀|🥰|❤|♥|좋아|굿|👍/],
  ];
  function exprFromText(text) { const t = String(text || ''); for (const [e, re] of EXPR_RULES) if (re.test(t)) return e; return null; }
  // 다른 사람에게 보내는 짧은 문자열 (서버에 저장할 때 사용)
  const LOOK_KEYS = ['skin', 'hair', 'hairColor', 'top', 'topColor', 'bottom', 'bottomColor', 'shoes', 'shoeColor', 'acc', 'eyes', 'brows', 'blush'];
  function encodeLook(L) { const l = Object.assign({}, DEFAULT_LOOK, L); return LOOK_KEYS.map((k) => (typeof l[k] === 'number' ? l[k].toString(36) : typeof l[k] === 'boolean' ? (l[k] ? '1' : '0') : String(l[k]))).join('.'); }
  function decodeLook(str) {
    const out = {}; const parts = String(str || '').split('.');
    if (parts.length !== LOOK_KEYS.length) return Object.assign({}, DEFAULT_LOOK);
    LOOK_KEYS.forEach((k, i) => { const d = DEFAULT_LOOK[k], v = parts[i];
      if (typeof d === 'number') { const n = parseInt(v, 36); out[k] = Number.isFinite(n) && n >= 0 && n <= 0xffffff ? n : d; }
      else if (typeof d === 'boolean') out[k] = v === '1';
      else { const list = WARDROBE[k === 'acc' ? 'acc' : k]; out[k] = list && list.some((x) => x.id === v) ? v : d; } });
    return out;
  }
  // 내 캐릭터 저장 (메인 앱과 라운지가 같이 씀)
  const STORE = 'thinkchip:avatar:v1';
  function loadMine() { try { const v = JSON.parse(localStorage.getItem(STORE)); if (v && v.look) return {look: Object.assign({}, DEFAULT_LOOK, v.look), owned: Array.isArray(v.owned) ? v.owned : []}; } catch (e) {} return {look: Object.assign({}, DEFAULT_LOOK), owned: []}; }
  function saveMine(data) { try { localStorage.setItem(STORE, JSON.stringify(data)); localStorage.setItem('thinkchip:look', encodeLook(data.look)); } catch (e) {} } // thinkchip:look = 메인 앱 실시간 방이 서버로 보내는 내 모습

  global.ThinkChipAvatar = {WARDROBE, DEFAULT_LOOK, buildAvatar, animateAvatar, handWorld, exprFromText, encodeLook, decodeLook, loadMine, saveMine};
})(typeof window !== 'undefined' ? window : globalThis);
