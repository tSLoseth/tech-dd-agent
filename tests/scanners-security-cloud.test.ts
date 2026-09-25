import { describe, it, expect } from "vitest";
import { scanSecurity } from "../src/scanners/security.js";
import { scanCloud } from "../src/scanners/cloud.js";
import { ctxFor } from "./helpers.js";

const byKind = <T extends { kind: string }>(ev: T[], kind: string) => ev.find((e) => e.kind === kind);
const FAKE_AWS_KEY = "AKIA" + "ABCDEFGHIJKLMNOP"; // split so this file is not itself a hit

describe("scanSecurity", () => {
  it("flags hardcoded secrets as critical and never leaks the value", () => {
    const ev = scanSecurity(ctxFor({ "src/config.ts": `export const key = "${FAKE_AWS_KEY}";\n` }));
    const secrets = byKind(ev, "secrets")!;
    expect(secrets.flag!.severity).toBe("critical");
    expect(secrets.detail).toContain("src/config.ts:1 — AWS access key");
    expect(JSON.stringify(ev)).not.toContain(FAKE_AWS_KEY);
  });

  it("flags committed .env files but not templates", () => {
    const ev = scanSecurity(ctxFor({ ".env": "A=1\n", ".env.example": "A=\n" }));
    expect(byKind(ev, "env_files")!.files).toEqual([".env"]);
    expect(byKind(ev, "env_files")!.flag!.severity).toBe("high");
  });

  it("flags unpinned base images and root containers", () => {
    const ev = scanSecurity(ctxFor({ Dockerfile: "FROM node\nRUN npm ci\n" }));
    expect(byKind(ev, "container_base")!.flag!.title).toBe("Unpinned container base images");
    expect(byKind(ev, "container_user")!.flag!.title).toBe("Containers run as root");
  });

  it("accepts pinned multi-stage images with a non-root user", () => {
    const ev = scanSecurity(ctxFor({ Dockerfile: "FROM node:22 AS build\nFROM build\nUSER app\n" }));
    expect(byKind(ev, "container_base")).toBeUndefined();
    expect(byKind(ev, "container_user")).toBeUndefined();
  });

  it("flags missing automated dependency updates only when there are manifests", () => {
    expect(byKind(scanSecurity(ctxFor({ "package.json": "{}" })), "dependency_updates")!.flag).toBeDefined();
    expect(byKind(scanSecurity(ctxFor({ "notes.txt": "x" })), "dependency_updates")).toBeUndefined();
    expect(byKind(scanSecurity(ctxFor({ "package.json": "{}", ".github/dependabot.yml": "version: 2\n" })), "dependency_updates")!.flag).toBeUndefined();
  });
});

describe("scanCloud", () => {
  it("flags a repo with no containers and no IaC", () => {
    const ev = scanCloud(ctxFor({ "src/a.ts": "export {}\n" }));
    expect(byKind(ev, "containers")!.flag!.title).toBe("Not containerised");
    expect(byKind(ev, "iac")!.flag!.title).toBe("No infrastructure as code");
  });

  it("recognises containers, terraform, env config and health checks", () => {
    const ev = scanCloud(ctxFor({
      Dockerfile: "FROM node:22\nUSER app\n",
      "infra/main.tf": "resource \"x\" \"y\" {}\n",
      "src/server.ts": "const port = process.env.PORT;\napp.get('/healthz', ok);\n",
    }));
    expect(ev.filter((e) => e.flag)).toEqual([]);
    expect(byKind(ev, "iac")!.files).toEqual(["infra/main.tf"]);
    expect(byKind(ev, "config")!.summary).toContain("1 files");
    expect(byKind(ev, "health")).toBeDefined();
  });

  it("detects kubernetes manifests as IaC", () => {
    const ev = scanCloud(ctxFor({ "k8s/app.yaml": "apiVersion: apps/v1\nkind: Deployment\n" }));
    expect(byKind(ev, "iac")!.files).toEqual(["k8s/app.yaml"]);
  });

  it("treats PaaS-only deployment as a low finding", () => {
    const ev = scanCloud(ctxFor({ "vercel.json": "{}" }));
    expect(byKind(ev, "paas")!.flag!.severity).toBe("low");
    expect(byKind(ev, "iac")).toBeUndefined();
  });

  it("flags hardcoded localhost endpoints in three or more files", () => {
    const files = Object.fromEntries([1, 2, 3].map((i) => [`src/c${i}.ts`, "fetch('http://localhost:3000/x');\n"]));
    expect(byKind(scanCloud(ctxFor(files)), "localhost")!.flag!.severity).toBe("low");
  });
});
