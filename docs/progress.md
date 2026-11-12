# Farmbridge progress

Updated: 2026-11-12

This note records the current implementation state and agreed product decisions. For backend setup history and deployment cautions, see [backend-foundation-handoff.md](./backend-foundation-handoff.md).

## Architecture and foundation

- Monorepo uses pnpm workspaces and Turborepo.
- `apps/mobile` is the Expo farmer app, `apps/api` is Hono on Cloudflare Workers, and `apps/web` is the Vite + React admin frontend.
- The API uses Neon Postgres, Drizzle, and Better Auth. Local API development uses `pnpm --filter api dev` at `http://localhost:8787`; mobile reads `EXPO_PUBLIC_API_URL`. USB-connected Android testing may require `adb reverse tcp:8787 tcp:8787`.
- Better Auth phone/OTP auth is connected to Expo with SecureStore and `@better-auth/expo`. Expo Router separates the auth and farmer route groups and guards them based on session state. Role-specific administrator routing is not implemented.
- Migrations `0000` through `0008` establish Better Auth tables, farmer profiles, Cocoa, daily prices and revisions, offers, offer events, deal records, scheduled pickup dates, farmer-provided pickup locations, and pickup collection records. They are applied to Neon `dev`; production has not been migrated.
- `apps/web` uses Tailwind CSS v4 (Vite plugin) and shadcn/ui, installed in `apps/web` only (no shared `packages/ui`; mobile is styled separately). `components.json` uses the `base-lyra` style (Base UI primitives, so components use a `render` prop rather than Radix `asChild`), Remix icons, and the theme from preset `b4ZVZIPi9h`. The `@/` alias maps to `apps/web/src` in both `vite.config.ts` and the tsconfig files. The pickup-date and collection dialogs use shadcn `Dialog`, `Input`, `Label`, and `Button`; the rest of the dashboard still uses `App.css` and is migrated incrementally.

## Procurement decisions now reflected in code

- The farmer home screen shows the published daily Cocoa base price with a kg/quintal display switch, defaulting to kg. The screen refreshes when it regains focus and when the app returns to the foreground. The admin enters the base price per quintal; the API converts and stores the per-kg amount to four decimal places, preserving paise in the quintal input. The API provides `GET /api/prices/today` and an admin-only `POST /api/admin/prices/today`.
- `apps/web` now has a phone/OTP sign-in page and a responsive daily-price publishing dashboard. Local Vite requests use credentialed CORS to reach the API.
- The admin phone is checked server-side using `ADMIN_PHONE_NUMBER`. After OTP verification, `POST /api/admin/claim` authorizes only that verified number and assigns the server-side admin role. The phone shown in the browser is not an authorization control.
- A farmer explicitly intends to sell by submitting a quote. There is no separate Yes/No selling field and no prior admin approval requirement for submission.
- Farmers enter the offer price per kilogram and choose whether to enter quantity in quintals or kg; quintals are selected by default. The API validates the selected unit and converts the quantity to kilograms for storage. The admin quote view displays the stored quantity as quintals for consistency.
- Every quote requires a numeric self-reported bean moisture percentage, numeric bean count per 100 g, and one expected-ready date for pickup.
- Dates shown to farmers and admins use the Indian `DD-MM-YYYY` format. The app converts these to ISO `YYYY-MM-DD` before sending them to the API; storage and API filters remain ISO dates.
- The farmer reviews the details before submission. The API validates the fields, requires a verified farmer session, enforces the offer-price floor against the published base price, and records an offer event.
- Farmers can open My quotes from Home or after submitting a quote. The farmer-only API returns up to 100 of the signed-in farmer's own quotes, lazily expires stale open quotes, and includes rejection reasons plus the deal snapshot/status for accepted quotes. User-facing dates use `DD-MM-YYYY`.
- Admins can schedule or update a pickup date on an open deal using `DD-MM-YYYY`. It is stored separately from the farmer's expected-ready date, and each scheduling change is recorded in the associated offer event history. The farmer sees the current pickup date in My quotes after refreshing/reopening the screen.
- Admins record a pickup collection on an open deal with a pickup location: the actual collection date (`DD-MM-YYYY`, today or earlier in Asia/Kolkata; future dates are rejected) and the scale weight in quintals (default) or kg. The API stores `collected_weight_kg` separately from the accepted quote quantity, plus who recorded it and when. Corrections are allowed and logged as `pickup_collected` / `pickup_collection_updated` offer events with old/new values and the entered unit. Recording a collection does not change the deal status; it stays `open` because inspection, partial acceptance, and payment come later. The admin deal list shows the collected weight in quintals and the date. Farmers see a Collected row in My quotes, and their pickup location becomes read-only once collected (the API rejects later location updates).
- On an accepted deal, the farmer can provide or update a text pickup location with village, landmark, and directions for the driver's visit. Admins see it in the deal list; pickup date scheduling is blocked until a location is provided. Location updates record actor/time without duplicating the address in the event payload.
- One active quote per farmer is enforced. Quotes expire at the end of the business day in Asia/Kolkata; on the farmer's next submission, expired active quotes are marked expired and an audit event is recorded.
- Admin role checks are server-side. New accounts default to farmer; client role selection cannot grant admin access.

## Current boundaries and unfinished work

- The admin dashboard can publish or update today's price, review and filter the newest 100 open quotes, accept pending quotes, reject open quotes with a required reason, and view the newest 100 deals. Accepting creates a deal snapshot of the submitted offer price/kg, quantity, moisture, bean count, and ready date; the API records admin decisions in the offer event history. Migration `0005` is applied to Neon `dev`.
- Local admin sign-in uses `ADMIN_PHONE_NUMBER=+919491234567` in the ignored `apps/api/.dev.vars` file. The corresponding production secret is not configured.
- The local OTP callback still prints OTPs in Wrangler logs. Choose and configure an SMS provider before deployment.
- Production database migrations, production Hyperdrive configuration, and deployment are not done.
- Driver dispatch details, delivery and inspection, partial acceptance, proactive farmer notifications, and payment recording remain future work. The deal status currently starts as open; no later deal lifecycle actions are implemented.
- Learning content is planned, but its video hosting provider is undecided.
- PAN, Aadhaar, and bank-detail collection are out of scope until purpose, access, and secure handling are decided.

## Verification recorded

- Mobile, API, and web TypeScript checks passed on 2026-11-09; API and web checks passed again on 2026-11-10 after adding the admin quote queue.
- The phone/OTP flow was previously exercised on an Android phone; the backend handoff also records local API-client OTP/session verification and a successful local database health check against Neon `dev`.
- API and web TypeScript checks passed on 2026-11-10 after adding admin quote decisions and deal records. The deal migration was applied to Neon `dev`; the admin accept/reject and deal list flows were manually exercised.
- Mobile and API TypeScript checks passed on 2026-11-10 after adding farmer quote history. The user confirmed the farmer can see accepted/rejected quote outcomes.
- API, web, and mobile TypeScript checks passed on 2026-11-10 after adding pickup scheduling and farmer pickup locations. Migrations `0006` and `0007` were applied to Neon `dev`. The user confirmed the farmer's location appears in the admin dashboard and the admin's scheduled/rescheduled date appears in the farmer app. Mobile lint could not run because Expo attempted to install ESLint and pnpm reported a store-location mismatch; no package files were changed by that attempt.
- On 2026-11-12, migration `0008` (pickup collection) was applied to Neon `dev`. API, web, and mobile TypeScript checks passed after the collection work. The user confirmed the admin collection dialog and the shadcn pickup-date dialog work, and the collection appears in the farmer's My quotes. Not separately confirmed: the API rejecting pickup-location updates after collection.
- Tests have not been run in this work, and nothing has been deployed.

## Next steps

1. Continue delivery and inspection, partial acceptance, and payment workflow on top of the collection record. Payable amount and the meaning of deal `completed` still need to be defined; do not mark deals completed on collection.
2. Continue migrating the admin dashboard to shadcn components section by section. Optional idea: show a plain-words preview (e.g. "Thursday, 12 November 2026") under typed `DD-MM-YYYY` inputs to catch day/month slips.
3. Choose a notification channel before implementing proactive farmer alerts.
4. Configure production `ADMIN_PHONE_NUMBER`, choose/configure an SMS provider, and follow the production migration/Hyperdrive/API URL checklist before deployment. Do not deploy while OTPs are printed in logs. Do not add PAN, Aadhaar, or bank-detail collection before purpose and secure handling are decided.
