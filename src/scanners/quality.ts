import { isCodeFile, isTestPath } from "../inventory.js";
import type { EvidenceInput, Scanner } from "../types.js";

const CI_RE = /^\.github\/workflows\/[^/]+\.ya?ml$|^\.gitlab-ci\.yml$|^azure-pipelines\.ya?ml$|^Jenkinsfile$|^\.circleci\/config\.yml$|^bitbucket-pipelines\.yml$/;
const LINT_RE = /(^|\/)(\.eslintrc(\.[a-z]+)?|eslint\.config\.[a-z]+|\.prettierrc(\.[a-z]+)?|biome\.json|ruff\.toml|\.flake8|\.pylintrc)$/;
const DEBT_RE = /\b(TODO|FIXME|HACK|XXX)\b/g;
const README_RE = /^readme(\.[a-z]+)?$/i;
const LARGE_FILE_LINES = 800;
const DEBT_FLAG_THRESHOLD = 50;

export const scanQuality: Scanner = ({ inventory, read }) => {
  const out: EvidenceInput[] = [];
  const code = inventory.files.filter(isCodeFile);
  const tests = code.filter((f) => isTestPath(f.path));
  const source = code.length - tests.length;

  if (source >= 5 && tests.length === 0) {
    out.push({
      dimension: "code_quality",
      kind: "tests",
      summary: `${source} source files and no test files`,
      flag: {
        severity: "high",
        title: "No automated tests",
        recommendation: "Introduce a test harness and cover the revenue-critical paths first (characterisation tests before any refactoring).",
        effort: "M",
      },
    });
  } else if (source > 0) {
    const ratio = tests.length / source;
    out.push({
      dimension: "code_quality",
      kind: "tests",
      summary: `${tests.length} test files for ${source} source files (ratio ${ratio.toFixed(2)})`,
      ...(ratio < 0.1 && source >= 10
        ? {
            flag: {
              severity: "medium" as const,
              title: "Thin test coverage",
              recommendation: "Raise coverage on the core modules and gate merges on tests in CI.",
              effort: "M" as const,
            },
          }
        : {}),
    });
  }

  const ci = inventory.files.filter((f) => CI_RE.test(f.path));
  out.push(
    ci.length > 0
      ? { dimension: "team_process", kind: "ci", summary: `CI pipeline configured (${ci.length} config files)`, files: ci.map((f) => f.path) }
      : {
          dimension: "team_process",
          kind: "ci",
          summary: "No CI configuration found",
          flag: {
            severity: "medium",
            title: "No CI pipeline",
            recommendation: "Add a CI pipeline that builds, tests and scans every change.",
            effort: "S",
          },
        },
  );

  const lint = inventory.files.filter((f) => LINT_RE.test(f.path));
  out.push(
    lint.length > 0
      ? { dimension: "code_quality", kind: "lint", summary: `Linting/formatting configured (${lint.map((f) => f.path).join(", ")})`, files: lint.map((f) => f.path) }
      : {
          dimension: "code_quality",
          kind: "lint",
          summary: "No linter or formatter configuration found",
          flag: {
            severity: "low",
            title: "No linter or formatter configured",
            recommendation: "Adopt a linter and formatter and enforce them in CI.",
            effort: "S",
          },
        },
  );

  const large = code
    .filter((f) => f.lines > LARGE_FILE_LINES && !isTestPath(f.path))
    .sort((a, b) => b.lines - a.lines);
  if (large.length > 0) {
    out.push({
      dimension: "code_quality",
      kind: "large_files",
      summary: `${large.length} source files over ${LARGE_FILE_LINES} lines (largest: ${large[0]!.path}, ${large[0]!.lines} lines)`,
      files: large.slice(0, 5).map((f) => f.path),
      flag: {
        severity: "medium",
        title: "Oversized modules",
        recommendation: "Split the largest modules along domain boundaries; they are change hotspots and onboarding bottlenecks.",
        effort: "M",
      },
    });
  }

  let debt = 0;
  const debtFiles: string[] = [];
  for (const f of code) {
    const n = (read(f.path).match(DEBT_RE) ?? []).length;
    if (n > 0) {
      debt += n;
      debtFiles.push(f.path);
    }
  }
  if (debt > 0) {
    out.push({
      dimension: "code_quality",
      kind: "debt",
      summary: `${debt} TODO/FIXME/HACK markers in ${debtFiles.length} files`,
      files: debtFiles.slice(0, 10),
      ...(debt > DEBT_FLAG_THRESHOLD
        ? {
            flag: {
              severity: "low" as const,
              title: "Accumulated debt markers",
              recommendation: "Triage the markers into a tracked backlog and delete the stale ones.",
              effort: "S" as const,
            },
          }
        : {}),
    });
  }

  const readme = inventory.files.find((f) => README_RE.test(f.path));
  out.push(
    readme
      ? { dimension: "team_process", kind: "docs", summary: `README present (${readme.lines} lines)`, files: [readme.path] }
      : {
          dimension: "team_process",
          kind: "docs",
          summary: "No README at the repository root",
          flag: {
            severity: "medium",
            title: "No README / onboarding documentation",
            recommendation: "Write a README covering setup, architecture and deployment so new engineers are productive in days, not weeks.",
            effort: "S",
          },
        },
  );

  return out;
};
