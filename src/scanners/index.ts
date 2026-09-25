import { EvidenceLedger } from "../evidence.js";
import type { ScanContext, Scanner } from "../types.js";
import { scanCloud } from "./cloud.js";
import { scanQuality } from "./quality.js";
import { scanSecurity } from "./security.js";
import { scanStack } from "./stack.js";
import { scanGitHistory } from "./team.js";

const STATIC_SCANNERS: Scanner[] = [scanStack, scanQuality, scanSecurity, scanCloud];

export function collectEvidence(ctx: ScanContext, ledger: EvidenceLedger = new EvidenceLedger()): EvidenceLedger {
  for (const scan of STATIC_SCANNERS) for (const e of scan(ctx)) ledger.add(e);
  for (const e of scanGitHistory(ctx.inventory.root)) ledger.add(e);
  return ledger;
}
