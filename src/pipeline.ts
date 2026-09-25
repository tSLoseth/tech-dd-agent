import type { Usage } from "ensemble";
import { runSpecialist, type AgentOptions } from "./agents/specialists.js";
import { runSynthesis } from "./agents/synthesis.js";
import { buildInventory, languageStats, makeReader } from "./inventory.js";
import { collectEvidence } from "./scanners/index.js";
import { combineFindings, groundFindings, overallScore, ruleFindings, scoreDimensions, sortFindings } from "./scoring.js";
import { DIMENSIONS, type Finding, type Report } from "./types.js";

export interface PipelineOptions extends AgentOptions {
  root: string;
  target: string;
  mode: "full" | "offline";
  concurrency?: number;
  now?: Date;
}

export async function runDueDiligence(opts: PipelineOptions): Promise<Report> {
  const inventory = buildInventory(opts.root);
  const ledger = collectEvidence({ inventory, read: makeReader(inventory) });
  const usage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const addUsage = (u: Usage) => {
    usage.inputTokens += u.inputTokens;
    usage.outputTokens += u.outputTokens;
    usage.costUsd += u.costUsd;
  };

  const rules = ruleFindings(ledger.all());
  let findings: Finding[] = rules;
  let droppedFindings = 0;

  if (opts.mode === "full") {
    const results = await mapLimit(DIMENSIONS, opts.concurrency ?? DIMENSIONS.length, (d) =>
      runSpecialist(d, inventory, ledger, opts),
    );
    results.forEach((r) => addUsage(r.usage));
    const grounded = groundFindings(results.flatMap((r) => r.findings), ledger);
    droppedFindings = grounded.dropped;
    findings = combineFindings(rules, grounded.kept, ledger);
  }

  findings = sortFindings(findings);
  const scores = scoreDimensions(findings);
  const overall = overallScore(scores, findings);

  let summary: Report["summary"] = null;
  if (opts.mode === "full") {
    const synthesis = await runSynthesis(opts.target, findings, scores, overall, opts);
    summary = synthesis.summary;
    addUsage(synthesis.usage);
  }

  const languages = languageStats(inventory);
  return {
    target: opts.target,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    mode: opts.mode,
    model: opts.mode === "full" ? opts.model : null,
    stats: {
      files: inventory.files.length,
      lines: Object.values(languages).reduce((a, b) => a + b, 0),
      languages,
    },
    evidence: ledger.all(),
    findings,
    droppedFindings,
    scores,
    overall,
    summary,
    usage,
  };
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const lane = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, lane));
  return out;
}
