import { describe, it, expect } from "vitest";
import { renderHtml } from "../src/report/html.js";
import { renderMarkdown } from "../src/report/markdown.js";
import { overallScore, scoreDimensions } from "../src/scoring.js";
import type { Finding, Report } from "../src/types.js";

function sampleReport(over: Partial<Report> = {}): Report {
  const findings: Finding[] = [{
    title: "Secrets <script>alert(1)</script>",
    dimension: "security",
    severity: "critical",
    description: "Keys in code",
    evidenceIds: ["SEC-001"],
    recommendation: "Rotate",
    effort: "S",
  }];
  const scores = scoreDimensions(findings);
  return {
    target: "demo-repo",
    generatedAt: "2026-10-01T10:00:00.000Z",
    mode: "full",
    model: "claude-haiku-4-5-20251001",
    stats: { files: 10, lines: 500, languages: { TypeScript: 500 } },
    evidence: [{ id: "SEC-001", dimension: "security", kind: "secrets", summary: "1 probable secret", detail: "src/a.ts:1 — AWS access key" }],
    findings,
    droppedFindings: 2,
    scores,
    overall: overallScore(scores, findings),
    summary: { headline: "Fix secrets before close.", redFlags: ["Secrets"], valueLevers: ["CI"], hundredDayPlan: ["Rotate keys"] },
    usage: { inputTokens: 1000, outputTokens: 200, costUsd: 0.002 },
    ...over,
  };
}

describe("renderMarkdown", () => {
  it("includes headline, scorecard, findings, evidence and method", () => {
    const md = renderMarkdown(sampleReport());
    expect(md).toContain("> Fix secrets before close.");
    expect(md).toContain("| Security | 65 | Red | 1 |");
    expect(md).toContain("[CRITICAL]");
    expect(md).toContain("`SEC-001`");
    expect(md).toContain("2 model findings were discarded");
  });

  it("explains offline mode when there is no summary", () => {
    expect(renderMarkdown(sampleReport({ summary: null, mode: "offline" }))).toContain("Offline mode");
  });
});

describe("renderHtml", () => {
  it("escapes content and links findings to evidence anchors", () => {
    const html = renderHtml(sampleReport());
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="#ev-SEC-001"');
    expect(html).toContain('id="ev-SEC-001"');
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });
});
