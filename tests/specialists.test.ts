import { describe, it, expect } from "vitest";
import { EventBus } from "ensemble";
import { MockAnthropicClient } from "ensemble/testing";
import { createEvidenceTools } from "../src/agents/tools.js";
import { runSpecialist } from "../src/agents/specialists.js";
import { buildInventory, makeReader } from "../src/inventory.js";
import { collectEvidence } from "../src/scanners/index.js";
import { EvidenceLedger } from "../src/evidence.js";
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
const PRIVATE_KEY_HEADER = "-----BEGIN RSA " + "PRIVATE KEY-----";

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

  it("grep keeps the searched pattern out of the ledger", async () => {
    const secret = "AKIA" + "ABCDEFGHIJKLMNOP";
    const inv = buildInventory(makeRepo({ "src/config.ts": `export const key = "${secret}";\n` }));
    const ledger = collectEvidence({ inventory: inv, read: makeReader(inv) });
    const grep = createEvidenceTools(inv, ledger, "security").find((t) => t.name === "grep")!;
    const out = JSON.parse((await grep.execute({ pattern: secret }, ctx)).content);
    expect(out.matches).toHaveLength(1);
    expect(JSON.stringify(ledger.all())).not.toContain(secret);
    expect(JSON.stringify(out)).not.toContain(secret);
  });

  it("read_file and grep redact secrets in returned content", async () => {
    const secret = "AKIA" + "ABCDEFGHIJKLMNOP";
    const inv = buildInventory(makeRepo({ "src/config.ts": `export const key = "${secret}";\n` }));
    const tools = createEvidenceTools(inv, new EvidenceLedger(), "security");
    const read = JSON.parse((await tools.find((t) => t.name === "read_file")!.execute({ path: "src/config.ts" }, ctx)).content);
    expect(read.content).toContain("[REDACTED: AWS access key]");
    expect(read.content).not.toContain(secret);
    const grep = JSON.parse((await tools.find((t) => t.name === "grep")!.execute({ pattern: "key" }, ctx)).content);
    expect(grep.matches).toEqual(['src/config.ts:1: export const key = "[REDACTED: AWS access key]";']);
  });

  it("read_file refuses .env and private-key files but allows env templates", async () => {
    const inv = buildInventory(makeRepo({
      ".env": "DB_PASSWORD=hunter2hunter2\n",
      ".env.production": "X=1\n",
      ".env.example": "DB_PASSWORD=\n",
      "certs/server.pem": "abc\n",
      "deploy/id_rsa": "abc\n",
      "src/k.txt": `${PRIVATE_KEY_HEADER}\nMIIEabc\n`,
    }));
    const ledger = new EvidenceLedger();
    const read = createEvidenceTools(inv, ledger, "security").find((t) => t.name === "read_file")!;
    for (const path of [".env", ".env.production", "certs/server.pem", "deploy/id_rsa", "src/k.txt"]) {
      const out = JSON.parse((await read.execute({ path }, ctx)).content);
      expect(out.evidenceId).toBe("NONE");
      expect(out.content).not.toContain("hunter2");
      expect(out.content).not.toContain("MIIE");
    }
    expect(ledger.all()).toHaveLength(0);
    expect(JSON.parse((await read.execute({ path: ".env.example" }, ctx)).content).content).toContain("DB_PASSWORD=");
  });

  it("grep skips .env and private-key files", async () => {
    const inv = buildInventory(makeRepo({
      ".env": "DB_PASSWORD=hunter2hunter2\n",
      "src/k.txt": `${PRIVATE_KEY_HEADER}\nMIIEabc\n`,
      "src/a.ts": "const MIIE = 1; // hunter2\n",
    }));
    const grep = createEvidenceTools(inv, new EvidenceLedger(), "security").find((t) => t.name === "grep")!;
    const out = JSON.parse((await grep.execute({ pattern: "hunter2|MIIE" }, ctx)).content);
    expect(out.matches).toEqual(["src/a.ts:1: const MIIE = 1; // hunter2"]);
  });

  it("grep skips lines longer than 2,000 characters", async () => {
    const inv = buildInventory(makeRepo({ "src/min.js": `${"a".repeat(2_001)}\nshort a\n` }));
    const grep = createEvidenceTools(inv, new EvidenceLedger(), "architecture").find((t) => t.name === "grep")!;
    const out = JSON.parse((await grep.execute({ pattern: "a" }, ctx)).content);
    expect(out.matches).toEqual(["src/min.js:2: short a"]);
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
