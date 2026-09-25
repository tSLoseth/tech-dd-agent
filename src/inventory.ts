import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import type { FileEntry, Inventory } from "./types.js";

const IGNORED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next", "out", "coverage",
  "vendor", "__pycache__", ".venv", "venv", "target", ".turbo",
]);
const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".pdf", ".zip", ".gz",
  ".woff", ".woff2", ".ttf", ".eot", ".exe", ".dll", ".so", ".jar", ".mp4", ".lockb",
]);
const MAX_TEXT_BYTES = 1_000_000;

export const LANGUAGES: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
  ".mjs": "JavaScript", ".cjs": "JavaScript", ".py": "Python", ".java": "Java",
  ".kt": "Kotlin", ".go": "Go", ".rs": "Rust", ".cs": "C#", ".rb": "Ruby",
  ".php": "PHP", ".swift": "Swift", ".c": "C", ".cpp": "C++", ".h": "C/C++",
  ".scala": "Scala", ".sql": "SQL", ".vue": "Vue", ".svelte": "Svelte",
};

const TEST_RE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$|_test\.(go|py)$/i;

export function isTestPath(path: string): boolean {
  return TEST_RE.test(path);
}

export function isCodeFile(f: FileEntry): boolean {
  return LANGUAGES[f.ext] !== undefined && f.lines > 0;
}

export function buildInventory(root: string): Inventory {
  const abs = resolve(root);
  const files: FileEntry[] = [];
  const walk = (dir: string): void => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, d.name);
      if (d.isDirectory()) {
        if (!IGNORED_DIRS.has(d.name)) walk(full);
        continue;
      }
      if (!d.isFile()) continue;
      const ext = extname(d.name).toLowerCase();
      const bytes = statSync(full).size;
      const lines = BINARY_EXT.has(ext) || bytes > MAX_TEXT_BYTES ? 0 : countLines(readFileSync(full, "utf8"));
      files.push({ path: relative(abs, full).split("\\").join("/"), ext, bytes, lines });
    }
  };
  walk(abs);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { root: abs, name: basename(abs), files };
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

export function languageStats(inv: Inventory): Record<string, number> {
  const totals = new Map<string, number>();
  for (const f of inv.files) {
    const lang = LANGUAGES[f.ext];
    if (lang && f.lines > 0) totals.set(lang, (totals.get(lang) ?? 0) + f.lines);
  }
  return Object.fromEntries([...totals.entries()].sort((a, b) => b[1] - a[1]));
}

export function makeReader(inv: Inventory, maxChars = 200_000): (path: string) => string {
  const known = new Set(inv.files.map((f) => f.path));
  return (path) => {
    if (!known.has(path)) return "";
    try {
      return readFileSync(join(inv.root, path), "utf8").slice(0, maxChars);
    } catch {
      return "";
    }
  };
}
