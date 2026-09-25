import type { Usage } from "ensemble";
import { runSpecialist, type AgentOptions } from "./agents/specialists.js";
import { runSynthesis } from "./agents/synthesis.js";
import { buildInventory, languageStats, makeReader } from "./inventory.js";
import { collectEvidence } from "./scanners/index.js";
import { redactSecrets } from "./scanners/security.js";
import {
  capTeamHistory, combineFindings, dropContradictedStrengths, groundFindings, overallScore, ruleFindings, scoreDimensions, sortFindings,
  stripSeverityWord,
} from "./scoring.js";
import { DIMENSIONS, type Dimension, type Finding, type Report, type Summary } from "./types.js";

export interface PipelineOptions extends AgentOptions {
  root: string;
  target: string;
  mode: "full" | "offline";
  concurrency?: number;
  now?: Date;
  onDimensionError?: (dimension: Dimension, err: unknown) => void;
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
  let dedupedFindings = 0;
  const failedDimensions: Dimension[] = [];

  if (opts.mode === "full") {
    const results = await mapLimit(DIMENSIONS, opts.concurrency ?? DIMENSIONS.length, (d) =>
      runSpecialist(d, inventory, ledger, opts).catch((err: unknown) => {
        opts.onDimensionError?.(d, err);
        failedDimensions.push(d);
        return null;
      }),
    );
    const ok = results.filter((r) => r !== null);
    if (ok.length === 0) throw new Error("All specialists failed; no report was written.");
    ok.forEach((r) => addUsage(r.usage));
    const grounded = groundFindings(ok.flatMap((r) => r.findings).map(cleanFinding), ledger);
    droppedFindings = grounded.dropped;
    const calibrated = dropContradictedStrengths(capTeamHistory(grounded.kept, ledger), ledger);
    const combined = combineFindings(rules, calibrated, ledger);
    findings = combined.findings;
    dedupedFindings = combined.deduped;
  }
  failedDimensions.sort((a, b) => DIMENSIONS.indexOf(a) - DIMENSIONS.indexOf(b));

  findings = sortFindings(findings);
  const scores = scoreDimensions(findings, failedDimensions);
  const overall = overallScore(scores, findings);

  let summary: Report["summary"] = null;
  if (opts.mode === "full") {
    const synthesis = await runSynthesis(opts.target, findings, scores, overall, opts);
    summary = redactSummary(synthesis.summary);
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
    dedupedFindings,
    failedDimensions,
    scores,
    overall,
    summary,
    usage,
  };
}

// The tools already redact what agents see; this scrubs model-written text once more before it reaches a report.
const cleanFinding = (f: Finding): Finding => ({
  ...f,
  title: stripSeverityWord(redactSecrets(f.title)),
  description: redactSecrets(f.description),
  recommendation: redactSecrets(f.recommendation),
});

const redactSummary = (s: Summary): Summary => ({
  headline: redactSecrets(s.headline),
  redFlags: s.redFlags.map(redactSecrets),
  valueLevers: s.valueLevers.map(redactSecrets),
  hundredDayPlan: s.hundredDayPlan.map(redactSecrets),
});

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
