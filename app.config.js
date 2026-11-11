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
  // 'web' = Microsoft Store / public website build: never touches the Toss SDK.
  target: env.VITE_TARGET === 'web' ? 'web' : 'toss', // the +50 "trial bonus" button stays off in release builds
});
