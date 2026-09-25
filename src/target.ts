import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

export function resolveTarget(target: string): { root: string; display: string; cleanup: () => void } {
  if (/^(https?:\/\/|git@)/.test(target)) {
    const dir = mkdtempSync(join(tmpdir(), "tdd-clone-"));
    // blob:none keeps the full commit history (needed for the team scanner) while fetching only HEAD file contents.
    execFileSync("git", ["clone", "--quiet", "--filter=blob:none", target, dir], { stdio: "inherit" });
    return { root: dir, display: target, cleanup: () => rmSync(dir, { recursive: true, force: true, maxRetries: 3 }) };
  }
  const root = resolve(target);
  if (!existsSync(root)) throw new Error(`Target not found: ${target}`);
  return { root, display: basename(root), cleanup: () => {} };
}
