/* ThinkChip Lounge — 3D 토이 피규어 아바타 (three.js r128, 전역 THREE 사용)
 * buildAvatar(look) → THREE.Group. look 의 모든 항목은 꾸미기에서 바꿀 수 있어요.
 * 부위: 머리(헤어), 상의, 하의, 신발, 소품. 모든 파츠는 같은 비율(큰 머리 2.5등신)에 맞춰져 있어요.
 */
(function (global) {
  const THREE = global.THREE;

  // ── 꾸미기 카탈로그 (가격 0 = 기본 제공) ──
  const WARDROBE = {
    // g: 'f' 여자 전용 · 'm' 남자 전용 · 없으면 공용. hide: 예전 아이템 (산 사람만 보여요)
    hair: [
      {id: 'bob', name: '단발', price: 0, g: 'f'}, {id: 'buns', name: '양갈래 번', price: 0, g: 'f'}, {id: 'pony', name: '포니테일', price: 40, g: 'f'},
      {id: 'long', name: '긴 생머리', price: 60, g: 'f'}, {id: 'hime', name: '히메컷', price: 70, g: 'f'}, {id: 'wave', name: 'S컬 웨이브', price: 80, g: 'f'}, {id: 'curly', name: '물결펌', price: 60, g: 'f'},
      {id: 'part', name: '가르마', price: 0, g: 'm'}, {id: 'buzz', name: '짧은 머리', price: 0, g: 'm'}, {id: 'spiky', name: '삐죽 머리', price: 40, g: 'm'},
      {id: 'dandy', name: '댄디컷', price: 50, g: 'm'}, {id: 'mperm', name: '애즈펌', price: 60, g: 'm'}, {id: 'wolf', name: '울프컷', price: 60, g: 'm'},
    ],
    top: [
      {id: 'hoodie', name: '후디', price: 0}, {id: 'tee', name: '반팔 티', price: 0}, {id: 'knit', name: '꽈배기 니트', price: 50}, {id: 'puffer', name: '숏패딩', price: 130},
      {id: 'blouse', name: '리본 블라우스', price: 50, g: 'f'}, {id: 'sailor', name: '세일러 카라', price: 60, g: 'f'}, {id: 'cardigan', name: '단추 가디건', price: 70, g: 'f'}, {id: 'dress', name: '원피스', price: 90, g: 'f'},
      {id: 'shirt', name: '셔츠 + 넥타이', price: 60, g: 'm'}, {id: 'baseball', name: '야구 점퍼', price: 80, g: 'm'}, {id: 'jacket', name: '봄버 재킷', price: 90, g: 'm'}, {id: 'suit', name: '정장 재킷', price: 120, g: 'm'},
      {id: 'tank', name: '나시', price: 40, hide: true}, {id: 'vneck', name: '브이넥 니트', price: 70, hide: true}, {id: 'layered', name: '레이어드 티', price: 60, hide: true}, {id: 'crop', name: '크롭티', price: 60, hide: true},
    ],
    bottom: [
      {id: 'jeans', name: '청바지', price: 0}, {id: 'shorts', name: '반바지', price: 0},
      {id: 'skirt', name: '플리츠 스커트', price: 40, g: 'f'}, {id: 'longskirt', name: '롱스커트', price: 60, g: 'f'}, {id: 'mini', name: '미니스커트', price: 50, g: 'f'},
      {id: 'jogger', name: '트레이닝 팬츠', price: 30, g: 'm'}, {id: 'wide', name: '슬랙스', price: 50, g: 'm'}, {id: 'cargo', name: '카고 팬츠', price: 60, g: 'm'},
    ],
    eyes: [{id: 'round', name: '동글눈', price: 0}, {id: 'sparkle', name: '반짝눈', price: 0}, {id: 'sleepy', name: '나른눈', price: 0}, {id: 'cat', name: '고양이눈', price: 0}, {id: 'dot', name: '점눈', price: 0}],
    brows: [{id: 'soft', name: '보통 눈썹', price: 0}, {id: 'bold', name: '진한 눈썹', price: 0}, {id: 'none', name: '눈썹 없음', price: 0}],
    shoes: [{id: 'sneaker', name: '스니커즈', price: 0}, {id: 'boots', name: '부츠', price: 40}, {id: 'loafer', name: '로퍼', price: 40}, {id: 'mary', name: '메리제인', price: 50, g: 'f'}, {id: 'chunky', name: '하이탑', price: 60, g: 'm'}],
    body: [{id: 'f', name: '여자', price: 0}, {id: 'm', name: '남자', price: 0}],
    acc: [
      {id: 'none', name: '없음', price: 0}, {id: 'glasses', name: '동그란 안경', price: 30}, {id: 'sunglass', name: '선글라스', price: 50},
      {id: 'beanie', name: '비니', price: 40}, {id: 'cap', name: '볼캡', price: 40}, {id: 'headset', name: '헤드셋', price: 70},
      {id: 'ribbon', name: '리본', price: 30, g: 'f'}, {id: 'crown', name: '왕관 (우승자)', price: 300},
      {id: 'bucket', name: '버킷햇', price: 50}, {id: 'earring', name: '진주 귀걸이', price: 40, g: 'f'}, {id: 'necklace', name: '실버 목걸이', price: 40}, {id: 'hairpin', name: '헤어핀', price: 30, g: 'f'},
    ],
    colors: {
      hair: [0x2b211d, 0x4a2f26, 0x8a5a3c, 0xc99a6b, 0x1d1f2b, 0x9aa3b5, 0xd36b8c, 0x5b6cff],
      cloth: [0xf4f1ea, 0x9d86ff, 0x3fcf9a, 0xffb34d, 0xff7a8a, 0x5aa9ff, 0x2c3550, 0x1f2430, 0xe8d3b0, 0xc0392b, 0xb8c7a3, 0x8d6e63, 0xf6c1cf, 0x9fb7d9],
      skin: [0xffe5d4, 0xffdcc5, 0xf1c6a5, 0xd9a37f, 0xa8714f, 0x7a4e35],
    },
  };
  const GENDER_DEFAULT = {f: {hair: 'bob', top: 'hoodie', bottom: 'skirt', shoes: 'sneaker'}, m: {hair: 'part', top: 'hoodie', bottom: 'jeans', shoes: 'sneaker'}};
  const fitsBody = (item, body) => !item.g || item.g === (body === 'm' ? 'm' : 'f');
  const DEFAULT_LOOK = {eyes: 'round', brows: 'soft', blush: true, skin: 0xffe0cc, hair: 'bob', hairColor: 0x4a2f26, top: 'hoodie', topColor: 0x9d86ff, bottom: 'jeans', bottomColor: 0x2c3550, shoes: 'sneaker', shoeColor: 0xf4f1ea, acc: 'none', body: 'f'};

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
      if (L.body !== 'm' && L.eyes !== 'dot') for (const k of [0, 1]) { const lash = add(eye, capsule(r * 0.012, r * 0.07), dark, s * r * (0.1 + k * 0.05), r * 0.17 * EYE.s[1] - k * r * 0.03, r * 0.02); lash.rotation.z = -s * (0.9 + k * 0.4); } // 여자: 속눈썹
      if (L.body === 'm' && L.brows !== 'none') brow.scale.set(1.35, 1.1, 1); // 남자: 조금 진한 눈썹
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
    const backVol = (z = -0.3, sy = 0.98, y = -0.12, sx = 1.06, sz = 0.74) => { const b = add(g, sphere(r * 1.08, 40, 32), H, 0, cy + y * r, z * r); b.scale.set(sx, sy, sz); return b; };
    // 긴 머리: 목을 덮지 않게 뒤로 빼서 등 쪽으로 흘러내려요 (옆에서 보면 목이 보이게)
    const longBack = (sy = 1.25) => { backVol(-0.42, 1.0, -0.05, 1.04, 0.72); const b = add(g, sphere(r * 0.95, 32, 24), H, 0, cy - r * 0.75, -r * 0.62); b.scale.set(1.0, sy, 0.5); return b; };
    const wavyStrand = (x, z, len, amp = 0.09, rr = 0.2) => { for (let k = 0; k < len; k++) add(g, sphere(r * rr * (1 - k * 0.05), 16, 12), H, (x + Math.sin(k * 1.6) * amp * Math.sign(x || 1)) * r, cy - r * (0.05 + k * 0.27), z * r - k * r * 0.03); };
    if (style === 'buzz') { const c = add(g, sphere(r * 1.03, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.5), H, 0, cy + r * 0.02, -r * 0.04); c.rotation.x = -0.35; return; }
    cap();
    if (style === 'bob') { backVol(); for (const s of [-1, 1]) add(g, capsule(r * 0.24, r * 0.5), H, s * r * 0.88, cy - r * 0.3, -r * 0.02).scale.set(0.8, 1, 1);
      bangs([[-0.42, 0.5, 0.62, 1.0, 0.62, 0.55, 0.35], [0.05, 0.56, 0.68, 1.15, 0.6, 0.55, -0.05], [0.48, 0.48, 0.6, 0.95, 0.6, 0.55, -0.4]]); }
    if (style === 'long') { longBack(1.3); for (const s of [-1, 1]) { const st = add(g, capsule(r * 0.17, r * 0.75), H, s * r * 0.86, cy - r * 0.45, -r * 0.28); st.rotation.x = 0.12; }
      bangs([[-0.3, 0.55, 0.62, 1.2, 0.6, 0.55, 0.25], [0.35, 0.52, 0.6, 1.1, 0.6, 0.55, -0.3]]); }
    if (style === 'part') { bangs([[-0.15, 0.62, 0.6, 1.7, 0.62, 0.6, 0.32, 0.4], [0.62, 0.45, 0.5, 0.8, 0.62, 0.55, -0.6]]); const t = add(g, new THREE.ConeGeometry(r * 0.14, r * 0.4, 16), H, r * 0.1, cy + r * 1.12, r * 0.05); t.rotation.z = -0.5; }
    if (style === 'spiky') { for (let i = 0; i < 7; i++) { const c = add(g, new THREE.ConeGeometry(r * 0.24, r * 0.6, 12), H, (i - 3) * r * 0.24, cy + r * 0.95 + Math.cos((i - 3) * 0.5) * r * 0.1, r * 0.1 - Math.abs(i - 3) * r * 0.06); c.rotation.x = -0.2; c.rotation.z = -(i - 3) * 0.2; } }
    if (style === 'buns') { backVol(-0.28, 1, -0.02); for (const s of [-1, 1]) add(g, sphere(r * 0.36, 28, 24), H, s * r * 0.78, cy + r * 0.78, -r * 0.1);
      bangs([[-0.3, 0.55, 0.62, 1.1, 0.55, 0.55, 0.2], [0.3, 0.55, 0.62, 1.1, 0.55, 0.55, -0.2]]); }
    if (style === 'pony') { bangs([[-0.3, 0.58, 0.62, 1.1, 0.58, 0.55, 0.25], [0.32, 0.56, 0.6, 1.05, 0.58, 0.55, -0.25]]);
      // 풍성한 포니테일: 뒤로 튀어나왔다가 아래로 흘러내려서 옆에서도 잘 보여요
      [[0, 0.55, -1.05, 0.34], [0, 0.25, -1.28, 0.36], [0, -0.12, -1.36, 0.33], [0, -0.48, -1.32, 0.28], [0, -0.78, -1.2, 0.2]].forEach(([x, y, z, rr]) => { const p = add(g, sphere(r * rr, 20, 16), H, x, cy + y * r, z * r); p.scale.set(1.05, 1.15, 0.95); });
      add(g, new THREE.TorusGeometry(r * 0.17, r * 0.06, 8, 20), mat(0xff6b8a, {roughness: 0.4}), 0, cy + r * 0.66, -r * 0.92).rotation.x = 1.1; }
    if (style === 'wolf') { backVol(-0.34, 0.82, 0.02); for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const c = add(g, new THREE.ConeGeometry(r * 0.16, r * 0.55, 10), H, s * r * (0.7 + k * 0.08), cy - r * (0.3 + k * 0.22), -r * (0.25 + k * 0.18)); c.rotation.z = Math.PI + s * 0.2; } // 레이어드 뒷머리
      bangs([[-0.45, 0.48, 0.6, 0.9, 0.7, 0.55, 0.45], [0, 0.52, 0.66, 1.0, 0.7, 0.55, 0], [0.45, 0.48, 0.6, 0.9, 0.7, 0.55, -0.45]]); }
    if (style === 'hime') { longBack(1.35); for (const s of [-1, 1]) { const side = add(g, new THREE.BoxGeometry(r * 0.2, r * 0.6, r * 0.26), H, s * r * 0.88, cy - r * 0.22, r * 0.12); side.rotation.z = s * 0.04; } // 옆머리 일자 (짧게 → 목이 보여요)
      bangs([[-0.42, 0.5, 0.62, 1.0, 0.55, 0.5, 0.05], [0, 0.53, 0.68, 1.05, 0.55, 0.5, 0], [0.42, 0.5, 0.62, 1.0, 0.55, 0.5, -0.05]]); } // 일자 앞머리
    if (style === 'dandy') { bangs([[-0.2, 0.62, 0.62, 1.7, 0.55, 0.55, 0.15, 0.6], [0.45, 0.58, 0.58, 1.0, 0.5, 0.5, -0.3, 0.6]]); const top = add(g, sphere(r * 0.9, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.4), H, 0, cy + r * 0.32, 0); top.scale.set(1.08, 0.9, 1.08); }
    if (style === 'wave') { longBack(1.2); for (const s of [-1, 1]) for (let k = 0; k < 4; k++) add(g, sphere(r * (0.22 + k * 0.02), 18, 14), H, s * r * (0.84 + (k % 2) * 0.12), cy - r * (0.15 + k * 0.32), -r * (0.3 + k * 0.06)); // 끝으로 갈수록 굵어지는 S컬
      bangs([[-0.35, 0.55, 0.62, 1.2, 0.6, 0.55, 0.3], [0.38, 0.5, 0.6, 1.0, 0.6, 0.55, -0.35]]); }
    if (style === 'mperm') { const top = add(g, sphere(r * 0.95, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.42), H, 0, cy + r * 0.3, -r * 0.02); top.scale.set(1.08, 0.95, 1.08);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI - Math.PI; add(g, sphere(r * 0.2, 16, 12), H, Math.cos(a) * r * 0.62, cy + r * 1.0 + Math.sin(i * 1.7) * r * 0.05, r * 0.2 + Math.sin(-a) * r * 0.2); }
      bangs([[-0.35, 0.5, 0.64, 0.95, 0.62, 0.55, 0.45, 0.5], [0.05, 0.54, 0.7, 1.05, 0.62, 0.55, 0.1, 0.5], [0.45, 0.5, 0.62, 0.9, 0.62, 0.55, -0.3, 0.5]]); } // 쉼표처럼 내린 앞머리 + 볼륨
    if (style === 'curly') { // 물결펌: 동글동글이 아니라 어깨 아래로 물결치는 긴 머리
      longBack(1.15); for (const s of [-1, 1]) { wavyStrand(s * 0.86, -0.22, 5, 0.12, 0.2); wavyStrand(s * 0.55, -0.62, 6, 0.1, 0.22); } wavyStrand(0.001, -0.75, 6, 0.08, 0.24);
      bangs([[-0.38, 0.52, 0.62, 1.1, 0.62, 0.55, 0.35], [0.4, 0.5, 0.6, 1.05, 0.62, 0.55, -0.35]]); }
  }

  // ── 상의 ──
  function buildTop(g, kind, color, skinM, body = 'f') {
    const C = mat(color, {roughness: kind === 'jacket' || kind === 'suit' || kind === 'puffer' ? 0.45 : 0.78, clearcoat: kind === 'jacket' || kind === 'puffer' ? 0.4 : 0.08});
    const W = body === 'm' ? 1.06 : 0.93; // 남자: 어깨가 조금 넓게, 여자: 조금 가늘게
    const torso = add(g, capsule(0.37, 0.28), kind === 'tank' || kind === 'crop' ? skinM : C, 0, 0.86, 0); torso.scale.set(W, 1, 0.88);
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
    if (kind === 'shirt') { sleeve(0.28, C); const tie = add(g, new THREE.BoxGeometry(0.07, 0.3, 0.02), mat(0x1f2a52, {roughness: 0.4}), 0, 0.9, 0.335); const knot = add(g, sphere(0.04, 10, 8), mat(0x1f2a52, {roughness: 0.4}), 0, 1.06, 0.33); knot.scale.set(1.2, 1, 0.6); tie.rotation.x = -0.12;
      const collar = add(g, new THREE.ConeGeometry(0.15, 0.2, 3), mat(0xf6f3ec, {roughness: 0.7}), 0, 1.1, 0.25); collar.rotation.x = Math.PI; collar.scale.z = 0.35;
      for (let i = 0; i < 3; i++) add(g, sphere(0.022, 8, 8), mat(0xf7ce55, {metalness: 0.8, roughness: 0.3}), 0, 0.92 - i * 0.1, 0.33); }
    if (kind === 'jacket') { sleeve(0.3, C); add(g, new THREE.TorusGeometry(0.25, 0.07, 10, 32), mat(0x1f2430, {roughness: 0.8}), 0, 1.15, 0).rotation.x = Math.PI / 2;
      add(g, new THREE.TorusGeometry(0.34, 0.05, 10, 32), mat(0x1f2430, {roughness: 0.8}), 0, 0.6, 0).rotation.x = Math.PI / 2;
      add(g, new THREE.BoxGeometry(0.02, 0.48, 0.02), mat(0xd9dde6, {metalness: 0.9, roughness: 0.2}), 0, 0.86, 0.335); }
    if (kind === 'suit') { sleeve(0.3, C); const shirt = add(g, new THREE.ConeGeometry(0.15, 0.36, 3), mat(0xf6f3ec, {roughness: 0.7}), 0, 0.98, 0.26); shirt.rotation.x = Math.PI; shirt.scale.z = 0.3;
      add(g, new THREE.BoxGeometry(0.06, 0.24, 0.02), mat(0x8a1e2c, {roughness: 0.5}), 0, 0.95, 0.32); add(g, sphere(0.03, 8, 8), mat(0xf7ce55, {metalness: 0.9, roughness: 0.2}), 0.2, 0.98, 0.3); }
    if (kind === 'tank') { // 나시: 맨팔 + 얇은 끈 + 몸판
      for (const s of [-1, 1]) { const arm = armAdd(s, capsule(0.085, 0.3), skinM, s * 0.49, 0.8, 0); arm.rotation.z = s * 0.3; add(g, capsule(0.022, 0.18), C, s * 0.16, 1.07, 0.14).rotation.x = -0.4; }
      const vest = add(g, capsule(0.375, 0.1), C, 0, 0.9, 0.004); vest.scale.set(W * 1.01, 1, 0.89); }
    if (kind === 'vneck') { sleeve(0.28, C); const v = add(g, new THREE.ConeGeometry(0.16, 0.36, 3), skinM, 0, 0.98, 0.29); v.rotation.x = Math.PI; v.scale.z = 0.25; // 깊은 V
      for (const s of [-1, 1]) { const rib = add(g, capsule(0.02, 0.36), mat(color, {roughness: 0.9}), s * 0.085, 0.98, 0.31); rib.rotation.z = s * 0.42; } }
    if (kind === 'layered') { sleeve(0.32, mat(0xf2f2f2, {roughness: 0.8})); for (const s of [-1, 1]) { const sl = armAdd(s, capsule(0.112, 0.08), C, s * 0.44, 0.98, 0); sl.rotation.z = s * 0.6; } // 긴팔 위에 반팔
      add(g, new THREE.TorusGeometry(0.34, 0.035, 8, 28), mat(0xf2f2f2, {roughness: 0.8}), 0, 0.6, 0).rotation.x = Math.PI / 2; }
    if (kind === 'crop') { sleeve(0.12, C); const top = add(g, capsule(0.375, 0.12), C, 0, 0.95, 0.004); top.scale.set(W * 1.01, 1, 0.89); }
    if (kind === 'cardigan') { sleeve(0.32, C); const inner = add(g, new THREE.BoxGeometry(0.22, 0.5, 0.05), mat(0xf6f3ec, {roughness: 0.8}), 0, 0.84, 0.3);
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) add(g, sphere(0.022, 8, 8), mat(0xe8d3b0, {roughness: 0.4}), s * 0.14, 0.95 - i * 0.12, 0.32);
      const hem = add(g, new THREE.TorusGeometry(0.4, 0.05, 10, 30), C, 0, 0.58, 0); hem.rotation.x = Math.PI / 2; hem.scale.set(W, 1, 0.9); }
    if (kind === 'puffer') { sleeve(0.3, C); for (let i = 0; i < 4; i++) { const ring = add(g, new THREE.TorusGeometry(0.36, 0.07, 10, 30), C, 0, 0.62 + i * 0.15, 0); ring.rotation.x = Math.PI / 2; ring.scale.set(W * 1.05, 1, 0.92); }
      add(g, new THREE.TorusGeometry(0.24, 0.08, 10, 28), C, 0, 1.15, 0).rotation.x = Math.PI / 2; }
    if (kind === 'blouse') { // 퍼프 소매 + 둥근 카라 + 리본
      const white = mat(0xfbf8f2, {roughness: 0.8}); for (const s of [-1, 1]) { add(arms[s], sphere(0.16, 20, 16), C, s * 0.03, -0.04, 0); const arm = armAdd(s, capsule(0.085, 0.2), skinM, s * 0.52, 0.78, 0); arm.rotation.z = s * 0.35; }
      for (const s of [-1, 1]) { const c = add(g, new THREE.CircleGeometry(0.13, 20), white, s * 0.1, 1.08, 0.31); c.rotation.x = -0.35; c.rotation.y = s * 0.3; }
      const rb = mat(0xe8456b, {roughness: 0.45}); for (const s of [-1, 1]) { const w = add(g, new THREE.ConeGeometry(0.07, 0.13, 12), rb, s * 0.07, 1.02, 0.34); w.rotation.z = s * Math.PI / 2; } add(g, sphere(0.035, 10, 10), rb, 0, 1.02, 0.35); }
    if (kind === 'sailor') { sleeve(0.28, C); const navy = mat(0x1f2a52, {roughness: 0.7}), red = mat(0xd8262f, {roughness: 0.5});
      const back = add(g, new THREE.BoxGeometry(0.62, 0.32, 0.04), navy, 0, 1.0, -0.3); back.rotation.x = 0.25;
      for (const s of [-1, 1]) { const f = add(g, new THREE.BoxGeometry(0.1, 0.36, 0.03), navy, s * 0.12, 0.98, 0.3); f.rotation.z = s * 0.55; f.rotation.x = -0.2; }
      add(g, sphere(0.06, 12, 10), red, 0, 0.86, 0.35); for (const s of [-1, 1]) { const t = add(g, new THREE.ConeGeometry(0.05, 0.16, 10), red, s * 0.04, 0.76, 0.34); t.rotation.z = s * 0.3; } }
    if (kind === 'dress') { // 원피스: 몸판 + 무릎까지 퍼지는 치마 (하의는 숨겨요)
      for (const s of [-1, 1]) { add(arms[s], sphere(0.14, 20, 16), C, s * 0.03, -0.04, 0); const arm = armAdd(s, capsule(0.085, 0.22), skinM, s * 0.52, 0.78, 0); arm.rotation.z = s * 0.35; }
      const sk = add(g, new THREE.CylinderGeometry(0.34, 0.5, 0.42, 22, 1, true), mat(color, {roughness: 0.7, side: THREE.DoubleSide}), 0, 0.42, 0); sk.scale.z = 0.92;
      const belt = add(g, new THREE.TorusGeometry(0.34, 0.03, 8, 30), mat(0xfbf8f2, {roughness: 0.6}), 0, 0.64, 0); belt.rotation.x = Math.PI / 2; belt.scale.set(W, 1, 0.9);
      for (const s of [-1, 1]) { const c = add(g, new THREE.CircleGeometry(0.11, 18), mat(0xfbf8f2, {roughness: 0.8}), s * 0.09, 1.08, 0.31); c.rotation.x = -0.35; c.rotation.y = s * 0.3; } }
    if (kind === 'baseball') { // 야구 점퍼: 흰 소매 + 줄무늬 시보리 + 이니셜 패치
      sleeve(0.3, mat(0xf4f1ea, {roughness: 0.7})); const rib = mat(0x1f2430, {roughness: 0.8});
      for (const [y, rr] of [[1.15, 0.25], [0.6, 0.34]]) { const t = add(g, new THREE.TorusGeometry(rr, 0.05, 10, 30), rib, 0, y, 0); t.rotation.x = Math.PI / 2; t.scale.set(W, 1, 0.9); }
      for (let i = 0; i < 4; i++) add(g, sphere(0.022, 8, 8), mat(0xf4f1ea, {roughness: 0.4}), 0.02, 1.0 - i * 0.11, 0.335);
      const patch = add(g, new THREE.CircleGeometry(0.075, 18), mat(0xf7ce55, {roughness: 0.5}), -0.17, 0.98, 0.31); patch.rotation.y = -0.3; }
    hands();
  }

  // ── 하의 & 신발 ──
  function buildBottom(g, kind, color, skinM, top) {
    const C = mat(color, {roughness: 0.75, clearcoat: 0.05});
    if (top === 'dress') { for (const s of [-1, 1]) add(g, capsule(0.085, 0.22), skinM, s * 0.16, 0.3, 0); return; } // 원피스: 다리만
    if ((top === 'tank' || top === 'crop') && !['skirt', 'mini', 'longskirt'].includes(kind)) { const hip = add(g, capsule(0.4, 0.04), C, 0, 0.52, 0); hip.scale.set(1, 1, 0.9); } // 나시·크롭엔 허리까지 바지가 보이게
    if (kind === 'jeans' || kind === 'jogger') { for (const s of [-1, 1]) add(g, capsule(0.13, 0.24), C, s * 0.17, 0.34, 0);
      if (kind === 'jogger') for (const s of [-1, 1]) add(g, new THREE.TorusGeometry(0.12, 0.035, 8, 20), mat(0xffffff, {roughness: 0.7}), s * 0.17, 0.22, 0).rotation.x = Math.PI / 2; }
    if (kind === 'shorts') { for (const s of [-1, 1]) { add(g, capsule(0.14, 0.06), C, s * 0.17, 0.48, 0); add(g, capsule(0.09, 0.2), skinM, s * 0.17, 0.3, 0); } }
    if (kind === 'wide') { for (const s of [-1, 1]) { const l = add(g, new THREE.CylinderGeometry(0.13, 0.19, 0.5, 18), C, s * 0.17, 0.33, 0); l.castShadow = true; } add(g, new THREE.BoxGeometry(0.02, 0.4, 0.02), mat(color, {roughness: 0.6}), 0.17, 0.33, 0.17); }
    if (kind === 'cargo') { for (const s of [-1, 1]) { add(g, capsule(0.14, 0.24), C, s * 0.17, 0.34, 0); add(g, new THREE.BoxGeometry(0.1, 0.12, 0.06), mat(color, {roughness: 0.9}), s * 0.29, 0.34, 0.03); } }
    if (kind === 'mini') { const sk = add(g, new THREE.CylinderGeometry(0.33, 0.4, 0.17, 16, 1, true), mat(color, {roughness: 0.7, side: THREE.DoubleSide}), 0, 0.6, 0); sk.scale.z = 0.9;
      for (const s of [-1, 1]) add(g, capsule(0.085, 0.3), skinM, s * 0.16, 0.32, 0); }
    if (kind === 'longskirt') { const sk = add(g, new THREE.CylinderGeometry(0.33, 0.44, 0.5, 18, 1, true), mat(color, {roughness: 0.75, side: THREE.DoubleSide}), 0, 0.43, 0); sk.scale.z = 0.9; }
    if (kind === 'skirt') { const sk = add(g, new THREE.CylinderGeometry(0.33, 0.46, 0.3, 16, 1, true), mat(color, {roughness: 0.7, side: THREE.DoubleSide}), 0, 0.53, 0); sk.scale.z = 0.9;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, pl = add(g, new THREE.BoxGeometry(0.012, 0.29, 0.03), mat(color, {roughness: 0.85}), Math.sin(a) * 0.4, 0.53, Math.cos(a) * 0.36); pl.rotation.y = a; pl.rotation.x = Math.cos(a) * 0.4; pl.rotation.z = -Math.sin(a) * 0.4; pl.castShadow = false; } // 주름
      for (const s of [-1, 1]) add(g, capsule(0.085, 0.24), skinM, s * 0.16, 0.3, 0); }
  }
  function buildShoes(g, kind, color) {
    for (const s of [-1, 1]) {
      if (kind === 'boots') { add(g, capsule(0.15, 0.1), mat(0x5a3a28, {roughness: 0.4, clearcoat: 0.6}), s * 0.17, 0.16, 0.02); const t = add(g, sphere(0.16, 20, 16), mat(0x5a3a28, {roughness: 0.4, clearcoat: 0.6}), s * 0.17, 0.09, 0.08); t.scale.set(1, 0.6, 1.3); }
      else if (kind === 'chunky') { const t = add(g, sphere(0.18, 20, 16), mat(color, {roughness: 0.4}), s * 0.17, 0.13, 0.07); t.scale.set(1.08, 0.75, 1.4); const sole = add(g, new THREE.BoxGeometry(0.34, 0.08, 0.5), mat(0xd9dde6, {roughness: 0.7}), s * 0.17, 0.04, 0.07); sole.castShadow = true; }
      else if (kind === 'mary') { const t = add(g, sphere(0.16, 20, 16), mat(color === 0xf4f1ea ? 0x15161c : color, {roughness: 0.2, clearcoat: 1}), s * 0.17, 0.09, 0.06); t.scale.set(0.95, 0.6, 1.35); const st = add(g, new THREE.BoxGeometry(0.2, 0.025, 0.04), mat(0x15161c, {roughness: 0.3}), s * 0.17, 0.16, 0.06); st.castShadow = false; add(g, capsule(0.075, 0.12), mat(0xffffff, {roughness: 0.8}), s * 0.17, 0.22, 0); }
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
    if (kind === 'bucket') { const c = mat(0xe8d3b0, {roughness: 0.9}); add(g, new THREE.CylinderGeometry(r * 0.78, r * 0.95, r * 0.55, 32), c, 0, cy + r * 0.85, -r * 0.04); const brim = add(g, new THREE.CylinderGeometry(r * 1.32, r * 1.32, r * 0.05, 36), c, 0, cy + r * 0.58, -r * 0.02); brim.rotation.x = 0.08; }
    if (kind === 'earring') { const pearl = mat(0xfaf6ee, {roughness: 0.15, clearcoat: 1}); for (const s of [-1, 1]) { add(g, sphere(r * 0.025, 8, 8), gold, s * r * 1.02, cy - r * 0.12, 0); add(g, sphere(r * 0.075, 16, 16), pearl, s * r * 1.02, cy - r * 0.26, 0); } }
    if (kind === 'necklace') { const n = add(g, new THREE.TorusGeometry(0.2, 0.012, 8, 40), mat(0xd9dde6, {metalness: 0.9, roughness: 0.2}), 0, 1.06, 0.12); n.rotation.x = Math.PI / 2 - 0.5; add(g, sphere(0.04, 12, 12), mat(0xd9dde6, {metalness: 0.9, roughness: 0.15}), 0, 0.93, 0.33); }
    if (kind === 'hairpin') { for (let k = 0; k < 2; k++) { const p = add(g, new THREE.BoxGeometry(r * 0.32, r * 0.05, r * 0.05), mat(k ? 0xff7a8a : 0xf7ce55, {roughness: 0.3}), r * 0.42, cy + r * (0.66 - k * 0.1), r * 0.78); p.rotation.z = 0.5; } }
    if (kind === 'crown') { const gm = mat(0xf7ce55, {metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide}); add(g, new THREE.CylinderGeometry(r * 0.38, r * 0.42, r * 0.26, 6, 1, true), gm, 0, cy + r * 1.16, 0);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(g, new THREE.ConeGeometry(r * 0.07, r * 0.2, 8), gm, Math.sin(a) * r * 0.38, cy + r * 1.38, Math.cos(a) * r * 0.38); } }
  }

  function buildAvatar(look = {}) {
    const L = Object.assign({}, DEFAULT_LOOK, look);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const skinM = mat(L.skin, {roughness: 0.55, clearcoat: 0.3});
    buildShoes(body, L.shoes, L.shoeColor);
    buildBottom(body, L.bottom, L.bottomColor, skinM, L.top);
    buildTop(body, L.top, L.topColor, skinM, L.body);
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
    // 무릎 꿇기 (장미 줄 때): 몸을 낮추고 살짝 앞으로 숙여요
    const kn = av.userData.kneelK = (av.userData.kneelK || 0) + ((av.userData.kneel ? 1 : 0) - (av.userData.kneelK || 0)) * 0.18;
    body.position.y -= 0.34 * kn; body.rotation.x = 0.16 * kn;
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
  const LOOK_KEYS = ['skin', 'hair', 'hairColor', 'top', 'topColor', 'bottom', 'bottomColor', 'shoes', 'shoeColor', 'acc', 'eyes', 'brows', 'blush', 'body']; // 새 항목은 맨 뒤에만 (예전 문자열도 읽히게)
  function encodeLook(L) { const l = Object.assign({}, DEFAULT_LOOK, L); return LOOK_KEYS.map((k) => (typeof l[k] === 'number' ? l[k].toString(36) : typeof l[k] === 'boolean' ? (l[k] ? '1' : '0') : String(l[k]))).join('.'); }
  function decodeLook(str) {
    const out = {}; const parts = String(str || '').split('.');
    if (parts.length < 13 || parts.length > LOOK_KEYS.length) return Object.assign({}, DEFAULT_LOOK);
    LOOK_KEYS.forEach((k, i) => { const d = DEFAULT_LOOK[k], v = parts[i]; if (v === undefined) { out[k] = d; return; }
      if (typeof d === 'number') { const n = parseInt(v, 36); out[k] = Number.isFinite(n) && n >= 0 && n <= 0xffffff ? n : d; }
      else if (typeof d === 'boolean') out[k] = v === '1';
      else { const list = WARDROBE[k === 'acc' ? 'acc' : k]; out[k] = list && list.some((x) => x.id === v) ? v : d; } });
    return out;
  }
  // 내 캐릭터 저장 (메인 앱과 라운지가 같이 씀)
  const STORE = 'thinkchip:avatar:v1';
  function loadMine() { try { const v = JSON.parse(localStorage.getItem(STORE)); if (v && v.look) return {look: Object.assign({}, DEFAULT_LOOK, v.look), owned: Array.isArray(v.owned) ? v.owned : []}; } catch (e) {} return {look: Object.assign({}, DEFAULT_LOOK), owned: []}; }
  function saveMine(data) { try { localStorage.setItem(STORE, JSON.stringify(data)); localStorage.setItem('thinkchip:look', encodeLook(data.look)); } catch (e) {} } // thinkchip:look = 메인 앱 실시간 방이 서버로 보내는 내 모습

  global.ThinkChipAvatar = {WARDROBE, DEFAULT_LOOK, GENDER_DEFAULT, fitsBody, buildAvatar, animateAvatar, handWorld, exprFromText, encodeLook, decodeLook, loadMine, saveMine};
})(typeof window !== 'undefined' ? window : globalThis);
