import { z } from "zod";
import type { Usage } from "ensemble";

export const DimensionSchema = z.enum([
  "architecture",
  "code_quality",
  "security",
  "cloud_readiness",
  "team_process",
]);
export type Dimension = z.infer<typeof DimensionSchema>;
export const DIMENSIONS = DimensionSchema.options;

export const SeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const EffortSchema = z.enum(["S", "M", "L"]);
export type Effort = z.infer<typeof EffortSchema>;

export const FindingSchema = z.object({
  title: z.string().min(3),
  dimension: DimensionSchema,
  severity: SeveritySchema,
  description: z.string(),
  evidenceIds: z.array(z.string()).min(1),
  recommendation: z.string(),
  effort: EffortSchema,
});
export type Finding = z.infer<typeof FindingSchema>;
export const FindingListSchema = z.object({ findings: z.array(FindingSchema) });

export const SummarySchema = z.object({
  headline: z.string(),
  redFlags: z.array(z.string()).max(5),
  valueLevers: z.array(z.string()).max(5),
  hundredDayPlan: z.array(z.string()).max(6),
});
export type Summary = z.infer<typeof SummarySchema>;

export interface FileEntry {
  path: string; // repo-relative, forward slashes
  ext: string; // lower-case, with dot
  bytes: number;
  lines: number; // 0 for binary/oversized files
}

export interface Inventory {
  root: string;
  name: string;
  files: FileEntry[];
}

export interface RuleFlag {
  severity: Severity;
  title: string;
  recommendation: string;
  effort: Effort;
}

export interface Evidence {
  id: string;
  dimension: Dimension;
  kind: string;
  summary: string;
  detail?: string;
  files?: string[];
  flag?: RuleFlag;
}
export type EvidenceInput = Omit<Evidence, "id">;

export interface ScanContext {
  inventory: Inventory;
  read: (path: string) => string;
}
export type Scanner = (ctx: ScanContext) => EvidenceInput[];

export type Rag = "green" | "amber" | "red";

export interface DimensionScore {
  dimension: Dimension;
  score: number;
  rag: Rag;
  findingCount: number;
}

export interface Report {
  target: string;
  generatedAt: string;
  mode: "full" | "offline";
  model: string | null;
  stats: { files: number; lines: number; languages: Record<string, number> };
  evidence: Evidence[];
  findings: Finding[];
  droppedFindings: number;
  scores: DimensionScore[];
  overall: { score: number; rag: Rag };
  summary: Summary | null;
  usage: Usage;
}
