export function requireEnv(name: string, example: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} environment variable is not set (e.g. '${example}').`
    );
  }
  return value;
}

export const TARGET_REPO = process.env.TARGET_REPO ?? "acme/widgets";

const [repoOwner = "", repoName = ""] = TARGET_REPO.split("/");
export const targetRepo = { owner: repoOwner, repo: repoName };

export const AGENT_BOT_NAME =
  process.env.AGENT_BOT_NAME ?? "dependabot-agent";

export const FIX_BRANCH_PREFIX =
  process.env.FIX_BRANCH_PREFIX ?? "security/dependabot-";

export const GITHUB_CONNECTOR =
  process.env.GITHUB_CONNECTOR ?? "github/dependabot-agent";
