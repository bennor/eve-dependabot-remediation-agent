import githubExtension from "@github-tools/eve-extension";
import { targetRepo } from "../lib/constants.js";
import { GITHUB_CONNECTOR } from "../lib/constants.js";

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
    createPullRequest: "always",
    addIssueComment: "never",
    addLabels: "never",
    updatePullRequest: "always",
    addPullRequestComment: "never",
  },
});
