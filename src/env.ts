import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function loadEnv(startDir: string = process.cwd(), maxUp = 4): void {
  let dir = resolve(startDir);
  for (let i = 0; i <= maxUp; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      for (const raw of readFileSync(candidate, "utf8").split(/\r?\n/)) {
        const line = unquote(raw.trim());
        const eq = line.indexOf("=");
        if (!line || line.startsWith("#") || eq === -1) continue;
        const key = line.slice(0, eq).trim();
        if (key && process.env[key] === undefined) process.env[key] = unquote(line.slice(eq + 1).trim());
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

function unquote(s: string): string {
  const q = s[0];
  return s.length >= 2 && (q === '"' || q === "'") && s.at(-1) === q ? s.slice(1, -1) : s;
}
