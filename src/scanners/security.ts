import type { EvidenceInput, Scanner } from "../types.js";
import { fileName } from "./stack.js";

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "Private key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI-style API key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "Slack webhook", re: /hooks\.slack\.com\/services\/[A-Za-z0-9/]+/ },
  { name: "Hardcoded credential", re: /\b(?:api[_-]?key|secret|passw(?:or)?d|token)\b\s*[:=]\s*["'][^"'\s]{12,}["']/i },
];
const ENV_FILE_RE = /(^|\/)\.env(\.[a-z0-9_-]+)?$/i;
const ENV_TEMPLATE_RE = /\.(example|sample|template|dist)$/i;
const DOCKERFILE_RE = /(^|\/)Dockerfile[^/]*$/;
const UPDATES_RE = /^\.github\/dependabot\.ya?ml$|(^|\/)renovate\.json5?$|^\.renovaterc(\.json)?$/;
const MANIFEST_RE = /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|go\.mod|pom\.xml|build\.gradle|Cargo\.toml)$/;
const MAX_SCAN_BYTES = 500_000;

export const scanSecurity: Scanner = ({ inventory, read }) => {
  const out: EvidenceInput[] = [];

  // Only pattern name + location are recorded; the matched value is never stored.
  const hits: string[] = [];
  const secretFiles = new Set<string>();
  for (const f of inventory.files) {
    if (f.lines === 0 || f.bytes > MAX_SCAN_BYTES || fileName(f.path).endsWith("lock.json") || f.path.endsWith(".lock")) continue;
    read(f.path).split("\n").forEach((line, i) => {
      for (const p of SECRET_PATTERNS) {
        if (p.re.test(line)) {
          hits.push(`${f.path}:${i + 1} — ${p.name}`);
          secretFiles.add(f.path);
        }
      }
    });
  }
  if (hits.length > 0) {
    out.push({
      dimension: "security",
      kind: "secrets",
      summary: `${hits.length} probable hardcoded secrets in ${secretFiles.size} files (values redacted)`,
      detail: hits.slice(0, 20).join("\n"),
      files: [...secretFiles].slice(0, 20),
      flag: {
        severity: "critical",
        title: "Secrets committed to source code",
        recommendation: "Rotate every exposed credential before close, purge them from git history and move them to a secrets manager.",
        effort: "S",
      },
    });
  }

  const envFiles = inventory.files.filter((f) => ENV_FILE_RE.test(f.path) && !ENV_TEMPLATE_RE.test(f.path));
  if (envFiles.length > 0) {
    out.push({
      dimension: "security",
      kind: "env_files",
      summary: `${envFiles.length} environment files committed to the repository`,
      files: envFiles.map((f) => f.path),
      flag: {
        severity: "high",
        title: "Environment files committed",
        recommendation: "Remove .env files from the repository and its history, rotate their values and add them to .gitignore.",
        effort: "S",
      },
    });
  }

  for (const d of inventory.files.filter((f) => DOCKERFILE_RE.test(f.path))) {
    const text = read(d.path);
    const stages = new Set([...text.matchAll(/^FROM\s+\S+\s+AS\s+(\S+)/gim)].map((m) => m[1]!.toLowerCase()));
    const unpinned = [...text.matchAll(/^FROM\s+(\S+)/gim)]
      .map((m) => m[1]!)
      .filter((img) => img !== "scratch" && !stages.has(img.toLowerCase()))
      .filter((img) => (!img.includes(":") && !img.includes("@")) || img.endsWith(":latest"));
    if (unpinned.length > 0) {
      out.push({
        dimension: "security",
        kind: "container_base",
        summary: `${d.path} uses unpinned base images: ${unpinned.join(", ")}`,
        files: [d.path],
        flag: {
          severity: "low",
          title: "Unpinned container base images",
          recommendation: "Pin base images to a version tag or digest so builds are reproducible and patchable.",
          effort: "S",
        },
      });
    }
    if (!/^USER\s+/im.test(text)) {
      out.push({
        dimension: "security",
        kind: "container_user",
        summary: `${d.path} has no USER directive — the container runs as root`,
        files: [d.path],
        flag: {
          severity: "medium",
          title: "Containers run as root",
          recommendation: "Add a non-root USER to every production image.",
          effort: "S",
        },
      });
    }
  }

  if (inventory.files.some((f) => MANIFEST_RE.test(f.path))) {
    const updates = inventory.files.filter((f) => UPDATES_RE.test(f.path));
    out.push(
      updates.length > 0
        ? { dimension: "security", kind: "dependency_updates", summary: `Automated dependency updates configured (${updates[0]!.path})`, files: updates.map((f) => f.path) }
        : {
            dimension: "security",
            kind: "dependency_updates",
            summary: "No Dependabot or Renovate configuration found",
            flag: {
              severity: "low",
              title: "No automated dependency updates",
              recommendation: "Enable Dependabot or Renovate so security patches arrive as reviewed PRs.",
              effort: "S",
            },
          },
    );
  }

  const policy = inventory.files.find((f) => /(^|\/)SECURITY\.md$/i.test(f.path));
  if (policy) out.push({ dimension: "security", kind: "security_policy", summary: "Security policy (SECURITY.md) published", files: [policy.path] });

  return out;
};
