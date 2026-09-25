import { describe, it, expect } from "vitest";
import { EvidenceLedger } from "../src/evidence.js";
import {
  groundFindings, mergeFindings, overallScore, ruleFindings, scoreDimensions, sortFindings,
} from "../src/scoring.js";
import type { Finding } from "../src/types.js";

const f = (over: Partial<Finding>): Finding => ({
  title: "Finding",
  dimension: "security",
  severity: "medium",
  description: "d",
  evidenceIds: ["SEC-001"],
  recommendation: "r",
  effort: "S",
  ...over,
});

describe("ruleFindings", () => {
  it("turns scanner flags into findings citing their evidence", () => {
    const ledger = new EvidenceLedger();
    ledger.add({ dimension: "security", kind: "secrets", summary: "2 secrets", flag: { severity: "critical", title: "Secrets", recommendation: "Rotate", effort: "S" } });
    ledger.add({ dimension: "architecture", kind: "languages", summary: "TS" });
    const rules = ruleFindings(ledger.all());
    expect(rules).toEqual([f({ title: "Secrets", severity: "critical", description: "2 secrets", recommendation: "Rotate" })]);
  });
});

describe("groundFindings", () => {
  it("drops unknown ids and findings left without evidence", () => {
    const ledger = new EvidenceLedger();
    ledger.add({ dimension: "security", kind: "k", summary: "s" }); // SEC-001
    const { kept, dropped } = groundFindings(
      [f({ evidenceIds: ["SEC-001", "FAKE-9"] }), f({ evidenceIds: ["NOPE-1"] })],
      ledger,
    );
    expect(kept).toEqual([f({ evidenceIds: ["SEC-001"] })]);
    expect(dropped).toBe(1);
  });
});

describe("mergeFindings", () => {
  it("adds critical/high rule findings the model ignored", () => {
    const rule = f({ title: "Secrets", severity: "critical" });
    const merged = mergeFindings([rule], [f({ title: "Other", evidenceIds: ["SEC-002"] })]);
    expect(merged.map((x) => x.title)).toEqual(["Other", "Secrets"]);
  });

  it("raises a model finding's severity to the rule floor instead of duplicating", () => {
    const merged = mergeFindings([f({ severity: "high" })], [f({ title: "Richer", severity: "low" })]);
    expect(merged).toEqual([f({ title: "Richer", severity: "high" })]);
  });

  it("does not force medium/low rule findings in", () => {
    expect(mergeFindings([f({ severity: "medium" })], [])).toEqual([]);
  });
});

describe("scoring", () => {
  it("scores dimensions from severity penalties", () => {
    const scores = scoreDimensions([f({ severity: "high" }), f({ severity: "medium" })]);
    const sec = scores.find((s) => s.dimension === "security")!;
    expect(sec).toEqual({ dimension: "security", score: 79, rag: "amber", findingCount: 2 });
    expect(scores.find((s) => s.dimension === "architecture")).toEqual({ dimension: "architecture", score: 100, rag: "green", findingCount: 0 });
  });

  it("any critical makes the dimension and the overall red", () => {
    const findings = [f({ severity: "critical" })];
    const scores = scoreDimensions(findings);
    expect(scores.find((s) => s.dimension === "security")!.rag).toBe("red");
    expect(overallScore(scores, findings)).toEqual({ score: 93, rag: "red" });
  });

  it("sorts findings by severity, most severe first", () => {
    const sorted = sortFindings([f({ severity: "low" }), f({ severity: "critical" }), f({ severity: "info" })]);
    expect(sorted.map((x) => x.severity)).toEqual(["critical", "low", "info"]);
  });
});
