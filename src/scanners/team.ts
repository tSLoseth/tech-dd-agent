import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import type { EvidenceInput } from "../types.js";

const DAY = 86_400_000;
const DORMANT_DAYS = 180;
const BUS_FACTOR_MIN_COMMITS = 20;

function git(root: string, args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function sameDir(a: string, b: string): boolean {
  const norm = (p: string) => {
    const real = realpathSync.native(p);
    return process.platform === "win32" ? real.toLowerCase() : real;
  };
  return norm(a) === norm(b);
}

export function scanGitHistory(root: string, now: number = Date.now()): EvidenceInput[] {
  const none: EvidenceInput[] = [{
    dimension: "team_process",
    kind: "git",
    summary: "No git history available — key-person and activity risk could not be assessed",
  }];

  let log: string;
  try {
    // A temp dir inside some parent repo would otherwise report the parent's history.
    if (!sameDir(git(root, ["rev-parse", "--show-toplevel"]).trim(), root)) return none;
    log = git(root, ["log", "--no-merges", "--format=%an%x09%at"]);
  } catch {
    return none;
  }

  const commits = log
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [author, ts] = line.split("\t");
      return { author: author ?? "unknown", at: Number(ts) * 1000 };
    });
  if (commits.length === 0) return none;

  const counts = new Map<string, number>();
  for (const c of commits) counts.set(c.author, (counts.get(c.author) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  // Bus factor = fewest authors who together wrote at least half the commits.
  let covered = 0;
  let busFactor = 0;
  for (const [, n] of ranked) {
    busFactor++;
    covered += n;
    if (covered * 2 >= commits.length) break;
  }

  const newest = commits.reduce((m, c) => Math.max(m, c.at), 0);
  const oldest = commits.reduce((m, c) => Math.min(m, c.at), Infinity);
  const idleDays = Math.floor((now - newest) / DAY);
  const recent = commits.filter((c) => now - c.at <= 90 * DAY).length;
  const topShare = Math.round((100 * ranked[0]![1]) / commits.length);

  const out: EvidenceInput[] = [
    {
      dimension: "team_process",
      kind: "activity",
      summary: `${commits.length} commits by ${ranked.length} contributors since ${new Date(oldest).toISOString().slice(0, 7)}; ${recent} in the last 90 days; last commit ${idleDays} days ago${
        commits.length < BUS_FACTOR_MIN_COMMITS ? `; history too short to assess key-person risk (${commits.length} commits)` : ""
      }`,
    },
    {
      dimension: "team_process",
      kind: "bus_factor",
      summary: `Bus factor ${busFactor}: top contributor authored ${topShare}% of commits`,
      // Ranked, never named: the report should not profile individual developers.
      detail: ranked.slice(0, 5).map(([, n], i) => `Contributor ${String.fromCharCode(65 + i)}: ${n}`).join("\n"),
      ...(busFactor === 1 && commits.length >= BUS_FACTOR_MIN_COMMITS
        ? {
            flag: {
              severity: "high" as const,
              title: "Key-person dependency",
              recommendation: "Pair a second engineer on the core modules and document critical knowledge before close; consider retention terms for the key developer.",
              effort: "M" as const,
            },
          }
        : {}),
    },
  ];

  if (idleDays > DORMANT_DAYS) {
    out.push({
      dimension: "team_process",
      kind: "staleness",
      summary: `No commits for ${idleDays} days`,
      flag: {
        severity: "medium",
        title: "Dormant codebase",
        recommendation: "Confirm who maintains the product today and budget for a dependency and security catch-up.",
        effort: "M",
      },
    });
  }
  return out;
}
