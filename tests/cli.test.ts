import { describe, it, expect } from "vitest";
import { describeToolCall, parseArgs, slug } from "../src/cli.js";
import { resolveTarget } from "../src/target.js";
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

describe("resolveTarget", () => {
  it("resolves a local directory", () => {
    const root = makeRepo({ "a.txt": "a" });
    expect(resolveTarget(root).root).toBe(root);
  });

  it("throws for a missing path", () => {
    expect(() => resolveTarget("C:/definitely/not/here")).toThrow(/not found/);
  });
});
