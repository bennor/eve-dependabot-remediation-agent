import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

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
  approval: always(),
  description:
    "Push a committed remediation branch from the sandbox and create a draft pull request on GitHub. " +
    "This action is gated on human approval.",
  async execute(input, ctx) {
    const refusal = validateBranch(input.branch);
    if (refusal) {
      return { branch: input.branch, error: refusal, success: false };
    }

    const sandbox = await ctx.getSandbox();

    const branchCheck = await sandbox.run({
      command: `git -C /workspace rev-parse --verify '${input.branch}' 2>/dev/null`,
    });

    if (branchCheck.exitCode !== 0) {
      return {
        branch: input.branch,
        error: `Branch '${input.branch}' not found in sandbox. Ensure the fix was committed.`,
        success: false,
      };
    }

    const pushResult = await sandbox.run({
      command: `git -C /workspace push origin 'refs/heads/${input.branch}:refs/heads/${input.branch}' 2>&1`,
    });

    if (pushResult.exitCode !== 0) {
      return {
        branch: input.branch,
        error: `Git push failed (exit ${pushResult.exitCode}): ${String(
          pushResult.stderr || pushResult.stdout
        ).trim()}`,
        success: false,
      };
    }

    const prUrl = `https://github.com/${input.targetRepo}/pull/new/${input.branch}`;

    return {
      branch: input.branch,
      prUrl,
      success: true,
    };
  },
  inputSchema: z.object({
    body: z
      .string()
      .describe("Detailed PR description including CVE list, version changes, and verification results"),
    branch: z
      .string()
      .describe("Local git branch name in the sandbox (e.g. 'security/dependabot-batch-1')"),
    targetRepo: z.string().describe("Owner/repo name of the target repository"),
    title: z.string().describe("Pull request title"),
  }),
  outputSchema: z.object({
    branch: z.string(),
    error: z.string().optional(),
    prUrl: z.string().optional(),
    success: z.boolean(),
  }),
});
