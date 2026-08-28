import {
  defaultBackend,
  defineSandbox,
  type SandboxSessionContext,
} from "eve/sandbox";

export default defineSandbox({
  backend: defaultBackend({
    vercel: {
      resources: { vcpus: 4 },
    },
  }),
  async onSession({ use }: SandboxSessionContext): Promise<void> {
    const sandbox = await use();
    await sandbox.run({
      command: "git config --global --add safe.directory /workspace",
    });
  },
});
