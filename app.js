/* BriefIQ — Dashboard app: storage, rendering, exports, events. */
/* ---------------- STORAGE (backend-ready) ----------------
   Schema mirrors a REST backend:
   users[{id,name,email}] · projects[{id,userId,createdAt,updatedAt,title,
   inputs{...}, analysis{...}, ideaScores[], savedTerritories[], exportHistory[]}]
   To go server-side: replace Store's four methods with fetch() calls; shapes stay identical. */
const Store={
  KEY:"briefiq_db_v2",
  db(){try{return JSON.parse(localStorage.getItem(this.KEY))||this.seed()}catch(e){return this.seed()}},
  seed(){return{version:2,users:[{id:"local-user",name:"Local User",email:null}],projects:[]}},
  write(db){localStorage.setItem(this.KEY,JSON.stringify(db))},
  saveProject(p){const db=this.db();const i=db.projects.findIndex(x=>x.id===p.id);p.updatedAt=new Date().toISOString();if(i>=0)db.projects[i]=p;else db.projects.unshift(p);this.write(db);return p},
  list(){return this.db().projects},
  get(id){return this.db().projects.find(p=>p.id===id)},
  del(id){const db=this.db();db.projects=db.projects.filter(p=>p.id!==id);this.write(db)}
};
let currentProject=null;

/* ---------------- HELPERS ---------------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function kvRows(arr){return `<div class="kv">${arr.map(r=>`<div class="k">${esc(r.k)}</div><div class="v">${esc(r.v)}</div>`).join("")}</div>`}
function refsHtml(refs,label){if(!refs||!refs.length)return"";return `<div class="refs"><div class="refs-t">${label||"Similar Work — precedents & inspiration"}</div>${refs.map(r=>`<a class="ref" href="${r.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><b>${esc(r.t)}</b> — ${esc(r.b)}${r.ag?` · ${esc(r.ag)}`:""}, ${r.y} · <span class="src">${esc(r.src)}</span>${r.cat?` <span class="tag" style="margin-left:6px">${esc(r.cat)}</span>`:""}${r.rel?` <span class="tag ${r.rel>=80?"green":r.rel>=65?"lime":"amber"}" style="float:right">Relevance ${r.rel}%</span>`:""}<p>${esc(r.why)}</p><p class="take">Key takeaway: ${esc(r.take)}</p></a>`).join("")}</div>`}
function refLine(r){if(!r)return"";return `<div style="margin-top:8px"><a href="${r.url}" target="_blank" rel="noopener" style="font-size:11.5px;color:var(--lime-dim);text-decoration:none" onclick="event.stopPropagation()">↗ Evidence: ${esc(r.t)} (${esc(r.b)}, ${r.y}) — ${esc(r.src)}</a></div>`}
function ringColor(n){return n>=75?"var(--green)":n>=55?"var(--lime)":n>=35?"var(--amber)":"var(--red)"}
/* Inline evidence-confidence badge (mirrors the Confidence Audit section). */
function auditBadge(a){if(!a)return"";const c=a.sev==="low"?"var(--green)":a.sev==="high"?"var(--red)":"var(--amber)";const stars="★".repeat(a.stars)+"☆".repeat(5-a.stars);return `<span class="pill" style="background:${c};border-color:${c};color:#fff" title="Evidence confidence: ${esc(a.word)} — ${esc(a.flag)}. Full breakdown in the Confidence Audit section.">Evidence ${stars}</span>`}
/* Jump to a section from the nav chips — expand it first if it's collapsed
   (the heavy reasoning sections render collapsed; the global .sec-head handler
   toggles .collapsed on click). */
function jumpToSec(id){const el=document.getElementById(id);if(!el)return;el.classList.remove("collapsed");el.scrollIntoView({behavior:"smooth"})}

/* ---------------- RENDER ---------------- */
function render(A){
  $("emptyState").style.display="none";
  const R=$("results");R.style.display="block";
  const secs=[];
  let n=0;const sec=(id,title,lede,body,collapsible)=>{n++;secs.push({id,title});return `<div class="sec${collapsible?" collapsed":""}" id="${id}"><div class="sec-head"><span class="sec-num">${String(n).padStart(2,"0")}</span><h2>${title}</h2></div>${lede?`<p class="lede">${lede}</p>`:""}${body}</div>`};

  /* score hero */
  const q=A.quality;
  const circ=2*Math.PI*56;
  const hero=`<div class="score-hero">
    <div class="score-ring"><svg width="130" height="130"><circle cx="65" cy="65" r="56" fill="none" stroke="var(--ink)" stroke-width="9"/>
    <circle cx="65" cy="65" r="56" fill="none" stroke="${ringColor(q.total)}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${circ*q.total/100} ${circ}"/></svg>
    <div class="num"><b>${q.total}</b><span>Brief quality</span></div></div>
    <div class="score-meta"><h3>${esc(q.grade.label)}</h3><p>${esc(q.grade.desc)}</p>
    <div class="score-bars">${q.dims.map(d=>`<div class="sbar"><div class="lbl"><span>${esc(d.name)}</span><span>${d.score}</span></div><div class="track"><div class="fill" style="width:${d.score}%;background:${ringColor(d.score)}"></div></div></div>`).join("")}</div></div></div>`;

  let html=hero;

  /* Strategic Constraints — what the interrogation locked in, what it left open. */
  if(A.interrogation&&(A.interrogation.constraints.length||A.interrogation.unanswered.length||A.interrogation.assumptions.length)){
    const I=A.interrogation;
    const doneLine=`<b>${I.answeredCount} of ${I.askedCount}</b> pre-analysis question${I.askedCount===1?"":"s"} answered.${I.unanswered.length?` <b>${I.unanswered.length} left open</b> — each is flagged as a risk in the Red Flag Detector below.`:" Nothing left open — every recommendation below is anchored to your answers."}`;
    let body=`<p class="lede" style="margin-top:-4px">${doneLine}</p>`;
    if(I.constraints.length)
      body+=`<div style="font-family:var(--serif);font-size:16px;margin:6px 0 4px">What you locked in — the analysis is built to honour these</div>`+
        kvRows(I.constraints.map(c=>({k:c.q,v:c.a})));
    if(I.assumptions.length)
      body+=`<div style="font-family:var(--serif);font-size:16px;margin:16px 0 6px">Assumptions the brief was hiding</div>`+
        I.assumptions.map(a=>`<div class="flag med"><span class="sev">Assumption</span><div><b>${esc(a.assumption)}</b><div class="why">Found in the brief: ${esc(a.found_in_brief)}</div><div class="fix">Risk if wrong: ${esc(a.risk_if_wrong)}</div></div></div>`).join("");
    html+=sec("constraints","Strategic Constraints",I.pressure||"What your pre-analysis answers commit the work to — and what the brief was quietly assuming.",body);
  }

  if(A.roleGuide){const G=A.roleGuide;
    html+=sec("rolelens",`Your Role Lens — ${esc(G.role)}`,
      G.custom?"Custom role: guidance built from the diagnosis, tuned to your title. The sections below apply through your lane.":"This brief, read through your professional lens: what to focus on, ask, watch for, own, and do next.",
      `<b style="font-family:var(--serif);font-size:16px">What you should focus on</b><ul class="clean">${G.focus.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Questions you should ask the client</b><ul class="clean q">${G.questions.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Risks you should flag</b>${G.risks.map(x=>`<div class="chal"><p>${esc(x)}</p></div>`).join("")}
      <div style="height:12px"></div><div class="kv">
        <div class="k">Your deliverables</div><div class="v">${G.deliverables.map(x=>esc(x)).join(" · ")}</div>
        <div class="k">Missing info that hits your lane</div><div class="v">${G.missing.map(x=>esc(x)).join(" · ")}</div>
      </div>
      <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Recommended next steps</b><ul class="clean">${G.next.map((x,i)=>`<li><b style="font-family:var(--mono);font-size:11px;color:var(--lime)">${i+1}.</b> ${esc(x)}</li>`).join("")}</ul>`);
  }

  html+=sec("snapshot","Brief Snapshot","What we're working with, stripped of jargon.",
    `<p>${esc(A.snapshot.plain)}</p><div style="height:14px"></div>`+kvRows([
    {k:"Client",v:A.snapshot.client},{k:"Brand",v:A.snapshot.brand},{k:"Industry",v:A.ctx.industry},
    {k:"Market",v:A.snapshot.market},{k:"Objective",v:A.snapshot.objective},{k:"Audience",v:A.snapshot.audience},
    {k:"Budget",v:A.snapshot.budget},{k:"Deadline",v:A.snapshot.deadline},{k:"Deliverables",v:A.snapshot.deliverables},
    {k:"Tone",v:A.snapshot.tone},{k:"Channels",v:A.snapshot.channels},{k:"Brief length",v:A.snapshot.length}]));

  if(A.contextIntel)html+=sec("contextintel","Context Analysis — Read Before The Recommendations",
    esc(A.contextIntel.summary),
    kvRows(A.contextIntel.lenses));

  if(A.ctx.M)html+=sec("marketintel",`Market Intelligence — ${esc(A.ctx.M.name)}`,"Everything below adapts to this market: culture, media, platforms, influencer rates, budgets, retail, tone and risk.",
    kvRows(marketIntelRows(A.ctx.M)));

  html+=sec("solutions","Solution Diagnosis — What This Brief Actually Needs","Not every client problem is a campaign. Confidence scores below reflect signals in the brief, the objective, and the category.",
    `<div class="flag ${A.solutions.top[0].name==="Campaign Development"?"low":"med"}" style="margin-bottom:14px"><span class="sev">Verdict</span><div><div class="why" style="font-size:14px;color:var(--bone)">${esc(A.solutions.verdict)}</div></div></div>`
    +A.solutions.top.map((s,i)=>`<div class="sol ${i===0?"lead":""}"><div class="pct">${s.score}<small>signal</small></div><div><b>${esc(s.name)}</b><div class="why">${esc(s.why)}</div><div class="del">${esc(s.del)}</div></div></div>`).join("")
    +`<p style="margin-top:12px;color:var(--mute);font-size:12.5px">Also considered: ${A.solutions.all.slice(5,12).map(s=>`${esc(s.name)} (${s.score})`).join(" · ")}</p>`);

  html+=sec("realask","What The Client Is Really Asking For","The brief beneath the brief.",
    A.realAsk.map(p=>`<p>${esc(p)}</p>`).join(""));

  html+=sec("bizproblem","The Business Problem","Not the marketing symptom — the thing costing money.",kvRows(A.bizProblem));

  html+=sec("commsproblem","The Communication Problem","What's happening in the audience's head right now.",kvRows(A.commsProblem));

  html+=sec("redflags","Red Flag Detector",A.flags.length?`${A.flags.length} issue${A.flags.length>1?"s":""} that will cause pain later if not handled now.`:"",
    A.flags.length?A.flags.map(f=>`<div class="flag ${f.sev}"><span class="sev">${f.sev==="high"?"High risk":f.sev==="med"?"Caution":"Note"}</span><div><b>${esc(f.title)}</b><div class="why">${esc(f.why)}</div><div class="fix">${esc(f.fix)}</div></div></div>`).join("")
    :`<p>No classic red flags detected. Either this is a genuinely good brief, or the problems are hiding in what was <i>left out</i> — check Missing Information below.</p>`);

  html+=sec("reality","Reality Check — Is The Client Being Unrealistic?","Where ambition and arithmetic disagree.",
    A.warns.length?A.warns.map(w=>`<div class="flag med"><span class="sev">Mismatch</span><div><b>${esc(w.title)}</b><div class="why">${esc(w.detail)}</div><div class="fix">${esc(w.say)}</div></div></div>`).join("")
    :`<p>No major expectation mismatches detected from the information given. Note: this check is only as good as the budget/deadline data provided — if those are missing, unrealism is hiding, not absent.</p>`);

  html+=sec("audience","Audience Breakdown","Who we're actually talking to — beyond the age bracket.",kvRows(A.audience));

  html+=sec("missing","Missing Information","What the client should have told you and didn't.",
    A.miss.length?`<ul class="clean">${A.miss.map(m=>`<li>${esc(m)}</li>`).join("")}</ul>`:`<p>Remarkably complete. Confirm the details in a kickoff call, then move fast.</p>`);

  html+=sec("questions","Questions To Ask The Client","Take these into the briefing call. In this order.",
    `<ul class="clean q">${A.qs.map(m=>`<li>${esc(m)}</li>`).join("")}</ul>`);

  html+=sec("insights","Insight Engine","Eight ways into the problem, each with a linked precedent and a confidence score. The work should trace its logic back to at least three of these.",
    `<div class="insights">${A.insights.map(i=>`<div class="icard"><div class="itype">${esc(i.type)}${i.conf?` <span class="tag ${i.conf>=80?"green":i.conf>=70?"lime":"amber"}" style="float:right">Confidence ${i.conf}%</span>`:""}</div><div class="itxt">${esc(i.txt)}</div><div class="iuse">${esc(i.use)}</div>${refLine(i.ref)}</div>`).join("")}</div>`);

  if(A.deep&&A.deep.length){
    html+=sec("deepinsights",`Deep Market Insights — ${esc(A.ctx.M?A.ctx.M.name:"Global")}`,
      "Layered like a planning department researches: local market → region → continent → global. Each insight carries its rationale, the behaviour behind it, the business implication, the creative opportunity, a confidence score and a source.",
      A.deep.map(L=>`<div style="margin-bottom:18px">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px"><b style="font-family:var(--serif);font-size:17px">${esc(L.layer)}</b><span class="tag lime">${esc(L.scope)}</span></div>
        ${L.items.map(i=>`<div class="icard" style="margin-bottom:10px">
          <div class="itxt">${esc(i.s)} <span class="tag ${i.conf>=82?"green":i.conf>=74?"lime":"amber"}" style="margin-left:6px">Confidence ${i.conf}%</span></div>
          <div class="kv" style="margin-top:8px">
            <div class="k">Why it's true</div><div class="v">${esc(i.why)}</div>
            <div class="k">Consumer behaviour</div><div class="v">${esc(i.beh)}</div>
            <div class="k">Business implication</div><div class="v">${esc(i.imp)}</div>
            <div class="k">Creative opportunity</div><div class="v">${esc(i.opp)}</div>
          </div>
          <div style="margin-top:8px"><a href="${i.src.url}" target="_blank" rel="noopener" style="font-size:12px;color:var(--lime-dim);text-decoration:none" onclick="event.stopPropagation()">↗ Source: ${esc(i.src.name)}</a></div>
        </div>`).join("")}
      </div>`).join(""));
  }

  if(A.evidence&&A.evidence.length){
    html+=sec("evidence","Evidence and Sources","Everything above traces back to something citable. Research references, industry reports and case studies used in this analysis — links open the study or a pinned search that lands on it.",
      `<div class="tblwrap"><table><thead><tr><th>Type</th><th>Source</th><th>Used for</th></tr></thead><tbody>
      ${A.evidence.map(e=>`<tr><td><span class="tag ${e.type==="Case study"?"orange":"lime"}">${esc(e.type)}</span></td>
      <td><a href="${e.url}" target="_blank" rel="noopener" style="color:var(--lime);text-decoration:none">${esc(e.name)} ↗</a></td>
      <td style="color:var(--bone-dim)">${esc(e.used)}</td></tr>`).join("")}</tbody></table></div>
      <p style="margin-top:10px;color:var(--mute);font-size:12.5px">Confidence scores reflect evidence strength: 80%+ = multiple published sources; 70–79% = strong directional evidence; below 70% = informed strategic judgement, verify before betting the budget.</p>`);
  }

  /* Confidence Audit — reliability of every recommendation made visible. */
  if(A.evidenceAudit&&A.evidenceAudit.confidence_audits.length){
    const EA=A.evidenceAudit;
    const starRow=n=>`<span style="letter-spacing:1px;font-size:15px" title="${n}/5">${"★".repeat(n)}<span style="opacity:.28">${"★".repeat(5-n)}</span></span>`;
    const flagTag=a=>`<span class="tag ${a.sev==="low"?"green":a.sev==="high"?"":"amber"}"${a.sev==="high"?' style="background:var(--red);color:#fff"':""}>${esc(a.flag)}</span>`;
    let body=`<div class="flag ${EA.average_stars>=4?"low":EA.average_stars>=3?"med":"high"}"><span class="sev">Evidence quality</span><div><div class="why" style="color:var(--bone);font-size:14px">${esc(EA.overall_evidence_quality)}</div></div></div>`;
    if(EA.recommendations_needing_research.length)
      body+=`<div style="margin-top:6px"><b style="font-family:var(--serif);font-size:15px">Needs research before spend</b><ul class="clean">${EA.recommendations_needing_research.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></div>`;
    // per-recommendation audit cards
    body+=`<div style="font-family:var(--serif);font-size:16px;margin:16px 0 8px">Recommendation-by-recommendation</div>`;
    body+=EA.confidence_audits.map(a=>`<div class="icard" style="margin-bottom:12px">
      <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">
        ${starRow(a.confidence_stars)} <b style="font-family:var(--serif);font-size:15.5px;flex:1">${esc(a.title)}</b>
        <span class="tag lime">${esc(a.type)}</span>${flagTag(a)}
      </div>
      <div style="font-size:13px;color:var(--mute);margin:8px 0 0">${esc(a.reasoning)}</div>
      ${kvRows([{k:"Source credibility",v:a.source_credibility},{k:"Market specificity",v:a.market_specificity}])}
      ${a.embedded_assumptions.length?`<div style="font-size:12px;font-family:var(--mono,monospace);text-transform:uppercase;letter-spacing:.06em;color:var(--mute);margin:10px 0 4px">Rests on — and how to test it</div>`+
        a.embedded_assumptions.map(as=>`<div style="border-left:3px solid var(--ink);padding:2px 0 2px 12px;margin:0 0 8px"><b style="font-size:13.5px">${esc(as.assumption)}</b><div style="font-size:12.5px;color:var(--mute);margin-top:2px">Evidence: ${esc(as.evidence)}</div><div style="font-size:12.5px;color:var(--lime-dim);margin-top:2px">${as.test_required?"Test — ":"Optional check — "}${esc(as.test_method)}</div></div>`).join(""):""}
      <div style="font-size:13px;margin-top:6px"><b>Pressure test:</b> ${esc(a.pressure_test)}</div>
    </div>`).join("");
    // tensions
    if(EA.tensions.length)
      body+=`<div style="font-family:var(--serif);font-size:16px;margin:16px 0 8px">Productive tensions — where the creative lives</div>`+
        EA.tensions.map(t=>`<div class="flag low"><span class="sev">Tension</span><div><b>${esc(t.name)}</b><div class="why">${esc(t.both_true)}</div><div class="fix">Creative opportunity: ${esc(t.creative_lives)}</div></div></div>`).join("");
    // blind spots
    if(EA.market_specific_blind_spots.length)
      body+=`<div style="font-family:var(--serif);font-size:16px;margin:16px 0 8px">Market blind spots to double-check</div>`+
        EA.market_specific_blind_spots.map(b=>`<div class="flag med"><span class="sev">Blind spot</span><div><div class="why" style="color:var(--bone)">${esc(b)}</div></div></div>`).join("");
    body+=`<p class="lede" style="margin-top:14px">${esc(EA.next_steps)}</p>`;
    html+=sec("confidenceaudit","Confidence Audit","How much to trust each call — the source behind it, the assumption under it, and what would prove it wrong. Nothing here is rejected for being low-confidence; it's flagged, named and given a test.",body,true);
  }

  /* Assumption Auditor — the bets under each recommendation, with Plan B + a cheap test. */
  if(A.assumptionAudit&&A.assumptionAudit.assumption_cards.length){
    const AA=A.assumptionAudit;
    const certTag=c=>`<span class="tag ${c==="High"?"green":c==="Low"?"":"amber"}"${c==="Low"?' style="background:var(--red);color:#fff"':""}>${esc(c)} certainty</span>`;
    let body="";
    if(AA.critical_assumptions.length)
      body+=`<div class="flag high"><span class="sev">Critical</span><div><b>Wrong here and the strategy doesn't survive</b><ul class="clean" style="margin-top:6px">${AA.critical_assumptions.map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div></div>`;
    if(AA.easy_wins.length)
      body+=`<div class="flag low"><span class="sev">Easy wins</span><div><b>Test these before you spend a shilling — cheap and fast</b><ul class="clean" style="margin-top:6px">${AA.easy_wins.map(e=>`<li>${esc(e)}</li>`).join("")}</ul></div></div>`;
    body+=`<div style="font-family:var(--serif);font-size:16px;margin:16px 0 8px">Bet-by-bet, with a Plan B and a test for each</div>`;
    body+=AA.assumption_cards.map(card=>`<div class="icard" style="margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:4px">
        <b style="font-family:var(--serif);font-size:16px;flex:1">${esc(card.recommendation_title)}</b><span class="tag lime">${esc(card.recommendation_type)}</span>
      </div>
      ${card.assumption_sets.map(a=>`<div style="border-left:3px solid var(--ink);padding:4px 0 6px 12px;margin:10px 0">
        <div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><b style="font-size:14px;flex:1">${a.number}. ${esc(a.assumption)}</b>${certTag(a.certainty)}</div>
        <div style="font-size:12.5px;color:var(--mute);margin-top:5px"><b style="color:var(--ink)">Why we believe it — </b>${esc(a.evidence)} <i>(${esc(a.source_or_logic)})</i></div>
        <div style="font-size:12.5px;margin-top:4px"><b style="color:var(--red)">Proven wrong if — </b>${esc(a.disproven_if)}</div>
        <div style="font-size:12.5px;margin-top:4px"><b>Plan B — </b>${esc(a.plan_b)}</div>
        <div style="font-size:12.5px;color:var(--lime-dim);margin-top:4px"><b style="color:var(--ink)">Test — </b>${esc(a.test_method)} <span class="tag lime" style="margin-left:4px">${esc(a.test_cost)}</span><span class="tag lime">${esc(a.test_timeline)}</span></div>
      </div>`).join("")}
    </div>`).join("");
    body+=`<p class="lede" style="margin-top:12px">${esc(AA.note)}</p>`;
    html+=sec("assumptionaudit","Assumption Auditor","Every recommendation is a bet. Here's what each one is betting on, what 'wrong' looks like in numbers, the Plan B if it breaks, and the cheap, fast way to find out before you commit budget.",body,true);
  }

  /* Devil's Advocate — the strongest case against each recommendation. */
  if(A.devilsAdvocate&&A.devilsAdvocate.pressure_tests.length){
    const DA=A.devilsAdvocate;
    const starRow=n=>`<span style="letter-spacing:1px;font-size:14px" title="${n}/5 credibility">${"★".repeat(n)}<span style="opacity:.28">${"★".repeat(5-n)}</span></span>`;
    let body=`<div class="flag ${DA.recommendations_at_risk.length?"high":"low"}"><span class="sev">Verdict</span><div><div class="why" style="color:var(--bone);font-size:14px">${esc(DA.executive_summary)}</div></div></div>`;
    if(DA.recommendations_at_risk.length)
      body+=`<div style="margin-top:6px"><b style="font-family:var(--serif);font-size:15px">Survive by a thin margin — defend these before the room</b><ul class="clean">${DA.recommendations_at_risk.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></div>`;
    body+=`<div style="font-family:var(--serif);font-size:16px;margin:16px 0 8px">The strongest case against each call</div>`;
    body+=DA.pressure_tests.map(p=>{
      const sev=p.counter_credibility_stars>=4?"high":p.counter_credibility_stars===3?"med":"low";
      const verdict=/fully valid/.test(p.your_honest_assessment)?"Holds up":/easily dismissed/.test(p.your_honest_assessment)?"Weak":"Partly holds";
      return `<div class="icard" style="margin-bottom:12px">
      <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:4px">
        ${starRow(p.counter_credibility_stars)} <b style="font-family:var(--serif);font-size:15.5px;flex:1">${esc(p.recommendation_summary)}</b>
        <span class="tag lime">${esc(p.recommendation_type)}</span><span class="tag ${sev==="low"?"green":sev==="high"?"":"amber"}"${sev==="high"?' style="background:var(--red);color:#fff"':""}>${verdict}</span>
      </div>
      <div style="font-size:14px;margin-top:6px"><b>“</b>${esc(p.counter_argument)}<b>”</b></div>
      <div style="font-size:12.5px;color:var(--mute);margin-top:7px"><b style="color:var(--ink)">Why it has logic — </b>${esc(p.why_it_has_logic)}</div>
      <div style="font-size:12.5px;color:var(--mute);margin-top:4px"><b style="color:var(--ink)">Market reality — </b>${esc(p.market_reality_supporting_counter)}</div>
      <div style="font-size:12.5px;margin-top:4px"><b style="color:var(--lime-dim)">Prove them wrong with — </b>${esc(p.evidence_needed_to_disprove)}</div>
      <div style="font-size:13px;margin-top:6px">${esc(p.your_honest_assessment)}</div>
      <div style="font-size:13px;margin-top:4px"><b>${esc(p.mitigation_or_pivot)}</b></div>
    </div>`;}).join("");
    html+=sec("devilsadvocate","Devil's Advocate","The strongest case a smart competitor or sceptical CD would make against each recommendation — steel-manned, honestly rated, and answered. Not to shoot ideas down: to show which have weak legs and how to strengthen them.",body,true);
  }

  /* Validation Roadmap — 3-tier test-before-you-ship plan for the top bets. */
  if(A.preProd&&A.preProd.test_roadmap&&A.preProd.test_roadmap.length){
    const P=A.preProd;
    let body=`<div class="flag low"><span class="sev">Principle</span><div><div class="why" style="color:var(--bone);font-size:14px">${esc(P.principle)}</div></div></div>`;
    body+=kvRows([{k:"Total test budget",v:P.total_test_budget},{k:"Timeline",v:P.total_test_timeline},{k:"Critical path",v:P.critical_path}]);
    body+=P.test_roadmap.map(t=>`<div class="icard" style="margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px">
        <span class="tag" style="background:var(--ink);color:var(--paper,#fff);border-color:var(--ink)">TIER ${t.tier}</span>
        <b style="font-family:var(--serif);font-size:16px;flex:1">${esc(t.tier_name)}</b>
        <span class="pill">${esc(t.timeline)}</span><span class="pill">${esc(t.budget)}</span>
      </div>
      <div style="font-size:12px;color:var(--mute);margin-bottom:6px">Validates: <b style="color:var(--ink)">${esc(t.recommendation_tested)}</b></div>
      <div style="font-size:14px"><b>Hypothesis — </b>${esc(t.hypothesis)}</div>
      ${kvRows([{k:"Method",v:t.test_design.method},{k:"Platforms",v:(t.test_design.platforms||[]).join(", ")},{k:"Sample",v:t.test_design.sample_size},{k:"Success metric",v:`${t.success_metric.kpi} — ${t.success_metric.threshold}`},{k:"Measured by",v:t.success_metric.measurement}])}
      <div style="font-size:12px;font-family:var(--mono,monospace);text-transform:uppercase;letter-spacing:.06em;color:var(--mute);margin:10px 0 4px">Runs in parallel — don't wait for results</div>
      <ul class="clean" style="margin:0 0 6px">${t.parallel_work.map(w=>`<li>${esc(w)}</li>`).join("")}</ul>
      <div style="border-left:3px solid var(--ink);padding-left:12px;margin-top:8px">
        <div style="font-size:12.5px;margin-top:2px"><b style="color:var(--green)">If it works — </b>${esc(t.if_success)}</div>
        <div style="font-size:12.5px;margin-top:3px"><b style="color:var(--red)">If it fails — </b>${esc(t.if_failure)}</div>
        <div style="font-size:12.5px;margin-top:3px"><b style="color:var(--amber)">If inconclusive — </b>${esc(t.if_inconclusive)}</div>
      </div>
    </div>`).join("");
    body+=`<div class="flag med"><span class="sev">Market test design</span><div><div class="why" style="color:var(--bone)">${esc(P.market_testing_notes)}</div></div></div>`;
    body+=`<div style="font-family:var(--serif);font-size:16px;margin:14px 0 6px">Kill criteria — decided upfront</div>`+
      P.kill_criteria.map(k=>`<div class="flag high"><span class="sev">Kill</span><div><div class="why" style="color:var(--bone)">${esc(k)}</div></div></div>`).join("");
    body+=`<div style="font-family:var(--serif);font-size:16px;margin:14px 0 6px">Decision tree</div><p style="font-size:13px;color:var(--mute)">${esc(P.decision_tree)}</p>`;
    body+=`<div style="font-family:var(--serif);font-size:16px;margin:14px 0 6px">What runs while tests run</div><p style="font-size:13px;color:var(--mute)">${esc(P.production_timeline)}</p>`;
    html+=sec("validationroadmap","Validation Roadmap","Don't ship the idea — test the hypothesis first. Three escalating tiers, each cheaper than the failure it prevents, with the production work that runs alongside so testing costs timeline, not weeks.",body,true);
  }

  const BO=A.brandOps;
  html+=sec("branding","Branding Opportunities","The brand layer under any campaign — position, personality, promise, voice.",
    `<b style="font-family:var(--serif);font-size:16px">Positioning directions</b>
    ${BO.positioning.map(p=>`<div class="chal" style="border-left-color:var(--lime)"><b>${esc(p.n)}</b><p>${esc(p.s)}</p><p class="push">${esc(p.fit)}</p></div>`).join("")}
    <div style="height:10px"></div>`
    +kvRows([
      {k:"Primary archetype",v:`${BO.arch.primary.n} — ${BO.arch.primary.d} Voice: ${BO.arch.primary.voice}.`},
      {k:"Secondary archetype",v:`${BO.arch.secondary.n} — ${BO.arch.secondary.d} (The flavour, not the base.)`},
      {k:"Brand personality",v:BO.personality.join(" · ")},
      {k:"Brand values",v:BO.values.join(" — ")},
      {k:"Brand promise",v:BO.promise},
      {k:"Voice — principles",v:BO.voice.principles.join(" · ")},
      {k:"Voice — sounds like",v:BO.voice.do},
      {k:"Voice — never",v:BO.voice.dont}])
    +`<div style="height:16px"></div><b style="font-family:var(--serif);font-size:16px">Messaging pillars</b>
    <div class="kv" style="margin-top:8px">${BO.pillars.map(p=>`<div class="k">${esc(p.p)}</div><div class="v">${esc(p.m)}<br><small style="color:var(--mute)">Proof: ${esc(p.proof)}</small></div>`).join("")}</div>
    <div style="height:16px"></div><b style="font-family:var(--serif);font-size:16px">Tagline territories</b>
    <div class="kv" style="margin-top:8px">${BO.taglines.map(tt=>`<div class="k">${esc(tt.t)}</div><div class="v">${tt.lines.map(l=>`“${esc(l)}”`).join(" / ")}</div>`).join("")}</div>`
    +refsHtml(BO.refs));

  html+=sec("identity","Brand Identity Recommendations",esc(A.identity.note),
    A.identity.routes.map((r,i)=>`<div class="route"><h4>${i+1}. ${esc(r.n)}</h4><div class="vibe">${esc(r.vibe)}</div>
    <div class="swatches">${r.colors.map(c=>`<div class="swatch" style="background:${c[0]}"><small>${esc(c[1].split(" —")[0])}</small></div>`).join("")}</div>
    ${kvRows([{k:"Logo direction",v:r.logo},{k:"Typography",v:r.type},{k:"Colour logic",v:r.colors.map(c=>c[1]).join("; ")},{k:"Design principles",v:r.principles.join(" · ")},{k:"Moodboard themes",v:r.mood},{k:"Packaging opportunity",v:r.pack}])}
    ${refsHtml(r.refs,"Reference projects")}</div>`).join(""));

  const PK=A.packaging;
  html+=sec("packaging","Packaging Design Analysis",PK.relevant?"The pack is the last ad before the money moves.":"",
    PK.relevant?
      `<b style="font-family:var(--serif)">Shelf visibility</b><ul class="clean">${PK.shelf.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif)">Decision triggers at the point of purchase</b><ul class="clean">${PK.triggers.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif)">Innovation opportunities</b><ul class="clean">${PK.innovation.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif)">Sustainable packaging</b><ul class="clean">${PK.sustainable.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif)">Structural ideas</b><ul class="clean">${PK.structural.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`
      +refsHtml(PK.refs,"Packaging references (Pentawards / Design Week class)")
    :`<p>${esc(PK.note)}</p>`);

  const UX=A.ux;
  if(UX)html+=sec("ux","UX Recommendations",UX.relevant?"The destination is part of the campaign.":"",
    UX.relevant?
      `<p>${esc(UX.principle)}</p><div style="height:12px"></div>
      <b style="font-family:var(--serif)">Destination audit — before media money moves</b><ul class="clean">${UX.audit.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif)">Conversion flow</b><ul class="clean">${UX.conversion.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif)">Onboarding &amp; first session</b><ul class="clean">${UX.onboarding.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif)">Measure it</b><ul class="clean">${UX.measure.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`
      +refsHtml(UX.refs,"Digital product & utility references")
    :`<p>${esc(UX.note)}</p>`);

  html+=sec("territories","Strategic Territories","Five distinct hills to fight from. Pick one — hybrids die in research.",
    A.terrs.map(t=>`<div class="terr" onclick="this.classList.toggle('open')"><div class="terr-head"><span class="terr-num">${t.n}</span><h4>${esc(t.name)}<span class="thought">${esc(t.core)}</span></h4>${auditBadge(t.audit)}<button class="btn small ghost save-terr" onclick="event.stopPropagation();saveTerritory(${t.n})">☆ Save</button></div>
    <div class="terr-body">${kvRows([{k:"Core thought",v:t.core},{k:"Why it works",v:t.why},{k:"Audience relevance",v:t.rel},{k:"Campaign direction",v:t.dir},{k:"Risks",v:t.risk}].concat(t.principle?[{k:"Strategic principle",v:`${t.principle.name} — ${t.principle.why} (${t.principle.school})`},{k:"Why it may fail",v:cap(t.principle.whyFails)+"."},{k:"Trade-off accepted",v:cap(t.principle.tradeoff)+"."}].concat(t.principle.alternative?[{k:"Alternative considered",v:t.principle.alternative}]:[]):[],t.confidence?[{k:"Confidence",v:`${t.confidence.level} — ${t.confidence.why}${t.confidence.assumptions.length?` Assumes: ${t.confidence.assumptions.join("; ")}.`:""}`}]:[]))}${refsHtml(t.refs,"It's been proven — see:")}</div></div>`).join(""));

  html+=sec("ideas","Creative Idea Generator","Ten campaign-ready starting points, ranked by award potential. Click any idea to expand.",
    A.ideas.map(i=>ideaCard(i)).join(""));

  html+=sec("compare","Campaign Idea Comparison","All ten side by side. Sortable logic: the score column is the average of eight craft criteria.",
    `<div class="tblwrap"><table><thead><tr><th>#</th><th>Idea</th><th>Award score</th><th>Difficulty</th><th>Budget</th><th>Market fit</th><th>Top strength</th><th>Main risk</th></tr></thead><tbody>
    ${A.ideas.map(i=>{const s=i.scores;const names={orig:"Originality",cult:"Cultural relevance",simp:"Simplicity",craft:"Craft",eff:"Effectiveness",emo:"Emotional power",pr:"PR potential",feas:"Feasibility"};
    const top=Object.entries(s).sort((a,b)=>b[1]-a[1])[0];const low=Object.entries(s).sort((a,b)=>a[1]-b[1])[0];
    return `<tr><td>${i.n}</td><td><b>${esc(i.title)}</b><br><small style="color:var(--mute)">${esc(i.one)}</small></td><td><span class="score-cell">${i.award}</span>/10</td><td>${i.diff}</td><td>${i.budget}</td><td>${i.afriScore}/10</td><td>${names[top[0]]} (${top[1]})</td><td>Low ${names[low[0]].toLowerCase()} (${low[1]})</td></tr>`}).join("")}</tbody></table></div>`);

  html+=sec("best3","Best 3 Ideas To Pitch","Weighted for effectiveness, feasibility and cultural fit — the deck you'd actually take into the room.",
    `<div class="best3">${A.best3.map((i,x)=>`<div class="bcard ${x===0?"first":""}"><div class="rank">${x===0?"① Lead with this":x===1?"② The strong second":"③ The range-shower"}</div><h4>${esc(i.title)}</h4><p>${esc(i.one)}</p><div style="margin-top:10px"><span class="pill score">${i.award}/10</span> <span class="pill diff-${i.diff}">${i.diff} difficulty</span></div></div>`).join("")}</div>
    <p style="margin-top:14px;color:var(--bone-dim);font-size:13.5px">Pitch order logic: open with the lead (highest combined effectiveness + feasibility), use the second to prove depth, close with the third to show range. Never present ten ideas — it tells the client you couldn't choose.</p>`);

  html+=sec("sba","Safe vs Brave vs Award","Three honest postures. Make the client choose with eyes open.",
    `<div class="best3 sba">
    <div class="bcard"><div class="rank safe">The Safe Bet</div><h4>${esc(A.sba.safe.title)}</h4><p>${esc(A.sba.safe.one)}</p><p style="margin-top:8px"><b>Choose when:</b> the client's job is on the line, the timeline is brutal, or trust hasn't been built yet. It will work; it won't be talked about.</p></div>
    <div class="bcard"><div class="rank brave">The Brave Play</div><h4>${esc(A.sba.brave.title)}</h4><p>${esc(A.sba.brave.one)}</p><p style="margin-top:8px"><b>Choose when:</b> the brand needs fame more than reassurance, and the client can hold their nerve through 48 hours of mixed reactions.</p></div>
    <div class="bcard"><div class="rank award">The Award Shot</div><h4>${esc(A.sba.award.title)}</h4><p>${esc(A.sba.award.one)}</p><p style="margin-top:8px"><b>Choose when:</b> there's genuine craft budget, a client who wants to matter, and a problem worth solving beautifully. Award work is just brave work with better finishing.</p></div></div>`);

  const SO=A.social;
  html+=sec("social","Social Media Strategy","A system for showing up, not a folder of posts.",
    `<b style="font-family:var(--serif);font-size:16px">Content pillars & mix</b>
    <div style="margin:8px 0 16px">${SO.pillars.map(p=>`<div class="pillar"><b>${esc(p.p)}</b><span class="mix">${p.mix}%</span><span style="color:var(--bone-dim)">${esc(p.d)}</span></div>`).join("")}</div>
    <b style="font-family:var(--serif);font-size:16px">Community building</b><ul class="clean">${SO.community.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Formats that fit this market</b>
    <div style="margin:10px 0 4px">${SO.formats.map(f=>`<span class="tag">${esc(f)}</span>`).join("")}</div>
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Always-on opportunities</b><ul class="clean">${SO.alwaysOn.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Social campaign starters</b><ul class="clean">${SO.campaigns.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Platform playbook</b>
    <div class="kv" style="margin-top:8px">${SO.platforms.map(p=>`<div class="k">${esc(p.pl)}</div><div class="v"><b>${esc(p.role)}.</b> ${esc(p.note)}</div>`).join("")}</div>`
    +refsHtml(SO.refs));

  const IN=A.influencers;
  html+=sec("influencers","Influencer Strategy","Types and profiles, not names — vet real people against these specs. Rates are current Kenya-market ranges.",
    `<div class="flag low" style="margin-bottom:14px"><span class="sev">Roster mix</span><div><b>${esc(IN.mixRec.mix)}</b><div class="why">${esc(IN.mixRec.note)}</div></div></div>
    ${IN.tiers.map(t=>`<div class="tier"><div><span class="tname">${esc(t.n)}</span><span class="treach">${esc(t.reach)}</span><span class="tbudget">${esc(t.cost)}</span></div>
    ${kvRows([{k:"Role in the plan",v:t.role},{k:"Why suitable / impact",v:t.impact},{k:"Deploy when",v:t.when}])}</div>`).join("")}
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Creator profiles to look for (${esc(A.ctx.industryShort)})</b>
    <div style="margin:10px 0">${IN.profiles.map(p=>`<span class="tag lime">${esc(p)}</span>`).join("")}</div>
    <b style="font-family:var(--serif);font-size:16px">Non-negotiable rules</b><ul class="clean">${IN.rules.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>`
    +refsHtml(IN.refs));

  const AU=A.audit;
  html+=sec("audit","Creative Opportunity Audit","What the brief isn't seeing.",
    `<b style="font-family:var(--serif);font-size:16px">Missed opportunities</b><ul class="clean">${AU.missed.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Unexplored channels</b>
    <div class="kv" style="margin-top:8px">${AU.channels.map(c=>`<div class="k">${esc(c[0].split(" (")[0])}</div><div class="v">${esc(c[1])}</div>`).join("")}</div>
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Unexplored audiences</b>
    <div class="kv" style="margin-top:8px">${AU.audiences.map(c=>`<div class="k">${esc(c[0])}</div><div class="v">${esc(c[1])}</div>`).join("")}</div>
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Partnership opportunities</b><ul class="clean">${AU.partnerships.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Product opportunities</b><ul class="clean">${AU.product.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Community opportunities</b><ul class="clean">${AU.community.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`
    +refsHtml(AU.refs));

  html+=sec("afri",`${esc(A.ctx.M?A.ctx.M.name:"Market")} Relevance Check`,`Average market-fit across all ideas: <b>${A.afriOverall}/10</b>. What each check means for execution.`,
    `<div style="margin-bottom:14px">${AFRI_CHECKS.map(c=>`<span class="tag ${A.ideas.filter(i=>i.afri.includes(c)).length>=5?"lime":""}">${esc(c.label)} · ${A.ideas.filter(i=>i.afri.includes(c)).length}/10 ideas</span>`).join("")}</div>
    <ul class="clean">${AFRI_CHECKS.map(c=>`<li><b>${esc(c.label)}:</b> ${esc(c.note)}</li>`).join("")}</ul>
    <p style="margin-top:14px;color:var(--bone-dim);font-size:13.5px">Rule of thumb: if an idea would work identically in London, it isn't finished yet. The winning version of every idea above is the one that could ONLY happen here.</p>`);

  const B=A.budget;
  html+=sec("budget","Budget + Production Estimate",esc(B.note),
    kvRows([{k:"Low-budget route",v:B.low.range+" — "+B.low.what},{k:"— team",v:B.low.team},
    {k:"Mid-budget route",v:B.mid.range+" — "+B.mid.what},{k:"— team",v:B.mid.team},
    {k:"Premium route",v:B.high.range+" — "+B.high.what},{k:"— team",v:B.high.team}])
    +`<div style="height:18px"></div><div class="kv">${B.timeline.map(t=>`<div class="k">${esc(t[0])}</div><div class="v">${esc(t[1])}</div>`).join("")}</div>
    <div style="height:18px"></div><b style="font-family:var(--serif)">Hidden costs that ambush budgets:</b><ul class="clean">${B.hidden.map(h=>`<li>${esc(h)}</li>`).join("")}</ul>`);

  html+=sec("team","Agency Team Recommendation",esc(A.agencyTeam.note),
    A.agencyTeam.roles.map(r=>`<div class="role"><b>${esc(r[0])}</b><span class="pri ${r[1]}">${r[1]==="ess"?"Essential":r[1]==="rec"?"Recommended":"Phase 2"}</span><p>${esc(r[2])}</p></div>`).join("")
    +`<div style="height:14px"></div><p>${esc(A.team.shape)}</p>
    <div style="margin:10px 0">${A.team.core.concat(A.team.extra).map(r=>`<span class="tag">${esc(r)}</span>`).join("")}</div>
    <p style="color:var(--bone-dim);font-size:13.5px">${esc(A.team.warning)}</p>`);

  const CH=A.challenge;
  html+=sec("challenge","Creative Director Challenge","The function that argues back. Read this before falling in love with anything above.",
    `<b style="font-family:var(--serif);font-size:16px">Assumptions to challenge</b><div style="height:8px"></div>
    ${CH.assumptions.map(a=>`<div class="chal"><b>${esc(a.a)}</b><p>${esc(a.c)}</p></div>`).join("")}
    ${CH.weakWords?`<b style="font-family:var(--serif);font-size:16px">Weak language detected in the brief</b><div style="margin:8px 0">${CH.weakWords.found.map(w=>`<span class="tag red">${esc(w)}</span>`).join("")}</div><p style="color:var(--bone-dim);font-size:13.5px">${esc(CH.weakWords.note)}</p><div style="height:12px"></div>`:""}
    ${CH.generic?`<b style="font-family:var(--serif);font-size:16px">Generic-idea warning</b><div style="margin:8px 0">${CH.generic.list.map(w=>`<span class="tag amber">${esc(w)}</span>`).join("")}</div><p style="color:var(--bone-dim);font-size:13.5px">${esc(CH.generic.note)}</p><div style="height:12px"></div>`:""}
    <b style="font-family:var(--serif);font-size:16px">Stronger alternatives</b><ul class="clean">${CH.stronger.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>
    <div style="height:14px"></div><b style="font-family:var(--serif);font-size:16px">Safe vs Brave vs Award — the trade-offs</b>
    <div class="tblwrap" style="margin-top:10px"><table><thead><tr><th></th><th style="color:var(--green)">Safe</th><th style="color:var(--orange)">Brave</th><th style="color:var(--lime)">Award</th></tr></thead><tbody>
    ${CH.tradeoffs.map(row=>`<tr><td style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--mute)">${esc(row[0])}</td><td>${esc(row[1])}</td><td>${esc(row[2])}</td><td>${esc(row[3])}</td></tr>`).join("")}</tbody></table></div>
    <div class="flag ${A.quality.total>=60?"low":"med"}" style="margin-top:14px"><span class="sev">CD verdict</span><div><div class="why" style="color:var(--bone);font-size:14px">${esc(CH.verdict)}</div></div></div>`);

  if(A.presentPrep){const P=A.presentPrep;
    html+=sec("presentprep","Presentation Prep — Defend This Work",
      "How to walk this into the room: what to say to a Creative Director, what to say to the client, the objections that will come, and the evidence that answers them.",
      `<b style="font-family:var(--serif);font-size:16px">Presenting to a Creative Director</b><ul class="clean">${P.cd.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Presenting to the client</b><ul class="clean">${P.client.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:14px"></div><b style="font-family:var(--serif);font-size:16px">Objections you should expect — and how to answer</b><div style="height:8px"></div>
      ${P.objections.map(ob=>`<div class="chal"><b>${esc(ob.o)}</b><p>${esc(ob.r)}</p><p class="push">Evidence: ${esc(ob.ev)}</p></div>`).join("")}
      <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Why this direction beats the alternatives</b><ul class="clean">${P.whyStronger.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      ${P.evidence.length?`<div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Evidence to bring into the room</b><div style="margin-top:8px">${P.evidence.map(e=>`<span class="tag lime">${esc(e)}</span>`).join("")}</div>`:""}
      ${P.confidence?`<div class="flag ${P.confidence.level==="High"?"low":P.confidence.level==="Medium"?"med":"high"}" style="margin-top:14px"><span class="sev">${P.confidence.level} confidence</span><div><div class="why" style="color:var(--bone);font-size:14px">${esc(P.confidence.why)}${P.confidence.missing.length?` To raise it: ${esc(P.confidence.missing.join("; "))}.`:""}</div></div></div>`:""}`);
  }

  html+=sec("cdnotes","Creative Director Notes","Brutally honest, constructively meant.",
    `<div class="notes">${A.notes.map(p=>`<p>${esc(p)}</p>`).join("")}<div class="sig">— BriefIQ / The CD who reads everything twice</div></div>`);

  if(A.inspo){
    const IE=A.inspo;
    html+=sec("inspiration","References, Inspiration & Learning",
      "What has been done before, what worked, what failed, and what can be adapted — for every recommendation in this analysis. Drawn from Cannes Lions, Effie, D&AD, The One Show, WARC, Contagious, IPA, Pentawards, The Dieline, Design Week and the behavioural-science canon. Every territory, idea, insight and identity route above also carries its own linked Similar Work.",
      IE.areas.map(a=>`<div style="margin-bottom:18px"><b style="font-family:var(--serif);font-size:16px">${esc(a.area)}</b><p style="color:var(--bone-dim);font-size:13px;margin:4px 0 0">${esc(a.note)}</p>${refsHtml(a.items,"Similar Work")}</div>`).join("")
      +`<p style="margin-top:8px;color:var(--mute);font-size:12.5px">Library: ${IE.libSize} verified case studies & studies · ${IE.count} matched to this brief. Links open a pinned search that lands on the original case study — WARC and LIONS Intelligence may require member access for full papers.</p>`);

    const G=IE.gap;
    html+=sec("oppgap","Opportunity Gap","Where the market is crowded, where it's exhausted, and where the differentiation actually is.",
      `<b style="font-family:var(--serif);font-size:16px">Already common in the market</b><ul class="clean">${G.common.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Overused — the audience has stopped seeing these</b><ul class="clean">${G.overused.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Saturated territories</b><div style="margin:8px 0">${G.saturated.map(x=>`<span class="tag amber">${esc(x)}</span>`).join("")}</div>
      <div style="height:12px"></div><b style="font-family:var(--serif);font-size:16px">Underexplored territories</b><ul class="clean">${G.open.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      <div class="flag low" style="margin-top:14px"><span class="sev">Biggest opportunity</span><div><div class="why" style="color:var(--bone);font-size:14px">${esc(G.white)}</div></div></div>`);

    html+=sec("learnbest","Learn From The Best","A study list, not a swipe file — the campaigns, branding, packaging, design systems and strategy cases that teach the thinking behind this analysis.",
      IE.learn.map(g=>`<div style="margin-bottom:18px"><b style="font-family:var(--serif);font-size:16px">${esc(g.group)}</b><p style="color:var(--bone-dim);font-size:13px;margin:4px 0 0">${esc(g.note)}</p>${refsHtml(g.items,"Study these")}</div>`).join("")
      +`<p style="margin-top:8px;color:var(--mute);font-size:12.5px">The objective isn't imitation — it's pattern literacy. Knowing what has been done, what worked and what failed is how strategists, designers and creative directors get sharper with every brief.</p>`);
  }else{
    const libRefs=refsFor(ARC_TAGS[A.best3[0].arc].concat(TERR_TAGS[A.terrs[0].style]||[],["effectiveness","science","africa"]),8,A.ctx.brand+"lib");
    html+=sec("inspiration","References, Inspiration & Learning","The most relevant precedents for this whole brief.",
      refsHtml(libRefs,"Top matches for this brief"));
  }

  html+=sec("deck","Pitch Deck Summary","Eight slides. This is the skeleton of the presentation.",
    `<div class="deck-grid">${A.deck.map(d=>`<div class="deck-card"><div class="slide">${esc(d.s)}</div><b>${esc(d.b)}</b><p>${esc(d.p)}</p></div>`).join("")}</div>`);

  html+=sec("export","Export & Save","",
    `<div class="export-row">
    <button class="btn" onclick="copySummary()">⧉ Copy summary</button>
    <button class="btn" onclick="downloadTxt()">↓ Download full report (.txt)</button>
    <button class="btn" onclick="downloadDeck()">↓ Pitch deck outline (.md)</button>
    ${(typeof Features!=="undefined"&&Features.isOn("export-json"))?`<button class="btn" onclick="downloadJson()">↓ Export JSON${(typeof Workspace!=="undefined"&&Workspace.isAdmin()&&Features.get("export-json")?.status!=="live")?" <span style='color:var(--orange)'>· testing</span>":""}</button>`:""}
    <button class="btn primary" onclick="saveProject()">＋ Save project</button>
    </div><p style="margin-top:12px;color:var(--mute);font-size:12.5px" id="exportLog"></p>`);

  R.innerHTML=`<div class="secnav">${secs.map(s=>`<button class="chip" onclick="jumpToSec('${s.id}')">${s.title.split(" ").slice(0,3).join(" ")}</button>`).join("")}</div>`+html;
  window.__A=A;
  R.scrollIntoView({behavior:"smooth"});
}
function ideaCard(i){
  return `<div class="idea" onclick="this.classList.toggle('open')"><div class="idea-head"><span class="no">${String(i.n).padStart(2,"0")}</span>
  <h4>${esc(i.title)}<span class="oneliner">${esc(i.one)}</span></h4>
  <span class="pill diff-${i.diff}">${i.diff} difficulty</span><span class="pill budget-${i.budget}">${i.budget} budget</span><span class="pill score">★ ${i.award}</span>${auditBadge(i.audit)}</div>
  <div class="idea-body">
  <div class="idea-scores">${[["Originality",i.scores.orig],["Cultural relevance",i.scores.cult],["Simplicity",i.scores.simp],["Craft potential",i.scores.craft],["Effectiveness",i.scores.eff],["Emotional power",i.scores.emo],["PR potential",i.scores.pr],["Feasibility",i.scores.feas]].map(s=>`<div class="iscore"><b>${s[1]}</b><span>${s[0]}</span></div>`).join("")}</div>
  ${kvRows([{k:"Campaign mechanic",v:i.mech},{k:"Key visual direction",v:i.vis},{k:"Copy direction",v:i.copy},{k:"Activation idea",v:i.act},{k:"Social execution",v:i.soc},{k:"Experiential idea",v:i.exp},{k:"Why it could work",v:i.why},{k:"Market relevance",v:i.afriScore+"/10 — "+(i.afri.map(c=>c.label).join(", ")||"needs localisation work")}].concat(i.principle?[{k:"Strategic principle",v:`${i.principle.name} — ${i.principle.why} (${i.principle.school})`},{k:"Why it may fail",v:cap(i.principle.whyFails)+"."},{k:"Trade-off accepted",v:cap(i.principle.tradeoff)+"."}].concat(i.principle.alternative?[{k:"Alternative considered",v:i.principle.alternative}]:[]):[],i.confidence?[{k:"Confidence",v:`${i.confidence.level} — ${i.confidence.why}${i.confidence.missing.length?` Missing: ${i.confidence.missing[0]}.`:""}`}]:[]))}
  ${refsHtml(i.refs,"Similar work that worked")}
  </div></div>`;
}

/* ---------------- EXPORTS ---------------- */
function serialize(A,full=true){
  const L=[];const hr="\n"+"—".repeat(46)+"\n";
  L.push(`BRIEFIQ STRATEGIC BREAKDOWN — ${A.ctx.brand} (${new Date().toLocaleDateString()})`);
  L.push(`Brief Quality Score: ${A.quality.total}/100 — ${A.quality.grade.label}`);
  if(A.roleGuide)L.push(hr+`YOUR ROLE LENS — ${A.roleGuide.role.toUpperCase()}\nFocus:\n${A.roleGuide.focus.map(x=>"• "+x).join("\n")}\nAsk the client:\n${A.roleGuide.questions.map(x=>"• "+x).join("\n")}\nRisks:\n${A.roleGuide.risks.map(x=>"• "+x).join("\n")}\nDeliverables: ${A.roleGuide.deliverables.join("; ")}\nMissing info for this role: ${A.roleGuide.missing.join("; ")}\nNext steps:\n${A.roleGuide.next.map((x,i)=>(i+1)+". "+x).join("\n")}`);
  L.push(hr+"BRIEF SNAPSHOT\n"+A.snapshot.plain);
  L.push(hr+"THE REAL ASK\n"+A.realAsk.join("\n\n"));
  L.push(hr+"BUSINESS PROBLEM\n"+A.bizProblem.map(r=>`• ${r.k}: ${r.v}`).join("\n"));
  L.push(hr+"COMMUNICATION PROBLEM\n"+A.commsProblem.map(r=>`• ${r.k}: ${r.v}`).join("\n"));
  L.push(hr+"RED FLAGS\n"+(A.flags.map(f=>`[${f.sev.toUpperCase()}] ${f.title} — ${f.why} FIX: ${f.fix}`).join("\n")||"None detected."));
  L.push(hr+"REALITY CHECK\n"+(A.warns.map(w=>`⚠ ${w.title} — ${w.detail} ${w.say}`).join("\n")||"No mismatches detected."));
  if(full){
    L.push(hr+"AUDIENCE\n"+A.audience.map(r=>`• ${r.k}: ${r.v}`).join("\n"));
    L.push(hr+"MISSING INFORMATION\n"+A.miss.map(m=>"• "+m).join("\n"));
    L.push(hr+"QUESTIONS FOR THE CLIENT\n"+A.qs.map((q,i)=>`${i+1}. ${q}`).join("\n"));
    L.push(hr+"INSIGHTS\n"+A.insights.map(i=>`• ${i.type} (confidence ${i.conf||70}%): ${i.txt}\n  Use it: ${i.use}`).join("\n"));
    if(A.deep)L.push(hr+"DEEP MARKET INSIGHTS\n"+A.deep.map(Ly=>`【${Ly.layer} — ${Ly.scope}】\n`+Ly.items.map(i=>`• ${i.s} (confidence ${i.conf}%)\n  Why: ${i.why}\n  Behaviour: ${i.beh}\n  Implication: ${i.imp}\n  Opportunity: ${i.opp}\n  Source: ${i.src.name} → ${i.src.url}`).join("\n")).join("\n\n"));
    if(A.evidence)L.push(hr+"EVIDENCE AND SOURCES\n"+A.evidence.map(e=>`• [${e.type}] ${e.name} — ${e.used} → ${e.url}`).join("\n"));
    L.push(hr+"STRATEGIC TERRITORIES\n"+A.terrs.map(t=>`${t.n}. ${t.name}\n   Core: ${t.core}\n   Why: ${t.why}\n   Direction: ${t.dir}\n   Risks: ${t.risk}`).join("\n\n"));
    L.push(hr+"IDEAS (ranked by award potential)\n"+A.ideas.map(i=>`${i.n}. ${i.title} — ★${i.award}/10 [${i.diff} difficulty / ${i.budget} budget / African relevance ${i.afriScore}/10]\n   ${i.one}\n   Mechanic: ${i.mech}\n   Visual: ${i.vis}\n   Copy: ${i.copy}\n   Activation: ${i.act}\n   Social: ${i.soc}\n   Experiential: ${i.exp}\n   Why: ${i.why}`).join("\n\n"));
    L.push(hr+"BEST 3 TO PITCH\n"+A.best3.map((i,x)=>`${x+1}. ${i.title} (★${i.award})`).join("\n"));
    L.push(hr+"SAFE / BRAVE / AWARD\nSafe: "+A.sba.safe.title+"\nBrave: "+A.sba.brave.title+"\nAward: "+A.sba.award.title);
    L.push(hr+"BUDGET ROUTES\nLow: "+A.budget.low.range+" — "+A.budget.low.what+"\nMid: "+A.budget.mid.range+" — "+A.budget.mid.what+"\nPremium: "+A.budget.high.range+" — "+A.budget.high.what+"\n\nHidden costs:\n"+A.budget.hidden.map(h=>"• "+h).join("\n"));
    L.push(hr+"TEAM NEEDED\n"+A.team.shape+"\n"+[...A.team.core,...A.team.extra].map(r=>"• "+r).join("\n"));
    L.push(hr+"SOLUTION DIAGNOSIS\n"+A.solutions.verdict+"\n"+A.solutions.top.map(s=>`• ${s.name} (${s.score}) — ${s.why}`).join("\n"));
    L.push(hr+"BRANDING OPPORTUNITIES\nPositioning directions:\n"+A.brandOps.positioning.map(p=>`• ${p.n}: ${p.s}`).join("\n")
      +`\nArchetype: ${A.brandOps.arch.primary.n} (secondary: ${A.brandOps.arch.secondary.n})\nPersonality: ${A.brandOps.personality.join(", ")}\nPromise: ${A.brandOps.promise}\nValues:\n${A.brandOps.values.map(v=>"• "+v).join("\n")}\nTagline territories:\n${A.brandOps.taglines.map(t=>`• ${t.t}: ${t.lines.join(" / ")}`).join("\n")}`);
    L.push(hr+"IDENTITY ROUTES\n"+A.identity.routes.map((r,i)=>`${i+1}. ${r.n} — ${r.vibe}\n   Logo: ${r.logo}\n   Type: ${r.type}\n   Colours: ${r.colors.map(c=>c[0]+" ("+c[1]+")").join(", ")}`).join("\n\n"));
    if(A.packaging.relevant)L.push(hr+"PACKAGING ANALYSIS\nShelf:\n"+A.packaging.shelf.map(x=>"• "+x).join("\n")+"\nInnovation:\n"+A.packaging.innovation.map(x=>"• "+x).join("\n")+"\nStructural:\n"+A.packaging.structural.map(x=>"• "+x).join("\n"));
    if(A.ux&&A.ux.relevant)L.push(hr+"UX RECOMMENDATIONS\n"+A.ux.principle+"\nDestination audit:\n"+A.ux.audit.map(x=>"• "+x).join("\n")+"\nConversion flow:\n"+A.ux.conversion.map(x=>"• "+x).join("\n")+"\nOnboarding:\n"+A.ux.onboarding.map(x=>"• "+x).join("\n")+"\nMeasure:\n"+A.ux.measure.map(x=>"• "+x).join("\n"));
    L.push(hr+"SOCIAL MEDIA STRATEGY\nPillars:\n"+A.social.pillars.map(p=>`• ${p.p} (${p.mix}%): ${p.d}`).join("\n")+"\nPlatforms:\n"+A.social.platforms.map(p=>`• ${p.pl} — ${p.role}: ${p.note}`).join("\n"));
    L.push(hr+"INFLUENCER STRATEGY\nMix: "+A.influencers.mixRec.mix+" — "+A.influencers.mixRec.note+"\n"+A.influencers.tiers.map(t=>`• ${t.n} (${t.reach}, ${t.cost}): ${t.role}`).join("\n")+"\nProfiles: "+A.influencers.profiles.join("; "));
    L.push(hr+"CREATIVE OPPORTUNITY AUDIT\nMissed:\n"+A.audit.missed.map(x=>"• "+x).join("\n")+"\nUnexplored channels:\n"+A.audit.channels.map(c=>`• ${c[0]} — ${c[1]}`).join("\n")+"\nPartnerships:\n"+A.audit.partnerships.map(x=>"• "+x).join("\n"));
    L.push(hr+"CD CHALLENGE\n"+A.challenge.assumptions.map(a=>`• ${a.a} ${a.c}`).join("\n")+(A.challenge.weakWords?`\nWeak language: ${A.challenge.weakWords.found.join(", ")}`:"")+`\nVerdict: ${A.challenge.verdict}`);
    L.push(hr+"AGENCY TEAM\n"+A.agencyTeam.roles.map(r=>`• [${r[1]==="ess"?"ESSENTIAL":r[1]==="rec"?"RECOMMENDED":"PHASE 2"}] ${r[0]} — ${r[2]}`).join("\n"));
    L.push(hr+"KEY REFERENCES\n"+refsFor(["effectiveness","science"],3,"ser").concat(A.terrs[0].refs||[]).map(r=>`• ${r.t} — ${r.b}, ${r.y} (${r.src}): ${r.take} → ${r.url}`).join("\n"));
    if(A.inspo){
      L.push(hr+"REFERENCES, INSPIRATION & LEARNING\n"+A.inspo.areas.map(a=>`【${a.area}】 ${a.note}\n`+a.items.map(r=>`• ${r.t} — ${r.b}${r.ag?" ("+r.ag+")":""}, ${r.y} [${r.cat||"—"} · relevance ${r.rel}%] (${r.src})\n  Why relevant: ${r.why}\n  Key takeaway: ${r.take}\n  → ${r.url}`).join("\n")).join("\n\n"));
      const G=A.inspo.gap;
      L.push(hr+"OPPORTUNITY GAP\nAlready common in the market:\n"+G.common.map(x=>"• "+x).join("\n")+"\n\nOverused:\n"+G.overused.map(x=>"• "+x).join("\n")+"\n\nSaturated territories:\n"+G.saturated.map(x=>"• "+x).join("\n")+"\n\nUnderexplored territories:\n"+G.open.map(x=>"• "+x).join("\n")+"\n\nBiggest opportunity for differentiation:\n"+G.white);
      L.push(hr+"LEARN FROM THE BEST\n"+A.inspo.learn.map(g=>`【${g.group}】\n`+g.items.map(r=>`• ${r.t} — ${r.b}${r.ag?" ("+r.ag+")":""}, ${r.y} [relevance ${r.rel}%]: ${r.take} → ${r.url}`).join("\n")).join("\n\n"));
    }
    L.push(hr+"CREATIVE DIRECTOR NOTES\n"+A.notes.join("\n\n"));
  }
  L.push(hr+"PITCH DECK SUMMARY\n"+A.deck.map(d=>`${d.s} — ${d.b}\n${d.p}`).join("\n\n"));
  return L.join("\n");
}
function logExport(type){
  if(currentProject){currentProject.exportHistory.push({type,at:new Date().toISOString()});Store.saveProject(currentProject)}
  if(typeof Usage!=="undefined")Usage.log("export",{format:type});
  const log=$("exportLog");if(log)log.textContent=`Last export: ${type} · ${new Date().toLocaleTimeString()}`;
}
function copySummary(){navigator.clipboard.writeText(serialize(window.__A,false)).then(()=>{toast("Summary copied");logExport("copy-summary")})}
function download(name,content,mime){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:mime}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function downloadTxt(){download(`BriefIQ_${window.__A.ctx.brandShort}_full-report.txt`,serialize(window.__A,true),"text/plain");toast("Report downloaded");logExport("download-txt")}
function downloadJson(){
  const A=window.__A||window.__AIRES||window.__AGENTS;if(!A)return;
  download(`BriefIQ_${window.__A?window.__A.ctx.brandShort:"analysis"}_analysis.json`,JSON.stringify(A,(k,v)=>typeof v==="function"?undefined:v,2),"application/json");
  toast("JSON exported");logExport("download-json");
}
function downloadDeck(){
  const A=window.__A;
  const md=`# ${A.ctx.brand} — Pitch Deck Outline\n\n`+A.deck.map((d,i)=>`## Slide ${i+1} · ${d.s.split("· ")[1]}\n**${d.b}**\n\n${d.p}\n\n> Speaker note: keep this slide to one thought. ${i===3?"Pause here. Let the idea land before you defend it.":""}`).join("\n\n")+`\n\n## Slide 9 · The Ask\nBudget route recommended: ${A.budget.mid.range}. Decision needed: safe / brave / award posture (see report).\n`;
  download(`BriefIQ_${A.ctx.brandShort}_deck-outline.md`,md,"text/markdown");toast("Deck outline downloaded");logExport("download-deck")}
function saveTerritory(num){
  if(!currentProject){saveProject(true)}
  const t=window.__A.terrs.find(x=>x.n===num);
  if(!currentProject.savedTerritories.some(x=>x.name===t.name)){currentProject.savedTerritories.push(t);Store.saveProject(currentProject)}
  toast(`Territory “${t.name}” saved`);
}
function saveProject(silent){
  const A=window.__A;if(!A)return;
  if(!currentProject)currentProject={id:"p_"+Date.now().toString(36),userId:"local-user",createdAt:new Date().toISOString(),savedTerritories:[],exportHistory:[]};
  currentProject.title=`${A.ctx.brand} — ${A.ctx.obj.label.split(" —")[0]}`;
  currentProject.inputs=collectInputs();
  currentProject.analysis={quality:A.quality.total,grade:A.quality.grade.label,flags:A.flags.length,afriOverall:A.afriOverall,references:A.inspo?A.inspo.count:0};
  if(A.inspo)currentProject.inspiration={referenceCount:A.inspo.count,areas:A.inspo.areas.map(a=>({area:a.area,items:a.items.map(r=>({title:r.t,brand:r.b,agency:r.ag||null,year:r.y,category:r.cat||null,relevance:r.rel,source:r.src,link:r.url}))})),opportunityGap:A.inspo.gap,learnFromBest:A.inspo.learn.map(g=>({group:g.group,items:g.items.map(r=>({title:r.t,brand:r.b,year:r.y,relevance:r.rel,link:r.url}))}))};
  currentProject.ideaScores=A.ideas.map(i=>({title:i.title,award:i.award,scores:i.scores}));
  currentProject.fullText=serialize(A,true);
  Store.saveProject(currentProject);
  if(typeof Usage!=="undefined")Usage.log("project-save",{title:currentProject.title});
  if(!silent)toast("Project saved");
}

/* (Single-provider enhancement removed — superseded by the AI Routing Engine in js/ai/router.js.) */

/* ---------------- EVENTS ---------------- */
function collectInputs(){
  const country=$("fCountry")?$("fCountry").value:"Global / Multi-market";
  const custom=$("fMarketCustom")?$("fMarketCustom").value.trim():"";
  return{
  brief:$("briefText").value.trim(),client:$("fClient").value.trim(),brand:$("fBrand").value.trim(),
  industry:$("fIndustry").value,
  market:country!=="Other"?country:(custom||""),region:$("fRegion")?$("fRegion").value:"Global",
  language:$("fLanguage")?$("fLanguage").value.trim():"",culture:$("fCulture")?$("fCulture").value.trim():"",
  maturity:$("fMaturity")?$("fMaturity").value:"",audType:$("fAudType")?$("fAudType").value:"",
  audience:$("fAudience").value.trim(),
  objective:$("fObjective").value,budget:$("fBudget").value,deadline:$("fDeadline").value,
  deliverables:$("fDeliverables").value.trim(),tone:$("fTone").value,channels:$("fChannels").value.trim(),
  model:$("fModel")?$("fModel").value:"local",mode:$("fMode")?$("fMode").value:"full",
  role:$("fRole")?$("fRole").value:"",roleCustom:$("fRoleCustom")?$("fRoleCustom").value.trim():"",
  agentMode:$("agentMode")?$("agentMode").checked:false}}
if($("fRole"))$("fRole").addEventListener("change",e=>{$("fRoleCustom").style.display=e.target.value==="Other (custom role)"?"block":"none"});

$("btnAnalyse").addEventListener("click",()=>onAnalyseClick());

/* ---------- STRATEGIC INTERROGATION (pre-analysis) ----------
   Before the engine runs, force the strategist through the questions a
   senior planner would ask. Answers become constraints on the analysis;
   blanks become red flags on the report. (js/interrogator.js) */
function onAnalyseClick(){
  const inp=collectInputs();
  if(!inp.brief){toast("Paste a brief first");$("briefText").focus();return}
  if(typeof Interrogator==="undefined"){generate(inp);return}
  const I=Interrogator.build(inp);
  if(!I.questions.length){generate(inp);return}
  window.__pendingInterro={inp,I};
  renderInterrogation(I);
  if(typeof Usage!=="undefined")Usage.log("interrogation",{market:inp.market,role:inp.role||"—",questions:I.questions.length});
}
function renderInterrogation(I){
  $("emptyState").style.display="none";
  const R=$("results");R.style.display="block";
  const wBadge=w=>`<span class="tag ${w==="high"?"amber":"lime"}" style="float:right">${w==="high"?"Must resolve":"Sharpen"}</span>`;
  const assumptions=I.embedded_assumptions.length?
    `<div style="font-family:var(--serif);font-size:16px;margin:6px 0 8px">Assumptions buried in this brief — you're carrying these whether you meant to or not</div>`+
    I.embedded_assumptions.map(a=>`<div class="flag med"><span class="sev">Assumption</span><div><b>${esc(a.assumption)}</b><div class="why">Found in the brief: ${esc(a.found_in_brief)}</div><div class="fix">Risk if wrong: ${esc(a.risk_if_wrong)}</div></div></div>`).join(""):"";
  const cards=I.questions.map(q=>`
    <div class="qcard" style="border:2px solid var(--ink);border-radius:16px;padding:16px 18px;margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:baseline">
        <span style="font-family:var(--mono,monospace);font-size:12px;font-weight:700;opacity:.55">${String(q.number).padStart(2,"0")}</span>
        <b style="font-family:var(--serif);font-size:17px;line-height:1.32;flex:1">${esc(q.question)}${wBadge(q.weight)}</b>
      </div>
      <div style="font-size:13px;color:var(--mute);margin:9px 0 0"><b style="color:var(--ink)">Why it matters — </b>${esc(q.why_it_matters)}</div>
      ${q.market_context?`<div style="font-size:12.5px;color:var(--mute);margin:5px 0 0;font-style:italic">${esc(q.market_context)}</div>`:""}
      <textarea data-interro-key="${esc(q.key)}" rows="2" placeholder="Your answer — or leave blank and it becomes a red flag on the report" style="width:100%;margin-top:11px;padding:10px 12px;border:2px solid var(--ink);border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:14px;resize:vertical"></textarea>
    </div>`).join("");
  const html=
    `<div class="sec" id="interroTop"><div class="sec-head"><span class="sec-num">00</span><h2>Before the analysis — think</h2></div>
      <p class="lede">${esc(I.next_step)}</p>
      ${I.role_specific_pressure?`<div class="flag high"><span class="sev">Your lane</span><div><div class="why" style="color:var(--bone)">${esc(I.role_specific_pressure)}</div></div></div>`:""}
      ${assumptions}
    </div>
    <div class="sec" id="interroQs"><div class="sec-head"><span class="sec-num">01</span><h2>${I.questions.length} questions a senior planner would ask</h2></div>
      <p class="lede">Tough but on your side. Answer what you can — every answer sharpens the analysis; every blank is flagged honestly rather than hidden.</p>
      ${cards}
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
        <button class="analyse-btn" id="btnRunInterro" style="flex:1;min-width:220px">Run analysis with my answers →</button>
        <button class="analyse-btn ghost" id="btnSkipInterro" style="flex:0 0 auto;background:transparent;color:var(--ink);border:2px solid var(--ink)">Skip — flag the gaps</button>
      </div>
    </div>`;
  R.innerHTML=html;
  $("btnRunInterro").addEventListener("click",()=>runInterrogation(false));
  $("btnSkipInterro").addEventListener("click",()=>runInterrogation(true));
  window.scrollTo({top:0,behavior:"smooth"});
}
function collectInterroAnswers(){
  const a={};
  document.querySelectorAll("[data-interro-key]").forEach(el=>{const v=el.value.trim();if(v)a[el.getAttribute("data-interro-key")]=v});
  return a;
}
function runInterrogation(skip){
  const P=window.__pendingInterro;if(!P)return;
  const answers=skip?{}:collectInterroAnswers();
  if(skip&&Object.keys(collectInterroAnswers()).length&&!confirm("You've written answers — skip anyway and flag every question as open?"))return;
  const interrogation={answers,questions:P.I.questions,embedded_assumptions:P.I.embedded_assumptions,role_specific_pressure:P.I.role_specific_pressure,skipped:!!skip};
  generate(P.inp,interrogation);
}

async function generate(inp,interrogation){
  inp=inp||collectInputs();
  if(!inp.brief){toast("Paste a brief first");$("briefText").focus();return}
  if(interrogation)inp.interrogation=interrogation;
  if(typeof Usage!=="undefined")Usage.log("analysis",{mode:inp.mode,model:inp.agentMode?"agents:"+inp.model:inp.model,market:inp.market,industry:inp.industry,role:inp.role||"—"});
  const btn=$("btnAnalyse");btn.disabled=true;btn.innerHTML=`<span class="spin"></span>Working…`;
  currentProject=null;
  try{
    if(inp.agentMode){ await generateAgents(inp); }
    else if(inp.model==="local"){
      await new Promise(r=>setTimeout(r,350));
      const A=analyse(inp); render(A); filterMode(inp.mode);
      window.__LAST={kind:"local",mode:inp.mode};
    }
    else if(inp.model==="briefiq-ai"){
      /* managed BriefIQ AI: routes through the serverless proxy (server re-verifies the plan).
         Works out of the box even before the backend is live — falls back to the offline engine. */
      if(window.BriefIQBackend && BriefIQBackend.aiProxy()){
        btn.innerHTML=`<span class="spin"></span>BriefIQ AI…`;
        const r=await BriefIQBackend.api("/api/ai",{method:"POST",body:{provider:"anthropic",system:SYSTEM_PROMPT,user:buildMasterPrompt(inp,inp.mode)}});
        if(r.ok && r.data && r.data.ok){ renderAIResults([AIRouter.normalise(r.data)],inp,false); window.__LAST={kind:"ai",mode:inp.mode}; }
        else { toast((r.data&&r.data.error)||"BriefIQ AI unavailable — using the offline engine"); const A=analyse(inp); render(A); filterMode(inp.mode); window.__LAST={kind:"local",mode:inp.mode}; }
      } else {
        toast("BriefIQ AI (managed) ships with the hosted plan — using the offline engine for now");
        await new Promise(r=>setTimeout(r,300));
        const A=analyse(inp); render(A); filterMode(inp.mode); window.__LAST={kind:"local",mode:inp.mode};
      }
    }
    else if(inp.model==="manual"){ openPromptModal(inp); }
    else if(inp.model==="compare"||inp.model==="all"){
      const ids=AIRouter.configured().map(p=>p.id);
      if(!ids.length){toast("No API keys configured — opening Manual Mode");openPromptModal(inp);}
      else{
        btn.innerHTML=`<span class="spin"></span>Asking ${ids.length} model${ids.length>1?"s":""}…`;
        const results=await AIRouter.compare(ids,inp,inp.mode);
        renderAIResults(results,inp,true);
      }
    }
    else{ /* single provider */
      if(!AIRouter.keys()[inp.model]){toast("No key for that model — opening Manual Mode");openPromptModal(inp);}
      else{
        btn.innerHTML=`<span class="spin"></span>Asking ${AIRouter.providers[inp.model].label}…`;
        const res=await AIRouter.run(inp.model,inp,inp.mode);
        renderAIResults([res],inp,false);
      }
    }
  }catch(e){console.error(e);toast("Something broke: "+e.message)}
  btn.disabled=false;btn.textContent="Analyse Brief";
}

$("optToggle").addEventListener("click",function(){this.classList.toggle("open");$("optFields").classList.toggle("show")});

$("btnSample").addEventListener("click",()=>{
  $("briefText").value=`Hi team, we need a big campaign for our new mobile savings product Chapaa Grow. We want to target everyone in Kenya especially young people. The product lets you save from as little as 10 bob and earn interest daily. We want it to go viral on TikTok and also build awareness and also drive downloads and sign-ups. We are thinking a TVC, radio, billboards, social media, influencers and an activation. Budget is tight so we need smart ideas. We want something like the Safaricom ads but fresher. Deadline is ASAP as the CEO wants to see it live before the board meeting. Also the logo should be prominent. We'll know a great idea when we see it. Make it award-winning!`;
  $("fClient").value="Chapaa Financial";$("fBrand").value="Chapaa Grow";$("fIndustry").value="Fintech / Banking";
  if($("fCountry"))$("fCountry").value="Kenya";
  $("optToggle").classList.add("open");$("optFields").classList.add("show");
  $("fAudience").value="Urban Gen Z & young hustlers, 18–28, Nairobi + Kisumu + Mombasa";
  toast("Sample brief loaded — note how messy it is on purpose");
});

$("btnNew").addEventListener("click",()=>{
  document.querySelectorAll("input,textarea").forEach(e=>{if(e.id!=="apiKey"&&e.type!=="date")e.value="";if(e.type==="date")e.value=""});
  document.querySelectorAll("select").forEach(s=>s.selectedIndex=0);
  $("results").style.display="none";$("emptyState").style.display="block";
  currentProject=null;window.scrollTo({top:0,behavior:"smooth"});
});

$("btnProjects").addEventListener("click",()=>{
  const list=Store.list();
  $("projList").innerHTML=list.length?list.map(p=>`<div class="proj-item" onclick="openProject('${p.id}')"><div><b>${esc(p.title||"Untitled")}</b><small>${new Date(p.updatedAt).toLocaleString()} · quality ${p.analysis?.quality??"–"}/100 · ${p.savedTerritories?.length||0} territories saved</small></div><button class="del" onclick="event.stopPropagation();delProject('${p.id}')">✕</button></div>`).join("")
  :`<p style="color:var(--mute)">No saved projects yet. Analyse a brief and hit “Save project”.</p>`;
  $("projModal").classList.add("show");
});
function openProject(id){
  const p=Store.get(id);if(!p)return;closeModals();
  const i=p.inputs;$("briefText").value=i.brief;$("fClient").value=i.client;$("fBrand").value=i.brand;
  $("fIndustry").value=i.industry;
  if($("fCountry")){
    const opts=[...$("fCountry").options].map(o=>o.value);
    if(opts.includes(i.market))$("fCountry").value=i.market;
    else{$("fCountry").value="Other";if($("fMarketCustom"))$("fMarketCustom").value=i.market||""}
    if(i.region&&$("fRegion"))$("fRegion").value=i.region;
    if($("fLanguage"))$("fLanguage").value=i.language||"";if($("fCulture"))$("fCulture").value=i.culture||"";
    if($("fMaturity"))$("fMaturity").value=i.maturity||"";if($("fAudType"))$("fAudType").value=i.audType||"";
  }
  $("fAudience").value=i.audience;
  $("fObjective").value=i.objective;$("fBudget").value=i.budget;$("fDeadline").value=i.deadline;
  $("fDeliverables").value=i.deliverables;$("fTone").value=i.tone;$("fChannels").value=i.channels;
  if(i.audience||i.budget){$("optToggle").classList.add("open");$("optFields").classList.add("show")}
  currentProject=p;
  render(analyse(i));
  toast("Project reopened & re-analysed");
}
function delProject(id){Store.del(id);$("btnProjects").click()}
function refreshKeyStatus(){
  const k=AIRouter.keys();
  document.querySelectorAll(".keyStatus").forEach(el=>{
    const on=!!k[el.dataset.p];
    el.textContent=on?"· CONNECTED":"· NOT CONNECTED";
    el.style.cssText="font-family:var(--mono,monospace);font-size:9px;letter-spacing:1px;margin-left:4px;color:"+(on?"#1E7D46":"#9a968b");
  });
  document.querySelectorAll(".keyRemove").forEach(b=>{ b.style.display=k[b.dataset.p]?"":"none"; });
}
function openSettings(){
  const k=AIRouter.keys();
  if($("keyOpenai"))$("keyOpenai").value=k.openai||"";
  if($("keyAnthropic"))$("keyAnthropic").value=k.anthropic||"";
  if($("keyGemini"))$("keyGemini").value=k.gemini||"";
  refreshKeyStatus();
  $("setModal").classList.add("show");
}
if($("btnSettings"))$("btnSettings").addEventListener("click",openSettings);
$("btnSaveKey").addEventListener("click",()=>{
  const k={};
  if($("keyOpenai")&&$("keyOpenai").value.trim())k.openai=$("keyOpenai").value.trim();
  if($("keyAnthropic")&&$("keyAnthropic").value.trim())k.anthropic=$("keyAnthropic").value.trim();
  if($("keyGemini")&&$("keyGemini").value.trim())k.gemini=$("keyGemini").value.trim();
  AIRouter.saveKeys(k);updateAiNote();refreshKeyStatus();closeModals();
  toast(Object.keys(k).length?`${Object.keys(k).length} model${Object.keys(k).length>1?"s":""} connected`:"No keys — built-in engine & Manual Mode active");
});
/* per-provider remove: wipe that one key from the browser immediately */
document.querySelectorAll(".keyRemove").forEach(b=>b.addEventListener("click",()=>{
  const p=b.dataset.p, k=AIRouter.keys(); delete k[p]; AIRouter.saveKeys(k);
  const inp=$("key"+p.charAt(0).toUpperCase()+p.slice(1)); if(inp)inp.value="";
  updateAiNote();refreshKeyStatus();
  toast((p==="openai"?"ChatGPT":p==="anthropic"?"Claude":"Gemini")+" key removed from this browser");
}));
function closeModals(){document.querySelectorAll(".modal-bg").forEach(m=>m.classList.remove("show"))}
document.querySelectorAll(".modal-bg").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModals()}));
function updateAiNote(){
  const c=AIRouter.configured();
  $("aiNote").innerHTML=c.length?`Engines: built-in + <span class="on">${c.map(p=>p.label.split(" (")[0]).join(" · ")}</span> connected · Manual Mode always available if a live call fails`:`Engine: built-in (offline) · Manual Mode — the always-works path for any AI · optional live keys in AI Settings`;
}
updateAiNote();

/* ---------------- MODE FILTERING (local engine) ---------------- */
const MODE_LOCAL_SECTIONS={
  full:null,
  insights:["constraints","rolelens","snapshot","marketintel","realask","bizproblem","commsproblem","audience","missing","questions","insights","deepinsights","evidence","confidenceaudit","inspiration","oppgap","learnbest","export"],
  campaigns:null,   /* Campaign mode outputs the FULL analysis — the campaign sections lead, but reasoning, evidence and prep all appear (user decision 2026-07-13) */
  brand:["constraints","rolelens","snapshot","marketintel","solutions","branding","insights","deepinsights","confidenceaudit","assumptionaudit","devilsadvocate","inspiration","oppgap","learnbest","export"],
  identity:["constraints","rolelens","snapshot","branding","identity","inspiration","oppgap","learnbest","export"],
  packaging:["constraints","rolelens","snapshot","marketintel","packaging","identity","inspiration","oppgap","learnbest","export"],
  social:["constraints","rolelens","snapshot","marketintel","insights","deepinsights","social","confidenceaudit","assumptionaudit","devilsadvocate","validationroadmap","inspiration","oppgap","learnbest","export"],
  influencer:["constraints","rolelens","snapshot","marketintel","social","influencers","assumptionaudit","devilsadvocate","validationroadmap","inspiration","oppgap","learnbest","export"],
  pitch:null,       /* Pitch mode outputs the FULL analysis too (user decision 2026-07-13) */
  budget:["constraints","rolelens","snapshot","marketintel","redflags","reality","budget","team","validationroadmap","export"],
  cases:["constraints","snapshot","evidence","confidenceaudit","inspiration","oppgap","learnbest","export"]
};
function filterMode(mode){
  const keep=MODE_LOCAL_SECTIONS[mode];
  if(!keep)return;
  document.querySelectorAll("#results .sec").forEach(s=>{if(!keep.includes(s.id))s.remove()});
  document.querySelectorAll("#results .secnav .chip").forEach(ch=>{
    const oc=ch.getAttribute("onclick")||"";
    if(!keep.some(id=>oc.includes(`'${id}'`)))ch.remove();
  });
}

/* ---------------- FILE UPLOAD (PDF / DOCX / TXT, all in-browser) ---------------- */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Couldn't load a helper library — check your internet connection."));document.head.appendChild(s)})}
async function extractUpload(f){
  const ext=(f.name.toLowerCase().split(".").pop()||"");
  if(f.size>15*1024*1024)throw new Error(`"${f.name}" is over 15 MB — split the document or export just the brief section.`);
  if(f.size===0)throw new Error(`"${f.name}" is empty (0 bytes).`);
  if(["txt","md","text","markdown"].includes(ext)){
    const t=await f.text();if(!t.trim())throw new Error("The file was read but contains no text.");return t;
  }
  if(ext==="pdf"){
    if(!window.pdfjsLib)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    let doc;
    try{doc=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise}
    catch(e){throw new Error(/password/i.test(String(e&&e.message))?"This PDF is password-protected. Remove the password and re-upload.":"Couldn't open this PDF — it may be corrupted. Try re-exporting it.")}
    let out="";
    for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);const c=await p.getTextContent();out+=c.items.map(it=>it.str||"").join(" ")+"\n\n"}
    if(!out.trim())throw new Error("This PDF has no extractable text — it's probably a scanned image. Run OCR on it or paste the text manually.");
    return out.replace(/[ \t]+/g," ").trim();
  }
  if(ext==="docx"){
    if(!window.mammoth)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
    let r;
    try{r=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()})}
    catch(e){throw new Error("Couldn't parse this DOCX — it may be corrupted or not a real Word file.")}
    if(!r.value.trim())throw new Error("No text found in this DOCX (is it all images?).");
    return r.value.trim();
  }
  if(ext==="doc")throw new Error("Legacy .doc isn't supported. In Word: File → Save As → .docx, then re-upload.");
  throw new Error(`Unsupported file type ".${ext}". Upload PDF, DOCX, TXT or MD.`);
}
async function handleUpload(f){
  if(!f)return;
  $("fileName").textContent="Extracting…";
  try{
    const text=await extractUpload(f);
    $("briefText").value=$("briefText").value.trim()?$("briefText").value+"\n\n"+text:text;
    $("fileName").textContent=f.name+" ✓";
    toast(`Extracted ${text.split(/\s+/).length.toLocaleString()} words from ${f.name}`);
  }catch(err){
    $("fileName").textContent="";
    toast("Upload failed");
    alert("Upload failed:\n\n"+err.message);
  }
  $("briefFile").value="";
}
$("briefFile").addEventListener("change",e=>handleUpload(e.target.files[0]));
/* drag & drop onto the brief textarea */
(()=>{const ta=$("briefText");if(!ta)return;
  ta.addEventListener("dragover",e=>{e.preventDefault();ta.style.borderColor="var(--lime)"});
  ta.addEventListener("dragleave",()=>ta.style.borderColor="");
  ta.addEventListener("drop",e=>{e.preventDefault();ta.style.borderColor="";if(e.dataTransfer.files&&e.dataTransfer.files[0])handleUpload(e.dataTransfer.files[0])});
})();

/* ---------------- MANUAL MODE / COPY PROMPT ---------------- */
function openPromptModal(inp){
  inp=inp||collectInputs();
  const p=buildManualPrompt(inp,inp.mode);
  $("promptText").value=p;
  $("promptMeta").textContent=`${OUTPUT_MODES[inp.mode].label} · ${p.length.toLocaleString()} chars`;
  $("promptModal").classList.add("show");
}
$("btnCopyPrompt").addEventListener("click",()=>{
  const inp=collectInputs();
  if(!inp.brief){toast("Paste a brief first");return}
  openPromptModal(inp);
});
$("btnCopyPromptModal").addEventListener("click",()=>{
  navigator.clipboard.writeText($("promptText").value).then(()=>toast("Prompt copied — paste into any AI tool"));
  logExport("copy-prompt");
});
$("btnRenderPaste").addEventListener("click",()=>{
  const raw=$("pasteBack").value.trim();
  if(!raw){toast("Paste the AI's response first");return}
  const json=AIRouter.parseJSON(raw);
  if(!json){toast("Couldn't parse that as JSON — check for extra text around it");return}
  closeModals();
  renderAIResults([{ok:true,provider:"manual",model:"pasted response",json,meta:{sections:Object.keys(json)}}],collectInputs(),false);
});

/* ---------------- AI RESULT RENDERING (normalised cards) ---------------- */
const CARD_GROUPS=[
  ["Diagnosis",["diagnosis","missing_info","client_questions"]],
  ["Insights",["insights"]],
  ["Strategy",["strategy"]],
  ["Brand",["brand"]],
  ["Design",["design","packaging"]],
  ["Social",["social"]],
  ["Influencers",["influencers"]],
  ["Campaign Ideas",["campaign_ideas","experiential_ideas","pr_ideas"]],
  ["References, Inspiration & Learning",["references","similar_work"]],
  ["Opportunity Gap",["opportunity_gap"]],
  ["Learn From The Best",["learn_from_best"]],
  ["Budget",["budget"]],
  ["Team",["team"]],
  ["Pitch Summary",["pitch_summary","cd_notes"]]
];
const human=k=>String(k).replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
function pretty(v,depth=0){
  if(v==null)return"";
  if(Array.isArray(v)){
    if(!v.length)return"";
    if(typeof v[0]==="object")return v.map(o=>`<div class="icard" style="margin-bottom:10px">${pretty(o,depth+1)}</div>`).join("");
    return `<ul class="clean">${v.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  }
  if(typeof v==="object"){
    return `<div class="kv" style="margin-bottom:6px">${Object.entries(v).map(([k,val])=>{
      const inner=(typeof val==="object")?pretty(val,depth+1):esc(String(val));
      return `<div class="k">${esc(human(k))}</div><div class="v">${inner}</div>`;
    }).join("")}</div>`;
  }
  return `<p>${esc(String(v))}</p>`;
}
function prettyRefs(refs){
  if(!Array.isArray(refs))return pretty(refs);
  return refs.map(r=>{
    const verified=r.link&&/^https?:\/\//i.test(r.link)&&!/verification/i.test(r.link);
    const url=verified?r.link:"https://www.google.com/search?q="+encodeURIComponent(r.search_for||`"${r.campaign_name||r.title||""}" ${r.brand||""} case study ${r.source||""}`);
    const rel=r.relevance_score||r.relevance;
    return `<a class="ref" href="${url}" target="_blank" rel="noopener"><b>${esc(r.campaign_name||r.title||"Untitled")}</b> — ${esc(r.brand||"")}${r.agency?` · ${esc(r.agency)}`:""}${r.year?", "+r.year:""} · <span class="src">${esc(r.source||"")}</span>${r.category?` <span class="tag" style="margin-left:6px">${esc(r.category)}</span>`:""}${rel?` <span class="tag ${rel>=80?"green":rel>=65?"lime":"amber"}" style="float:right">Relevance ${rel}%</span>`:""}
    ${verified?"":`<span class="tag amber" style="margin-left:8px">Link needs verification — opens search</span>`}
    ${r.summary?`<p>${esc(r.summary)}</p>`:""}<p>${esc(r.why_relevant||"")}</p>${r.what_worked?`<p><b>Worked:</b> ${esc(r.what_worked)}${r.what_failed_or_risked?` · <b>Failed / risked:</b> ${esc(r.what_failed_or_risked)}`:""}</p>`:""}<p class="take">${esc(r.key_learning||r.key_takeaway||"")}</p></a>`;
  }).join("");
}
function prettyGap(g){
  if(!g||typeof g!=="object")return pretty(g);
  const ul=a=>Array.isArray(a)?`<ul class="clean">${a.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:`<p>${esc(String(a||""))}</p>`;
  return `<b style="font-family:var(--serif)">Already common in the market</b>${ul(g.common_in_market||g.common)}
  <div style="height:10px"></div><b style="font-family:var(--serif)">Overused</b>${ul(g.overused)}
  <div style="height:10px"></div><b style="font-family:var(--serif)">Saturated territories</b>${ul(g.saturated_territories||g.saturated)}
  <div style="height:10px"></div><b style="font-family:var(--serif)">Underexplored territories</b>${ul(g.underexplored_territories||g.underexplored)}
  <div class="flag low" style="margin-top:12px"><span class="sev">Biggest opportunity</span><div><div class="why" style="color:var(--bone);font-size:14px">${esc(g.biggest_differentiation_opportunity||g.white||"")}</div></div></div>`;
}
function prettyLearn(groups){
  if(!Array.isArray(groups))return pretty(groups);
  return groups.map(g=>`<div style="margin-bottom:14px"><b style="font-family:var(--serif);font-size:15px">${esc(g.area||g.group||"")}</b>${prettyRefs(g.recommendations||g.items||[])}</div>`).join("");
}
function renderAIResults(results,inp,isCompare){
  $("emptyState").style.display="none";
  const R=$("results");R.style.display="block";
  let html="";
  if(isCompare&&results.length>1){
    html+=`<div class="sec"><div class="sec-head"><span class="sec-num">⇄</span><h2>Model Comparison — ${esc(OUTPUT_MODES[inp.mode].label)}</h2></div>
    <div class="tblwrap"><table><thead><tr><th>Model</th><th>Status</th><th>Sections returned</th><th>Ideas</th><th>References</th></tr></thead><tbody>
    ${results.map(r=>`<tr><td><b>${esc(AIRouter.providers[r.provider]?.label||r.provider)}</b><br><small style="color:var(--mute)">${esc(r.model||"")}</small></td>
    <td>${r.ok?'<span class="tag green">OK</span>':'<span class="tag red">Failed</span>'}</td>
    <td>${r.json?r.meta.sections.length:0}</td>
    <td>${r.json?.campaign_ideas?.length??"–"}</td><td>${r.json?.references?.length??"–"}</td></tr>`).join("")}
    </tbody></table></div>
    <p style="margin-top:10px;color:var(--mute);font-size:12.5px">Same master prompt, different brains. Scroll for each model's full output — disagreements between models are usually where the interesting thinking hides.</p></div>`;
  }
  results.forEach(r=>{
    const label=AIRouter.providers[r.provider]?.label||(r.provider==="manual"?"Manual Mode":r.provider);
    if(!r.ok&&!r.json){
      html+=`<div class="sec"><div class="sec-head"><span class="sec-num">✕</span><h2>${esc(label)}</h2></div>
      <div class="flag high"><span class="sev">Error</span><div><b>Request failed</b><div class="why">${esc(r.error||"Unknown error")}</div>
      <div class="fix">→ Manual Mode always works: click ⧉ Copy Prompt, paste it into the model's own site, then paste the JSON back here. (Also worth checking: the API key in AI Settings.)</div></div></div>
      ${r.text?`<pre style="white-space:pre-wrap;font-size:11px;color:var(--mute);margin-top:10px">${esc(r.text.slice(0,1500))}</pre>`:""}</div>`;
      return;
    }
    if(results.length>1||r.provider!=="local")html+=`<div class="sec" style="padding:16px 28px;border-color:var(--lime-dim)"><b style="font-family:var(--serif);font-size:18px">◉ ${esc(label)}</b> <span style="font-family:var(--mono);font-size:10px;color:var(--mute)">${esc(r.model||"")} · ${r.meta?.sections.length||0} sections</span></div>`;
    const j=r.json||{};
    CARD_GROUPS.forEach(([title,keys])=>{
      const present=keys.filter(k=>j[k]!=null);
      if(!present.length)return;
      html+=`<div class="sec"><div class="sec-head"><span class="sec-num">▸</span><h2>${esc(title)}</h2></div>
      ${present.map(k=>{
        const body=(k==="references"||k==="similar_work")?prettyRefs(j[k]):k==="opportunity_gap"?prettyGap(j[k]):k==="learn_from_best"?prettyLearn(j[k]):pretty(j[k]);
        return (present.length>1?`<b style="font-family:var(--serif);font-size:15px;display:block;margin:12px 0 8px">${esc(human(k))}</b>`:"")+body;
      }).join("")}</div>`;
    });
    // leftovers the model returned outside the schema
    const known=new Set(CARD_GROUPS.flatMap(g=>g[1]));
    Object.keys(j).filter(k=>!known.has(k)).forEach(k=>{
      html+=`<div class="sec"><div class="sec-head"><span class="sec-num">▸</span><h2>${esc(human(k))}</h2></div>${pretty(j[k])}</div>`;
    });
  });
  html+=`<div class="sec" id="export"><div class="sec-head"><span class="sec-num">↓</span><h2>Export & Save</h2></div>
  <div class="export-row">
  <button class="btn" onclick="copyAIResults()">⧉ Copy results</button>
  <button class="btn" onclick="downloadAIResults()">↓ Download (.txt)</button>
  <button class="btn primary" onclick="saveAIProject()">＋ Save project</button>
  </div></div>`;
  R.innerHTML=html;
  window.__AIRES={results,inp};window.__LAST={kind:"ai",mode:inp.mode};
  R.scrollIntoView({behavior:"smooth"});
}
function aiResultsText(){
  const {results,inp}=window.__AIRES;
  return results.map(r=>`=== ${AIRouter.providers[r.provider]?.label||r.provider} (${r.model||""}) — ${OUTPUT_MODES[inp.mode].label} ===\n`+(r.json?JSON.stringify(r.json,null,2):r.error||"")).join("\n\n");
}
function copyAIResults(){navigator.clipboard.writeText(aiResultsText()).then(()=>toast("Results copied"));logExport("copy-ai-results")}
function downloadAIResults(){download(`BriefIQ_${(window.__AIRES.inp.brand||"brief").split(/\s+/)[0]}_${window.__AIRES.inp.mode}.txt`,aiResultsText(),"text/plain");toast("Downloaded");logExport("download-ai-results")}
function saveAIProject(){
  const {results,inp}=window.__AIRES;
  currentProject=currentProject||{id:"p_"+Date.now().toString(36),userId:"local-user",createdAt:new Date().toISOString(),savedTerritories:[],exportHistory:[]};
  currentProject.title=`${inp.brand||inp.client||"Untitled"} — ${OUTPUT_MODES[inp.mode].label}`;
  currentProject.inputs=inp;
  currentProject.aiResults=results.map(r=>({provider:r.provider,model:r.model,ok:r.ok,json:r.json,error:r.error}));
  currentProject.analysis={mode:inp.mode,models:results.map(r=>r.provider)};
  Store.saveProject(currentProject);toast("Project saved");
}

/* ---------------- MULTI-AGENT MODE ---------------- */
async function generateAgents(inp){
  const btn=$("btnAnalyse");
  let data;
  const useAPI=inp.model!=="local"&&inp.model!=="manual"&&AIRouter.keys()[inp.model];
  if(useAPI){
    btn.innerHTML=`<span class="spin"></span>Convening the agency room (${AIRouter.providers[inp.model].label})…`;
    data=await AgentEngine.runAPI(inp.model,inp,AGENTS.map(a=>a.id));
    if(data.error){toast(data.error);data=null}
  }
  if(!data){
    btn.innerHTML=`<span class="spin"></span>Convening the agency room…`;
    await new Promise(r=>setTimeout(r,500));
    const A=analyse(inp);
    data=AgentEngine.runLocal(A);
    data.localAnalysis=A;
  }
  renderAgents(data,inp);
}
function renderAgents(data,inp){
  $("emptyState").style.display="none";
  const R=$("results");R.style.display="block";
  let html=`<div class="sec"><div class="sec-head"><span class="sec-num">☰</span><h2>The Agency Room — ${data.takes.length} specialists reviewed this brief</h2></div>
  <p class="lede">Source: ${esc(data.takes[0].source)}. Each specialist analysed the brief independently; the synthesis below shows where they agree, where they clash, and what only one of them saw.</p></div>`;
  // individual takes
  html+=`<div class="best3" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px">`+
  data.takes.map(t=>`<div class="bcard"><div class="rank">${t.agent.icon} ${esc(t.agent.name)}</div>
  ${kvRows([{k:"Recommends",v:t.out.recommendation},{k:"Biggest concern",v:t.out.top_concern},{k:"Sees that others miss",v:t.out.opportunity}])}</div>`).join("")+`</div>`;
  // synthesis
  const s=data.synth;
  html+=`<div class="sec"><div class="sec-head"><span class="sec-num">✓</span><h2>Consensus — the team agrees</h2></div><ul class="clean">${(s.consensus||[]).map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div>`;
  html+=`<div class="sec"><div class="sec-head"><span class="sec-num">⚡</span><h2>Disagreements — productive tension</h2></div>${(s.disagreements||[]).map(d=>`<div class="chal"><b>${esc(d.a)} vs ${esc(d.b)}</b><p>${esc(d.issue)}</p></div>`).join("")||"<p>No major clashes recorded.</p>"}</div>`;
  html+=`<div class="sec"><div class="sec-head"><span class="sec-num">◎</span><h2>Blind spots — what only one agent saw</h2></div><ul class="clean">${(s.blindspots||[]).map(b=>`<li>${esc(b)}</li>`).join("")}</ul></div>`;
  if(data.localAnalysis)html+=`<div class="sec" style="text-align:center;padding:20px"><button class="btn primary" onclick="render(window.__AGENTA);filterMode('${inp.mode}')">Open the full ${esc(OUTPUT_MODES[inp.mode].label)} behind this review →</button></div>`;
  html+=`<div class="sec" id="export"><div class="sec-head"><span class="sec-num">↓</span><h2>Export & Save</h2></div>
  <div class="export-row"><button class="btn" onclick="copyAgents()">⧉ Copy review</button><button class="btn primary" onclick="saveAgentProject()">＋ Save project</button></div></div>`;
  R.innerHTML=html;
  window.__AGENTS={data,inp};if(data.localAnalysis)window.__AGENTA=data.localAnalysis;
  R.scrollIntoView({behavior:"smooth"});
}
function agentsText(){
  const {data,inp}=window.__AGENTS;
  return `BRIEFIQ AGENCY ROOM — ${inp.brand||inp.client||"Untitled"}\n\n`+
  data.takes.map(t=>`${t.agent.name.toUpperCase()}\n• Recommends: ${t.out.recommendation}\n• Concern: ${t.out.top_concern}\n• Unique angle: ${t.out.opportunity}`).join("\n\n")+
  `\n\nCONSENSUS\n${(data.synth.consensus||[]).map(c=>"• "+c).join("\n")}\n\nDISAGREEMENTS\n${(data.synth.disagreements||[]).map(d=>`• ${d.a} vs ${d.b}: ${d.issue}`).join("\n")}\n\nBLIND SPOTS\n${(data.synth.blindspots||[]).map(b=>"• "+b).join("\n")}`;
}
function copyAgents(){navigator.clipboard.writeText(agentsText()).then(()=>toast("Review copied"));logExport("copy-agents")}
function saveAgentProject(){
  const {data,inp}=window.__AGENTS;
  currentProject=currentProject||{id:"p_"+Date.now().toString(36),userId:"local-user",createdAt:new Date().toISOString(),savedTerritories:[],exportHistory:[]};
  currentProject.title=`${inp.brand||inp.client||"Untitled"} — Agency Room review`;
  currentProject.inputs=inp;
  currentProject.agentReview={takes:data.takes.map(t=>({agent:t.agent.name,out:t.out})),synth:data.synth};
  Store.saveProject(currentProject);toast("Project saved");
}

/* ---------------- BRAND SETTINGS ---------------- */
if($("btnBrand")){
  $("btnBrand").addEventListener("click",()=>{
    const b=Brand.get();
    $("bName").value=b.name;$("bLogo").value=b.logoText;$("bTagline").value=b.tagline;
    $("bAccent").value=b.accent;$("bButton").value=b.button;$("bFont").value=b.font;
    $("bHero").value=b.heroTitle;$("bHeroSub").value=b.heroSub;$("bPricing").value=b.pricingLede;
    const pick=$("bPick");
    if(pick.options.length<=1)NAME_OPTIONS.forEach((n,i)=>{const o=document.createElement("option");o.value=i;o.textContent=`${n.name} — ${n.tag}`;pick.appendChild(o)});
    $("brandModal").classList.add("show");
  });
  $("bPick").addEventListener("change",e=>{
    const n=NAME_OPTIONS[e.target.value];if(!n)return;
    $("bName").value=n.name;$("bLogo").value=n.name;$("bTagline").value=n.tag;
  });
  $("btnBrandSave").addEventListener("click",()=>{
    Brand.save({name:$("bName").value.trim()||"BriefIQ",logoText:$("bLogo").value.trim()||$("bName").value.trim(),
      tagline:$("bTagline").value.trim(),accent:$("bAccent").value,button:$("bButton").value,font:$("bFont").value,
      heroTitle:$("bHero").value.trim(),heroSub:$("bHeroSub").value.trim(),pricingLede:$("bPricing").value.trim()});
    closeModals();toast("Brand updated — applies across the whole app");
  });
  $("btnBrandReset").addEventListener("click",()=>{Brand.reset();closeModals();toast("Brand reset to defaults")});
}

/* ---------------- DEEP LINK (Owner Dashboard → open project) ---------------- */
(()=>{try{
  const pid=new URLSearchParams(location.search).get("project");
  if(pid&&Store.get(pid))openProject(pid);
}catch(e){}})();

/* ---------------- SECTION COLLAPSE (scan long outputs) ---------------- */
document.addEventListener("click",e=>{
  const h=e.target.closest(".sec-head");
  if(h&&h.parentElement.classList.contains("sec")&&!e.target.closest("button,a"))
    h.parentElement.classList.toggle("collapsed");
});
