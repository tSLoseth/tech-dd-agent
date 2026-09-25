import { describe, it, expect } from "vitest";
import { scanStack } from "../src/scanners/stack.js";
import { scanQuality } from "../src/scanners/quality.js";
import { ctxFor } from "./helpers.js";

const byKind = <T extends { kind: string }>(ev: T[], kind: string) => ev.find((e) => e.kind === kind);

describe("scanStack", () => {
  it("detects languages, frameworks, unpinned deps and a missing lockfile", () => {
    const ev = scanStack(ctxFor({
      "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "^19.0.0", leftpad: "*" } }),
      "src/index.ts": "export {}\n",
    }));
    expect(byKind(ev, "languages")!.summary).toContain("TypeScript 100%");
    expect(byKind(ev, "frameworks")!.summary).toContain("Next.js, React");
    expect(byKind(ev, "unpinned")!.detail).toContain("leftpad@*");
    expect(byKind(ev, "lockfile")!.flag!.severity).toBe("medium");
  });

  it("does not flag a lockfile that exists", () => {
    const ev = scanStack(ctxFor({
      "package.json": JSON.stringify({ dependencies: { express: "4.19.0" } }),
      "package-lock.json": "{}",
    }));
    expect(byKind(ev, "lockfile")).toBeUndefined();
    expect(byKind(ev, "frameworks")!.summary).toContain("Express");
  });

  it("parses requirements.txt", () => {
    const ev = scanStack(ctxFor({ "requirements.txt": "fastapi==0.110.0\npandas\n# comment\n" }));
    expect(byKind(ev, "frameworks")!.summary).toContain("fastapi, pandas");
    expect(byKind(ev, "unpinned")!.detail).toContain("pandas");
  });

  it("recognises a monorepo", () => {
    const ev = scanStack(ctxFor({
      "package.json": "{}",
      "apps/web/package.json": "{}",
      "packages/ui/package.json": "{}",
    }));
    expect(byKind(ev, "monorepo")!.summary).toContain("3 package.json");
  });
});

describe("scanQuality", () => {
  it("flags missing tests, CI and README on a bare repo", () => {
    const files = Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`src/m${i}.ts`, "export const x = 1;\n"]));
    const ev = scanQuality(ctxFor(files));
    const titles = ev.filter((e) => e.flag).map((e) => e.flag!.title);
    expect(titles).toContain("No automated tests");
    expect(titles).toContain("No CI pipeline");
    expect(titles).toContain("No README / onboarding documentation");
    expect(byKind(ev, "tests")!.flag!.severity).toBe("high");
  });

  it("recognises tests, CI, lint config and README", () => {
    const ev = scanQuality(ctxFor({
      "src/a.ts": "export const a = 1;\n",
      "src/a.test.ts": "test('a', () => {});\n",
      ".github/workflows/ci.yml": "on: push\n",
      "eslint.config.js": "export default [];\n",
      "README.md": "# App\n",
    }));
    expect(ev.filter((e) => e.flag && e.flag.severity !== "info")).toEqual([]);
    expect(byKind(ev, "ci")!.dimension).toBe("team_process");
  });

  it("flags oversized modules and accumulated debt markers", () => {
    const ev = scanQuality(ctxFor({ "src/big.ts": "// TODO tidy\n".repeat(900), "README.md": "# x\n" }));
    expect(byKind(ev, "large_files")!.summary).toContain("src/big.ts");
    expect(byKind(ev, "debt")!.summary).toContain("900 TODO/FIXME/HACK markers");
    expect(byKind(ev, "debt")!.flag!.severity).toBe("low");
  });
});
