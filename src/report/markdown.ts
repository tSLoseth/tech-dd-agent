import { PENALTY } from "../scoring.js";
import { DIMENSIONS, type Report } from "../types.js";
import { DIMENSION_LABEL, RAG_LABEL, failedNote, plural } from "./labels.js";

const bullets = (items: string[]): string[] => (items.length ? items.map((i) => `- ${i}`) : ["- None identified"]);

export function renderMarkdown(r: Report): string {
  const L: string[] = [];
  L.push(`# Technology due diligence — ${r.target}`, "");
  L.push(`_Generated ${r.generatedAt} · mode: ${r.mode}${r.model ? ` · model: ${r.model}` : ""} · ${r.stats.files} files, ${r.stats.lines.toLocaleString("en-US")} lines of code_`, "");
  L.push(`**Overall: ${r.overall.score}/100 — ${RAG_LABEL[r.overall.rag]}**`, "");

  if (r.summary) {
    L.push(`> ${r.summary.headline}`, "");
    L.push("## Red flags", "", ...bullets(r.summary.redFlags), "");
    L.push("## Value-creation levers", "", ...bullets(r.summary.valueLevers), "");
    L.push("## 100-day plan", "", ...r.summary.hundredDayPlan.map((s, i) => `${i + 1}. ${s}`), "");
  } else {
    L.push("> Offline mode: findings come from the deterministic scanners only. Run without `--offline` for the specialist review and executive summary.", "");
  }

  L.push("## Scorecard", "", "| Dimension | Score | Status | Findings |", "|---|---:|:---:|---:|");
  for (const s of r.scores) {
    L.push(`| ${DIMENSION_LABEL[s.dimension]} | ${s.assessed ? s.score : "—"} | ${s.assessed ? RAG_LABEL[s.rag] : "Not assessed"} | ${s.findingCount} |`);
  }
  L.push("");
  if (r.failedDimensions.length) L.push(`> **Not assessed:** ${failedNote(r.failedDimensions)}`, "");

  L.push("## Findings", "");
  for (const d of DIMENSIONS) {
    const own = r.findings.filter((f) => f.dimension === d);
    if (own.length === 0) continue;
    L.push(`### ${DIMENSION_LABEL[d]}`, "");
    for (const f of own) {
      L.push(`- **[${f.severity.toUpperCase()}] ${f.title}** (effort ${f.effort}) — ${f.description}`);
      L.push(`  - Recommendation: ${f.recommendation}`);
      L.push(`  - Evidence: ${f.evidenceIds.map((id) => `\`${id}\``).join(", ")}`);
    }
    L.push("");
  }

  L.push("## Evidence", "");
  for (const e of r.evidence) {
    L.push(`- \`${e.id}\` ${e.summary}${e.files?.length ? ` — ${e.files.slice(0, 5).join(", ")}` : ""}`);
  }
  L.push("");

  const penalties = Object.entries(PENALTY).filter(([, p]) => p > 0).map(([s, p]) => `${s} −${p}`).join(", ");
  L.push("## Method", "");
  const was = (n: number) => (n === 1 ? "was" : "were");
  const modelNote = r.mode === "full"
    ? ` ${plural(r.droppedFindings, "model finding")} ${was(r.droppedFindings)} discarded for citing evidence that does not exist, and ${plural(r.dedupedFindings, "finding")} ${was(r.dedupedFindings)} removed as ${r.dedupedFindings === 1 ? "a cross-dimension duplicate" : "cross-dimension duplicates"}.`
    : "";
  L.push(`Scores are computed deterministically from the findings (${penalties}; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened.${modelNote} Critical and high scanner flags cannot be removed by the model. Cost: $${r.usage.costUsd.toFixed(4)} (${(r.usage.inputTokens + r.usage.outputTokens).toLocaleString("en-US")} tokens).`);
  return `${L.join("\n")}\n`;
}
