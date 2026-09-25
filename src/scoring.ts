import type { EvidenceLedger } from "./evidence.js";
import { DIMENSIONS, type Dimension, type DimensionScore, type Evidence, type Finding, type Rag, type Severity } from "./types.js";

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
    // A file read by one specialist is not evidence for another specialist's finding.
    const evidenceIds = finding.evidenceIds.filter((id) => {
      const e = ledger.get(id);
      return e !== undefined && (!id.startsWith("READ-") || e.dimension === finding.dimension);
    });
    if (evidenceIds.length === 0) dropped++;
    else kept.push({ ...finding, evidenceIds });
  }
  return { kept, dropped };
}

// Critical/high scanner flags are facts the model may enrich but not remove. Each flag needs its own model finding,
// so one broad finding cannot absorb several flags and hide all but one of them.
export function mergeFindings(rule: Finding[], model: Finding[]): Finding[] {
  const out = model.map((f) => ({ ...f }));
  const absorbed = new Set<Finding>();
  for (const r of rule.filter((x) => RANK[x.severity] >= FLOOR_RANK)) {
    const match = out.find((f) => !absorbed.has(f) && f.dimension === r.dimension && f.evidenceIds.includes(r.evidenceIds[0]!));
    if (match) {
      absorbed.add(match);
      if (RANK[r.severity] > RANK[match.severity]) match.severity = r.severity;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

// A finding is a cross-dimension duplicate when it cites no scanner evidence of its own dimension and every foreign
// scanner citation is already covered by a kept finding in the owning dimension, so one fact is penalised once.
export function dedupeAcrossDimensions(findings: Finding[], ledger: EvidenceLedger): Finding[] {
  const kept = new Set(findings);
  for (const finding of findings) {
    const scanner = finding.evidenceIds.map((id) => ledger.get(id)).filter((e): e is Evidence => !!e && !e.id.startsWith("READ-"));
    const foreign = scanner.filter((e) => e.dimension !== finding.dimension);
    if (foreign.length === 0 || foreign.length < scanner.length) continue;
    const covered = foreign.every((e) =>
      [...kept].some((o) => o !== finding && o.dimension === e.dimension && o.evidenceIds.includes(e.id)),
    );
    if (covered) kept.delete(finding);
  }
  return findings.filter((f) => kept.has(f));
}

// Dedupe first, rule floor last: a critical/high scanner flag can never be removed by the dedupe.
export function combineFindings(rule: Finding[], model: Finding[], ledger: EvidenceLedger): { findings: Finding[]; deduped: number } {
  const unique = dedupeAcrossDimensions(model, ledger);
  return { findings: mergeFindings(rule, unique), deduped: model.length - unique.length };
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

export function scoreDimensions(findings: Finding[], failed: readonly Dimension[] = []): DimensionScore[] {
  return DIMENSIONS.map((dimension) => {
    const own = findings.filter((f) => f.dimension === dimension);
    const score = Math.max(0, 100 - own.reduce((sum, f) => sum + PENALTY[f.severity], 0));
    const assessed = !failed.includes(dimension);
    const rag = ragFor(score, own.some((f) => f.severity === "critical"));
    return { dimension, score, rag: assessed || rag !== "green" ? rag : "amber", findingCount: own.length, assessed };
  });
}

// Not-assessed dimensions are left out of the mean, and an incomplete review is never rated green.
export function overallScore(scores: DimensionScore[], findings: Finding[]): { score: number; rag: Rag } {
  const assessed = scores.filter((s) => s.assessed);
  const score = Math.round(assessed.reduce((sum, s) => sum + s.score, 0) / Math.max(1, assessed.length));
  const rag = ragFor(score, findings.some((f) => f.severity === "critical"));
  return { score, rag: rag === "green" && assessed.length < scores.length ? "amber" : rag };
}
