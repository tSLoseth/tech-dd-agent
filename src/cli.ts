import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { EventBus } from "ensemble";
import { loadEnv } from "./env.js";
import { runDueDiligence } from "./pipeline.js";
import { renderHtml } from "./report/html.js";
import { renderMarkdown } from "./report/markdown.js";
import { resolveTarget } from "./target.js";
import type { Report } from "./types.js";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const USAGE = "Usage: npm run dd -- <repo-url|path> [--offline] [--out <dir>] [--model <id>] [--concurrency <n>]";

export interface CliArgs {
  target: string;
  out: string | null;
  offline: boolean;
  model: string;
  concurrency: number;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { target: "", out: null, offline: false, model: DEFAULT_MODEL, concurrency: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--offline") args.offline = true;
    else if (a === "--out") args.out = argv[++i] ?? null;
    else if (a === "--model") args.model = argv[++i] ?? DEFAULT_MODEL;
    else if (a === "--concurrency") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) throw new Error(`--concurrency must be an integer of at least 1\n${USAGE}`);
      args.concurrency = n;
    } else if (a.startsWith("--")) throw new Error(`Unknown option ${a}\n${USAGE}`);
    else args.target = a;
  }
  if (!args.target) throw new Error(USAGE);
  return args;
}

export function slug(text: string): string {
  const last = text.replace(/\.git$/, "").replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "target";
  return last.toLowerCase().replace(/[^a-z0-9._-]+/g, "-") || "target";
}

// A grep pattern is model-supplied and may be a secret literal, so it is never logged.
export function describeToolCall(tool: string, input: unknown): string {
  if (tool === "grep") {
    const pattern = (input as { pattern?: unknown } | null)?.pattern;
    return `grep (${typeof pattern === "string" ? pattern.length : 0}-char pattern)`;
  }
  return `${tool} ${JSON.stringify(input)}`;
}

export function summaryLine(r: Pick<Report, "overall" | "findings" | "droppedFindings" | "dedupedFindings" | "failedDimensions" | "usage">): string {
  const failed = r.failedDimensions.length ? ` · not assessed: ${r.failedDimensions.join(", ")}` : "";
  return `Overall ${r.overall.score}/100 (${r.overall.rag}) · ${r.findings.length} findings · ${r.droppedFindings} dropped · ${r.dedupedFindings} deduped · $${r.usage.costUsd.toFixed(4)}${failed}`;
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  if (!args.offline && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env, or run with --offline for a scanner-only report.");
  }

  const target = resolveTarget(args.target);
  try {
    const bus = new EventBus();
    bus.onType("tool_call_start", (e) => console.error(`  [${e.agent}] ${describeToolCall(e.tool, e.input)}`));
    bus.onType("agent_done", (e) => console.error(`  [${e.agent}] done in ${e.turns} turns ($${e.usage.costUsd.toFixed(4)})`));

    console.error(`Running ${args.offline ? "offline" : `full (${args.model})`} tech DD on ${target.display} …`);
    const report = await runDueDiligence({
      root: target.root,
      target: target.display,
      mode: args.offline ? "offline" : "full",
      model: args.model,
      concurrency: args.concurrency,
      bus,
      onDimensionError: (d, err) => console.error(`  [dd-${d}] failed: ${err instanceof Error ? err.message : String(err)}`),
    });

    const outDir = resolve(args.out ?? join("reports", slug(args.target)));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
    writeFileSync(join(outDir, "report.md"), renderMarkdown(report));
    writeFileSync(join(outDir, "report.html"), renderHtml(report));

    console.log(summaryLine(report));
    console.log(`Report: ${join(outDir, "report.html")}`);
  } finally {
    target.cleanup();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
