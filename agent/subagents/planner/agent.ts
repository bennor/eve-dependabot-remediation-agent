import { defineAgent } from "eve";
import { MODELS } from "../../lib/models.js";

export default defineAgent({
  description:
    "Plan batch dependency upgrades from validated Dependabot alerts. " +
    "Groups patch and minor updates into batch transactions, isolates major version bumps, " +
    "and resolves dependency conflicts. Returns an ordered remediation plan with upgrade commands. " +
    "The caller passes the valid alerts in the message.",
  model: MODELS.planner,
  outputSchema: {
    additionalProperties: false,
    properties: {
      batches: {
        description: "Ordered remediation batches. Each batch is applied as a single transaction.",
        items: {
          additionalProperties: false,
          properties: {
            command: {
              description: "The package manager command to run for this batch (e.g. 'pnpm up lodash@4.17.21 cross-spawn@7.0.6')",
              type: "string",
            },
            id: {
              description: "Batch identifier (e.g. 'batch-1', 'batch-2')",
              type: "string",
            },
            packages: {
              description: "Packages included in this batch with their version changes.",
              items: {
                additionalProperties: false,
                properties: {
                  breaking: { type: "boolean" },
                  cve: { type: "string" },
                  from: { type: "string" },
                  package: { type: "string" },
                  severity: { enum: ["critical", "high", "medium", "low"], type: "string" },
                  to: { type: "string" },
                },
                required: ["package", "from", "to", "cve", "severity", "breaking"],
                type: "object",
              },
              type: "array",
            },
            reason: {
              description: "Why these packages are grouped together (e.g. 'independent patch updates, no shared deps')",
              type: "string",
            },
            strategy: {
              enum: ["batch", "sequential"],
              type: "string",
            },
          },
          required: ["id", "strategy", "reason", "packages", "command"],
          type: "object",
        },
        type: "array",
      },
      skipped: {
        description: "Alerts that cannot be safely remediated automatically, with a reason.",
        items: {
          additionalProperties: false,
          properties: {
            cve: { type: "string" },
            package: { type: "string" },
            reason: { type: "string" },
          },
          required: ["package", "cve", "reason"],
          type: "object",
        },
        type: "array",
      },
      summary: {
        description: "One-paragraph summary of the remediation plan.",
        type: "string",
      },
    },
    required: ["batches", "skipped", "summary"],
    type: "object",
  },
});
