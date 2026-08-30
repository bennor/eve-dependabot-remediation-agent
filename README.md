# Dependabot remediation agent

An Eve agent that takes Dependabot vulnerability alerts, plans batch upgrades, verifies changes against the repository test suite, and opens draft pull requests.

## How it works

The agent coordinates three stations to turn Dependabot alerts into verified draft pull requests:

```
[ Dependabot Alert / Payload ]
              │
              ▼
    ┌──────────────────┐
    │  Scanner Tool    │  Reads alerts and repository package.json
    └─────────┬────────┘
              │
              ▼
    ┌──────────────────┐
    │  Planner Agent   │  Groups CVEs into batch vs sequential upgrades
    └─────────┬────────┘
              │
              ▼
    ┌──────────────────┐
    │ Remediator Agent │  Applies bumps, runs build/tests, and pushes branch
    └─────────┬────────┘
              │
              ▼
    ┌──────────────────┐
    │ Draft Pull Req   │  Orchestrator opens draft PR on GitHub
    └──────────────────┘
```

1. **Alert scanning**: The [`scan_alerts`](agent/tools/scan_alerts.ts) tool reads advisory payloads from `dependabot-alerts.json` or webhook context. The [`scanner`](agent/subagents/scanner/) subagent verifies each advisory against the actual `package.json` in the sandbox, dropping any that are already patched or stale.
2. **Batch planning**: The [`planner`](agent/subagents/planner/) subagent evaluates all valid alerts together. Independent patch and minor updates are grouped into a single batch transaction. Major version bumps with potential breaking API changes are isolated into sequential batches. The planner also generates concise, package-based branch names (e.g. `security/lodash-4.17.21-cross-spawn-7.0.6`).
3. **Remediation and verification**: The [`remediator`](agent/subagents/remediator/) subagent creates the feature branch, applies version bumps, and runs [`run_verification`](agent/subagents/remediator/tools/run_verification.ts) to execute `pnpm build` and `pnpm test`. If type errors or breaking changes occur, the remediator attempts targeted repairs (up to 3 retries). Once clean, it commits with a verified bot identity from [`agent/sandbox.ts`](agent/sandbox.ts) and calls [`push_branch`](agent/subagents/remediator/tools/push_branch.ts).
4. **Draft delivery**: The orchestrator in [`agent/instructions.ts`](agent/instructions.ts) opens a draft pull request via [`github__createPullRequest`](agent/extensions/github.ts). Draft pull requests open autonomously via `createPullRequestPolicy`, delivering the finished PR without getting stuck in approval loops.

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
