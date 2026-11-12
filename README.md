# Farmbridge

Farmbridge is a cocoa procurement platform built as a pnpm workspace and managed with Turborepo.

## Workspaces

- `apps/mobile` — Expo app for both farmers and administrators. The server, not the client, will determine a signed-in user's permissions.
- `apps/web` — TanStack Start + React web application for administrators.
- `apps/api` — Hono API running on Cloudflare Workers.
- `packages/eslint-config` and `packages/typescript-config` — shared project configuration.

Each app is a separate package with its own dependencies and scripts. The root workspace provides one dependency installation and one lockfile; Turborepo runs matching scripts across packages and can cache build outputs.

## Getting started

Install dependencies from the repository root:

```sh
pnpm install
```

Run all app development servers together:

```sh
pnpm dev
```

Or run one app at a time:

```sh
pnpm --filter mobile dev
pnpm --filter web dev
pnpm --filter api dev
```

For the Expo native Android workflow, use Expo's local native build command from the root:

```sh
pnpm --filter mobile exec expo run:android --device
```

This requires Android Studio/SDK and a connected or configured device. The API's local Wrangler server is available at `http://localhost:8787` by default.
