# Nexflow Automations — company website

Static site for www.nexflowautomations.in: plain HTML, one stylesheet, one script, no build step.
Vercel project `nexflow-landing` deploys `main`; every other branch gets a preview URL.

```
index.html   company home          p2.html      Nexflow P2 product page     track.html  Nexflow Track (placeholder, TODO(track-session))
pricing.html both products          privacy.html / terms.html  legal (English; lawyer review pending)
css/site.css tokens + components    js/site.js   SITE_CONFIG (contacts, CTA switch, prices) + I18N (en, mr) + behaviour
assets/      fonts (OFL), icons.svg sprite, shots/ (test-tenant screenshots), og.png, favicons
tools/       serve.mjs (local server), check-site.mjs (content rules), shots.mjs (capture), render-assets.mjs (brand + WebP)
```

## Rules that the check enforces (`node tools/check-site.mjs`)
- header and footer markup byte-identical on every page
- every `data-i18n` key exists in both languages and the English text matches the HTML
- every price shown equals `SITE_CONFIG.pricing`
- no emoji; no client, OEM or Gmail strings; no demo-login remnants
- every `<img>` has width, height and alt; every page has title, description, canonical, OG tags; sitemap lists every page

## Where the TODOs are
- `js/site.js` → `SITE_CONFIG.pricing.p2Pro`: TODO-CONFIRM the P2 Pro yearly price and the onboarding fee; `p2TrialUrl` once self-serve exists
- `js/site.js` → `I18N.mr`: UNREVIEWED Marathi (natural spoken register; needs a native read)
- `index.html` → `<!-- TODO(founder): rewrite in your own words -->` around the founder note; `hello@nexflowautomations.in` mailbox to be created
- `track.html` and the Track card on `index.html` → `TODO(track-session)` copy and screenshots
- `SITE_CONFIG.p2Cta`: flip `'whatsapp'` to `'trial'` when P2 self-serve ships

## Local run
```
node tools/serve.mjs            # http://localhost:8787  (mirrors Vercel cleanUrls: /p2 -> p2.html)
node tools/check-site.mjs       # must print PASS before a commit
node tools/shots.mjs            # founder only: masked prompt for the TEST-tenant login, writes shots-raw/*.png
node tools/render-assets.mjs shots shots-raw   # -> assets/shots/*.webp + .jpg
node tools/render-assets.mjs brand             # regenerates og.png and the favicons
```
Playwright is loaded from `PLAYWRIGHT_DIR` (default: the Nexflow Track repo's installed copy); nothing is installed here.
