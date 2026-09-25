import type { Report } from "../types.js";
import { DIMENSION_LABEL, RAG_LABEL, failedNote, plural } from "./labels.js";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

const CSS = `:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--card:#fff;--line:#e7e5e4;--green:#15803d;--amber:#b45309;--red:#b91c1c}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#f5f5f4;--muted:#a8a29e;--card:#292524;--line:#44403c;--green:#4ade80;--amber:#fbbf24;--red:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 16px}h1{margin:.2em 0}h2{margin-top:2em;font-size:1.1rem}
.eyebrow,.meta{color:var(--muted);font-size:.85rem;margin:0}
.overall{font-size:3rem;font-weight:700;margin:12px 0}.overall span{font-size:1rem;color:var(--muted)}
.green{color:var(--green)}.na{color:var(--muted)}.amber{color:var(--amber)}.red{color:var(--red)}.headline{font-size:1.15rem;font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-top:4px solid currentColor;border-radius:8px;padding:12px}
.card .label{color:var(--fg);font-size:.85rem}.card .score{font-size:2rem;font-weight:700}
.table{overflow-x:auto}table{width:100%;border-collapse:collapse;background:var(--card)}
td,th{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
.sev{font-size:.75rem;font-weight:700;text-transform:uppercase}.sev.critical,.sev.high{color:var(--red)}.sev.medium{color:var(--amber)}.sev.low,.sev.info{color:var(--muted)}
.evidence li{margin:6px 0}pre{white-space:pre-wrap;font-size:.8rem;color:var(--muted);margin:4px 0}a{color:inherit}`;

const list = (title: string, items: string[]): string =>
  items.length ? `<section><h2>${title}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>` : "";

export function renderHtml(r: Report): string {
  const summary = r.summary
    ? `<p class="headline">${esc(r.summary.headline)}</p>${list("Red flags", r.summary.redFlags)}${list("Value-creation levers", r.summary.valueLevers)}${list("100-day plan", r.summary.hundredDayPlan)}`
    : `<p class="headline">Offline mode — deterministic scanner findings only.</p>`;

  const cards = r.scores
    .map((s) => `<div class="card ${s.assessed ? s.rag : "na"}"><div class="label">${esc(DIMENSION_LABEL[s.dimension])}</div><div class="score">${s.assessed ? s.score : "—"}</div><div class="meta">${s.assessed ? RAG_LABEL[s.rag] : "Not assessed"} · ${plural(s.findingCount, "finding")}</div></div>`)
    .join("");
  const failed = r.failedDimensions.length ? `<p class="meta"><strong>Not assessed:</strong> ${esc(failedNote(r.failedDimensions))}</p>` : "";
  const modelNote = r.mode === "full"
    ? `${plural(r.droppedFindings, "model finding")} discarded for citing non-existent evidence; ${plural(r.dedupedFindings, "finding")} removed as ${r.dedupedFindings === 1 ? "a cross-dimension duplicate" : "cross-dimension duplicates"}. `
    : "";

  const rows = r.findings
    .map((f) => `<tr><td><span class="sev ${f.severity}">${f.severity}</span></td><td>${esc(DIMENSION_LABEL[f.dimension])}</td><td><strong>${esc(f.title)}</strong><br>${esc(f.description)}<br><em>${esc(f.recommendation)}</em></td><td>${f.effort}</td><td>${f.evidenceIds.map((id) => `<a href="#ev-${esc(id)}">${esc(id)}</a>`).join(" ")}</td></tr>`)
    .join("");

  const evidence = r.evidence
    .map((e) => `<li id="ev-${esc(e.id)}"><code>${esc(e.id)}</code> ${esc(e.summary)}${e.detail ? `<pre>${esc(e.detail)}</pre>` : ""}</li>`)
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tech DD — ${esc(r.target)}</title><style>${CSS}</style></head><body><main>
<header><p class="eyebrow">Technology due diligence</p><h1>${esc(r.target)}</h1>
<p class="meta">Generated ${esc(r.generatedAt)} · ${r.mode}${r.model ? ` · ${esc(r.model)}` : ""} · ${r.stats.files} files · $${r.usage.costUsd.toFixed(4)}</p>
<div class="overall ${r.overall.rag}">${r.overall.score}<span>/100</span></div></header>
${summary}
<section><h2>Scorecard</h2><div class="cards">${cards}</div>${failed}</section>
<section><h2>Findings</h2><div class="table"><table><thead><tr><th>Severity</th><th>Dimension</th><th>Finding</th><th>Effort</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<section><h2>Evidence</h2><ul class="evidence">${evidence}</ul></section>
<p class="meta">${modelNote}Scores are deterministic from severity penalties.</p>
</main></body></html>`;
}
