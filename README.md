# Dependabot remediation agent

An Eve agent that takes Dependabot vulnerability alerts, plans batch upgrades, verifies changes against the repository test suite, and opens draft pull requests.

## How it works

The agent coordinates a target extraction tool and three stations to turn thread or prompt context into verified draft pull requests:

```
[ GitHub Issue / PR Thread / Prompt ]
                 │
                 ▼
     ┌───────────────────────┐
     │   extract_packages    │  Pure text parser: extracts targets & versions
     └───────────┬───────────┘  (no sandbox or repository access)
                 │
                 ▼
     ┌───────────────────────┐
     │    Scanner Station    │  Validates targets against package.json in sandbox
     └───────────┬───────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │    Planner Station    │  Groups updates into batch vs sequential upgrades
     └───────────┬───────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │   Remediator Station  │  Applies bumps, runs build/tests, and pushes branch
     └───────────┬───────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │    Draft Pull Req     │  Orchestrator opens draft PR via Vercel Connect
     └───────────────────────┘
```

1. **Target extraction**: The [`extract_packages`](agent/tools/extract_packages.ts) tool parses the issue title, description, or comment (e.g. `Bump lodash from 4.17.20 to 4.17.21` or `@dependabot-agent fix lodash`). It performs pure text analysis without touching the repository files. If no package targets are found, the agent stops immediately and asks for clarification.
2. **Repository scanning**: The [`scanner`](agent/subagents/scanner/) subagent receives the extracted targets and inspects the repository's `package.json` in the sandbox. It checks current versions, confirms presence in `dependencies` or `devDependencies`, and drops any packages that are already updated or not installed.
3. **Batch planning**: The [`planner`](agent/subagents/planner/) subagent evaluates the verified packages. Independent patch and minor updates are grouped into a single batch transaction. Major version bumps with potential breaking API changes are isolated into sequential batches. The planner generates concise, package-based branch names (e.g. `security/lodash-4.17.21-cross-spawn-7.0.6`).
4. **Remediation and verification**: The [`remediator`](agent/subagents/remediator/) subagent creates the feature branch, applies version bumps, and runs [`run_verification`](agent/subagents/remediator/tools/run_verification.ts) to execute `pnpm build` and `pnpm test`. If type errors or breaking changes occur, the remediator attempts targeted repairs (up to 3 retries). Once clean, it commits with a verified bot identity from [`agent/sandbox.ts`](agent/sandbox.ts) and calls [`push_branch`](agent/subagents/remediator/tools/push_branch.ts).
5. **Draft delivery**: The orchestrator in [`agent/instructions.ts`](agent/instructions.ts) opens a draft pull request via [`github__createPullRequest`](agent/extensions/github.ts). Draft pull requests open autonomously via `createPullRequestPolicy`, delivering the finished PR without getting stuck in approval loops.

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
- [`agent/instructions.ts`](agent/instructions.ts): System prompt defining the extract, scan, plan, remediate, and deliver pipeline.
- [`agent/sandbox.ts`](agent/sandbox.ts): Sandbox definition with git safe directory and bot commit identity.
- [`agent/channels/`](agent/channels/): Inbound channels for local dev (`eve.ts`) and GitHub webhooks (`github.ts`).
- [`agent/extensions/github.ts`](agent/extensions/github.ts): GitHub tool extensions with custom approval policies.
- [`agent/tools/extract_packages.ts`](agent/tools/extract_packages.ts): Pure text analysis tool for extracting package update targets from prompts and threads.
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
