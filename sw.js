/* BriefIQ service worker — offline support without staleness.
   Strategy:
   - navigations + same-origin assets: NETWORK-FIRST, fall back to cache
     (updates always win when online; offline serves the last good copy)
   - Google Fonts: cache-first (immutable files)
   - uncached offline navigation: offline.html */
const V = "briefiq-v255";
const SHELL = [
  "./", "index.html", "offline.html", "support.html", "privacy.html", "terms.html", "ai-disclosure.html", "admin-research.html", "beta.html", "beta-welcome.html", "manifest.webmanifest",
  "css/studio.css", "css/design-page.css", "css/responsive.css", "css/landing.css", "css/peek-buddy.css",
  "css/_tokens.css", "css/_utilities.css", "css/components.css",
  "js/backend.js", "js/research-feed.js", "js/supabase-auth.js", "js/doodle-trail.js", "js/owner.js", "js/brand-config.js", "js/beta-config.js", "js/beta-gate.js", "js/markets.js", "js/brief-fit.js", "js/quality-checker.js", "js/visual-curator.js", "js/briefiq-ai.js", "js/ai-enhance.js",
  "js/intel.js", "js/roles.js", "js/frameworks.js", "js/usage-engine.js", "js/project-types.js", "js/visual-summary.js", "js/visual-inspiration.js", "js/insight-evidence.js", "js/live-research.js", "js/vision.js", "js/inspiration-gallery.js", "js/cd-review.js", "js/thinking-tools.js", "js/creator-intelligence.js", "js/production-auditor.js", "js/editorial-planner.js", "js/production-schedule.js", "js/project-dashboard.js", "js/creative-growth.js", "js/focus-mode.js", "js/followup-engine.js", "js/refine-engine.js", "js/interrogator.js", "js/evidence-checker.js", "js/assumption-auditor.js", "js/devils-advocate.js", "js/preproduction-auditor.js", "js/variance-engine.js", "js/engine-local.js", "js/creative-insight-engine.js", "js/creative-playground.js", "js/ui-guidance.js", "js/clarify-chat.js", "js/project-understanding.js", "js/wizard.js", "js/inspiration.js", "js/work-media.js", "js/work-images.js", "js/case-board.js", "js/brief-reader.js", "js/discipline-gate.js", "js/live-platform.js", "js/doodle-girl.js", "js/explore.js", "css/explore.css", "css/doodle-girl.css", "assets/characters/laptop.webp", "assets/characters/laptop-noeyes.webp", "assets/characters/pitch.webp", "assets/characters/working.webp", "assets/characters/break.webp", "assets/characters/filming.webp", "js/moodboard.js", "js/results-tabs.js", "css/results-tabs.css", "css/readability.css",
  "js/prompt-builder.js", "js/ai/connector-openai.js", "js/ai/connector-anthropic.js",
  "js/ai/connector-gemini.js", "js/ai/router.js", "js/agents.js",
  "js/production.js", "js/sparring.js", "js/cultural.js", "js/universal.js", "js/media.js", "js/exporter.js", "js/app.js", "js/founder-lab.js", "js/site-runtime.js", "js/demo.js", "js/peek-buddy.js",
  "fonts/Makenfy.woff2", "fonts/Makenfy.woff", "fonts/Makenfy-Italic.woff2", "fonts/Makenfy-Italic.woff", "data/references.json", "icons/icon-192.png", "icons/icon-512.png", "assets/character.svg", "assets/briefiq-logo.svg", "assets/briefiq-logo-white.svg", "css/responsive-logo.css", "js/logo-initialization.js", "assets/og-image.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k.indexOf("briefiq-") === 0).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if (isFont) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); return res;
      }))
    );
    return;
  }
  if (u.origin !== location.origin) return;   // let other cross-origin pass through
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit =>
        hit || (req.mode === "navigate" ? caches.match("offline.html") : Response.error())
      )
    )
  );
});
