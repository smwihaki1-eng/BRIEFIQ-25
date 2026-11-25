# BriefIQ — Security

_Last reviewed: 2026-08-28. Owner: Sylvia (smwihaki1@gmail.com)._

BriefIQ is a **browser-only static app** (HTML/CSS/vanilla JS on Vercel/Netlify) with
optional serverless functions. Today there is **no BriefIQ server that receives user briefs
or AI keys** — briefs are analysed in the browser, and if a user connects their own AI key,
the browser calls that provider (Anthropic/OpenAI/Google) directly. This shapes the whole
threat model: the main risks are client-side (XSS, supply-chain of CDN scripts, and what the
browser stores locally), not server data breaches — until the hosted backend ships (see
"When the backend goes live").

If you find a vulnerability, email **smwihaki1@gmail.com** with steps to reproduce. Please do
not open a public issue for anything exploitable. We aim to acknowledge within 72 hours.

---

## Findings & status (pre-launch review, Aug 2026)

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1.1 | **Critical** | Reflected XSS: AI/JSON-supplied URLs interpolated into `href`/`src` without a scheme check *and* without escaping (`prettyRefs()` and ~6 other sites) | **Fixed** — `safeUrl()`/`safeSrc()` gate every dynamic URL; 21-assertion regression test |
| 1.2 | High | No Content-Security-Policy or hardening headers | **Fixed** — CSP + 5 headers via `vercel.json` and `_headers`; every external origin enumerated and whitelisted; confirmed no `eval`/`new Function` so no `'unsafe-eval'` needed |
| 1.3 | High | CDN parsers (pdf.js, mammoth) and PDF exporter (html2pdf) injected with no Subresource Integrity | **Fixed** — real `sha384` SRI on all three; `pdf.worker` documented residual (below) |
| 1.4 | High | AI keys stored in `localStorage`; no one-click wipe | **Mitigated** — plaintext-storage disclosure already shown at entry; added **Remove all keys** control. Server-side vault is the real fix and is deferred to the hosted backend |
| 1.5 | Medium | File uploads (PDF/DOCX/TXT/images incl. SVG) | **Reviewed — safe.** Parsed 100% in-browser (never uploaded), 15 MB cap, empty-file guard, filenames + extracted text escaped before `innerHTML`, SVG read only via `<img>`/`<canvas>` (script-disabled context) |
| 1.6 | Medium | Briefs/projects persist in browser with no bulk-delete/disclosure | **Fixed** — added **Delete all my data** (wipes every `briefiq_*` key) + "stored locally, never uploaded" disclosure |
| 1.7 | Medium | Outbound requests | **Reviewed.** Only destinations: the user's chosen AI provider (their key, direct), Supabase (publishable/anon key only), Formspree (feedback), and same-origin `/api/*`. All are in CSP `connect-src`. Keys are never logged or proxied through us |
| 1.8 | — | Future hosted backend | **Documented** (below) — not yet live |
| 2.x | Low | Large files (`engine-local.js`, `app.js`), ~58 inline handlers, thin automated-test coverage | **Backlog** (below) — not security-blocking |

---

## What was changed

- **`js/app.js`** — `safeUrl()`/`safeSrc()` URL-safety gate (blocks `javascript:`/`data:`/`vbscript:`,
  escapes attribute breakout) applied to every dynamic `href`/`src`; `CDN_SRI` + SRI-aware
  `loadScript()`; `clearAllKeys()` and `clearAllData()` privacy controls.
- **`js/visual-inspiration.js`, `js/live-research.js`** — same URL-safety gate on their dynamic links/images.
- **`js/exporter.js`** — html2pdf now loaded with SRI.
- **`vercel.json`, `_headers`** — CSP + `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`, `Strict-Transport-Security`.
- **`app.html`, `index.html`** — "Remove all keys" (AI Settings) and "Delete all my data" (Projects) controls + disclosures.
- **`tests/xss-url.test.mjs`** — regression test for the XSS fix (`npm test`).

---

## Known residual risks (accepted for launch, tracked)

1. **`pdf.worker.min.js` has no SRI.** It is set via `pdfjsLib.GlobalWorkerOptions.workerSrc`,
   which takes a URL, not an integrity attribute — the browser can't SRI-check it. It is pinned
   to an exact version on cdnjs and covered by CSP `worker-src`. **Real fix:** self-host pdf.js +
   its worker from `/js/vendor/` and drop cdnjs from the CSP entirely. _(High-value, low-risk.)_
2. **CSP keeps `script-src 'unsafe-inline'`.** ~58 inline `onclick=`/handlers still exist, so a
   strict CSP would break the UI today. This weakens CSP's XSS protection (the app's own escaping
   is the primary defence, which is why 1.1 mattered). **Real fix:** move handlers to
   `addEventListener` + `data-*`, then remove `'unsafe-inline'`. _(Medium, mechanical.)_
3. **AI keys in `localStorage`.** Honest trade-off for a single-user browser tool; disclosed at
   entry and wipeable. Not acceptable once accounts/multi-user land — see below.
4. **CSP/headers can only be verified on a real deploy.** They come from the platform (Vercel/
   Netlify), not the local file server. **Verify on a preview deploy before production** using the
   checklist below.

---

## When the backend goes live (must-do before hosting user data)

- **Never** put the Supabase **service-role** key, Stripe secret, or any provider key in client
  code — server env vars only. (`.gitignore` already excludes `.env`.)
- Enable **Row Level Security** on every Supabase table; default-deny; users read/write only their rows.
- If BriefIQ ever proxies AI calls, keys live in a **per-user encrypted vault**, never in shared
  client storage or plaintext in any DB (see the MIGRATION POINT note in `js/ai/router.js`).
- Validate/authorize every serverless endpoint server-side; never trust the client's plan/quota.
- Verify the Stripe webhook **signature** (already scaffolded in `netlify/functions/stripe-webhook.js`).
- Add rate-limiting and abuse controls on any endpoint that spends money or calls a paid API.

---

## Pre-launch security checklist

- [ ] Deploy to a **preview** URL and open DevTools → Console: **zero CSP violations** on
      index/app/beta while (a) loading, (b) uploading a PDF and a DOCX, (c) exporting a PDF,
      (d) running the built-in engine, (e) connecting a key and running one live analysis.
- [ ] Confirm response headers on the preview (`curl -I`): CSP + the 5 headers are present.
- [ ] `npm test` (or `node tests/xss-url.test.mjs`) passes.
- [ ] Confirm no secrets in the repo: `git grep -nE "sk-ant|sk-[A-Za-z0-9]{20}|service_role|SUPABASE_SERVICE"`.
- [ ] "Remove all keys" and "Delete all my data" both work and toast/reload as expected.
- [ ] (If backend live) RLS on, service-role key only in server env, webhook signature verified.

---

## Testing

```bash
npm test          # runs tests/xss-url.test.mjs (URL-safety / XSS regression)
```
