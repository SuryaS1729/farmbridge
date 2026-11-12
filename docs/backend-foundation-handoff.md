# Farmbridge backend foundation handoff

This is a short handoff for continuing the backend setup. The owner is learning the monorepo workflow and prefers guided, incremental steps with commands and explanations. Do not assume they want an agent to implement the entire backend for them.

## Product and architecture decisions

- Farmbridge is a pnpm/Turborepo monorepo.
- `apps/mobile` is the Expo app for both farmers and admins.
- `apps/api` is the Hono API running on Cloudflare Workers.
- `apps/web` is a React/Vite app planned for later. Both the mobile and web apps will use the API; neither should connect directly to Postgres.
- Backend focus comes first: mobile app plus Hono API. Web UI work is deferred.
- Use Neon Postgres only (no Neon Managed Auth) and self-managed Better Auth inside the Hono API.
- Authentication is intended to be phone/OTP based. The SMS provider (Exotel or MSG91) is not yet wired into the code; confirm the final provider choice before implementing its integration.
- Admin/farmer authorization must be enforced by the API using server-side user roles. The clients can render different screens based on the authenticated user, but must not be trusted to grant roles.
- Keep backend-only database code in `apps/api/src/db` initially. Add a shared workspace package only when there is a genuine consumer outside the API.

## Completed setup

### Neon

- Reused the existing Neon project rather than creating another one. Its identity and current branch are recorded in the root `.neon` file.
- Root `neon.ts` is now `defineConfig({})`. It declares no Managed Auth service and has no seven-day TTL policy for new branches.
- Installed Neon config packages at the workspace root: `@neon/config` and `@neon/env`.
- Created and checked out a Neon `dev` branch from `production` with `neon checkout dev --create`.
- Neon pulled `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `NEON_BRANCH` into root `.env.local`.
- `.env.local` is ignored by Git. Never commit it or paste its contents into chat. Use the unpooled/direct URL for migrations and as the upstream URL for Hyperdrive.

### Cloudflare Hyperdrive and API workspace

- Created a Cloudflare Hyperdrive config named `farmbridge-dev`, pointing at the Neon development branch via the unpooled connection string.
- Wrangler added a `HYPERDRIVE` binding to `apps/api/wrangler.jsonc`. The Hyperdrive ID is in that file.
- `apps/api/wrangler.jsonc` currently has `compatibility_date: "2026-10-13"`. Do not casually bump it: an earlier local Wrangler/workerd run rejected a date one day newer than the installed runtime supported.
- Added API workspace dependencies: `drizzle-orm`, `pg`, `drizzle-kit`, and `@types/pg`.
- Added API workspace dependencies `better-auth` and `@better-auth/drizzle-adapter` for self-managed Better Auth backed by Drizzle/Postgres.
- Added `apps/api/src/auth.ts` as a Better Auth factory using the Drizzle Postgres adapter, the phone-number plugin, and a server-managed `farmer`/`admin` role. For local development only, the OTP is currently printed in the Wrangler terminal instead of being sent by SMS. Replace this before any deployment.
- Added `apps/api/auth.cli.ts`, a CLI-only config used for Better Auth schema generation. Its placeholder URL and secret are not runtime credentials and it is not imported by the Worker.
- Generated `apps/api/src/db/schema.ts` with Better Auth's user/session/account/verification tables, phone fields, and role field.
- Added `apps/api/drizzle.config.ts`; it loads `DATABASE_URL_UNPOOLED` from the ignored root `.env.local` for Drizzle Kit migrations.
- Generated and reviewed `apps/api/drizzle/0000_wooden_yellowjacket.sql`. It creates the Better Auth tables, foreign keys, indexes, phone fields, and non-null farmer-default role.
- Applied the migration successfully to the linked Neon `dev` branch with Drizzle Kit. The command emitted an SSL mode compatibility warning (`require` currently aliases `verify-full` in the installed driver; semantics are scheduled to change in pg 9), but migrations completed successfully. Revisit before upgrading to pg 9.
- Ran `pnpm --filter api cf-typegen`; it generated `apps/api/worker-configuration.d.ts` with the Cloudflare binding types. Wrangler recommended `@types/node` because Node.js compatibility is enabled, and it has since been installed in the API workspace.
- Added `apps/api/src/db/client.ts`, which creates a `pg` client and Drizzle instance from a supplied connection string.
- Added a temporary `/health/db` route in `apps/api/src/index.ts`; it runs `select 1` through Drizzle using `c.env.HYPERDRIVE.connectionString`.
- Mounted Better Auth at `/api/auth/*` in Hono. The handler creates Better Auth with the request's Hyperdrive connection and local auth secret/base URL.
- Passed the generated Drizzle schema explicitly to the Better Auth adapter after its runtime schema check reported missing tables; configured the local `BETTER_AUTH_URL` as a Wrangler `vars` value because `secrets.required` filters local env files.
- Verified the local OTP flow with an API client: `POST /api/auth/phone-number/send-otp` printed the code in Wrangler, `POST /api/auth/phone-number/verify` created a phone-verified user and session, and `GET /api/auth/get-session` returned that session and user. Postman needed `Origin: http://localhost:8787` on subsequent requests after its cookie jar had stored the session cookie.
- Configured the local Hyperdrive connection for Wrangler using the unpooled URL for Neon `dev` in an ignored API-local env file. Local `wrangler dev` uses this direct connection for development; the deployed Worker will use the Hyperdrive config.
- Manually opened `/health/db` and received `{ "ok": true, "database": "connected" }`. This confirms the local Worker can reach the Neon `dev` branch and execute a query.

## Current code status

- Mobile phone/OTP auth is integrated with Better Auth, `@better-auth/expo`, and SecureStore. The root Expo Router layout protects the `(auth)` and `(farmer)` route groups according to session state. This is session routing only; role-specific routing for administrators is not implemented.
- The API exposes Better Auth, `/health/db`, today's published Cocoa price, daily-price publishing for admins, farmer quote submission and history (`GET /api/offers/mine`), farmer-owned deal pickup-location updates (`POST /api/deals/:dealId/pickup-location`, blocked once collected), admin quote decisions/deal listing/pickup-date scheduling/pickup collection recording (`POST /api/admin/deals/:dealId/collection`), and a server-side admin phone authorization route. Business routes require a verified phone session and enforce farmer/admin roles on the server. Farmer quote history is scoped to the authenticated farmer profile and returns the newest 100 quotes with decision details, pickup location, and current scheduled pickup date.
- The Vite admin app has an OTP login, daily price publishing dashboard, quote review queue, and deals list. Admins can filter open/pending/price-revision quotes and filter by offer price, quantity in quintals, moisture, bean count, and readiness date. The API returns the newest 100 matches. Admins can accept pending unexpired quotes (creating a deal with a snapshot of the offer terms), reject open quotes with a required reason, and schedule/update a pickup date on an open deal using `DD-MM-YYYY` after the farmer provides a location; deals show the farmer's text location and expected-ready date. Decisions, pickup locations, and pickup-date changes are recorded in offer events (the location text itself is not duplicated in those events). Migrations `0005` through `0007` have been applied to Neon `dev`.
- Local browser requests are allowed from the Vite development origins with credentialed cookies. Admin authorization is checked by the API against the `ADMIN_PHONE_NUMBER` secret; the dashboard phone field is only a convenience and does not grant access. The local dev number is configured; production provisioning remains separate.
- The farmer home screen loads today's base price with a kg/quintal display switch (default kg) and quietly refreshes when it regains navigation focus or the app returns to the foreground. It links to My quotes, which shows decision statuses, rejection reasons, locked deal terms after acceptance, the scheduled pickup date, and a form for the farmer to share/update pickup location on an open deal. Admins enter the daily price per quintal; the API stores the equivalent per-kg amount at four decimal places to preserve paise. The farmer quote flow collects offer price per kg, quantity in either quintals (default) or kg, required self-reported moisture percentage and bean count per 100 g, and one expected pickup-ready date. User-facing dates use Indian `DD-MM-YYYY`; the app converts them to ISO `YYYY-MM-DD` for API/database handling. It includes a review step; the API normalizes quantity to kilograms for storage and records the entered amount, unit, and normalized amount in the audit event. The admin queue displays derived quantities in quintals.
- Drizzle schema and migrations `0000` through `0008` cover Better Auth, farmer profiles, Cocoa, daily prices and revisions, offers, offer events, deals, scheduled pickup dates, farmer-provided pickup locations, and pickup collection (`collected_on`, `collected_weight_kg` kept separate from the accepted `quantity_kg`, plus recorded-at/by); they have been applied to Neon `dev`.
- The shared Asia/Kolkata "today" helper lives in `apps/api/src/lib/business-date.ts`. Production has not been migrated.
- The local OTP callback still prints OTPs in Wrangler logs. Do not deploy until an SMS provider is selected and configured. New accounts default to farmer; the allowlisted verified admin phone is elevated by the server-side claim route.
- Local API database access uses Wrangler's Hyperdrive override for Neon `dev`. Production Hyperdrive has not been exercised by a deployed Worker.

## Recommended next steps

1. Continue delivery and inspection, partial acceptance, and payment workflow on top of the pickup collection record. Define payable amount and what deal `completed` means first; collection alone keeps the deal `open`.
2. Choose a notification channel before implementing proactive farmer alerts.
3. Configure the equivalent `ADMIN_PHONE_NUMBER` secret deliberately for any deployed environment. Choose and configure an SMS provider before deployment; do not deploy with OTPs printed to logs. Do not add PAN, Aadhaar, or bank-detail collection before purpose and secure handling are decided.

## Production deployment notes

- Building and deploying are separate steps. A successful build does not configure production database access or secrets.
- The current top-level `HYPERDRIVE` binding in `apps/api/wrangler.jsonc` points to the `farmbridge-dev` Hyperdrive config, which connects to Neon `dev`. Do not treat a deploy using this current binding as the production API; it would use the dev database.
- Before production deployment, create a separate Hyperdrive config that connects to Neon `production`, then add a Wrangler `production` environment with its own `HYPERDRIVE` binding. Wrangler bindings are not inherited automatically by named environments, so configure the binding explicitly.
- Add production-only secrets to the production Worker environment using Cloudflare secrets (for example, the Better Auth secret and SMS provider credentials). Do not put them in `wrangler.jsonc`, source code, or committed env files. Each Wrangler environment needs its own secrets.
- Review and apply database migrations to Neon `production` deliberately after they have been exercised on `dev`.
- Configure the mobile app's production API base URL to point to the deployed API. The mobile app must never receive database connection URLs.
- The same Neon project can serve both development and production: keep the `dev` branch for local development and the `production` branch for the deployed API.
- Complete the production binding, secrets, migration, API URL, and deploy steps only after the routes and authentication flow are ready.

## Useful workspace conventions

- Run workspace commands from the repository root with `pnpm --filter api ...` when targeting the API.
- Keep local secrets in ignored environment files. Do not put DB URLs or passwords in source, Wrangler config, or this handoff.
- Root `AGENTS.md` has repository-specific Turborepo instructions: before changing Turbo configuration or commands, resolve the installed `turbo` package and read its bundled `docs/README.md` plus the relevant docs. Do not use generic Turborepo assumptions.
- Avoid broad unrelated changes: the repository currently has other uncommitted work in progress.
