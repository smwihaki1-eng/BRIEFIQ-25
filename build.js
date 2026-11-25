#!/usr/bin/env node
/* ============================================================
   BriefIQ build script — zero dependencies, plain Node (>=18).

   Usage (from BriefIQ-redesign/):
     node build.js            -> ../BriefIQ-offline.html  (single standalone file)
     node build.js --zip      -> also refresh ../BriefIQ-complete.zip
     node build.js --refresh-fonts -> re-download Google Fonts into build/fonts.css

   What it does:
   - index.html is the single source of truth (js/ + css/ referenced files)
   - Google Fonts are embedded as base64 @font-face (cached in build/fonts.css,
     so after the first run the build works fully offline)
   - all <link rel=stylesheet> and <script src> are inlined
   - assets/character.svg becomes a data: URI
   - window.__BRIEFIQ_FULL_ACCESS=true is injected (tester build: no paywall)
   The output opens from a double-click with no server and no internet.
   ============================================================ */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = __dirname, OUT = path.join(ROOT, "..", "BriefIQ-offline.html");
const FONT_CACHE = path.join(ROOT, "build", "fonts.css");
const FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap";
const UA = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36" } };

async function fontsCss(refresh) {
  if (!refresh && fs.existsSync(FONT_CACHE)) return fs.readFileSync(FONT_CACHE, "utf8");
  console.log("fetching Google Fonts…");
  const css = await (await fetch(FONT_CSS_URL, UA)).text();
  const blocks = [...css.matchAll(/\/\* (\w[\w-]*) \*\/\s*@font-face \{([\s\S]*?)\}/g)];
  const faces = [];
  for (const [, subset, body] of blocks) {
    if (subset !== "latin") continue;
    const url = body.match(/url\((https:\/\/[^)]+\.woff2)\)/)[1];
    const buf = Buffer.from(await (await fetch(url, UA)).arrayBuffer());
    faces.push("@font-face{" + body
      .replace(/src:[^;]+;/, `src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');`)
      .replace(/unicode-range:[^;]+;/, "").trim() + "}");
  }
  fs.mkdirSync(path.dirname(FONT_CACHE), { recursive: true });
  fs.writeFileSync(FONT_CACHE, faces.join("\n"));
  console.log(`fonts cached: ${faces.length} faces -> build/fonts.css`);
  return faces.join("\n");
}

(async () => {
  const refresh = process.argv.includes("--refresh-fonts");
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

  // fonts: replace the Google Fonts link with embedded faces
  html = html.replace('<link rel="preconnect" href="https://fonts.googleapis.com">', "");
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com[^"]*" rel="stylesheet">/,
    "<style>\n/* ===== embedded Google Fonts (offline) ===== */\n" + await fontsCss(refresh) + "\n</style>");

  // inline local CSS + JS (strip cache-bust query when resolving files)
  const read = f => fs.readFileSync(path.join(ROOT, f.split("?")[0]), "utf8");
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g,
    (_, f) => `<style>\n/* ===== ${f.split("?")[0]} ===== */\n${read(f)}\n</style>`);
  html = html.replace(/<script src="([^"]+)"><\/script>/g,
    (_, f) => `<script>\n/* ===== ${f.split("?")[0]} ===== */\n${read(f)}\n</script>`);

  // tester build: full access, no paywall + plan-preview switcher for testers
  html = html.replace(/<script>\n\/\* ===== js\/site-runtime\.js ===== \*\//,
    "<script>window.__BRIEFIQ_FULL_ACCESS=true;window.__BRIEFIQ_TESTER_VIEWAS=true;/* tester build: full access + View-As */</script>\n$&");

  // standalone file: embed the Support & Help Center as an in-file overlay
  const sup = fs.readFileSync(path.join(ROOT, "support.html"), "utf8");
  const supBody = sup.slice(sup.indexOf("<body>") + 6, sup.lastIndexOf("</body>"));
  const overlayHtml =
    `<div id="supportOverlay" style="display:none;position:fixed;inset:0;z-index:1500;overflow:auto;background:#f0eee9"><div style="max-width:880px;margin:0 auto;padding:26px">
<button onclick="document.getElementById('supportOverlay').style.display='none'" style="position:sticky;top:12px;float:right;border:1.5px solid #111;background:#fff;border-radius:100px;padding:10px 20px;font-weight:700;cursor:pointer;font-family:'Space Grotesk',sans-serif">✕ Close</button>
${supBody.replaceAll('<a href="index.html">← back to BriefIQ</a>', "")}
</div></div>\n`;
  const bodyEnd = html.lastIndexOf("</body>");
  html = html.slice(0, bodyEnd) + overlayHtml + html.slice(bodyEnd);
  html = html.replaceAll('href="support.html"', `href="#" onclick="document.getElementById('supportOverlay').style.display='block';return false"`);
  html = html.replaceAll('<a href="founder.html" style="color:#3DFF7E;text-decoration:underline">CONSOLE</a>', "");

  // inline the compat illustration
  const svg = fs.readFileSync(path.join(ROOT, "assets/character.svg"));
  html = html.replace('src="assets/character.svg"', 'src="data:image/svg+xml;base64,' + svg.toString("base64") + '"');

  // sanity: nothing external left except knowingly-allowed hrefs
  const leftovers = [...html.matchAll(/(?:src|href)="(?!#|data:|javascript:|mailto:)[^"]+"/g)]
    .map(m => m[0]).filter(x => !/manifest|icons\/|admin\.html|wa\.me|\$\{/.test(x));
  if (leftovers.length) console.warn("WARN unresolved refs:", leftovers.slice(0, 6));
  if (!/window\.__BRIEFIQ_FULL_ACCESS/.test(html)) throw new Error("full-access flag not injected");
  if (/<script src=|<link rel="stylesheet"/.test(html)) throw new Error("uninlined asset remains");

  fs.writeFileSync(OUT, html);
  console.log(`written: ${OUT} (${Math.round(html.length / 1024)} KB)`);

  if (process.argv.includes("--zip")) {
    const zip = path.join(ROOT, "..", "BriefIQ-complete.zip");
    fs.rmSync(zip, { force: true });
    cp.execSync(`cd "${path.join(ROOT, "..")}" && zip -rq BriefIQ-complete.zip "${path.basename(ROOT)}" -x "*.DS_Store"`);
    console.log("zip refreshed: " + zip);
  }
})().catch(e => { console.error("BUILD FAILED:", e.message); process.exit(1); });
