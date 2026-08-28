import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Run a verification command (build, test, or lint) inside the sandbox and return the exit code, stdout, and stderr. " +
    "Use this to confirm that dependency upgrades have not broken the build or tests.",
  async execute(input, ctx) {
    const sandbox = await ctx.getSandbox();
    const result = await sandbox.run({
      command: input.command,
    });

    return {
      command: input.command,
      exitCode: result.exitCode,
      passed: result.exitCode === 0,
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
    command: z.string(),
    exitCode: z.number(),
    passed: z.boolean(),
    stderr: z.string(),
    stdout: z.string(),
  }),
});
