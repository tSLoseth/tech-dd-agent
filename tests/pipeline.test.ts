import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { MockAnthropicClient } from "ensemble/testing";
import { buildInventory } from "../src/inventory.js";
import { collectEvidence } from "../src/scanners/index.js";
import { runDueDiligence } from "../src/pipeline.js";
import { renderHtml } from "../src/report/html.js";
import { renderMarkdown } from "../src/report/markdown.js";
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

  it("full mode: a failing specialist marks its dimension not assessed instead of killing the run", async () => {
    const strength = (d: string) => ({
      findings: [{ title: `Strength in ${d}`, dimension: d, severity: "info", description: "d", evidenceIds: ["ARC-001"], recommendation: "Keep", effort: "S" }],
    });
    const mock = new MockAnthropicClient([
      { text: "not json" }, // architecture
      { text: "still not json" }, // architecture repair — runStructured throws
      ...DIMENSIONS.slice(1).map((d) => ({ text: JSON.stringify(strength(d)) })),
      { text: JSON.stringify({ headline: "h", redFlags: [], valueLevers: [], hundredDayPlan: [] }) },
    ]);
    const report = await runDueDiligence({
      root: makeRepo(files), target: "demo", mode: "full", model: "mock", client: mock.asClient(), concurrency: 1,
    });
    expect(mock.callCount).toBe(7);
    expect(report.failedDimensions).toEqual(["architecture"]);
    expect(report.scores.find((s) => s.dimension === "architecture")).toMatchObject({ assessed: false });
    expect(report.findings.some((f) => f.dimension === "architecture" && f.severity === "info")).toBe(false);
    expect(report.overall.rag).not.toBe("green");
    expect(renderMarkdown(report)).toContain("Not assessed");
    expect(renderHtml(report)).toContain("Not assessed");
  });

  it("full mode: strips severity words from titles and caps history-only team findings", async () => {
    const root = makeRepo(files);
    execFileSync("git", ["-C", root, "init", "-q"]);
    execFileSync("git", ["-C", root, "-c", "user.name=a", "-c", "user.email=a@x", "commit", "--allow-empty", "-q", "-m", "one"]);
    const busId = collectEvidence({ inventory: buildInventory(root), read: () => "" }).all().find((e) => e.kind === "bus_factor")!.id;
    const one = (d: string, title: string, severity: string, id: string) => ({
      findings: [{ title, dimension: d, severity, description: "d", evidenceIds: [id], recommendation: "r", effort: "S" }],
    });
    const mock = new MockAnthropicClient([
      ...DIMENSIONS.map((d) => ({
        text: JSON.stringify(d === "team_process" ? one(d, "Critical bus factor: one author", "high", busId) : one(d, `High: gap in ${d}`, "low", "ARC-001")),
      })),
      { text: JSON.stringify({ headline: "h", redFlags: [], valueLevers: [], hundredDayPlan: [] }) },
    ]);
    const report = await runDueDiligence({ root, target: "demo", mode: "full", model: "mock", client: mock.asClient(), concurrency: 1 });
    const team = report.findings.find((f) => f.dimension === "team_process" && f.evidenceIds.includes(busId))!;
    expect(team).toMatchObject({ title: "Bus factor: one author", severity: "medium" });
    expect(report.findings.find((f) => f.dimension === "architecture")!.title).toBe("Gap in architecture");
  });

  it("full mode: throws when every specialist fails", async () => {
    const mock = new MockAnthropicClient([]);
    await expect(runDueDiligence({
      root: makeRepo(files), target: "demo", mode: "full", model: "mock", client: mock.asClient(), concurrency: 1,
    })).rejects.toThrow(/All specialists failed/);
  });

  it("full mode: redacts secrets echoed by the model from every output", async () => {
    const echo = (d: string) => ({
      findings: [{
        title: `Key ${FAKE_AWS_KEY} in ${d}`, dimension: d, severity: "high", description: `The key ${FAKE_AWS_KEY} is committed.`,
        evidenceIds: ["SEC-001"], recommendation: `Rotate ${FAKE_AWS_KEY}.`, effort: "S",
      }],
    });
    const mock = new MockAnthropicClient([
      ...DIMENSIONS.map((d) => ({ text: JSON.stringify(echo(d)) })),
      { text: JSON.stringify({ headline: `Rotate ${FAKE_AWS_KEY}.`, redFlags: [FAKE_AWS_KEY], valueLevers: [FAKE_AWS_KEY], hundredDayPlan: [FAKE_AWS_KEY] }) },
    ]);
    const report = await runDueDiligence({
      root: makeRepo(files), target: "demo", mode: "full", model: "mock", client: mock.asClient(), concurrency: 1,
    });
    expect(report.findings.some((f) => f.description.includes("[REDACTED: AWS access key]"))).toBe(true);
    for (const out of [renderMarkdown(report), renderHtml(report), JSON.stringify(report)]) {
      expect(out).not.toContain(FAKE_AWS_KEY);
    }
  });
});
