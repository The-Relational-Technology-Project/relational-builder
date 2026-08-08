import { qrSvgMarkup } from '@/lib/qr-svg';

/**
 * The printable room key: one page per event code — big QR, the code
 * spelled out for reading aloud, and two lines of instructions. Made for
 * the projector, the door, or a stack on the welcome table.
 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function roomKeyHtml(input: { name: string; code: string; link: string }): string {
  const { name, code, link } = input;
  const shortLink = link.replace(/^https?:\/\//, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} — join code</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #FAF7F2; color: #2A1F18; display: flex; overflow: auto;
  }
  /* margin auto centers when everything fits and scrolls (instead of
     clipping the top) when it doesn't */
  .sheet {
    margin: auto; display: flex; flex-direction: column; align-items: center;
    text-align: center; padding: 6vmin; gap: 3.5vmin;
  }
  .event { font-size: clamp(20px, 4vmin, 48px); font-weight: 700; letter-spacing: -0.01em; }
  .invite { font-size: clamp(14px, 2.4vmin, 26px); color: #49362B; max-width: 40ch; line-height: 1.4; }
  .qr { background: #ffffff; border: 1px solid #E5DCD0; border-radius: 24px;
    padding: 3.5vmin; line-height: 0; }
  .qr svg { width: min(52vmin, 480px); height: min(52vmin, 480px); }
  .code { font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: clamp(38px, 10vmin, 120px); font-weight: 700; letter-spacing: .22em;
    color: #C0532F; padding-left: .22em; /* balance the tracking */ }
  .how { font-size: clamp(13px, 2.2vmin, 24px); color: #93806F; max-width: 46ch; line-height: 1.5; }
  .how strong { color: #49362B; font-weight: 600; }
  @media print {
    body { background: #ffffff; }
    .qr { border-color: #ddd; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="event">${esc(name)}</div>
    <p class="invite">Build something your neighborhood will love — scan to get your own Relational Builder account, ready in seconds.</p>
    <div class="qr">${qrSvgMarkup(link, 480)}</div>
    <div class="code">${esc(code)}</div>
    <p class="how">Phone camera on the QR code, or go to <strong>${esc(shortLink.split('/?')[0])}</strong> and enter the code <strong>${esc(code)}</strong> when you request an account — the door opens right away.</p>
  </div>
</body>
</html>`;
}

/** Open the room key in a new tab, ready to print or project */
export function openRoomKey(input: { name: string; code: string; link: string }): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(roomKeyHtml(input));
  w.document.close();
  return true;
}
