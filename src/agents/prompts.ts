import type { EvidenceLedger } from "../evidence.js";
import { languageStats } from "../inventory.js";
import type { Dimension, Evidence, Inventory } from "../types.js";

export const DIMENSION_BRIEF: Record<Dimension, string> = {
  architecture: "Architecture & stack — structure, modularity, coupling, framework choices, how well the design scales and how hard it is to extend.",
  code_quality: "Code quality & technical debt — tests, maintainability, dependency hygiene, oversized modules, debt markers; what the debt would cost to pay down.",
  security: "Security & compliance — secrets handling, dependency and supply-chain risk, container hardening, visible injection or auth weaknesses, personal-data handling.",
  cloud_readiness: "Cloud readiness & operations — containerisation, infrastructure as code, 12-factor configuration, observability, how cheaply it can be deployed or migrated.",
  team_process: "Team & delivery process — key-person risk, development activity, CI/CD discipline, documentation and onboarding.",
};

export function specialistSystem(d: Dimension): string {
  return `You are a senior technology due-diligence consultant assessing a software asset for a private-equity buyer.
Your lens: ${DIMENSION_BRIEF[d]}

Rules:
- Every finding MUST cite evidence IDs: either from the evidence list you are given, or IDs returned by your read_file / grep tools. Never invent an ID.
- Use list_files, read_file and grep (at most about six calls) to verify or deepen the scanner evidence before concluding.
- Report only what you observed. State what the code does, not what it might do: a hypothetical risk with no observed defect ("could be exposed", "relies on custom code") is at most low. Never claim something is present or absent (a USER directive, an auth check, a test) unless the file content you read or the scanner evidence shows it, and never contradict a scanner finding.
- Stay in your lane: five specialists assess the same repo in parallel, and a gap reported twice is penalised twice. Report a cross-cutting gap only if your dimension owns it — missing tests: code_quality; missing CI, key-person risk and inactivity: team_process; missing containers, IaC and observability: cloud_readiness; dependency update automation and secrets: security. You may mention another dimension's gap inside one of your findings, but never as a finding of its own.
- Severity: critical = deal-relevant (could change price or needs a fix before close); high = fix within the first 100 days; medium = plan within a year; low = hygiene; info = a strength worth noting.
- Reserve critical for facts that could block or re-price the deal, such as exposed credentials or a known exploitable vulnerability. Key-person risk and dormancy are at most high.
- A bus-factor or key-person finding must match the bus-factor evidence: do not call a spread team (e.g. 16 contributors, top share 31%) a low bus factor.
- Titles must not contain severity words (critical, high, medium, low); severity lives only in the severity field.
- Calibrate severity to what the asset evidently is (library, CLI, service, demo): do not rate a gap critical or high if that kind of asset does not normally need it.
- Effort: S under one person-week, M one to six person-weeks, L more than six person-weeks.
- Return 3 to 7 findings, including at least one strength (severity info) when the evidence supports it. Fewer, specific findings beat padding to reach seven.
- Write for an investment committee: concrete, plain language, no unexplained jargon.`;
}

const line = (e: Evidence): string =>
  `[${e.id}] ${e.summary}${e.files?.length ? ` (files: ${e.files.slice(0, 5).join(", ")})` : ""}${e.flag ? ` {scanner flag: ${e.flag.severity} — ${e.flag.title}}` : ""}`;

export function specialistInput(d: Dimension, inv: Inventory, ledger: EvidenceLedger): string {
  const langs = Object.entries(languageStats(inv)).map(([l, n]) => `${l} ${n}`).join(", ") || "none detected";
  const own = ledger.forDimension(d);
  const other = ledger.all().filter((e) => e.dimension !== d);
  return [
    `Target repository: ${inv.name} — ${inv.files.length} files; lines of code by language: ${langs}.`,
    "",
    `Scanner evidence for your dimension (${d}):`,
    ...(own.length ? own.map(line) : ["(none)"]),
    "",
    "Context evidence from other dimensions (you may cite it too):",
    ...other.map(line),
    "",
    "Assess the asset through your lens and return your findings.",
  ].join("\n");
}
