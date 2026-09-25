import type { Dimension, Rag } from "../types.js";

export const DIMENSION_LABEL: Record<Dimension, string> = {
  architecture: "Architecture & stack",
  code_quality: "Code quality & tech debt",
  security: "Security",
  cloud_readiness: "Cloud readiness",
  team_process: "Team & process",
};

export const RAG_LABEL: Record<Rag, string> = { green: "Green", amber: "Amber", red: "Red" };

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

export const failedNote = (failed: Dimension[]): string =>
  `The specialist review for ${failed.map((d) => DIMENSION_LABEL[d]).join(", ")} could not be completed in this run, so ${failed.length === 1 ? "that dimension is" : "those dimensions are"} not assessed and left out of the overall score. Critical and high scanner flags are still listed.`;
