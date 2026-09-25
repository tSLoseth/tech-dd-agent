import { Agent, type AgentConfig, type EventBus, type Usage } from "ensemble";
import { runStructured } from "ensemble/outputs";
import type { EvidenceLedger } from "../evidence.js";
import { FindingListSchema, type Dimension, type Finding, type Inventory } from "../types.js";
import { specialistInput, specialistSystem } from "./prompts.js";
import { createEvidenceTools } from "./tools.js";

export interface AgentOptions {
  model: string;
  client?: AgentConfig["client"];
  bus?: EventBus;
}

export async function runSpecialist(
  dimension: Dimension,
  inv: Inventory,
  ledger: EvidenceLedger,
  opts: AgentOptions,
): Promise<{ dimension: Dimension; findings: Finding[]; usage: Usage }> {
  const agent = new Agent({
    name: `dd-${dimension}`,
    model: opts.model,
    system: specialistSystem(dimension),
    tools: createEvidenceTools(inv, ledger, dimension),
    maxTurns: 10,
    maxTokens: 4096,
    temperature: 0,
    client: opts.client,
  });
  const { output, result } = await runStructured(agent, specialistInput(dimension, inv, ledger), FindingListSchema, { bus: opts.bus });
  return {
    dimension,
    findings: output.findings.map((f) => ({ ...f, dimension })),
    usage: result.usage,
  };
}
