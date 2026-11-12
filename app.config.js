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
  // 씽크칩 유료 충전. sku = MS 스토어 상품 ID(서버 지급표와 같음), tossSku = 토스 콘솔이 붙여준 상품 ID. 가격은 각 콘솔에서 정해요.
  chipPacks: [
    {sku: 'chips_300', chips: 300, tossSku: 'ait.0000098395.082c18cf.2be99887a0.4467161148'},
    {sku: 'chips_1000', chips: 1100, tossSku: 'ait.0000098395.8b7347b8.b664cd8029.4467283967'},
    {sku: 'chips_3000', chips: 3500, tossSku: 'ait.0000098395.34707b2f.0a2e449a2b.4467393007'},
    {sku: 'vip_30', chips: 500, tossSku: 'ait.0000098395.4d757553.5327de2082.4468048393'},
  ],
  // 'web' = Microsoft Store / public website build: never touches the Toss SDK.
  target: env.VITE_TARGET === 'web' ? 'web' : 'toss', // the +50 "trial bonus" button stays off in release builds
});
