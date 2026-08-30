import { defineTool } from "eve/tools";
import { z } from "zod";

const ExtractedPackageSchema = z.object({
  advisoryIds: z
    .array(z.string())
    .describe("Associated CVE or GHSA identifiers if present in the text"),
  currentVersion: z
    .string()
    .optional()
    .describe("Current vulnerable version if mentioned (e.g. '4.17.20')"),
  evidence: z
    .string()
    .describe("Text excerpt showing where the package was identified"),
  name: z
    .string()
    .describe("Package name (e.g. 'lodash', 'cross-spawn', '@types/node')"),
  targetVersion: z
    .string()
    .optional()
    .describe("Target or fixed version if mentioned (e.g. '4.17.21')"),
});

// Matches standard npm package names including scoped packages (@org/pkg)
const PKG_NAME_RE =
  /(?:@[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z0-9_.-]+)/i;

// Common Dependabot and version upgrade phrasing patterns
const BUMP_FROM_TO_RE =
  /\b(?:bump|upgrade|update)\s+(@?[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?)\s+from\s+([vV]?\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)\s+to\s+([vV]?\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)/gi;

const UPDATE_TO_RE =
  /\b(?:bump|upgrade|update|fix|remediate)\s+(@?[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?)(?:\s*(?:to|->|=>|@)\s*([vV]?\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?))?/gi;

const CVE_RE = /\b(CVE-\d{4}-\d{4,8}|GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})\b/gi;

function cleanVersion(v: string | undefined): string | undefined {
  if (!v) return undefined;
  return v.trim().replace(/^[vV^~>=<]+/, "");
}

export default defineTool({
  description:
    "Extract package names, version hints, and advisory references directly from the prompt, " +
    "GitHub issue title/body, or thread comments. Runs pure text analysis without accessing " +
    "the sandbox or repository files.",
  async execute(input) {
    const text = input.text.trim();
    if (!text) {
      return {
        found: false,
        packages: [],
        summary: "No input text provided.",
      };
    }

    const cveMatches = Array.from(
      new Set(
        Array.from(text.matchAll(CVE_RE), (m) => m[1].toUpperCase())
      )
    );

    const foundPackages = new Map<
      string,
      z.infer<typeof ExtractedPackageSchema>
    >();

    // Pattern 1: Bump <pkg> from <ver> to <ver>
    for (const match of text.matchAll(BUMP_FROM_TO_RE)) {
      const pkgName = match[1].toLowerCase().trim();
      const current = cleanVersion(match[2]);
      const target = cleanVersion(match[3]);

      foundPackages.set(pkgName, {
        advisoryIds: cveMatches,
        currentVersion: current,
        evidence: match[0],
        name: pkgName,
        targetVersion: target,
      });
    }

    // Pattern 2: (fix|remediate|upgrade|bump) <pkg> [to <ver>]
    for (const match of text.matchAll(UPDATE_TO_RE)) {
      const candidateName = match[1].toLowerCase().trim();

      // Skip common non-package words
      if (
        [
          "all",
          "vulnerabilities",
          "vulnerability",
          "dependencies",
          "packages",
          "alerts",
          "alerts.json",
          "json",
          "security",
          "repo",
          "repository",
          "issue",
          "pr",
          "the",
          "this",
          "it",
          "please",
        ].includes(candidateName)
      ) {
        continue;
      }

      if (!foundPackages.has(candidateName)) {
        const target = cleanVersion(match[2]);
        foundPackages.set(candidateName, {
          advisoryIds: cveMatches,
          currentVersion: undefined,
          evidence: match[0],
          name: candidateName,
          targetVersion: target,
        });
      }
    }

    // Pattern 3: Look for comma/and separated lists following "fix" or "remediate"
    const listMatch = text.match(
      /\b(?:fix|remediate|upgrade|update)\s+([@a-z0-9_.,\s-and]+?)(?:\.|$|\n|using|with)/i
    );
    if (listMatch) {
      const tokens = listMatch[1]
        .split(/[,&]|\band\b/i)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      for (const token of tokens) {
        const words = token.split(/\s+/);
        const pkgCandidate = words[0]?.toLowerCase().trim();
        if (
          pkgCandidate &&
          PKG_NAME_RE.test(pkgCandidate) &&
          ![
            "all",
            "vulnerabilities",
            "vulnerability",
            "dependencies",
            "packages",
            "alerts",
            "security",
            "repo",
            "repository",
            "issue",
            "pr",
            "the",
            "this",
            "please",
          ].includes(pkgCandidate)
        ) {
          if (!foundPackages.has(pkgCandidate)) {
            const versionCandidate = cleanVersion(words[1] ?? words[2]);
            foundPackages.set(pkgCandidate, {
              advisoryIds: cveMatches,
              currentVersion: undefined,
              evidence: token,
              name: pkgCandidate,
              targetVersion: versionCandidate,
            });
          }
        }
      }
    }

    const packages = Array.from(foundPackages.values());

    return {
      found: packages.length > 0,
      packages,
      summary:
        packages.length > 0
          ? `Extracted ${packages.length} package target(s): ${packages.map((p) => `${p.name}${p.targetVersion ? `@${p.targetVersion}` : ""}`).join(", ")}.`
          : "No specific package targets identified in the input text.",
    };
  },
  inputSchema: z.object({
    text: z
      .string()
      .describe(
        "The complete text of the prompt, issue title, issue description, or PR comments to extract packages from."
      ),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    packages: z.array(ExtractedPackageSchema),
    summary: z.string(),
  }),
});
