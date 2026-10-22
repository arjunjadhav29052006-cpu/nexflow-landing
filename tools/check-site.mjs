// Static checks for the site. Run: node tools/check-site.mjs   (exit 1 on any failure)
// 1  header/footer parity across pages      2  every data-i18n key exists in en and mr, and en text matches the HTML
// 3  data-price text equals SITE_CONFIG     4  no emoji                         5  forbidden strings absent
// 6  every <img> has width, height, alt     7  title/description/canonical/og  8  sitemap lists every page
// 9  no "Live Demo" / demo credentials      10 every icon id used exists in the sprite
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const pages = readdirSync(root).filter((f) => f.endsWith('.html')).sort();
const read = (f) => readFileSync(join(root, f), 'utf8').replace(/\r\n/g, '\n');
const html = Object.fromEntries(pages.map((p) => [p, read(p)]));
const fails = [];
const fail = (where, msg) => fails.push(`${where}: ${msg}`);

// Load SITE_CONFIG + I18N from js/site.js without a browser.
const sandbox = { window: {}, document: { documentElement: { lang: 'en', classList: { add() {} } }, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null }, localStorage: { getItem: () => null, setItem() {} }, navigator: {}, location: { pathname: '/' }, IntersectionObserver: undefined, matchMedia: () => ({ matches: false }) };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/site.js') + '\n;this.__cfg = SITE_CONFIG; this.__i18n = I18N;', sandbox);
const CFG = sandbox.__cfg, I18N = sandbox.__i18n;

const block = (src, name) => { const m = src.match(new RegExp(`<!-- ${name} -->([\\s\\S]*?)<!-- /${name} -->`)); return m ? m[1] : null; };
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const fmt = (n) => typeof n === 'number' ? n.toLocaleString('en-IN') : String(n);
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// 1 parity
for (const name of ['header', 'footer']) {
  const ref = block(html['index.html'], name);
  if (!ref) fail('index.html', `missing <!-- ${name} --> block`);
  for (const p of pages) { const b = block(html[p], name); if (b == null) fail(p, `missing ${name} block`); else if (b !== ref) fail(p, `${name} block differs from index.html`); }
}

// 2 i18n keys + 3 prices + 6 images + 9 demo + 10 icons
const used = new Set();
for (const p of pages) {
  const src = html[p];
  for (const m of src.matchAll(/<([a-z0-9]+)([^>]*?)data-i18n(-html)?="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const [, , , isHtml, key, , inner] = m; used.add(key);
    if (!(key in I18N.en)) fail(p, `i18n key ${key} missing in en`);
    if (!(key in I18N.mr)) fail(p, `i18n key ${key} missing in mr`);
    if (key in I18N.en) {
      const want = isHtml ? decode(I18N.en[key]) : decode(I18N.en[key]);
      const have = decode(inner);
      if (have !== want) fail(p, `en text for ${key} differs from HTML: "${have}" vs "${want}"`);
    }
  }
  for (const m of src.matchAll(/data-price="([^"]+)">([^<]*)</g)) {
    const v = get(CFG.pricing, m[1]); if (v == null) fail(p, `data-price ${m[1]} not in SITE_CONFIG.pricing`);
    else if (fmt(v) !== m[2].trim()) fail(p, `price ${m[1]} shows "${m[2]}" but config says "${fmt(v)}"`);
  }
  for (const m of src.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    for (const a of ['width', 'height', 'alt']) if (!new RegExp(`\\b${a}=`).test(tag)) fail(p, `img without ${a}: ${tag.slice(0, 80)}`);
  }
  for (const m of src.matchAll(/icons\.svg#([a-z-]+)/g)) if (!read('assets/icons.svg').includes(`id="${m[1]}"`)) fail(p, `icon #${m[1]} not in sprite`);
  if (/Live Demo|demo@nexflow|demo-modal/i.test(src)) fail(p, 'demo login remnants');
  for (const a of ['<title>', 'name="description"', 'rel="canonical"', 'property="og:title"', 'property="og:image"', 'name="viewport"']) if (!src.includes(a)) fail(p, `missing ${a}`);
  // 4 emoji (anything in the Misc Symbols / Emoji ranges, excluding ₹ and arrows we don't use)
  const emoji = src.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}]/gu); if (emoji) fail(p, `emoji found: ${[...new Set(emoji)].join(' ')}`);
  // 5 forbidden strings (plus the JS strings are checked below)
  for (const s of ['Tata', 'KPML', 'SS Engineering', 'Datta Prasad', 'Shivprasad', 'dedicated database', 'cannot access', 'stockouts', 'gmail.com', 'nexflow-p2.vercel.app', 'Live Demo']) if (src.includes(s)) fail(p, `forbidden string "${s}"`);
}
for (const key of Object.keys(I18N.mr)) if (!(key in I18N.en)) fail('site.js', `mr key ${key} has no en counterpart`);
for (const key of Object.keys(I18N.en)) if (!used.has(key) && !key.startsWith('cta.') && !key.startsWith('wa.')) fail('site.js', `en key ${key} unused in HTML`);
const js = read('js/site.js');
for (const s of ['Tata', 'KPML', 'SS Engineering', 'gmail.com']) if (js.includes(s)) fail('site.js', `forbidden string "${s}"`);

// 11 every file in assets/shots is referenced by a page (nothing unreviewed ships), and every referenced shot exists
const allHtml = Object.values(html).join('\n');
const shotFiles = readdirSync(join(root, 'assets', 'shots')).filter((f) => /\.(webp|jpg)$/.test(f));
for (const f of shotFiles) if (!allHtml.includes(`assets/shots/${f}`)) fail('assets/shots', `${f} is not referenced by any page`);
for (const m of allHtml.matchAll(/assets\/shots\/([a-z0-9-]+\.(?:webp|jpg))/g)) if (!shotFiles.includes(m[1])) fail('assets/shots', `${m[1]} referenced but missing`);

// 8 sitemap
const sm = read('sitemap.xml');
for (const p of pages) { const slug = p === 'index.html' ? '' : p.replace(/\.html$/, ''); if (!sm.includes(`https://www.nexflowautomations.in/${slug}</loc>`)) fail('sitemap.xml', `missing ${slug || '/'}`); }

if (fails.length) { console.error(`check-site: ${fails.length} FAIL\n - ` + fails.join('\n - ')); process.exit(1); }
console.log(`check-site: ${pages.length} pages, ${used.size} i18n keys, ${Object.keys(I18N.mr).length} mr strings: PASS`);
