// Public app configuration only. NEVER put API keys, mTLS keys or secrets here.
// Values come from .env (VITE_*). 02_build_ait_windows.cmd asks for them and writes .env for you.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const isDev = Boolean(env.DEV);
export const APP_CONFIG = Object.freeze({
  appName: env.VITE_TOSS_APP_NAME || '',
  // Development uses the official Toss *test* rewarded-ad group (real IDs in testing can violate ad policy).
  rewardedAdGroupId: env.VITE_REWARDED_AD_GROUP_ID || (isDev ? 'ait-ad-test-rewarded-id' : ''),
  enableRewardedAds: true,
  demoFeatures: false,
  // 씽크칩 유료 충전 (토스 인앱결제). 콘솔 > 인앱결제에 같은 SKU 로 상품을 등록하면 지갑에 보여요. 가격은 콘솔에서 정해요.
  chipPacks: [{sku: 'chips_300', chips: 300}, {sku: 'chips_1000', chips: 1100}, {sku: 'chips_3000', chips: 3500}],
  // 'web' = Microsoft Store / public website build: never touches the Toss SDK.
  target: env.VITE_TARGET === 'web' ? 'web' : 'toss', // the +50 "trial bonus" button stays off in release builds
});
