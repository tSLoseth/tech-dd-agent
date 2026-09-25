import { describe, it, expect } from "vitest";
import { buildInventory, isTestPath, languageStats, makeReader } from "../src/inventory.js";
import { makeRepo } from "./helpers.js";

describe("buildInventory", () => {
  const root = makeRepo({
    "src/a.ts": "a\nb\nc\n",
    "src/lib/b.py": "x\n",
    "node_modules/dep/index.js": "junk\n",
    ".git/config": "[core]\n",
    "README.md": "# hi\n",
    "logo.png": "binary",
  });
  const inv = buildInventory(root);

  it("walks files, skips ignored dirs and uses forward slashes", () => {
    expect(inv.files.map((f) => f.path)).toEqual(["logo.png", "README.md", "src/a.ts", "src/lib/b.py"]);
  });

  it("counts lines for text files and zero for binaries", () => {
    expect(inv.files.find((f) => f.path === "src/a.ts")!.lines).toBe(3);
    expect(inv.files.find((f) => f.path === "logo.png")!.lines).toBe(0);
  });

  it("computes lines of code per language, largest first", () => {
    expect(languageStats(inv)).toEqual({ TypeScript: 3, Python: 1 });
  });

  it("reader returns file text, or empty string for unknown paths", () => {
    const read = makeReader(inv);
    expect(read("src/lib/b.py")).toBe("x\n");
    expect(read("nope.txt")).toBe("");
  });
});

describe("isTestPath", () => {
  it.each([
    ["src/a.test.ts", true],
    ["tests/test_api.py", true],
    ["pkg/handler_test.go", true],
    ["src/__tests__/x.tsx", true],
    ["src/testing.ts", false],
    ["src/contest/a.ts", false],
  ])("%s -> %s", (path, expected) => {
    expect(isTestPath(path)).toBe(expected);
  });
});
