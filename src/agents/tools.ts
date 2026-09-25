import { z } from "zod";
import { defineTool, type RunnerTool } from "ensemble/tools";
import type { EvidenceLedger } from "../evidence.js";
import { makeReader } from "../inventory.js";
import type { Dimension, Inventory } from "../types.js";

const MAX_READ_CHARS = 6_000;
const MAX_LIST = 200;
const MAX_GREP_BYTES = 200_000;

export function createEvidenceTools(inv: Inventory, ledger: EvidenceLedger, dimension: Dimension): RunnerTool[] {
  const read = makeReader(inv);

  return [
    defineTool({
      name: "list_files",
      description: "List repository files (paths relative to the repo root) whose path starts with a prefix, with line counts.",
      input: z.object({ prefix: z.string().default("").describe("Path prefix, e.g. 'src/' — empty for all files") }),
      output: z.object({ total: z.number(), files: z.array(z.string()) }),
      execute: ({ prefix }) => {
        const matches = inv.files.filter((f) => f.path.startsWith(prefix));
        return { total: matches.length, files: matches.slice(0, MAX_LIST).map((f) => `${f.path} (${f.lines} lines)`) };
      },
    }),
    defineTool({
      name: "read_file",
      description: "Read a repository file. Returns an evidenceId you can cite in findings, and the (possibly truncated) content.",
      input: z.object({ path: z.string().describe("Path relative to the repo root, exactly as list_files prints it") }),
      output: z.object({ evidenceId: z.string(), content: z.string() }),
      execute: ({ path }) => {
        if (!inv.files.some((f) => f.path === path)) {
          return { evidenceId: "NONE", content: `No such file: ${path}. Use list_files to find valid paths.` };
        }
        const text = read(path);
        const evidence = ledger.add({ dimension, kind: "file_read", summary: `Inspected ${path}`, files: [path] }, "READ");
        const content = text.length > MAX_READ_CHARS ? `${text.slice(0, MAX_READ_CHARS)}\n…[truncated]` : text;
        return { evidenceId: evidence.id, content };
      },
    }),
    defineTool({
      name: "grep",
      description: "Search all text files for a case-insensitive regular expression. Returns an evidenceId and up to maxResults 'path:line: text' matches.",
      input: z.object({
        pattern: z.string().describe("JavaScript regular expression"),
        maxResults: z.number().int().min(1).max(100).default(30),
      }),
      output: z.object({ evidenceId: z.string(), matches: z.array(z.string()) }),
      execute: ({ pattern, maxResults }) => {
        let re: RegExp;
        try {
          re = new RegExp(pattern, "i");
        } catch {
          return { evidenceId: "NONE", matches: [`Invalid regular expression: ${pattern}`] };
        }
        const matches: string[] = [];
        const files = new Set<string>();
        for (const f of inv.files) {
          if (f.lines === 0 || f.bytes > MAX_GREP_BYTES) continue;
          const lines = read(f.path).split("\n");
          for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
            if (re.test(lines[i]!)) {
              matches.push(`${f.path}:${i + 1}: ${lines[i]!.trim().slice(0, 200)}`);
              files.add(f.path);
            }
          }
          if (matches.length >= maxResults) break;
        }
        const evidence = ledger.add(
          { dimension, kind: "search", summary: `Searched /${pattern}/: ${matches.length} matches`, files: [...files].slice(0, 10) },
          "READ",
        );
        return { evidenceId: evidence.id, matches };
      },
    }),
  ];
}
