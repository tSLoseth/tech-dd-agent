import { languageStats } from "../inventory.js";
import type { EvidenceInput, Scanner } from "../types.js";

const MANIFESTS: Record<string, string> = {
  "package.json": "npm",
  "requirements.txt": "pip",
  "pyproject.toml": "Python (pyproject)",
  "go.mod": "Go modules",
  "pom.xml": "Maven",
  "build.gradle": "Gradle",
  "Cargo.toml": "Cargo",
};
const LOCKFILES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"]);
const JS_FRAMEWORKS: Record<string, string> = {
  next: "Next.js", react: "React", vue: "Vue", "@angular/core": "Angular", svelte: "Svelte",
  express: "Express", "@nestjs/core": "NestJS", fastify: "Fastify",
  "drizzle-orm": "Drizzle ORM", prisma: "Prisma", "@prisma/client": "Prisma",
};
const PY_FRAMEWORKS = new Set(["django", "flask", "fastapi", "pandas", "torch", "scikit-learn"]);

export const fileName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);
export const dirOf = (path: string): string => path.slice(0, path.lastIndexOf("/") + 1);

export const scanStack: Scanner = ({ inventory, read }) => {
  const out: EvidenceInput[] = [];

  const langs = languageStats(inventory);
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  if (total > 0) {
    const top = Object.entries(langs)
      .slice(0, 4)
      .map(([lang, n]) => `${lang} ${Math.round((100 * n) / total)}%`)
      .join(", ");
    out.push({ dimension: "architecture", kind: "languages", summary: `${total.toLocaleString("en-US")} lines of code: ${top}` });
  }

  const manifests = inventory.files.filter((f) => MANIFESTS[fileName(f.path)] !== undefined);
  const pkgJsons = manifests.filter((f) => fileName(f.path) === "package.json");
  if (pkgJsons.length > 1) {
    out.push({
      dimension: "architecture",
      kind: "monorepo",
      summary: `Monorepo layout with ${pkgJsons.length} package.json manifests`,
      files: pkgJsons.map((f) => f.path).slice(0, 10),
    });
  }

  const frameworks = new Set<string>();
  const unpinned: string[] = [];
  for (const m of manifests) {
    const name = fileName(m.path);
    if (name === "package.json") {
      const pkg = safeJson(read(m.path));
      const runtime = (pkg?.dependencies ?? {}) as Record<string, string>;
      const dev = (pkg?.devDependencies ?? {}) as Record<string, string>;
      const deps = { ...runtime, ...dev };
      out.push({
        dimension: "architecture",
        kind: "manifest",
        summary: `npm manifest ${m.path}: ${Object.keys(runtime).length} runtime and ${Object.keys(dev).length} dev dependencies`,
        files: [m.path],
      });
      for (const [dep, version] of Object.entries(deps)) {
        const fw = JS_FRAMEWORKS[dep];
        if (fw) frameworks.add(fw);
        if (version === "*" || version === "latest" || version === "") unpinned.push(`${m.path}: ${dep}@${version || "(empty)"}`);
      }
      const dir = dirOf(m.path);
      const hasLock = inventory.files.some(
        (f) => LOCKFILES.has(fileName(f.path)) && (dirOf(f.path) === dir || dirOf(f.path) === ""),
      );
      if (!hasLock && Object.keys(deps).length > 0) {
        out.push({
          dimension: "code_quality",
          kind: "lockfile",
          summary: `No lockfile next to ${m.path} — installs are not reproducible`,
          files: [m.path],
          flag: {
            severity: "medium",
            title: "Non-reproducible dependency installs",
            recommendation: "Commit a lockfile and install with a frozen lockfile in CI.",
            effort: "S",
          },
        });
      }
    } else {
      out.push({ dimension: "architecture", kind: "manifest", summary: `${MANIFESTS[name]} manifest ${m.path}`, files: [m.path] });
      if (name === "requirements.txt") {
        const reqs = read(m.path)
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#") && !l.startsWith("-"));
        for (const req of reqs) {
          const pkgName = req.toLowerCase().split(/[<>=!~[; ]/)[0]!;
          if (PY_FRAMEWORKS.has(pkgName)) frameworks.add(pkgName);
          if (!/[=<>~]/.test(req)) unpinned.push(`${m.path}: ${req}`);
        }
      }
    }
  }

  if (frameworks.size > 0) {
    out.push({ dimension: "architecture", kind: "frameworks", summary: `Frameworks detected: ${[...frameworks].sort().join(", ")}` });
  }
  if (unpinned.length > 0) {
    out.push({
      dimension: "code_quality",
      kind: "unpinned",
      summary: `${unpinned.length} dependencies without a version constraint`,
      detail: unpinned.slice(0, 10).join("\n"),
      files: [...new Set(unpinned.map((u) => u.split(":")[0]!))],
      flag: {
        severity: "medium",
        title: "Unpinned dependencies",
        recommendation: "Pin every dependency to a version or range and enable automated update PRs.",
        effort: "S",
      },
    });
  }
  return out;
};

function safeJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
