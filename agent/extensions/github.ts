import githubExtension from "@github-tools/eve-extension";
import type { ApprovalContext, ApprovalStatus } from "eve/tools";
import { always, never } from "eve/tools/approval";
import { GITHUB_CONNECTOR, targetRepo } from "../lib/constants.js";

/**
 * Draft PRs open autonomously; non-draft PRs require approval.
 */
function createPullRequestPolicy(ctx: ApprovalContext): ApprovalStatus {
  const input = ctx.toolInput as { draft?: unknown } | undefined;
  if (input?.draft === true) {
    return "not-applicable";
  }
  return "user-approval";
}

export default githubExtension({
  connector: GITHUB_CONNECTOR,
  context: targetRepo,
  include: [
    "getRepository",
    "getRepositoryTree",
    "getFileContent",
    "searchCode",
    "listBranches",
    "listCommits",
    "getCommit",
    "compareCommits",
    "searchIssues",
    "listIssues",
    "getIssueContext",
    "listIssueComments",
    "addIssueComment",
    "listLabels",
    "addLabels",
    "listPullRequests",
    "getPullRequestContext",
    "listPullRequestFiles",
    "listPullRequestReviews",
    "createPullRequest",
    "updatePullRequest",
    "addPullRequestComment",
    "listCheckRuns",
  ],
  requireApproval: {
    addIssueComment: never(),
    addLabels: never(),
    addPullRequestComment: never(),
    createPullRequest: createPullRequestPolicy,
    updatePullRequest: always(),
  },
});
