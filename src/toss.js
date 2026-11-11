/* 앱인토스 연결부: Safe Area, 사용자 식별키, 뒤로가기, 보상형 광고, 공유.
 * 웹 미리보기(토스 밖)에서는 SDK 호출이 실패해도 게임이 그대로 동작하도록 모두 안전하게 감쌉니다. */
import {APP_CONFIG} from '../app.config.js';
export const TOSS_CONFIG = APP_CONFIG;

let sdkPromise = null;
function getSDK() {
  // Dynamic import keeps the no-build dev server (scripts/dev-server.mjs) working without the SDK.
  if (TOSS_CONFIG.target === 'web') return Promise.resolve(null);
  sdkPromise ||= import('@apps-in-toss/web-framework').catch(() => null);
  return sdkPromise;
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
export const tossState = {inToss: false, userKeyHash: '', adReady: false};

/* ---------- Safe Area: keep game UI away from the status bar and Toss "⋯ / X" buttons ---------- */
function applyInsets(insets) {
  if (!insets) return;
  const r = document.documentElement.style;
  r.setProperty('--toss-top', `${Math.max(0, Number(insets.top) || 0)}px`);
  r.setProperty('--toss-bottom', `${Math.max(0, Number(insets.bottom) || 0)}px`);
  r.setProperty('--toss-right', `${Math.max(0, Number(insets.right) || 0)}px`);
}

/* ---------- Back button (Android back / iOS swipe): handled in-app, exit confirm on home ---------- */
export async function bindBackHandler(onBack) {
  const sdk = await getSDK();
  if (!sdk?.graniteEvent?.addEventListener) return;
  try {
    sdk.graniteEvent.addEventListener('backEvent', {
      onEvent: () => { onBack(); },
      onError: (e) => console.warn('backEvent', e),
    });
  } catch (e) { console.warn('backEvent subscribe failed', e); }
}
export async function exitApp() {
  const sdk = await getSDK();
  try { await sdk?.closeView?.(); } catch (e) { console.warn('closeView failed', e); }
}

/* ---------- Boot: environment, safe area, user key, ad preload ---------- */
export async function initToss() {
  const sdk = await getSDK();
  if (!sdk) return tossState;
  try {
    const insets = sdk.SafeAreaInsets?.get?.();
    if (insets) {
      tossState.inToss = true;
      document.documentElement.classList.add('in-toss');
      applyInsets(insets);
      sdk.SafeAreaInsets.subscribe?.({onEvent: applyInsets});
    }
  } catch (_) { /* not inside the Toss app */ }
  if (!tossState.inToss) return tossState;
  try {
    const res = await withTimeout(sdk.User.getAnonymousKey(), 5000);
    if (res?.hash) tossState.userKeyHash = String(res.hash);
  } catch (e) { console.warn('사용자 식별키를 가져오지 못했어요(기기 저장으로 계속):', e); }
  preloadRewardedAd();
  return tossState;
}

/* ---------- Rewarded ad: integrated in-app ads (loadFullScreenAd -> showFullScreenAd -> reload) ---------- */
let loadCleanup = null, loadRetries = 0, loadWaiters = [];
function settleLoad(ok) { const w = loadWaiters; loadWaiters = []; w.forEach(fn => fn(ok)); }
export async function preloadRewardedAd() {
  if (!TOSS_CONFIG.enableRewardedAds || !TOSS_CONFIG.rewardedAdGroupId || tossState.adReady || loadCleanup) return;
  const sdk = await getSDK();
  const load = sdk?.loadFullScreenAd;
  try { if (!load || (load.isSupported && !load.isSupported())) return; } catch (_) { return; }
  try {
    loadCleanup = load({
      options: {adGroupId: TOSS_CONFIG.rewardedAdGroupId},
      onEvent: (e) => {
        if (e?.type === 'loaded') { tossState.adReady = true; loadRetries = 0; try { loadCleanup?.(); } catch (_) {} loadCleanup = null; settleLoad(true); }
      },
      onError: (err) => {
        console.warn('광고 로드 실패', err);
        try { loadCleanup?.(); } catch (_) {} loadCleanup = null; settleLoad(false);
        if (loadRetries < 3) { loadRetries += 1; setTimeout(preloadRewardedAd, 20000 * loadRetries); } // bounded retries
      },
    });
  } catch (err) { loadCleanup = null; settleLoad(false); }
}
export function isRewardedAdSupported() { return tossState.inToss && Boolean(TOSS_CONFIG.rewardedAdGroupId); }

export async function showRewardedAd() {
  if (!TOSS_CONFIG.enableRewardedAds || !TOSS_CONFIG.rewardedAdGroupId) throw new Error('광고를 준비 중이에요. 잠시 후 다시 시도해 주세요.');
  if (!tossState.inToss) throw new Error('광고는 토스 앱에서만 볼 수 있어요.');
  const sdk = await getSDK();
  const show = sdk?.showFullScreenAd;
  if (!show || (show.isSupported && !show.isSupported())) throw new Error('토스 앱을 최신 버전으로 업데이트하면 광고를 볼 수 있어요.');
  if (!tossState.adReady) {
    const ok = await new Promise((resolve) => { loadWaiters.push(resolve); void preloadRewardedAd(); setTimeout(() => resolve(false), 8000); });
    if (!ok || !tossState.adReady) throw new Error('지금은 볼 수 있는 광고가 없어요. 잠시 후 다시 시도해 주세요.');
  }
  tossState.adReady = false; // a shown ad can't be shown again
  return new Promise((resolve, reject) => {
    let rewarded = false, finished = false, cleanup = () => {};
    const done = (error) => {
      if (finished) return; finished = true;
      try { cleanup(); } catch (_) {}
      void preloadRewardedAd(); // load -> show -> load
      if (error) reject(error); else resolve(rewarded);
    };
    try {
      cleanup = show({
        options: {adGroupId: TOSS_CONFIG.rewardedAdGroupId},
        onEvent: (e) => {
          if (e?.type === 'userEarnedReward') rewarded = true; // the ONLY reward trigger
          if (e?.type === 'dismissed') done();
          if (e?.type === 'failedToShow') done(new Error('광고를 표시하지 못했어요.'));
        },
        onError: (e) => done(e instanceof Error ? e : new Error('광고 재생에 실패했어요.')),
      }) || (() => {});
    } catch (err) { done(err); }
  });
}

/* ---------- Share a challenge link ---------- */
export async function shareInvite(search, text) {
  if (tossState.inToss && TOSS_CONFIG.appName) {
    try {
      const sdk = await getSDK();
      const path = `intoss://${TOSS_CONFIG.appName}?${search.toString()}`;
      const tossLink = await sdk.Share.createLink({path});
      await sdk.Share.sendMessage({message: `${text}\n${tossLink}`});
      return {ok: true, via: 'toss'};
    } catch (error) {
      if (/cancel/i.test(String(error?.message || error))) return {ok: false, error: '공유를 취소했어요.'};
      console.warn('토스 공유 실패:', error);
      return {ok: false, error: '공유하지 못했어요. 잠시 후 다시 시도해 주세요.'};
    }
  }
  if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) {
    return {ok: false, error: '도전 링크는 토스 앱에서 공유할 수 있어요.'};
  }
  const url = new URL(location.href); url.search = search.toString(); url.hash = '';
  try {
    if (navigator.share) { await navigator.share({title: '두뇌게임 대결', text, url: String(url)}); return {ok: true, via: 'browser'}; }
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(`${text}\n${url}`); return {ok: true, via: 'clipboard'}; }
    return {ok: false, error: '공유 기능을 사용할 수 없어요.'};
  } catch (error) {
    return {ok: false, error: error?.name === 'AbortError' ? '공유를 취소했어요.' : '공유에 실패했어요.'};
  }
}
