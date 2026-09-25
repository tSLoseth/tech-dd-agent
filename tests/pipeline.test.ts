import { describe, it, expect } from "vitest";
import { MockAnthropicClient } from "ensemble/testing";
import { runDueDiligence } from "../src/pipeline.js";
import { DIMENSIONS } from "../src/types.js";
import { makeRepo } from "./helpers.js";

const FAKE_AWS_KEY = "AKIA" + "ABCDEFGHIJKLMNOP";
const files = {
  ...Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`src/m${i}.ts`, "export const x = 1;\n"])),
  "src/config.ts": `export const key = "${FAKE_AWS_KEY}";\n`,
};

describe("runDueDiligence", () => {
  it("offline mode: scanner findings only, no summary, zero cost", async () => {
    const report = await runDueDiligence({ root: makeRepo(files), target: "demo", mode: "offline", model: "mock" });
    expect(report.mode).toBe("offline");
    expect(report.summary).toBeNull();
    expect(report.findings[0]!.severity).toBe("critical");
    expect(report.overall.rag).toBe("red");
    expect(report.usage.costUsd).toBe(0);
    expect(report.stats.files).toBe(6);
  });

  it("full mode: grounds specialist findings, keeps the rule floor, adds a summary", async () => {
    const finding = (title: string, id: string) => ({
      findings: [{ title, dimension: "architecture", severity: "info", description: "d", evidenceIds: [id], recommendation: "Keep", effort: "S" }],
    });
    const mock = new MockAnthropicClient([
      { text: JSON.stringify(finding("Invented claim", "FAKE-999")) }, // architecture — dropped
      ...DIMENSIONS.slice(1).map((d) => ({ text: JSON.stringify(finding(`Strength in ${d}`, "ARC-001")) })),
      { text: JSON.stringify({ headline: "Leaked credentials block close.", redFlags: ["Secrets in code"], valueLevers: ["Add CI"], hundredDayPlan: ["Rotate keys"] }) },
    ]);
    const report = await runDueDiligence({
      root: makeRepo(files), target: "demo", mode: "full", model: "mock", client: mock.asClient(), concurrency: 1,
    });
    expect(mock.callCount).toBe(6);
    expect(report.droppedFindings).toBe(1);
    expect(report.findings.some((f) => f.title === "Secrets committed to source code")).toBe(true);
    expect(report.findings.some((f) => f.title === "Invented claim")).toBe(false);
    expect(report.summary!.headline).toBe("Leaked credentials block close.");
  });
});
