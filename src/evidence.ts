import type { Dimension, Evidence, EvidenceInput } from "./types.js";

const PREFIX: Record<Dimension, string> = {
  architecture: "ARC",
  code_quality: "QUA",
  security: "SEC",
  cloud_readiness: "CLD",
  team_process: "TEAM",
};

export class EvidenceLedger {
  #items: Evidence[] = [];
  #counters = new Map<string, number>();

  add(input: EvidenceInput, prefix: string = PREFIX[input.dimension]): Evidence {
    const n = (this.#counters.get(prefix) ?? 0) + 1;
    this.#counters.set(prefix, n);
    const evidence: Evidence = { id: `${prefix}-${String(n).padStart(3, "0")}`, ...input };
    this.#items.push(evidence);
    return evidence;
  }

  has(id: string): boolean {
    return this.#items.some((e) => e.id === id);
  }

  get(id: string): Evidence | undefined {
    return this.#items.find((e) => e.id === id);
  }

  all(): Evidence[] {
    return [...this.#items];
  }

  forDimension(dimension: Dimension): Evidence[] {
    return this.#items.filter((e) => e.dimension === dimension);
  }
}
