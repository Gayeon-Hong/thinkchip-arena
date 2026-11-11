// Theme preference is separate from the wallet: changing it never resets game progress.
export const THEME_KEY = 'brain-arena:theme:v1';
const THEME_MODES = ['dark', 'light', 'system'];
let themePreference = 'dark';
let themeMedia;
let themeChangeHandler;
export function readThemePreference() {
  try { const value = localStorage.getItem(THEME_KEY); return THEME_MODES.includes(value) ? value : 'dark'; }
  catch { return 'dark'; }
}
export function getThemePreference() { return themePreference; }
export function resolveTheme(value = themePreference) {
  if (value !== 'system') return value === 'light' ? 'light' : 'dark';
  return themeMedia?.matches ? 'dark' : 'light';
}
export function applyTheme() {
  const value = resolveTheme();
  if (document.documentElement) {
    document.documentElement.dataset.theme = value;
    document.documentElement.style.colorScheme = value;
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute?.('content', value === 'dark' ? '#0c1323' : '#f4f6fb');
  return value;
}
export function setTheme(value) {
  if (!THEME_MODES.includes(value)) return;
  themePreference = value;
  try { localStorage.setItem(THEME_KEY, value); } catch {}
  applyTheme();
}
export function toggleTheme() { setTheme(resolveTheme() === 'dark' ? 'light' : 'dark'); }
export function initTheme(onChange) {
  themePreference = readThemePreference();
  themeMedia = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  themeChangeHandler = () => { if (themePreference === 'system') { applyTheme(); onChange?.(); } };
  themeMedia?.addEventListener?.('change', themeChangeHandler);
  applyTheme();
}
