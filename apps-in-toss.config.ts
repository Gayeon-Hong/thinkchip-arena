import {defineConfig} from '@apps-in-toss/web-framework/config';

// appName MUST equal the English appName registered in the Apps in Toss console.
// 02_build_ait_windows.cmd fills it in from .env (VITE_TOSS_APP_NAME).
export default defineConfig({
  appName: 'thinkchip-arena',
  webViewProps: {type: 'game'}, // game navigation bar ("⋯" + X only, full-screen game area)
  webView: {},
  webBundleDir: 'dist',
  permissions: [],
});
