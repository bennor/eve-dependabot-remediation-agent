import {
  defaultGitHubAuth,
  githubChannel,
} from "eve/channels/github";
import { connectGitHubCredentials } from "@vercel/connect/eve";
import { AGENT_BOT_NAME, GITHUB_CONNECTOR } from "../lib/constants.js";

const MENTION_RE = new RegExp(`@${AGENT_BOT_NAME}\\b`, "i");

export default githubChannel({
  botName: AGENT_BOT_NAME,
  credentials: connectGitHubCredentials(GITHUB_CONNECTOR),

  onComment: (ctx, comment) => {
    if (comment.body.includes("<!-- eve:github:")) return null;
    if (comment.author?.type === "Bot") return null;
    if (!MENTION_RE.test(comment.body)) return null;
    return { auth: defaultGitHubAuth(ctx) };
  },

  onPullRequest: (ctx, pr) => {
    const isDependabot =
      ctx.sender.login === "dependabot[bot]" ||
      ctx.sender.login === "dependabot";

    if (isDependabot && (pr.action === "opened" || pr.action === "reopened")) {
      return {
        auth: defaultGitHubAuth(ctx),
        context: [
          `Dependabot security update pull request #${pr.pullRequestNumber}.`,
          "Triage this dependency update: check whether the flagged vulnerable function is reachable from the repository's code, and post a recommendation on whether to merge or defer.",
        ],
        title: `Dependabot Triage #${pr.pullRequestNumber}`,
      };
    }

    return null;
  },
});
