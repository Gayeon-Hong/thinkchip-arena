/* 씽크칩 계정 · 서버 지갑 (메인 앱과 3D 라운지가 같이 써요)
 * 로그인: 웹/MS Store = 카카오, 토스 앱 = 토스 사용자 키(자동). 칩·친구·산 옷은 계정(서버)에 저장돼요.
 * 로그인 안 하면 둘러보기만: 라운지 구경·혼자 게임은 되지만 칩 받기·충전·구매·친구·선물은 안 돼요.
 *
 * window.ThinkChipAccount
 *   init(liveUrl)            실시간 서버 주소(wss://…/live)로 API 주소를 정해요. 페이지마다 한 번.
 *   state                    {ready, loggedIn, pid, name, platform, wallet:{chips, paid, …}, social:{…}}
 *   call(op, extra)          서버 호출 (로그인 필요). 성공하면 state 를 갱신하고 결과를 돌려줘요.
 *   refresh()                hello
 *   loginKakao(returnUrl)    카카오 로그인 페이지로 이동
 *   loginToss(hash, name)    토스 사용자 키로 로그인 (메인 앱이 토스 SDK 로 받아서 불러요)
 *   logout()
 *   onChange(fn)             state 가 바뀔 때마다
 */
(function (global) {
  'use strict';
  const SKEY = 'thinkchip:session', CKEY = 'thinkchip:acct';
  const ls = {get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }};
  let API = '', subs = [];
  const cached = (() => { try { return JSON.parse(ls.get(CKEY)) || null; } catch (e) { return null; } })();
  const state = {ready: false, loggedIn: !!ls.get(SKEY), pid: '', name: '', platform: '', wallet: null, social: null, data: {}, ...(cached && ls.get(SKEY) ? cached : {})};
  state.ready = false; state.welcomeBonus = Number(ls.get('thinkchip:welcome')) || 0;
  const emit = () => { ls.set(CKEY, state.loggedIn ? JSON.stringify({pid: state.pid, name: state.name, platform: state.platform, wallet: state.wallet, data: state.data}) : null); for (const f of subs) { try { f(state); } catch (e) { console.warn(e); } } };

  // 카카오 로그인에서 돌아오면 주소 끝(#session=…)에 세션이 붙어 와요
  (function takeRedirect() {
    try {
      const h = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
      const tok = h.get('session'), login = h.get('login');
      if (tok) { ls.set(SKEY, tok); state.loggedIn = true; state.justLoggedIn = true; }
      if (login) state.loginError = login; // cancel | fail
      if (tok || login) history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {}
  })();

  function apply(d) {
    if (!d || !d.ok) return;
    Object.assign(state, {loggedIn: true, pid: d.pid, name: d.name, platform: d.platform, admin: !!d.admin, wallet: d.wallet, data: d.data || {},
      social: {friends: d.friends, requests: d.requests, pending: d.pending, gifts: d.gifts, invites: d.invites || [], sentToday: d.sentToday, giftMax: d.giftMax}});
  }
  async function call(op, extra = {}) {
    const token = ls.get(SKEY); if (!API) throw new Error('offline'); if (!token) return {error: 'login'};
    const res = await fetch(`${API}/api/user`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({token, op, ...(state.where != null ? {where: state.where} : {}), ...extra})});
    const d = await res.json().catch(() => ({error: 'server'}));
    if (d.error === 'login') { logout(); return d; } // 세션 만료
    if (d.welcome) { state.welcomeBonus = d.welcome; ls.set('thinkchip:welcome', String(d.welcome)); } // 회원가입 보상: 화면에서 한 번 보여주고 clearWelcome()
    if (d.ok) { apply(d); state.ready = true; emit(); } else if (d.wallet) { apply({...d, ok: true}); emit(); }
    return d;
  }
  async function refresh() {
    if (!ls.get(SKEY)) { state.ready = true; emit(); return null; }
    try {
      const d = await call('hello');
      if (d && d.ok && d.wallet && !d.wallet.imported) { // 처음 로그인: 이 기기에 모아 둔 칩을 계정으로 (최대 3,000)
        let chips = 0; try { chips = Number((JSON.parse(ls.get('brain-arena:mvp:v2')) || {}).chips) || 0; } catch (e) {}
        const r = await call('import', {chips}); if (r && r.imported) state.importedChips = r.imported;
      }
      state.offline = false; return d;
    } catch (e) { state.ready = true; state.offline = true; emit(); return null; }
  }
  function loginKakao(returnUrl) { if (!API) return false; location.href = `${API}/auth/kakao/start?return=${encodeURIComponent(returnUrl || location.href.split('#')[0])}`; return true; }
  async function loginToss(hash, name) {
    if (!API || !hash) return false;
    try {
      const d = await fetch(`${API}/auth/toss`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({hash, name: name || ''})}).then((r) => r.json());
      if (!d.ok) return false; const fresh = !ls.get(SKEY); ls.set(SKEY, d.token); state.loggedIn = true; if (fresh) state.justLoggedIn = true; await refresh(); return true;
    } catch (e) { return false; }
  }
  // 토스 앱: 로그인 화면 없이 이 기기 전용 계정으로 자동 로그인 (기기 키는 이 브라우저에만 저장돼요)
  async function loginDevice(name) {
    if (!API) return false; if (ls.get(SKEY)) return true;
    let id = ls.get('thinkchip:deviceKey'); if (!/^[a-f0-9]{32}$/.test(id || '')) { const a = new Uint8Array(16); crypto.getRandomValues(a); id = [...a].map((x) => x.toString(16).padStart(2, '0')).join(''); ls.set('thinkchip:deviceKey', id); }
    try {
      const d = await fetch(`${API}/auth/device`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({id, name: name || ''})}).then((r) => r.json());
      if (!d.ok) return false; ls.set(SKEY, d.token); state.loggedIn = true; await refresh(); return true;
    } catch (e) { return false; }
  }
  function logout() { ls.set(SKEY, null); Object.assign(state, {loggedIn: false, pid: '', name: '', platform: '', wallet: null, social: null, data: {}}); emit(); }
  function init(liveUrl) {
    if (API) return; API = String(liveUrl || '').replace(/^ws/, 'http').replace(/\/live\/?$/, '');
    if (!API) { state.ready = true; return; }
    refresh();
  }
  addEventListener('storage', (e) => { if (e.key === SKEY && !e.newValue) logout(); else if (e.key === CKEY && e.newValue) { try { Object.assign(state, JSON.parse(e.newValue)); for (const f of subs) f(state); } catch (er) {} } });
  global.ThinkChipAccount = {state, init, call, refresh, loginKakao, loginToss, loginDevice, logout, onChange(fn) { subs.push(fn); return () => { subs = subs.filter((x) => x !== fn); }; }, get api() { return API; }, clearWelcome() { state.welcomeBonus = 0; ls.set('thinkchip:welcome', null); }, hasSession: () => !!ls.get(SKEY)};
})(typeof window !== 'undefined' ? window : globalThis);
