// Client for the real-time room server (live-server/). Keeps one WebSocket open, reconnects on drops,
// and keeps the server clock offset so every player's countdown ends at the same moment.
import {LIVE_URL} from './live.config.js';

export const liveAvailable = () => !!LIVE_URL;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const newRoomCode = () => Array.from({length: 4}, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');
export const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

// 3D 라운지 드레스룸에서 꾸민 내 캐릭터 (lounge/avatar.js 가 저장). 다른 사람 화면의 무대에 이 모습으로 서요.
const myLook = () => { try { return (localStorage.getItem('thinkchip:look') || '').slice(0, 300); } catch { return ''; } };

export function connectLive({code, name, pid, onState, onEmoji, onChat, onChatLog, onStatus, onError}) {
  let ws = null, closedByUser = false, tries = 0, offset = 0, timer = null, ping = null;
  const open = () => {
    onStatus?.(tries ? 'reconnecting' : 'connecting');
    try { ws = new WebSocket(`${LIVE_URL}/${code}?pid=${encodeURIComponent(pid)}&name=${encodeURIComponent(name)}&look=${encodeURIComponent(myLook())}`); }
    catch { onError?.('connect'); return; }
    ws.onopen = () => { tries = 0; onStatus?.('open'); clearInterval(ping); ping = setInterval(() => send({t: 'ping'}), 20000); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.serverNow) offset = m.serverNow - Date.now();
      if (m.t === 'state') onState?.(m);
      else if (m.t === 'emoji') onEmoji?.(m);
      else if (m.t === 'chat') onChat?.(m);
      else if (m.t === 'chatlog') onChatLog?.(m.items || []);
      else if (m.t === 'error') { closedByUser = true; onError?.(m.code); }
    };
    ws.onclose = () => {
      clearInterval(ping);
      if (closedByUser) { onStatus?.('closed'); return; }
      if (tries >= 6) { onStatus?.('closed'); onError?.('lost'); return; }
      tries += 1; onStatus?.('reconnecting');
      timer = setTimeout(open, Math.min(8000, 600 * 2 ** tries));
    };
  };
  const send = (msg) => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(msg)); return true; } return false; };
  open();
  return {
    send,
    serverNow: () => Date.now() + offset,
    close() { closedByUser = true; clearTimeout(timer); clearInterval(ping); try { ws?.close(1000, 'bye'); } catch {} },
  };
}
