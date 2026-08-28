import { defineAgent } from "eve";
import { MODELS } from "../../lib/models.js";

export default defineAgent({
  description:
    "Validate Dependabot alerts against the actual package.json in the sandbox. " +
    "Confirms each alert's vulnerable version matches what is installed, and flags " +
    "alerts that are stale or already resolved. The caller passes the alert list in the message.",
  model: MODELS.scanner,
  outputSchema: {
    additionalProperties: false,
    properties: {
      staleAlerts: {
        description: "Alerts where the installed version no longer matches the vulnerable version (already patched or replaced).",
        items: {
          additionalProperties: false,
          properties: {
            cve: { type: "string" },
            installedVersion: { type: "string" },
            package: { type: "string" },
            reason: { type: "string" },
          },
          required: ["package", "cve", "installedVersion", "reason"],
          type: "object",
        },
        type: "array",
      },
      validAlerts: {
        description: "Alerts confirmed against the actual package.json, ready for the planner.",
        items: {
          additionalProperties: false,
          properties: {
            breaking: { type: "boolean" },
            cve: { type: "string" },
            currentVersion: { type: "string" },
            fixedVersion: { type: "string" },
            package: { type: "string" },
            patchStrategy: {
              enum: ["batch-patch", "batch-minor", "sequential-major"],
              type: "string",
            },
            severity: { enum: ["critical", "high", "medium", "low"], type: "string" },
            title: { type: "string" },
          },
          required: [
            "package",
            "cve",
            "currentVersion",
            "fixedVersion",
            "severity",
            "breaking",
            "patchStrategy",
            "title",
          ],
          type: "object",
        },
        type: "array",
      },
    },
    required: ["validAlerts", "staleAlerts"],
    type: "object",
  },
});
