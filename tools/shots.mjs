// Captures product screenshots from the Nexflow P2 TEST tenant for the website.
//
//   node tools/shots.mjs [outDir]        (default outDir: ./shots-raw, which is git-ignored)
//
// It asks for the test-tenant email and password at a masked prompt (nothing is echoed, logged or written
// anywhere), signs in with a throw-away browser profile, captures the pages below, and exits. Then run
//   node tools/render-assets.mjs shots ./shots-raw
// to produce assets/shots/*.webp + *.jpg at the sizes the pages declare.
//
// Rules: TEST tenant only (never a client or the demo tenant). The AI chat panel is opened and a question is
// typed but NOT sent, so no agent call is made. Review every image for supplier/customer names before use.
import { createRequire } from 'node:module';
import readline from 'node:readline';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_DIR || 'C:/Users/acer/Nexflow-track/node_modules/playwright');

const APP = process.env.P2_APP_URL || 'https://nexflowautomations.in';
const out = resolve(process.argv[2] || 'shots-raw');
mkdirSync(out, { recursive: true });

function ask(question, masked) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (masked) {
      process.stdout.write(question);
      rl._writeToOutput = () => {}; // swallow echo: nothing typed reaches the terminal
    }
    rl.question(masked ? '' : question, (a) => { rl.close(); if (masked) process.stdout.write('\n'); res(a.trim()); });
  });
}

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const LAPTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

// name -> { path, device, lang, prep }
const SHOTS = [
  { name: 'dashboard-laptop', path: '/index.html', device: LAPTOP },
  { name: 'grn-phone', path: '/grn.html', device: PHONE },
  { name: 'export-laptop', path: '/export.html', device: LAPTOP },
  { name: 'invoices-laptop', path: '/invoices.html', device: LAPTOP },
  { name: 'gstr2b-laptop', path: '/gstr2b-reconcile.html', device: LAPTOP },
  { name: 'dispatch-laptop', path: '/dispatch.html', device: LAPTOP },
  { name: 'marathi-phone', path: '/index.html', device: PHONE, lang: 'mr' },
  { name: 'chat-phone', path: '/index.html', device: PHONE, lang: 'mr', prep: async (page) => {
      await page.click('#nf-agent-fab');
      await page.waitForSelector('#nf-agent-panel', { state: 'visible' });
      await page.fill('#nf-agent-input', 'बेअरिंग किती आहे?'); // typed, never sent
      await page.waitForTimeout(400);
    } },
];

const email = await ask('Test-tenant email: ', false);
const password = await ask('Test-tenant password (hidden): ', true);
if (!email || !password) { console.error('no credentials given; nothing captured'); process.exit(1); }

const browser = await chromium.launch();
try {
  // sign in once on a laptop context, then reuse the storage state for every shot
  const login = await browser.newContext(LAPTOP);
  const lp = await login.newPage();
  await lp.goto(`${APP}/login.html`, { waitUntil: 'networkidle' });
  await lp.fill('#email', email);
  await lp.fill('#password', password);
  await Promise.all([lp.waitForURL((u) => !u.pathname.endsWith('/login.html'), { timeout: 30000 }), lp.click('#loginBtn')]);
  const state = await login.storageState();
  await login.close();

  for (const s of SHOTS) {
    const ctx = await browser.newContext({ ...s.device, storageState: state, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
    await ctx.addInitScript((lang) => { try { localStorage.setItem('nexflow_lang', lang); } catch (e) {} }, s.lang || 'en');
    const page = await ctx.newPage();
    await page.goto(`${APP}${s.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    if (s.prep) await s.prep(page);
    await page.screenshot({ path: join(out, `${s.name}.png`), fullPage: false });
    console.log(`captured ${s.name}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`done. ${SHOTS.length} screenshots in ${out}. Next: node tools/render-assets.mjs shots "${out}"`);
