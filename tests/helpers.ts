import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildInventory, makeReader } from "../src/inventory.js";
import type { ScanContext } from "../src/types.js";

export function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "tdd-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

export function ctxFor(files: Record<string, string>): ScanContext {
  const inventory = buildInventory(makeRepo(files));
  return { inventory, read: makeReader(inventory) };
}
