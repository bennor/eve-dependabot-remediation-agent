import { defineAgent } from "eve";
import { MODELS } from "../../lib/models.js";

export default defineAgent({
  description:
    "Plan batch dependency upgrades from scanner-verified package updates. " +
    "Groups patch and minor updates into batch transactions, isolates major version bumps, " +
    "and generates upgrade commands and concise package-based branch names. " +
    "The caller passes the valid packages from the scanner in the message.",
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
                  advisoryIds: {
                    items: { type: "string" },
                    type: "array",
                  },
                  breaking: { type: "boolean" },
                  from: { type: "string" },
                  name: { type: "string" },
                  to: { type: "string" },
                },
                required: ["name", "from", "to", "breaking"],
                type: "object",
              },
              type: "array",
            },
            reason: {
              description: "Why these packages are grouped together (e.g. 'independent patch/minor updates')",
              type: "string",
            },
            strategy: {
              enum: ["batch", "sequential"],
              type: "string",
            },
            suggestedBranch: {
              description:
                "Short branch name derived from the packages and target versions being updated, prefixed with 'security/' (e.g. 'security/lodash-4.17.21-cross-spawn-7.0.6')",
              type: "string",
            },
          },
          required: ["id", "suggestedBranch", "strategy", "reason", "packages", "command"],
          type: "object",
        },
        type: "array",
      },
      summary: {
        description: "One-paragraph summary of the remediation plan.",
        type: "string",
      },
    },
    required: ["batches", "summary"],
    type: "object",
  },
});
