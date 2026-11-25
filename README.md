# v5 — Global, Themed, White-Label Creative Intelligence OS

No build step, no dependencies. Open `index.html` (landing) or `app.html` (dashboard) in any browser.

## What's new in v5.1 — Creative Reference & Inspiration Engine
Every analysis (all engines, all output modes) now ends with three integrated sections:
- **References, Inspiration & Learning** — per-recommendation reference sets (Brief Analysis, Insights, Territories, Campaign Ideas, Brand Strategy, Identity, Packaging, Social, Influencer, UX & Digital). Each reference carries title, brand, agency, year, category, summary, why-it's-relevant, key takeaway, relevance score and a link. Every territory, idea, insight and identity route also shows its own "Similar Work" (3+ scored precedents).
- **Opportunity Gap** — what's already common in the market, what's overused, which territories are saturated, which are underexplored, and the biggest differentiation opportunity for this brand.
- **Learn From The Best** — study lists across campaigns, branding, packaging, design systems and strategy/behavioural-science case studies.

Lives in `js/inspiration.js` (offline engine, deterministic, industry- and market-aware) and in the AI prompt contract (`references`, `opportunity_gap`, `learn_from_best` sections in `js/prompt-builder.js`) so live AI and Manual Mode return the same structure. Saved projects store the reference sets under `projects[].inspiration`. Sources span Cannes Lions, Effie, D&AD, One Show, WARC, Contagious, IPA, Pentawards, The Dieline, Design Week, Awwwards and the behavioural-science canon.

## What's new in v5
- **Global market intelligence** — 15 market packs (Kenya, Nigeria, South Africa, Ghana, Egypt, UAE, India, Indonesia, Brazil, Mexico, USA, UK, Germany, Japan, Global) + regional fallbacks. Selecting a country adapts cultural insights, consumer behaviour, media habits, platform priorities, influencer rates, budget bands, retail/packaging logic, tone, creative risks and regulatory flags. Nothing is forced to any one market; every engine string is localised through `js/markets.js`.
- **Light/dark mode** — accessible, calm palettes; toggle in the top bar; respects OS preference; persisted.
- **Readability rework** — bigger base text, minimum 11px labels, higher contrast, collapsible sections (click any section header), mobile responsive.
- **Central brand config** — `js/brand-config.js` holds name, logo, tagline, colours, fonts and homepage copy. Edit in-app via Settings → Brand (with a 20-option positioning picker). The name "BriefIQ" is not hard-coded anywhere user-facing.
- New brief fields: country, region, preferred language, cultural context, brand maturity, audience type; budget is now a market-neutral tier (micro → major).

## Files
```
index.html                    Landing page (brandable copy hooks, theme toggle)
app.html                      Dashboard (brief form, market/model/mode selectors, results)
css/studio.css                Design system — dual themes, readability layer, responsive
js/brand-config.js            ★ Central brand configuration + theme system + 20 positioning options
js/markets.js                 ★ Global market packs, localisation engine, market intel section
js/engine-local.js            Built-in offline strategy engine (deterministic, market-adaptive)
js/inspiration.js             ★ Creative Reference & Inspiration Engine (references, opportunity gap, learn-from-the-best)
js/prompt-builder.js          Universal master prompt (market-aware) + 11 output modes
js/ai/router.js               AI Routing Engine: single / compare / run-all + normaliser
js/ai/connector-openai.js     ChatGPT connector      (needs OpenAI key)
js/ai/connector-anthropic.js  Claude connector       (needs Anthropic key)
js/ai/connector-gemini.js     Gemini connector       (needs Google key)
js/agents.js                  Multi-Agent Mode: 10 specialists + consensus/disagreements
js/app.js                     Dashboard logic: storage, rendering, exports, events
docs/DEPLOYMENT.md            ★ Exact go-live checklist (Vercel · Supabase · Stripe · Resend · PostHog)
docs/POSITIONING.md           ★ 20 alternative names + taglines
```

## The four ways to run an analysis
1. **BriefIQ Engine (offline)** — the built-in engine. Instant, free, deterministic. Full 28-section output.
2. **Single AI model** — ChatGPT / Claude / Gemini via your own API key (AI Settings). Same master prompt, live bespoke analysis, rendered as normalised cards.
3. **Compare / Run all** — identical prompt to every configured model in parallel; comparison table + full outputs per model.
4. **Manual Mode** — "Copy Prompt" builds the polished master prompt for pasting into ANY AI tool (ChatGPT, Claude, Gemini, Perplexity…). Paste the JSON response back in and BriefIQ renders it as cards. Zero keys needed.

**Multi-Agent Mode** (checkbox) — 10 specialists (Strategist, CD, Brand Strategist, Designer, Packaging, Social, Influencer, Experiential, PR, Account Director) review the brief independently, then a synthesis shows consensus, productive disagreements, and blind spots. Works offline (engine-simulated) or via any connected model (10 persona calls + 1 synthesis call).

## Adding a new AI provider
Create `js/ai/connector-yourmodel.js` exposing `{id, label, needsKey, call({system,user,key}) → {ok,provider,model,text}}`, then `AIRouter.register(ConnectorYourModel)` and add one `<option>` in app.html. Nothing else changes — the prompt, normaliser and renderer are provider-agnostic.

## What needs API keys
Only live AI modes. Keys go in **AI Settings**, stored in localStorage only. The engine, Manual Mode, exports and projects work with zero keys. **Production note:** browser-side keys are for personal use; before charging customers, move the three connector calls behind a serverless proxy (Cloudflare Workers / Vercel functions) — connector files are structured so only the URL changes.

## Data (backend-ready)
`localStorage["briefiq_db_v2"]`: `users[] · projects[{id, userId, title, inputs{...model,mode}, analysis, inspiration{referenceCount, areas[], opportunityGap, learnFromBest[]}, aiResults[], agentReview, ideaScores[], savedTerritories[], exportHistory[]}]`. Swap `Store`'s four methods for fetch() calls to go server-side (Supabase maps 1:1).

## Deploy
Drag the folder into Netlify / Vercel / Cloudflare Pages, or GitHub Pages. It's all static.

## Testing checklist
1. Open app.html → "Load a sample messy brief" → Analyse (offline engine, full output).
2. Change Output type to "Insight Generator" → Analyse → filtered output.
3. Model: "Manual Mode" → Analyse → copy prompt → paste into any AI → paste JSON back → cards render.
4. Tick Multi-Agent Mode → Analyse → the Agency Room renders (offline).
5. Add a real key in AI Settings → pick that model → Analyse → live cards. Pick "Compare" with 2+ keys.
