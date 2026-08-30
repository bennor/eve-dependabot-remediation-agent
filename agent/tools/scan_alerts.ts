import { defineTool } from "eve/tools";
import { z } from "zod";

const AlertSchema = z.object({
  breaking: z.boolean(),
  cve: z.string(),
  ecosystem: z.string(),
  fixedVersion: z.string(),
  id: z.string(),
  package: z.string(),
  patchStrategy: z.enum([
    "batch-patch",
    "batch-minor",
    "sequential-major",
  ]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string(),
  vulnerableVersion: z.string(),
});

const DirectAlertSchema = z.object({
  cve: z.string().optional().describe("CVE identifier, e.g. 'CVE-2021-23337'"),
  fixedVersion: z
    .string()
    .optional()
    .describe("Target version to upgrade to, e.g. '4.17.21'"),
  package: z
    .string()
    .describe("Name of the package, e.g. 'lodash' or 'cross-spawn'"),
  severity: z
    .enum(["critical", "high", "medium", "low"])
    .optional()
    .describe("Severity level (defaults to 'high')"),
  title: z.string().optional().describe("Advisory title or summary"),
  vulnerableVersion: z
    .string()
    .optional()
    .describe("Current version in package.json (read from sandbox if omitted)"),
});

function isMajorBump(fromVer: string, toVer: string): boolean {
  const fromClean = fromVer.replace(/^[^0-9]*/, "").split(".")[0];
  const toClean = toVer.replace(/^[^0-9]*/, "").split(".")[0];
  if (!fromClean || !toClean) return false;
  return fromClean !== toClean && fromClean !== "0";
}

function getPatchStrategy(
  fromVer: string,
  toVer: string
): "batch-patch" | "batch-minor" | "sequential-major" {
  if (isMajorBump(fromVer, toVer)) {
    return "sequential-major";
  }
  const fromParts = fromVer.replace(/^[^0-9]*/, "").split(".");
  const toParts = toVer.replace(/^[^0-9]*/, "").split(".");
  if (fromParts[0] === toParts[0] && fromParts[1] !== toParts[1]) {
    return "batch-minor";
  }
  return "batch-patch";
}

export default defineTool({
  description:
    "Normalise and ingest Dependabot vulnerability alerts from the prompt/thread context, direct alert objects, " +
    "or a dependabot-alerts.json file in the sandbox. Supports filtering by package name.",
  async execute(input, ctx) {
    const sandbox = await ctx.getSandbox();

    // Read current package.json from sandbox to discover installed versions
    let installedDeps: Record<string, string> = {};
    try {
      const pkgResult = await sandbox.run({
        command:
          "cat /workspace/package.json 2>/dev/null || cat /workspace/repo/package.json 2>/dev/null || echo '{}'",
      });
      const pkgJson = JSON.parse(String(pkgResult.stdout).trim()) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      installedDeps = {
        ...(pkgJson.dependencies ?? {}),
        ...(pkgJson.devDependencies ?? {}),
      };
    } catch {
      // ignore
    }

    let rawAlerts: z.infer<typeof AlertSchema>[] = [];

    // Option 1: Direct alerts provided from prompt or GitHub thread
    if (input.alerts && input.alerts.length > 0) {
      rawAlerts = input.alerts.map((a, idx) => {
        const pkgName = a.package.trim();
        const currentRaw =
          a.vulnerableVersion ??
          installedDeps[pkgName] ??
          "0.0.0";
        const currentClean = currentRaw.replace(/^[\^~>=<]*/, "");
        const fixedClean = (a.fixedVersion ?? currentClean).replace(
          /^[\^~>=<]*/,
          ""
        );
        const breaking = isMajorBump(currentClean, fixedClean);
        const patchStrategy = getPatchStrategy(currentClean, fixedClean);

        return {
          breaking,
          cve: a.cve ?? `CVE-AUTO-${idx + 1}`,
          ecosystem: "npm",
          fixedVersion: fixedClean,
          id: a.cve ?? `alert-${pkgName}`,
          package: pkgName,
          patchStrategy,
          severity: a.severity ?? "high",
          title:
            a.title ??
            `Security vulnerability remediation for ${pkgName}`,
          vulnerableVersion: currentClean,
        };
      });
    } else {
      // Option 2: Read from alertsJson string or dependabot-alerts.json file
      let raw = input.alertsJson;
      if (!raw) {
        const result = await sandbox.run({
          command:
            "cat /workspace/dependabot-alerts.json 2>/dev/null || cat /workspace/repo/dependabot-alerts.json 2>/dev/null || echo 'NOT_FOUND'",
        });
        const output = String(result.stdout).trim();
        if (output !== "NOT_FOUND" && result.exitCode === 0) {
          raw = output;
        }
      }

      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown[];
          rawAlerts = z.array(AlertSchema).parse(parsed);
        } catch (err) {
          return {
            alerts: [],
            found: false,
            message: `Failed to parse alerts: ${String(err)}`,
          };
        }
      }
    }

    // Apply package filters if provided
    if (input.packages && input.packages.length > 0) {
      const pkgFilter = new Set(
        input.packages.map((p) => p.toLowerCase().trim())
      );
      rawAlerts = rawAlerts.filter((a) =>
        pkgFilter.has(a.package.toLowerCase().trim())
      );
    }

    const summary = {
      critical: rawAlerts.filter((a) => a.severity === "critical").length,
      high: rawAlerts.filter((a) => a.severity === "high").length,
      low: rawAlerts.filter((a) => a.severity === "low").length,
      medium: rawAlerts.filter((a) => a.severity === "medium").length,
      total: rawAlerts.length,
    };

    return {
      alerts: rawAlerts,
      found: rawAlerts.length > 0,
      message:
        rawAlerts.length > 0
          ? `Found ${rawAlerts.length} Dependabot alerts (${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low).`
          : "No matching alerts found for the requested criteria.",
      summary,
    };
  },
  inputSchema: z.object({
    alerts: z
      .array(DirectAlertSchema)
      .optional()
      .describe(
        "List of alerts extracted directly from the user message or GitHub issue/PR thread."
      ),
    alertsJson: z
      .string()
      .optional()
      .describe(
        "Raw JSON string of Dependabot alerts. If omitted, reads from sandbox file."
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
