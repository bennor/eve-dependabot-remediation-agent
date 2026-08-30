import { defineAgent } from "eve";
import { MODELS } from "../../lib/models.js";

export default defineAgent({
  description:
    "Execute a batch remediation plan in a sandbox checkout: create a feature branch, " +
    "edit package.json with target versions, run the package manager install, run build and tests, " +
    "fix any breakages (up to 3 retries), commit, and push the branch. The caller passes the full " +
    "remediation plan in the message.",
  model: MODELS.remediator,
  outputSchema: {
    additionalProperties: false,
    properties: {
      branch: {
        description: "The feature branch the remediation was committed and pushed to.",
        type: "string",
      },
      changeSummary: {
        description: "Per-package version changes applied.",
        items: {
          additionalProperties: false,
          properties: {
            from: { type: "string" },
            name: { type: "string" },
            to: { type: "string" },
          },
          required: ["name", "from", "to"],
          type: "object",
        },
        type: "array",
      },
      deviations: {
        description: "Departures from the plan, each with its reason; empty when the plan held.",
        items: { type: "string" },
        type: "array",
      },
      knownLimitations: {
        description: "Anything the reviewer should scrutinize.",
        items: { type: "string" },
        type: "array",
      },
      pushed: {
        description: "Whether push_branch succeeded.",
        type: "boolean",
      },
      verification: {
        description: "Commands run and what they produced, exactly.",
        items: {
          additionalProperties: false,
          properties: {
            command: { type: "string" },
            result: { type: "string" },
          },
          required: ["command", "result"],
          type: "object",
        },
        type: "array",
      },
    },
    required: [
      "branch",
      "pushed",
      "changeSummary",
      "verification",
      "deviations",
      "knownLimitations",
    ],
    type: "object",
  },
});
