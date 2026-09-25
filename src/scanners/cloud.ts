import { isCodeFile, isTestPath } from "../inventory.js";
import type { EvidenceInput, Scanner } from "../types.js";

const CONTAINER_RE = /(^|\/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml)$/;
const IAC_RE = /\.(tf|bicep)$|(^|\/)(cdk\.json|serverless\.ya?ml|Chart\.yaml|Pulumi\.ya?ml)$/;
const PAAS_RE = /(^|\/)(vercel\.json|netlify\.toml|fly\.toml|app\.yaml|render\.yaml|Procfile)$/;
const K8S_KIND_RE = /^kind:\s*(Deployment|StatefulSet|Service|Ingress|CronJob)\b/m;
const ENV_READ_RE = /process\.env\.|os\.environ|os\.getenv|System\.getenv|Environment\.GetEnvironmentVariable/;
const LOCALHOST_RE = /\b(localhost|127\.0\.0\.1):\d{2,5}/;
const HEALTH_RE = /["'`]\/(health|healthz|ready|readyz|livez)["'`]/;

export const scanCloud: Scanner = ({ inventory, read }) => {
  const out: EvidenceInput[] = [];

  const containers = inventory.files.filter((f) => CONTAINER_RE.test(f.path));
  out.push(
    containers.length > 0
      ? { dimension: "cloud_readiness", kind: "containers", summary: `Containerised (${containers.map((f) => f.path).join(", ")})`, files: containers.map((f) => f.path) }
      : {
          dimension: "cloud_readiness",
          kind: "containers",
          summary: "No Dockerfile or compose file found",
          flag: {
            severity: "medium",
            title: "Not containerised",
            recommendation: "Containerise the services so they can run on any cloud or orchestrator.",
            effort: "M",
          },
        },
  );

  const k8s = inventory.files.filter(
    (f) => (f.ext === ".yaml" || f.ext === ".yml") && f.bytes < 200_000 && /apiVersion:/.test(read(f.path)) && K8S_KIND_RE.test(read(f.path)),
  );
  const iac = [...inventory.files.filter((f) => IAC_RE.test(f.path)), ...k8s];
  const paas = inventory.files.filter((f) => PAAS_RE.test(f.path));
  if (iac.length > 0) {
    out.push({ dimension: "cloud_readiness", kind: "iac", summary: `Infrastructure as code: ${iac.length} files`, files: iac.map((f) => f.path).slice(0, 10) });
  } else if (paas.length > 0) {
    out.push({
      dimension: "cloud_readiness",
      kind: "paas",
      summary: `Deployed via PaaS configuration (${paas.map((f) => f.path).join(", ")}), no infrastructure as code`,
      files: paas.map((f) => f.path),
      flag: {
        severity: "low",
        title: "Infrastructure managed outside code",
        recommendation: "Capture environments, networking and secrets in infrastructure as code so environments are reproducible.",
        effort: "M",
      },
    });
  } else {
    out.push({
      dimension: "cloud_readiness",
      kind: "iac",
      summary: "No infrastructure-as-code or deployment configuration found",
      flag: {
        severity: "medium",
        title: "No infrastructure as code",
        recommendation: "Define infrastructure in Terraform/Bicep/CDK so environments can be rebuilt and audited.",
        effort: "M",
      },
    });
  }

  const source = inventory.files.filter((f) => isCodeFile(f) && !isTestPath(f.path));
  const envFiles = source.filter((f) => ENV_READ_RE.test(read(f.path)));
  const localhostFiles = source.filter((f) => LOCALHOST_RE.test(read(f.path)));
  const healthFiles = source.filter((f) => HEALTH_RE.test(read(f.path)));

  if (envFiles.length > 0) {
    out.push({
      dimension: "cloud_readiness",
      kind: "config",
      summary: `Configuration read from environment variables in ${envFiles.length} files (12-factor)`,
      files: envFiles.map((f) => f.path).slice(0, 10),
    });
  }
  if (localhostFiles.length >= 3) {
    out.push({
      dimension: "cloud_readiness",
      kind: "localhost",
      summary: `Hardcoded localhost endpoints in ${localhostFiles.length} source files`,
      files: localhostFiles.map((f) => f.path).slice(0, 10),
      flag: {
        severity: "low",
        title: "Hardcoded local endpoints",
        recommendation: "Move endpoints into configuration so the same build runs in every environment.",
        effort: "S",
      },
    });
  }
  if (healthFiles.length > 0) {
    out.push({ dimension: "cloud_readiness", kind: "health", summary: "Health-check endpoint found", files: healthFiles.map((f) => f.path).slice(0, 5) });
  }

  return out;
};
