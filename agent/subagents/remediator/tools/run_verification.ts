import { defineTool } from "eve/tools";
import { z } from "zod";

function parseNullDelimited(value: unknown): string[] {
  return String(value || "")
    .split("\0")
    .filter((entry) => entry.length > 0);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export default defineTool({
  description:
    "Run a verification command (build, test, lint, or dev-server test) inside the sandbox. " +
    "Preserves changes that existed before the command and removes tracked or untracked artifacts created by the command.",
  async execute(input, ctx) {
    const sandbox = await ctx.getSandbox();
    const beforeTracked = await sandbox.run({
      command: "git -C /workspace diff --name-only -z HEAD",
    });
    const beforeUntracked = await sandbox.run({
      command: "git -C /workspace ls-files --others --exclude-standard -z",
    });

    const result = await sandbox.run({
      command: input.command,
    });

    const afterTracked = await sandbox.run({
      command: "git -C /workspace diff --name-only -z HEAD",
    });
    const afterUntracked = await sandbox.run({
      command: "git -C /workspace ls-files --others --exclude-standard -z",
    });

    const trackedBefore = new Set(parseNullDelimited(beforeTracked.stdout));
    const untrackedBefore = new Set(parseNullDelimited(beforeUntracked.stdout));
    const generatedTracked = parseNullDelimited(afterTracked.stdout).filter(
      (path) => !trackedBefore.has(path)
    );
    const generatedUntracked = parseNullDelimited(afterUntracked.stdout).filter(
      (path) => !untrackedBefore.has(path)
    );
    const cleanupErrors: string[] = [];

    for (const path of generatedTracked) {
      const restore = await sandbox.run({
        command: `git -C /workspace restore --source=HEAD --staged --worktree -- ${shellQuote(path)}`,
      });
      if (restore.exitCode !== 0) {
        cleanupErrors.push(
          `Failed to restore ${path}: ${String(restore.stderr || restore.stdout).trim()}`
        );
      }
    }

    for (const path of generatedUntracked) {
      const remove = await sandbox.run({
        command: `git -C /workspace clean -f -- ${shellQuote(path)}`,
      });
      if (remove.exitCode !== 0) {
        cleanupErrors.push(
          `Failed to remove ${path}: ${String(remove.stderr || remove.stdout).trim()}`
        );
      }
    }

    return {
      cleanupErrors,
      command: input.command,
      exitCode: result.exitCode,
      passed: result.exitCode === 0 && cleanupErrors.length === 0,
      removedArtifacts: generatedUntracked,
      restoredArtifacts: generatedTracked,
      stderr: String(result.stderr || "").trim(),
      stdout: String(result.stdout || "").trim(),
    };
  },
  inputSchema: z.object({
    command: z
      .string()
      .describe("The shell command to run in the sandbox (e.g. 'pnpm build', 'pnpm test')"),
  }),
  outputSchema: z.object({
    cleanupErrors: z.array(z.string()),
    command: z.string(),
    exitCode: z.number(),
    passed: z.boolean(),
    removedArtifacts: z.array(z.string()),
    restoredArtifacts: z.array(z.string()),
    stderr: z.string(),
    stdout: z.string(),
  }),
});
