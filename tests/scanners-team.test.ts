import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { scanGitHistory } from "../src/scanners/team.js";
import { collectEvidence } from "../src/scanners/index.js";
import { ctxFor, makeRepo } from "./helpers.js";

const DAY = 86_400_000;

function commits(root: string, author: string, n: number): void {
  for (let i = 0; i < n; i++) {
    execFileSync("git", ["-C", root, "-c", `user.name=${author}`, "-c", `user.email=${author}@example.com`,
      "commit", "--allow-empty", "-q", "-m", `${author} ${i}`]);
  }
}

function gitRepo(): string {
  const root = makeRepo({ "a.txt": "a\n" });
  execFileSync("git", ["-C", root, "init", "-q"]);
  return root;
}

describe("scanGitHistory", () => {
  it("reports activity and flags a bus factor of one", () => {
    const root = gitRepo();
    commits(root, "alice", 20);
    commits(root, "bob", 1);
    const ev = scanGitHistory(root);
    expect(ev.find((e) => e.kind === "activity")!.summary).toContain("21 commits by 2 contributors");
    const bus = ev.find((e) => e.kind === "bus_factor")!;
    expect(bus.summary).toContain("95%");
    expect(bus.flag!.title).toBe("Key-person dependency");
    expect(bus.detail).toBe("Contributor A: 20\nContributor B: 1");
    expect(JSON.stringify(ev)).not.toContain("alice");
  });

  it("says when the history is too short to assess key-person risk", () => {
    const root = gitRepo();
    commits(root, "alice", 3);
    const ev = scanGitHistory(root);
    expect(ev.find((e) => e.kind === "activity")!.summary).toContain("; history too short to assess key-person risk (3 commits)");
    expect(ev.find((e) => e.kind === "bus_factor")!.flag).toBeUndefined();
  });

  it("flags a dormant codebase", () => {
    const root = gitRepo();
    commits(root, "alice", 2);
    const ev = scanGitHistory(root, Date.now() + 400 * DAY);
    expect(ev.find((e) => e.kind === "staleness")!.flag!.title).toBe("Dormant codebase");
  });

  it("returns a no-history note for a directory that is not its own repo", () => {
    const ev = scanGitHistory(makeRepo({ "a.txt": "a\n" }));
    expect(ev).toHaveLength(1);
    expect(ev[0]!.summary).toContain("No git history");
  });
});

describe("collectEvidence", () => {
  it("runs every scanner into one ledger with unique ids", () => {
    const ledger = collectEvidence(ctxFor({ "src/a.ts": "export {}\n", "package.json": "{}" }));
    const ids = ledger.all().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => id.startsWith("ARC-"))).toBe(true);
    expect(ids.some((id) => id.startsWith("CLD-"))).toBe(true);
    expect(ids.some((id) => id.startsWith("TEAM-"))).toBe(true);
  });
});
