import { defineTool } from "eve/tools";
import { connectGitHubCredentials } from "@vercel/connect/eve";
import { z } from "zod";
import { GITHUB_CONNECTOR, TARGET_REPO } from "../../../lib/constants.js";

const BRANCH_NAME_REGEX = /^[A-Za-z0-9._/-]+$/;

function validateBranch(branch: string): string | null {
  const trimmed = branch.trim();
  if (trimmed === "main" || trimmed === "master") {
    return "Refusing to push directly to main or master branch.";
  }
  if (!BRANCH_NAME_REGEX.test(trimmed)) {
    return `Invalid branch name: ${trimmed}`;
  }
  return null;
}

export default defineTool({
  description:
    "Push a local feature branch to the remote repository. The branch must already exist locally with the work committed and verified. " +
    "Returns the pushed branch name and head commit SHA so the orchestrator can open the draft pull request.",
  async execute(input, ctx) {
    const refusal = validateBranch(input.branch);
    if (refusal) {
      return { error: refusal, success: false as const };
    }

    const sandbox = await ctx.getSandbox();

    // Check branch existence
    const branchCheck = await sandbox.run({
      command: `git -C /workspace rev-parse --verify '${input.branch}' 2>/dev/null`,
    });

    if (branchCheck.exitCode !== 0) {
      return {
        error: `Branch '${input.branch}' not found in sandbox workspace. Ensure the fix was committed.`,
        success: false as const,
      };
    }

    // Push branch using credentials from Vercel Connect
    try {
      const credentials = connectGitHubCredentials(GITHUB_CONNECTOR);
      const tokenFn = credentials.installationToken;
      const token =
        typeof tokenFn === "function" ? await tokenFn() : tokenFn;

      if (token) {
        const authorization = `Basic ${Buffer.from(
          `x-access-token:${token}`
        ).toString("base64")}`;

        await sandbox.setNetworkPolicy({
          allow: {
            "*": [],
            "github.com": [
              { transform: [{ headers: { Authorization: authorization } }] },
            ],
          },
        });
      }

      const remoteUrl = `https://github.com/${TARGET_REPO}.git`;
      const pushResult = await sandbox.run({
        command: `git -C /workspace push ${remoteUrl} 'refs/heads/${input.branch}:refs/heads/${input.branch}' 2>&1`,
      });

      if (pushResult.exitCode !== 0) {
        return {
          error: `git push failed (exit ${pushResult.exitCode}): ${String(
            pushResult.stderr || pushResult.stdout
          ).trim()}`,
          success: false as const,
        };
      }

      const head = await sandbox.run({
        command: `git -C /workspace rev-parse '${input.branch}'`,
      });

      return {
        branch: input.branch,
        sha: String(head.stdout).trim(),
        success: true as const,
      };
    } finally {
      await sandbox.setNetworkPolicy("allow-all");
    }
  },
  inputSchema: z.object({
    branch: z
      .string()
      .min(1)
      .describe(
        "Branch name in /workspace to push, e.g. security/dependabot-batch-1"
      ),
  }),
  outputSchema: z.object({
    branch: z.string().optional(),
    error: z.string().optional(),
    sha: z.string().optional(),
    success: z.boolean(),
  }),
});
