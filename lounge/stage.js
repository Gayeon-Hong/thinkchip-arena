/* ThinkChip — 실시간 방 위쪽에 같은 방 친구들의 3D 캐릭터를 세워 두는 작은 무대.
 * 채팅이 오면 그 사람 머리 위에 말풍선을 띄우고, 이모티콘/말투에 맞춰 표정을 바꿔요.
 *   const stage = ThinkChipStage.mount(containerEl);
 *   stage.setPlayers([{pid, name, look, me, status}]);   // look = encodeLook 문자열 또는 객체
 *   stage.say(pid, text);                                  // 말풍선 + 표정
 *   stage.react(pid, 'laugh');                             // 표정만
 *   stage.destroy();
 */
(function (global) {
  const THREE = global.THREE, A = global.ThinkChipAvatar;

  function mount(container, opts = {}) {
    const height = opts.height || 170;
    const wrap = document.createElement('div');
    wrap.className = 'tc-stage';
    wrap.style.cssText = `position:relative;width:100%;height:${height}px;overflow:hidden;border-radius:18px;`;
    container.appendChild(wrap);

    let renderer;
    try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: true}); } catch (e) { wrap.remove(); return null; } // WebGL 미지원 기기
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    wrap.appendChild(renderer.domElement);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    wrap.appendChild(overlay);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8fb8, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.05); key.position.set(3, 7, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {left: -8, right: 8, top: 5, bottom: -5}); scene.add(key);
    const rim = new THREE.DirectionalLight(0xf7ce55, 0.45); rim.position.set(-4, 4, -5); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.ShadowMaterial({opacity: 0.25}));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    const actors = new Map(); // pid -> {av, name, label, bubble, exprTimer, bubbleTimer, phase}
    let raf = 0, alive = true;

    function resize() {
      const w = wrap.clientWidth || 300, h = wrap.clientHeight || height;
      renderer.setSize(w, h, false); cam.aspect = w / h;
      const n = Math.max(1, actors.size), span = Math.max(3.2, n * 1.55);
      // 인원 수에 맞춰 카메라 거리 조절 (모두 화면 안에)
      const dist = Math.max(6.2, (span / 2) / Math.tan((cam.fov * Math.PI) / 360) / Math.max(0.6, cam.aspect) * 1.05);
      cam.position.set(0, 1.9, dist); cam.lookAt(0, 1.25, 0); cam.updateProjectionMatrix();
    }
    const ro = global.ResizeObserver ? new ResizeObserver(resize) : null; ro && ro.observe(wrap);

    function label(text, me) {
      const el = document.createElement('div');
      el.className = 'tc-stage-name' + (me ? ' me' : '');
      el.style.cssText = 'position:absolute;transform:translate(-50%,0);font:700 11px/1.2 system-ui,sans-serif;padding:3px 8px;border-radius:999px;white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;' +
        (me ? 'background:#f7ce55;color:#111827' : 'background:rgba(9,14,28,.72);color:#f1f5f9');
      el.textContent = text; overlay.appendChild(el); return el;
    }
    function bubbleEl() {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);max-width:150px;padding:6px 10px;border-radius:14px 14px 14px 4px;background:#fff;color:#111827;font:600 12px/1.35 system-ui,sans-serif;box-shadow:0 6px 16px rgba(0,0,0,.25);opacity:0;transition:opacity .2s;word-break:break-all';
      overlay.appendChild(el); return el;
    }

    function setPlayers(list) {
      const keep = new Set();
      list.forEach((p) => {
        keep.add(p.pid);
        const look = typeof p.look === 'string' ? A.decodeLook(p.look) : Object.assign({}, A.DEFAULT_LOOK, p.look || {});
        const sig = A.encodeLook(look);
        let a = actors.get(p.pid);
        if (a && a.sig !== sig) { scene.remove(a.av); a.label.remove(); a.bubble.remove(); actors.delete(p.pid); a = null; }
        if (!a) {
          const av = A.buildAvatar(look); scene.add(av);
          a = {av, sig, label: label(p.name, p.me), bubble: bubbleEl(), phase: Math.random() * 6, state: 'idle'};
          actors.set(p.pid, a);
        }
        a.label.textContent = (p.status ? p.status + ' ' : '') + p.name;
        a.dim = p.online === false;
      });
      for (const [pid, a] of actors) if (!keep.has(pid)) { scene.remove(a.av); a.label.remove(); a.bubble.remove(); actors.delete(pid); }
      const n = actors.size; let i = 0;
      for (const a of actors.values()) { a.av.position.set((i - (n - 1) / 2) * 1.55, 0, 0); a.av.rotation.y = (i - (n - 1) / 2) * -0.08; i++; }
      resize();
    }

    function react(pid, expr, ms = 3500) {
      const a = actors.get(pid); if (!a || !expr) return;
      a.av.userData.face.set(expr); a.state = expr === 'laugh' || expr === 'happy' ? 'cheer' : expr === 'hmm' ? 'think' : 'idle';
      clearTimeout(a.exprTimer); a.exprTimer = setTimeout(() => { a.av.userData.face.set('happy'); a.state = 'idle'; }, ms);
    }
    function say(pid, text) {
      const a = actors.get(pid); if (!a) return;
      a.bubble.textContent = String(text).slice(0, 60); a.bubble.style.opacity = '1';
      clearTimeout(a.bubbleTimer); a.bubbleTimer = setTimeout(() => { a.bubble.style.opacity = '0'; }, 4000);
      react(pid, A.exprFromText(text));
    }

    const v = new THREE.Vector3(), clock = new THREE.Clock();
    function loop() {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const t = clock.getElapsedTime(), w = wrap.clientWidth, h = wrap.clientHeight;
      for (const a of actors.values()) {
        A.animateAvatar(a.av, t, a.state, a.phase);
        v.set(a.av.position.x, 0.02, a.av.position.z).project(cam);
        a.label.style.left = ((v.x + 1) / 2) * w + 'px'; a.label.style.top = Math.min(h - 20, ((1 - v.y) / 2) * h + 2) + 'px';
        a.label.style.opacity = a.dim ? '.45' : '1';
        v.set(a.av.position.x, 2.65, a.av.position.z).project(cam);
        a.bubble.style.left = ((v.x + 1) / 2) * w + 'px'; a.bubble.style.top = Math.max(26, ((1 - v.y) / 2) * h) + 'px';
      }
      renderer.render(scene, cam);
    }
    resize(); loop();

    return {
      el: wrap, setPlayers, react, say,
      destroy() { alive = false; cancelAnimationFrame(raf); ro && ro.disconnect(); renderer.dispose(); wrap.remove(); },
    };
  }

  global.ThinkChipStage = {mount};
})(typeof window !== 'undefined' ? window : globalThis);
