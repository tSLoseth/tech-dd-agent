import { describe, it, expect } from "vitest";
import { EvidenceLedger } from "../src/evidence.js";
import {
  combineFindings, dedupeAcrossDimensions, groundFindings, mergeFindings, overallScore, ruleFindings, scoreDimensions, sortFindings,
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

  it("counts READ evidence only for the dimension whose agent registered it", () => {
    const ledger = new EvidenceLedger();
    ledger.add({ dimension: "code_quality", kind: "file_read", summary: "read" }, "READ"); // READ-001
    ledger.add({ dimension: "security", kind: "file_read", summary: "read" }, "READ"); // READ-002
    const { kept, dropped } = groundFindings(
      [f({ evidenceIds: ["READ-001", "READ-002"] }), f({ title: "Borrowed", evidenceIds: ["READ-001"] })],
      ledger,
    );
    expect(kept).toEqual([f({ evidenceIds: ["READ-002"] })]);
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

  it("does not let a finding from another dimension absorb a rule finding", () => {
    const rule = f({ title: "Secrets", severity: "critical" });
    const arch = f({ title: "Arch", dimension: "architecture", severity: "low" });
    const merged = mergeFindings([rule], [arch]);
    expect(merged).toEqual([arch, rule]);
  });

  it("lets one model finding absorb only one rule flag", () => {
    const secrets = f({ title: "Secrets", severity: "critical", evidenceIds: ["SEC-001"] });
    const env = f({ title: "Env files", severity: "high", evidenceIds: ["SEC-002"] });
    const model = f({ title: "Credential hygiene", severity: "medium", evidenceIds: ["SEC-001", "SEC-002"] });
    const merged = mergeFindings([secrets, env], [model]);
    expect(merged).toEqual([{ ...model, severity: "critical" }, env]);
  });

  it("does not force medium/low rule findings in", () => {
    expect(mergeFindings([f({ severity: "medium" })], [])).toEqual([]);
  });
});

describe("dedupeAcrossDimensions", () => {
  const ledger = new EvidenceLedger();
  ledger.add({ dimension: "team_process", kind: "staleness", summary: "dormant" }); // TEAM-001
  ledger.add({ dimension: "security", kind: "deps", summary: "no dependabot" }); // SEC-001
  ledger.add({ dimension: "code_quality", kind: "file_read", summary: "read" }, "READ"); // READ-001
  ledger.add({ dimension: "team_process", kind: "bus_factor", summary: "bus factor 1" }); // TEAM-002

  it("drops an off-lane finding with no own scanner evidence when the owner covers every foreign citation", () => {
    const owner = f({ title: "Dormant", dimension: "team_process", evidenceIds: ["TEAM-001"] });
    const offLane = f({ title: "Dormant again", dimension: "security", evidenceIds: ["TEAM-001", "READ-001"] });
    expect(dedupeAcrossDimensions([owner, offLane], ledger)).toEqual([owner]);
  });

  it("keeps a finding that also cites scanner evidence from its own dimension", () => {
    const owner = f({ title: "Dormant", dimension: "team_process", evidenceIds: ["TEAM-001"] });
    const mixed = f({ title: "Dormant and unpatched", dimension: "security", evidenceIds: ["TEAM-001", "SEC-001"] });
    expect(dedupeAcrossDimensions([owner, mixed], ledger)).toEqual([owner, mixed]);
  });

  it("keeps an off-lane finding when one of its foreign citations is not covered", () => {
    const owner = f({ title: "Dormant", dimension: "team_process", evidenceIds: ["TEAM-001"] });
    const offLane = f({ title: "Dormant, one author", dimension: "security", evidenceIds: ["TEAM-001", "TEAM-002"] });
    expect(dedupeAcrossDimensions([owner, offLane], ledger)).toEqual([owner, offLane]);
  });

  it("keeps an off-lane finding when the owning dimension has no finding on that evidence", () => {
    const offLane = f({ title: "Dormant", dimension: "security", evidenceIds: ["TEAM-001"] });
    expect(dedupeAcrossDimensions([offLane], ledger)).toEqual([offLane]);
  });

  it("keeps both findings when each cites its own evidence plus the other's", () => {
    const sec = f({ title: "Sec", dimension: "security", evidenceIds: ["SEC-001", "TEAM-001"] });
    const team = f({ title: "Team", dimension: "team_process", evidenceIds: ["TEAM-001", "SEC-001"] });
    expect(dedupeAcrossDimensions([sec, team], ledger)).toEqual([sec, team]);
  });

  it("drops a foreign-only finding even when the owner also cites it back", () => {
    const sec = f({ title: "Sec", dimension: "security", evidenceIds: ["TEAM-001"] });
    const team = f({ title: "Team", dimension: "team_process", evidenceIds: ["SEC-001", "TEAM-001"] });
    expect(dedupeAcrossDimensions([sec, team], ledger)).toEqual([team]);
  });

  it("leaves findings citing only READ evidence untouched", () => {
    const a = f({ title: "A", dimension: "security", evidenceIds: ["READ-001"] });
    const b = f({ title: "B", dimension: "code_quality", evidenceIds: ["READ-001"] });
    expect(dedupeAcrossDimensions([a, b], ledger)).toEqual([a, b]);
  });
});

describe("combineFindings", () => {
  it("applies the rule floor after dedupe so a flagged critical cannot be removed, and counts removals", () => {
    const ledger = new EvidenceLedger();
    ledger.add({ dimension: "team_process", kind: "activity", summary: "dormant" }); // TEAM-001
    const secret = ledger.add({ dimension: "security", kind: "secrets", summary: "1 secret", flag: { severity: "critical", title: "Secrets", recommendation: "Rotate", effort: "S" } }); // SEC-001
    const security = f({ title: "Stale code", severity: "medium", evidenceIds: ["TEAM-001"] });
    const team = f({ title: "Dormant", dimension: "team_process", evidenceIds: ["TEAM-001"] });
    const { findings, deduped } = combineFindings(ruleFindings(ledger.all()), [security, team], ledger);
    expect(deduped).toBe(1);
    expect(findings).toEqual([team, expect.objectContaining({ dimension: "security", severity: "critical", evidenceIds: [secret.id] })]);
  });
});

describe("scoring", () => {
  it("scores dimensions from severity penalties", () => {
    const scores = scoreDimensions([f({ severity: "high" }), f({ severity: "medium" })]);
    const sec = scores.find((s) => s.dimension === "security")!;
    expect(sec).toEqual({ dimension: "security", score: 79, rag: "amber", findingCount: 2, assessed: true });
    expect(scores.find((s) => s.dimension === "architecture")).toEqual({ dimension: "architecture", score: 100, rag: "green", findingCount: 0, assessed: true });
  });

  it("any critical makes the dimension and the overall red", () => {
    const findings = [f({ severity: "critical" })];
    const scores = scoreDimensions(findings);
    expect(scores.find((s) => s.dimension === "security")!.rag).toBe("red");
    expect(overallScore(scores, findings)).toEqual({ score: 93, rag: "red" });
  });

  it("marks failed dimensions not assessed and leaves them out of the overall score", () => {
    const findings = [f({ severity: "high", dimension: "architecture" })];
    const scores = scoreDimensions(findings, ["security"]);
    expect(scores.find((s) => s.dimension === "security")).toMatchObject({ assessed: false });
    expect(overallScore(scores, findings)).toEqual({ score: 96, rag: "amber" });
  });

  it("sorts findings by severity, most severe first", () => {
    const sorted = sortFindings([f({ severity: "low" }), f({ severity: "critical" }), f({ severity: "info" })]);
    expect(sorted.map((x) => x.severity)).toEqual(["critical", "low", "info"]);
  });
});
