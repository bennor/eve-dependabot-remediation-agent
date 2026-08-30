import { defineTool } from "eve/tools";
import { z } from "zod";

const AlertSchema = z.object({
  id: z.string(),
  package: z.string(),
  ecosystem: z.string(),
  vulnerableVersion: z.string(),
  fixedVersion: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  cve: z.string(),
  title: z.string(),
  breaking: z.boolean(),
  patchStrategy: z.enum([
    "batch-patch",
    "batch-minor",
    "sequential-major",
  ]),
});

export default defineTool({
  description:
    "Read and parse Dependabot vulnerability alerts from a dependabot-alerts.json file in the sandbox workspace, " +
    "or from a JSON string provided as input. Returns a normalised list of alerts with package, version, severity, " +
    "and patch strategy metadata.",
  async execute(input, ctx) {
    let raw: string;

    if (input.alertsJson) {
      raw = input.alertsJson;
    } else {
      const sandbox = await ctx.getSandbox();
      const result = await sandbox.run({
        command:
          "cat /workspace/dependabot-alerts.json 2>/dev/null || cat /workspace/repo/dependabot-alerts.json 2>/dev/null || echo 'NOT_FOUND'",
      });
      const output = String(result.stdout).trim();
      if (output === "NOT_FOUND" || result.exitCode !== 0) {
        return {
          alerts: [],
          found: false,
          message:
            "No dependabot-alerts.json found in the workspace. Provide alerts as JSON input.",
        };
      }
      raw = output;
    }

    try {
      const parsed = JSON.parse(raw) as unknown[];
      let alerts = z.array(AlertSchema).parse(parsed);

      if (input.packages && input.packages.length > 0) {
        const pkgFilter = new Set(
          input.packages.map((p) => p.toLowerCase().trim())
        );
        alerts = alerts.filter((a) =>
          pkgFilter.has(a.package.toLowerCase().trim())
        );
      }

      const summary = {
        critical: alerts.filter((a) => a.severity === "critical").length,
        high: alerts.filter((a) => a.severity === "high").length,
        low: alerts.filter((a) => a.severity === "low").length,
        medium: alerts.filter((a) => a.severity === "medium").length,
        total: alerts.length,
      };

      return {
        alerts,
        found: true,
        message: `Found ${alerts.length} Dependabot alerts (${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low).`,
        summary,
      };
    } catch (err) {
      return {
        alerts: [],
        found: false,
        message: `Failed to parse alerts: ${String(err)}`,
      };
    }
  },
  inputSchema: z.object({
    alertsJson: z
      .string()
      .optional()
      .describe(
        "Raw JSON string of Dependabot alerts. If omitted, the tool reads dependabot-alerts.json from the sandbox."
      ),
    packages: z
      .array(z.string())
      .optional()
      .describe(
        "Optional list of package names to filter by (e.g. ['lodash']). When supplied, only matching alerts are returned."
      ),
  }),
  outputSchema: z.object({
    alerts: z.array(AlertSchema),
    found: z.boolean(),
    message: z.string(),
    summary: z
      .object({
        critical: z.number(),
        high: z.number(),
        low: z.number(),
        medium: z.number(),
        total: z.number(),
      })
      .optional(),
  }),
});
