# Dependabot remediation agent

An Eve agent that takes Dependabot vulnerability alerts, plans batch upgrades, verifies changes against the repository test suite, and opens draft pull requests.

## How it works

The root agent receives work from GitHub and coordinates three subagents. Scanner, Planner, and Remediator form the logical processing flow, but they do not communicate directly. The root agent invokes each one and passes its structured result into the next stage.

```text
GitHub issue / PR thread / prompt
                 │
                 │ via Vercel Connect
                 ▼
┌──────────────────────────── ROOT AGENT ────────────────────────────┐
│                                                                   │
│  Receives source context and coordinates the complete workflow    │
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌────────────────┐   │
│  │   Scanner    │ ───> │   Planner    │ ───> │   Remediator   │   │
│  │   subagent   │      │   subagent   │      │    subagent    │   │
│  └──────────────┘      └──────────────┘      └────────────────┘   │
│                                                                   │
│  Each subagent returns structured output to the root agent        │
│  before the root agent invokes the next stage.                    │
│                                                                   │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
                    Verified draft pull request
```

1. **Root coordination**: The root agent follows [`agent/instructions.ts`](agent/instructions.ts). It passes the complete issue, pull request thread, or prompt to Scanner, receives the validated package list, passes that list to Planner, then sends Planner's remediation batches to Remediator.
2. **Repository scanning**: The [`scanner`](agent/subagents/scanner/) subagent interprets the requested packages from the source context. It inspects `package.json` in the shared sandbox, checks current versions, confirms where each package is declared, and drops packages that are already updated or not installed. If no actionable target is found, its structured result tells the root agent to stop.
3. **Batch planning**: The [`planner`](agent/subagents/planner/) subagent receives Scanner's `validPackages` output from the root agent. It groups independent patch and minor updates into a batch, isolates potentially breaking major updates, and generates concise package-based branch names such as `security/lodash-4.17.21-cross-spawn-7.0.6`.
4. **Remediation and verification**: The [`remediator`](agent/subagents/remediator/) subagent receives Planner's batches from the root agent. It creates the feature branch, applies version bumps, and uses [`run_verification`](agent/subagents/remediator/tools/run_verification.ts) to run `pnpm build` and `pnpm test`. It attempts targeted repairs when an upgrade breaks the build, then commits with the bot identity configured by [`agent/sandbox.ts`](agent/sandbox.ts) and calls [`push_branch`](agent/subagents/remediator/tools/push_branch.ts).
5. **Draft delivery**: Remediator returns its branch and verification results to the root agent. The root agent opens a draft pull request through [`github__createPullRequest`](agent/extensions/github.ts). `createPullRequestPolicy` allows verified draft pull requests to open autonomously while non-draft changes remain approval-gated.

## GitHub intake and interaction

The agent connects to GitHub through Vercel Connect and the Eve GitHub channel ([`agent/channels/github.ts`](agent/channels/github.ts)).

### How work is triggered

- **Issue or pull request mentions**: Mentioning the bot handle (e.g. `@dependabot-agent please fix` or `@dependabot-agent fix lodash`) on an issue or pull request starts an interactive session. The channel ignores bot comments and checks for collaborator permissions before dispatching.
- **Automated Dependabot triage**: When Dependabot opens or reopens a security pull request, the channel intercepts the webhook, checks whether the vulnerable symbol is reachable from repository code, and posts an evidence-backed recommendation comment directly on the pull request.
- **Local development TUI**: Running `pnpm dev` launches an interactive terminal session where you can prompt the agent directly against a local checkout.

### Raising pull requests and comments

- **Branch pushes**: The remediator station pushes feature branches directly from the sandbox to the target repository using [`push_branch`](agent/subagents/remediator/tools/push_branch.ts), with credentials brokered through Vercel Connect.
- **Pull request creation**: The orchestrator opens the draft pull request using [`github__createPullRequest`](agent/extensions/github.ts). The pull request body contains the full remediation log, including resolved package versions and test verification output.
- **Progress updates**: The orchestrator posts progress notes and triage results using `github__addIssueComment` and `github__addPullRequestComment`.

### Approval and human-in-the-loop gates

Tool policies are defined in [`agent/extensions/github.ts`](agent/extensions/github.ts):

- **Draft pull requests**: `createPullRequest` checks the `draft` parameter. Setting `draft: true` marks the action as `not-applicable` for approval, allowing the agent to deliver draft pull requests autonomously.
- **Publishing and updates**: Non-draft pull requests or updates that change pull request status require explicit human approval (`user-approval`). Eve pauses the session and renders an approval prompt on the originating thread, waiting for a maintainer to reply before executing.
- **Comments and triage**: Progress comments and label applications run without approval (`never`), keeping the issue thread updated as stations complete.

## Repository layout

- [`agent/agent.ts`](agent/agent.ts): Root orchestrator model and session token budget.
- [`agent/instructions.ts`](agent/instructions.ts): System prompt defining the scan, plan, remediate, and deliver pipeline.
- [`agent/sandbox.ts`](agent/sandbox.ts): Sandbox definition with git safe directory and bot commit identity.
- [`agent/channels/`](agent/channels/): Inbound channels for local dev (`eve.ts`) and GitHub webhooks (`github.ts`).
- [`agent/extensions/github.ts`](agent/extensions/github.ts): GitHub tool extensions with custom approval policies.
- [`agent/subagents/`](agent/subagents/): Specialist stations (`scanner`, `planner`, `remediator`).

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Configure `.env.local`:

```ini
GITHUB_CONNECTOR=github/your-connector
TARGET_REPO=owner/repo
```

## Commands

```bash
pnpm dev       # run local interactive dev session
pnpm validate  # run TypeScript check and discovery diagnostics
eve deploy     # deploy to Vercel production
```
