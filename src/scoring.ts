import type { EvidenceLedger } from "./evidence.js";
import { DIMENSIONS, type DimensionScore, type Evidence, type Finding, type Rag, type Severity } from "./types.js";

export const PENALTY: Record<Severity, number> = { critical: 35, high: 15, medium: 6, low: 2, info: 0 };
const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const FLOOR_RANK = RANK.high;

export function ruleFindings(evidence: Evidence[]): Finding[] {
  return evidence
    .filter((e) => e.flag)
    .map((e) => ({
      title: e.flag!.title,
      dimension: e.dimension,
      severity: e.flag!.severity,
      description: e.summary,
      evidenceIds: [e.id],
      recommendation: e.flag!.recommendation,
      effort: e.flag!.effort,
    }));
}

export function groundFindings(findings: Finding[], ledger: EvidenceLedger): { kept: Finding[]; dropped: number } {
  const kept: Finding[] = [];
  let dropped = 0;
  for (const finding of findings) {
    const evidenceIds = finding.evidenceIds.filter((id) => ledger.has(id));
    if (evidenceIds.length === 0) dropped++;
    else kept.push({ ...finding, evidenceIds });
  }
  return { kept, dropped };
}

// Critical/high scanner flags are facts the model may enrich but not remove.
export function mergeFindings(rule: Finding[], model: Finding[]): Finding[] {
  const out = model.map((f) => ({ ...f }));
  for (const r of rule.filter((x) => RANK[x.severity] >= FLOOR_RANK)) {
    const match = out.find((f) => f.dimension === r.dimension && f.evidenceIds.includes(r.evidenceIds[0]!));
    if (match) {
      if (RANK[r.severity] > RANK[match.severity]) match.severity = r.severity;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

// A finding that cites another dimension's scanner evidence is dropped when that dimension already reports it,
// so one fact (e.g. dormancy) is not penalised in several dimensions.
export function dedupeAcrossDimensions(findings: Finding[], ledger: EvidenceLedger): Finding[] {
  return findings.filter((finding) =>
    !finding.evidenceIds.some((id) => {
      const e = ledger.get(id);
      if (!e || e.id.startsWith("READ-") || e.dimension === finding.dimension) return false;
      return findings.some((o) => o !== finding && o.dimension === e.dimension && o.evidenceIds.includes(id));
    }),
  );
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

function ragFor(score: number, hasCritical: boolean): Rag {
  if (hasCritical) return "red";
  if (score >= 80) return "green";
  if (score >= 55) return "amber";
  return "red";
}

export function scoreDimensions(findings: Finding[]): DimensionScore[] {
  return DIMENSIONS.map((dimension) => {
    const own = findings.filter((f) => f.dimension === dimension);
    const score = Math.max(0, 100 - own.reduce((sum, f) => sum + PENALTY[f.severity], 0));
    return { dimension, score, rag: ragFor(score, own.some((f) => f.severity === "critical")), findingCount: own.length };
  });
}

export function overallScore(scores: DimensionScore[], findings: Finding[]): { score: number; rag: Rag } {
  const score = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
  return { score, rag: ragFor(score, findings.some((f) => f.severity === "critical")) };
}
