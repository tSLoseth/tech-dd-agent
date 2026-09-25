import { Agent, type Usage } from "ensemble";
import { runStructured } from "ensemble/outputs";
import { SummarySchema, type DimensionScore, type Finding, type Rag, type Summary } from "../types.js";
import type { AgentOptions } from "./specialists.js";

const SYSTEM = `You are the engagement partner on a technology due diligence for a private-equity buyer.
Write the executive summary for the investment committee using ONLY the scored findings you are given.
- headline: one sentence with the overall verdict and the single most important reason.
- redFlags: the issues that could affect price or must be fixed before close (may be empty).
- valueLevers: technology improvements that would create value after the deal.
- hundredDayPlan: concrete, ordered actions for the first 100 days.
Plain language, no jargon without explanation, no claims beyond the findings.
A dimension with "assessed": false could not be reviewed in this run; say so where relevant and do not guess its state.`;

export async function runSynthesis(
  target: string,
  findings: Finding[],
  scores: DimensionScore[],
  overall: { score: number; rag: Rag },
  opts: AgentOptions,
): Promise<{ summary: Summary; usage: Usage }> {
  const agent = new Agent({ name: "dd-synthesis", model: opts.model, system: SYSTEM, maxTokens: 2048, temperature: 0, client: opts.client });
  const input = JSON.stringify({
    target,
    overall,
    scores: scores.map((s) => (s.assessed ? s : { dimension: s.dimension, assessed: false })),
    findings: findings.map(({ title, dimension, severity, recommendation, effort }) => ({ title, dimension, severity, recommendation, effort })),
  }, null, 2);
  const { output, result } = await runStructured(agent, input, SummarySchema, { bus: opts.bus });
  return { summary: output, usage: result.usage };
}
