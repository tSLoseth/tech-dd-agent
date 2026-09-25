import { describe, it, expect } from "vitest";
import { EventBus } from "ensemble";
import { MockAnthropicClient } from "ensemble/testing";
import { createEvidenceTools } from "../src/agents/tools.js";
import { runSpecialist } from "../src/agents/specialists.js";
import { buildInventory, makeReader } from "../src/inventory.js";
import { collectEvidence } from "../src/scanners/index.js";
import { makeRepo } from "./helpers.js";

function setup() {
  const inv = buildInventory(makeRepo({
    "src/db.ts": "export const connect = () => pool.query('select 1');\n",
    "src/api.ts": "export const handler = () => connect();\n",
  }));
  const ledger = collectEvidence({ inventory: inv, read: makeReader(inv) });
  return { inv, ledger };
}
const ctx = { runId: "t", agent: "t", bus: new EventBus() };

describe("createEvidenceTools", () => {
  it("read_file registers READ evidence and returns its id", async () => {
    const { inv, ledger } = setup();
    const read = createEvidenceTools(inv, ledger, "security").find((t) => t.name === "read_file")!;
    const res = await read.execute({ path: "src/db.ts" }, ctx);
    expect(JSON.parse(res.content)).toMatchObject({ evidenceId: "READ-001" });
    expect(ledger.has("READ-001")).toBe(true);
  });

  it("read_file refuses paths outside the inventory", async () => {
    const { inv, ledger } = setup();
    const read = createEvidenceTools(inv, ledger, "security").find((t) => t.name === "read_file")!;
    const res = await read.execute({ path: "../../etc/passwd" }, ctx);
    expect(res.content).toContain("No such file");
    expect(ledger.has("READ-001")).toBe(false);
  });

  it("grep returns matches with an evidence id", async () => {
    const { inv, ledger } = setup();
    const grep = createEvidenceTools(inv, ledger, "architecture").find((t) => t.name === "grep")!;
    const out = JSON.parse((await grep.execute({ pattern: "connect" }, ctx)).content);
    expect(out.evidenceId).toBe("READ-001");
    expect(out.matches).toHaveLength(2);
  });
});

describe("runSpecialist", () => {
  it("uses tools, forces its own dimension and returns findings", async () => {
    const { inv, ledger } = setup();
    const mock = new MockAnthropicClient([
      { toolUses: [{ name: "read_file", input: { path: "src/db.ts" } }] },
      {
        text: JSON.stringify({
          findings: [{
            title: "Raw SQL without a data-access layer",
            dimension: "security",
            severity: "medium",
            description: "Queries are issued inline.",
            evidenceIds: ["READ-001"],
            recommendation: "Introduce a repository layer.",
            effort: "M",
          }],
        }),
      },
    ]);
    const res = await runSpecialist("architecture", inv, ledger, { model: "mock", client: mock.asClient() });
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]!.dimension).toBe("architecture");
    expect(res.findings[0]!.evidenceIds).toEqual(["READ-001"]);
    expect(mock.callCount).toBe(2);
    expect(res.usage.inputTokens).toBeGreaterThan(0);
  });
});
