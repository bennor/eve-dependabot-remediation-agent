import { defineAgent } from "eve";
import { MODELS } from "../../lib/models.js";

export default defineAgent({
  description:
    "Interpret the incoming GitHub issue, pull request, or prompt and inspect the repository in the sandbox. " +
    "Extract package update requests from the source context, validate them against package.json, discover " +
    "current versions, and separate actionable updates from ambiguous, stale, missing, or already-updated packages.",
  model: MODELS.scanner,
  outputSchema: {
    additionalProperties: false,
    properties: {
      ambiguities: {
        description: "Source-context details that are too ambiguous to turn into a safe package update request.",
        items: { type: "string" },
        type: "array",
      },
      requestedPackages: {
        description: "Package requests interpreted from the source context, with evidence from that context.",
        items: {
          additionalProperties: false,
          properties: {
            advisoryIds: { items: { type: "string" }, type: "array" },
            currentVersionHint: { type: "string" },
            evidence: { type: "string" },
            name: { type: "string" },
            targetVersionHint: { type: "string" },
          },
          required: ["name", "evidence"],
          type: "object",
        },
        type: "array",
      },
      skippedPackages: {
        description: "Packages that cannot or should not be updated, with an explicit reason.",
        items: {
          additionalProperties: false,
          properties: {
            currentVersion: {
              description: "Installed version found in package.json, if any.",
              type: "string",
            },
            name: { type: "string" },
            reason: {
              enum: [
                "already_updated",
                "not_installed",
                "missing_target_version",
                "unsupported_ecosystem",
              ],
              type: "string",
            },
            targetVersion: {
              description: "Target version requested, if provided.",
              type: "string",
            },
          },
          required: ["name", "reason"],
          type: "object",
        },
        type: "array",
      },
      summary: {
        description: "Concise summary of repository scan findings.",
        type: "string",
      },
      validPackages: {
        description: "Packages confirmed present in package.json with verified upgrade targets, ready for the planner.",
        items: {
          additionalProperties: false,
          properties: {
            advisoryIds: {
              items: { type: "string" },
              type: "array",
            },
            breaking: {
              description: "True if target version crosses a semver major boundary.",
              type: "boolean",
            },
            currentVersion: {
              description: "Currently installed version in package.json.",
              type: "string",
            },
            dependencyType: {
              enum: ["dependencies", "devDependencies", "peerDependencies"],
              type: "string",
            },
            name: { type: "string" },
            patchStrategy: {
              enum: ["batch-patch", "batch-minor", "sequential-major"],
              type: "string",
            },
            targetVersion: {
              description: "Verified target safe version to upgrade to.",
              type: "string",
            },
          },
          required: [
            "name",
            "currentVersion",
            "targetVersion",
            "dependencyType",
            "breaking",
            "patchStrategy",
          ],
          type: "object",
        },
        type: "array",
      },
    },
    required: [
      "requestedPackages",
      "validPackages",
      "skippedPackages",
      "ambiguities",
      "summary",
    ],
    type: "object",
  },
});
