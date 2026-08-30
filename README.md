# Dependabot remediation agent

An Eve agent that takes Dependabot vulnerability alerts, plans batch upgrades, verifies changes against the repository test suite, and opens draft pull requests.

## How it works

1. **Scanner**: Validates incoming alerts against `package.json` and drops stale advisories.
2. **Planner**: Groups patch and minor upgrades into batch transactions, and isolates major version bumps.
3. **Remediator**: Creates a package-named branch in the sandbox, applies upgrades, runs `pnpm build` and `pnpm test`, and pushes the branch.
4. **Delivery**: The orchestrator opens an autonomous draft pull request on GitHub using `@github-tools/eve-extension`.

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
