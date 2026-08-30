import {
  defaultBackend,
  defineSandbox,
  type SandboxSessionContext,
} from "eve/sandbox";
import { AGENT_BOT_NAME } from "./lib/constants.js";

export default defineSandbox({
  backend: defaultBackend({
    vercel: {
      resources: { vcpus: 4 },
    },
  }),
  async onSession({ use }: SandboxSessionContext): Promise<void> {
    const sandbox = await use();
    const botSlug = AGENT_BOT_NAME.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    await sandbox.run({
      command: `git config --global --add safe.directory /workspace && git config --global user.name "${AGENT_BOT_NAME}[bot]" && git config --global user.email "${botSlug}[bot]@users.noreply.github.com"`,
    });
  },
});
