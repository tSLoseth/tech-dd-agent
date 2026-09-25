import { describe, it, expect } from "vitest";
import { EvidenceLedger } from "../src/evidence.js";
import { FindingSchema } from "../src/types.js";

describe("EvidenceLedger", () => {
  it("assigns sequential ids per dimension prefix", () => {
    const l = new EvidenceLedger();
    const a = l.add({ dimension: "security", kind: "secrets", summary: "a" });
    const b = l.add({ dimension: "security", kind: "secrets", summary: "b" });
    const c = l.add({ dimension: "architecture", kind: "languages", summary: "c" });
    expect([a.id, b.id, c.id]).toEqual(["SEC-001", "SEC-002", "ARC-001"]);
  });

  it("supports a custom prefix and lookups", () => {
    const l = new EvidenceLedger();
    const r = l.add({ dimension: "code_quality", kind: "file_read", summary: "read" }, "READ");
    expect(r.id).toBe("READ-001");
    expect(l.has("READ-001")).toBe(true);
    expect(l.has("READ-002")).toBe(false);
    expect(l.get("READ-001")).toEqual(r);
    expect(l.get("READ-002")).toBeUndefined();
    expect(l.forDimension("code_quality")).toHaveLength(1);
    expect(l.all()).toHaveLength(1);
  });
});

describe("FindingSchema", () => {
  it("rejects a finding without evidence", () => {
    const res = FindingSchema.safeParse({
      title: "No tests",
      dimension: "security",
      severity: "high",
      description: "d",
      evidenceIds: [],
      recommendation: "r",
      effort: "S",
    });
    expect(res.success).toBe(false);
  });
});
