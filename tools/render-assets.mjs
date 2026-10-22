// Renders the brand assets and converts screenshots, using only headless Chromium (no image libraries).
//   node tools/render-assets.mjs brand            -> assets/og.png, favicon.svg, favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png
//   node tools/render-assets.mjs shots <rawDir>   -> for every <name>.png in rawDir: assets/shots/<name>.webp + .jpg, resized to the site's intrinsic sizes
// Playwright is loaded from PLAYWRIGHT_DIR (default: the Nexflow Track repo's installed copy; read-only use).
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync, readFileSync, mkdirSync, unlinkSync, existsSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_DIR || 'C:/Users/acer/Nexflow-track/node_modules/playwright');
const root = join(fileURLToPath(import.meta.url), '..', '..');
const mode = process.argv[2];

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M10 44 24 20l10 18 8-12 12 20" fill="none" stroke="#ff5c1a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="20" r="4" fill="#ff5c1a"/><circle cx="42" cy="26" r="4" fill="#ff5c1a"/></svg>`;
// Headless Chromium reported an inline @font-face as loaded but rendered the fallback; the fonts render reliably
// only through css/site.css served over HTTP, so the template links the stylesheet from a throwaway local port.
// (fonts come from css/site.css, linked by the template)
const tmpHtml = join(root, 'assets', '.og-tmp.html');
let server = null;
const openTemplate = async (page, html) => {
  writeFileSync(tmpHtml, html);
  if (!server) {
    server = createServer((req, res) => {
      const file = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' });
      createReadStream(file).pipe(res);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
  }
  await page.goto(`http://127.0.0.1:${server.address().port}/assets/.og-tmp.html`, { waitUntil: 'load' });
};

async function brand() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  // OG image
  await openTemplate(page, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/css/site.css"><style>
    html,body{margin:0;width:1200px;height:630px;background:#0c0e14;overflow:hidden}
    .bg{position:absolute;inset:0;background-image:linear-gradient(rgba(255,92,26,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,92,26,.06) 1px,transparent 1px);background-size:48px 48px;-webkit-mask-image:radial-gradient(ellipse at 25% 30%,#000 10%,transparent 70%)}
    .glow{position:absolute;right:-120px;top:-160px;width:620px;height:620px;background:radial-gradient(circle,rgba(255,92,26,.28),transparent 62%)}
    .wrap{position:absolute;left:88px;top:92px;right:88px}
    .brand{display:flex;align-items:center;gap:18px;font-family:var(--font-display);font-weight:900;font-size:40px;letter-spacing:.06em;color:#fff;text-transform:uppercase}
    .brand svg{width:56px;height:56px}
    h1{margin:44px 0 0;font-family:var(--font-display);font-weight:900;font-size:96px;line-height:.94;color:#fff;text-transform:uppercase;letter-spacing:-.01em;max-width:900px}
    h1 em{font-style:normal;color:#ff5c1a;display:block}
    p{margin:26px 0 0;font-family:var(--font-body);font-weight:500;font-size:27px;color:#b4bccc;white-space:nowrap}
    .foot{position:absolute;left:88px;bottom:48px;font-family:var(--font-body);font-weight:500;font-size:24px;color:#8a93a8}
    .line{position:absolute;left:0;right:0;bottom:0;height:6px;background:#ff5c1a}</style>
    <div class="bg"></div><div class="glow"></div>
    <div class="wrap"><div class="brand">${MARK}Nexflow Automations</div>
    <h1>Software built for <em>MIDC factories.</em></h1>
    <p>Stock, GRN, challans, invoices and the CA's month-end. Marathi and English.</p></div>
    <div class="foot">www.nexflowautomations.in · Umbraj · Karad · Satara</div><div class="line"></div>`);
  await page.evaluate(() => Promise.all([document.fonts.load('900 96px "Barlow Condensed"'), document.fonts.load('500 28px "Barlow"')]).then(() => document.fonts.ready));
  await page.waitForTimeout(200);
  const loaded = await page.evaluate(() => [...document.fonts].map((f) => `${f.family}/${f.weight}:${f.status}`).join(' '));
  if (!/Barlow Condensed\/900:loaded/.test(loaded)) throw new Error('fonts did not load for the OG image: ' + loaded);
  writeFileSync(join(root, 'assets/og.png'), await page.screenshot({ type: 'png' }));
  unlinkSync(tmpHtml);

  // favicon.svg (mark on a dark rounded tile)
  const tile = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}"><rect width="64" height="64" rx="14" fill="#0c0e14"/><path d="M10 44 24 20l10 18 8-12 12 20" fill="none" stroke="#ff5c1a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="20" r="4" fill="#ff5c1a"/><circle cx="42" cy="26" r="4" fill="#ff5c1a"/></svg>`;
  writeFileSync(join(root, 'assets/favicon.svg'), tile(64) + '\n');
  for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}</style>${tile(size)}`);
    writeFileSync(join(root, 'assets', name), await p.screenshot({ type: 'png', omitBackground: true }));
    await p.close();
  }
  await browser.close();
  if (server) server.close();
  console.log('brand assets written to assets/');
}

// intrinsic sizes the pages declare (width x height); phone shots are 2x
const SIZES = { laptop: [1440, 900], phone: [780, 1688] };
async function shots(rawDir) {
  const files = readdirSync(rawDir).filter((f) => f.endsWith('.png'));
  if (!files.length) throw new Error('no png in ' + rawDir);
  mkdirSync(join(root, 'assets/shots'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  for (const f of files) {
    const name = basename(f, '.png');
    const kind = name.endsWith('-phone') ? 'phone' : 'laptop';
    const [w, h] = SIZES[kind];
    const b64 = readFileSync(join(rawDir, f)).toString('base64');
    const out = await page.evaluate(async ({ b64, w, h }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      // cover-fit from the top (same as the CSS object-fit: cover; object-position: top)
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, 0, dw, dh);
      const webp = c.toDataURL('image/webp', 0.82), jpg = c.toDataURL('image/jpeg', 0.8);
      return { webp: webp.split(',')[1], jpg: jpg.split(',')[1] };
    }, { b64, w, h });
    writeFileSync(join(root, 'assets/shots', name + '.webp'), Buffer.from(out.webp, 'base64'));
    writeFileSync(join(root, 'assets/shots', name + '.jpg'), Buffer.from(out.jpg, 'base64'));
    console.log(`${name}: ${w}x${h} webp ${Math.round(out.webp.length * 0.75 / 1024)} KB, jpg ${Math.round(out.jpg.length * 0.75 / 1024)} KB`);
  }
  await browser.close();
}

if (mode === 'brand') await brand();
else if (mode === 'shots') await shots(process.argv[3]);
else { console.error('usage: node tools/render-assets.mjs brand | shots <rawDir>'); process.exit(2); }
