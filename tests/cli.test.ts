import { describe, it, expect } from "vitest";
import { describeToolCall, parseArgs, slug, summaryLine } from "../src/cli.js";
import { redactUrl, resolveTarget } from "../src/target.js";
import { makeRepo } from "./helpers.js";

describe("parseArgs", () => {
  it("applies defaults", () => {
    expect(parseArgs(["./repo"])).toEqual({
      target: "./repo", out: null, offline: false, model: "claude-haiku-4-5-20251001", concurrency: 3,
    });
  });

  it("reads flags", () => {
    const a = parseArgs(["https://github.com/x/y", "--offline", "--out", "reports/y", "--model", "m", "--concurrency", "5"]);
    expect(a).toEqual({ target: "https://github.com/x/y", out: "reports/y", offline: true, model: "m", concurrency: 5 });
  });

  it("throws without a target", () => {
    expect(() => parseArgs(["--offline"])).toThrow(/Usage/);
  });

  it("rejects unknown flags", () => {
    expect(() => parseArgs(["./repo", "--ofline"])).toThrow(/Usage/);
  });

  it.each([["0"], ["-2"], ["1.5"], ["abc"], [undefined]])("rejects --concurrency %s", (n) => {
    const argv = ["./repo", "--concurrency"];
    if (n !== undefined) argv.push(n);
    expect(() => parseArgs(argv)).toThrow(/Usage/);
  });
});

describe("summaryLine", () => {
  it("reports score, findings, dropped and deduped counts and cost", () => {
    const line = summaryLine({
      overall: { score: 71, rag: "red" }, findings: [], droppedFindings: 2, dedupedFindings: 1, failedDimensions: [],
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.1234 },
    });
    expect(line).toBe("Overall 71/100 (red) · 0 findings · 2 dropped · 1 deduped · $0.1234");
  });

  it("names failed dimensions", () => {
    const line = summaryLine({
      overall: { score: 71, rag: "amber" }, findings: [], droppedFindings: 0, dedupedFindings: 0, failedDimensions: ["security"],
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
    });
    expect(line).toContain("not assessed: security");
  });
});

describe("slug", () => {
  it("makes a filesystem-safe name from a URL", () => {
    expect(slug("https://github.com/tSLoseth/tiny-agent-sdk.git")).toBe("tiny-agent-sdk");
  });
});

describe("describeToolCall", () => {
  it("never logs the grep pattern, only its length", () => {
    const line = describeToolCall("grep", { pattern: "AKIAABCDEFGHIJKLMNOP", maxResults: 30 });
    expect(line).toBe("grep (20-char pattern)");
    expect(line).not.toContain("AKIA");
  });

  it("logs other tool inputs as JSON", () => {
    expect(describeToolCall("read_file", { path: "src/a.ts" })).toBe('read_file {"path":"src/a.ts"}');
  });
});

describe("redactUrl", () => {
  it("strips credentials from URL targets", () => {
    expect(redactUrl("https://user:token@github.com/x/y")).toBe("https://github.com/x/y");
    expect(redactUrl("https://token@github.com/x/y.git")).toBe("https://github.com/x/y.git");
  });

  it("leaves URLs without credentials and ssh targets unchanged", () => {
    expect(redactUrl("https://github.com/x/y")).toBe("https://github.com/x/y");
    expect(redactUrl("git@github.com:x/y.git")).toBe("git@github.com:x/y.git");
  });
});

describe("resolveTarget", () => {
  it("resolves a local directory", () => {
    const root = makeRepo({ "a.txt": "a" });
    expect(resolveTarget(root).root).toBe(root);
  });

  it("throws for a missing path", () => {
    expect(() => resolveTarget("C:/definitely/not/here")).toThrow(/not found/);
  });

  it("keeps URL credentials out of a clone failure", () => {
    let message = "";
    try {
      resolveTarget("https://user:TOKEN@127.0.0.1:1/x.git");
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("git clone failed for https://127.0.0.1:1/x.git");
    expect(message).not.toContain("TOKEN");
  }, 30_000);
});
