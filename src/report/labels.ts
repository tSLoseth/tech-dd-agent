import type { Dimension, Rag } from "../types.js";

export const DIMENSION_LABEL: Record<Dimension, string> = {
  architecture: "Architecture & stack",
  code_quality: "Code quality & tech debt",
  security: "Security",
  cloud_readiness: "Cloud readiness",
  team_process: "Team & process",
};

export const RAG_LABEL: Record<Rag, string> = { green: "Green", amber: "Amber", red: "Red" };
