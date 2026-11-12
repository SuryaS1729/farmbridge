# Farmbridge — Project Instructions

We're building Farmbridge, a procurement platform connecting cocoa farmers with a single administrator who buys their produce.

## How you should work

- Act as a senior engineer helping me build this project from scratch.
- I know Node.js, pnpm, TypeScript, and terminal basics, but I'm new to pnpm workspaces and Turborepo.
- Explain important architectural decisions and unfamiliar configuration when they arise. Keep explanations concise and practical.
- Work incrementally. Complete one milestone at a time, verify it, and explain how to test it before proceeding.
- Do not implement the entire application in one pass.
- Inspect the generated repository before making changes. Preserve useful Turborepo conventions unless there's a reason to change them.
- Avoid unnecessary dependencies, abstractions, microservices, and premature optimization.
- Ask me before making significant product or architectural decisions that have not already been settled.
- Run relevant linting, type-checking, tests, and builds when available. Report what passed, what failed, and what you could not verify.
- Never claim that a command or test succeeded unless you actually ran it.

## Product requirements

Farmbridge v1 supports cocoa only, with more crops possible later.

- One administrator publishes a daily cocoa base price.
- Farmers can see the published daily base price on the farmer home screen.
- A farmer submits an offer only when they choose to sell. The offer price must meet or exceed the applicable published base price and includes quantity, readiness date/time, and the additional offer details described below. Not submitting an offer means the farmer is not currently offering cocoa for sale.
- Each farmer can have one active offer at a time.
- Pending offers can be revised or withdrawn and expire at the end of the business day.
- Price changes preserve history. When the base price increases, affected pending offers become invalid until revised. Accepted deals retain their agreed terms.
- The administrator can accept offers from multiple farmers. Acceptance creates a deal with locked terms.
- The administrator coordinates drivers outside the application; there are no driver accounts in v1.
- Farmers can request pickup rescheduling, which requires administrator approval.
- Partial deliveries and partial quality acceptance must be supported.
- The administrator records accepted quantity and inspection notes. The payable amount is based on accepted quantity multiplied by the agreed price.
- Payments happen outside the application through UPI or bank transfer. The administrator records partial or full payments, and the application tracks paid amount and outstanding balance.
- Send push notifications and WhatsApp notifications. SMS fallback is deferred.
- Optional insurance and loan information is stored separately from procurement data.
- There are approximately 5–10 pickups per day.

### Farmer and farm profiles

- Profile fields requested are farmer name, mobile number, village name, mandal name, PAN number, Aadhaar number, farm size in acres, and number of cocoa trees. The mobile number is associated with phone-based authentication.
- PAN and Aadhaar collection are not approved or assumed mandatory. Before implementation, review the purpose and necessity of each, applicable legal requirements, access controls, storage, retention, and deletion. Do not implement Aadhaar collection until the requirements and handling approach are confirmed. PAN also requires an approved purpose and handling policy.

### Farmer offer details

- The existing farmer quote/offer form is extended with available quantity in quintals (1 quintal = 100 kg), expected price per kg, the farmer-entered bean moisture percentage, the farmer-entered bean count as a number per 100 g, and the date when the farmer expects the cocoa to be ready for pickup.
- Submitting a quote is the farmer's explicit indication that they want to sell. Do not add a separate willingness-to-sell Yes/No field or create an offer when the farmer does not submit a quote.
- Keep these details on the existing procurement offer. Do not create a separate stock inventory subsystem for v1.
- Preserve the existing offer price rule: the offer price must meet or exceed the applicable daily base price. Preserve one active offer per farmer, expiry, revision, withdrawal, price-change handling, acceptance, and deal creation. Accepted deals retain agreed terms when daily prices change.
- Show these additional details in the administrator's offer dashboard. Farmer-reported moisture and bean count are indicative and self-reported, not verified inspection results. Actual quality inspection, accepted quantity, partial deliveries, and payment calculations remain in the deal workflow.
- Treat moisture as a farmer-entered percentage. Do not classify it automatically by the 7.5% reference; the administrator reviews the submitted value along with the other quote details and decides whether to accept the offer.
- Collect bean count as a farmer-entered number per 100 g. Do not bucket it into categories based on the 110 and 120 examples.

### Education

- Within the farmer app, crop advisory short videos cover cocoa farming practices, organic farming, model farming, manures and pesticides, farm traceability, and farm certification.
- Within the farmer app, post-harvest education videos cover cocoa bean quality improvement, cocoa pod harvesting, fermentation, drying, grading, cleaning, and storage.
- An administrator interface will manage education categories and video content, including content details, publication status, and display order. Whether videos are supplied as external links or uploaded and managed in Farmbridge remains unresolved.

### Bank information and privacy

- Proposed bank details are account holder name, account number, IFSC code, and branch name. This is restricted data and must have least-privilege access, encrypted transport and storage, masking in user interfaces, and protection from logs. Define who can view and edit these details, retention, and deletion before implementation.
- Clarify whether bank details are needed for existing external UPI/bank transfer payment recording or for a future payout integration. V1 payments remain external and are recorded by the administrator; no payment gateway or payout integration is in scope without an explicit requirement.
- Aadhaar collection, storage, access, retention, consent or notices, and applicable legal requirements require review before implementation. PAN also requires a defined purpose and access policy. Do not implement either field until those decisions are approved.
- Optional insurance and loan information remains separate from farmer/farm profile, stock availability, bank information, and procurement data.

## Agreed technical stack

- Monorepo: pnpm workspaces + Turborepo.
- Mobile application (farmers and administrators): React Native + Expo + TypeScript.
- Administrator web application: TanStack Start + React + TypeScript (an additional administrator surface).
- API: Hono deployed to Cloudflare Workers.
- Database: Neon PostgreSQL.
- Database connectivity from Cloudflare Workers to Neon: Cloudflare Hyperdrive.
- ORM and migrations: Drizzle ORM.
- Authentication: Better Auth with phone-number authentication, subject to verifying provider compatibility and choosing an Indian SMS provider.
- Validation: Zod.
- Server-state management: TanStack Query.
- Client UI state: Zustand.
- Object storage: Cloudflare R2 only if needed.
- Push and WhatsApp notifications will be integrated when the core workflow is ready.

Use a modular monolith: one API, one PostgreSQL database, and two client applications. The mobile app serves both farmers and administrators; the web app is an additional administrator surface. Permission, including whether a signed-in account acts as a farmer or an administrator, must be determined and enforced by the API after authentication. Do not hardcode authorization in a client, and do not present a client-side role selection that grants or changes access. Do not introduce microservices, Redis, Kubernetes, or a separate server unless a concrete requirement justifies it.

At the planning level, the data model should represent farmer/farm profile information separately from authentication credentials, keep each extended quote's price, quantity, readiness, and self-reported quality details with the procurement offer, and preserve the existing separation between offers, accepted deals, delivery/inspection records, and payment records. Restricted bank details, approved identity attributes, and optional insurance/loan information require separate access and handling boundaries. Education categories and video content are distinct from procurement. These are planning boundaries only; no schema changes are approved by this plan update.

For education management, the administrator web application should provide category and video-content management, publication status, and display ordering. The administrator must clarify whether videos will be provided as links or uploaded before storage is selected. Keep Cloudflare R2 conditional on a confirmed upload requirement; do not select storage based on an assumption.

## Repository expectations

Use the Turborepo structure generated by create-turbo as the starting point, then adapt it deliberately.

Current workspace layout and intended architecture:

- `apps/mobile` — Expo application for farmers and administrators. Both share one phone-based sign-in; the API resolves an account's role after authentication and the app routes accordingly, with no client-side role selection.
- `apps/web` — TanStack Start + React web application for administrators.
- `apps/api` — Hono API for Cloudflare Workers.
- `packages/db` — Drizzle schema, migrations, and database access.
- `packages/validation` — shared Zod schemas.
- `packages/api-client` — shared API client and types, if useful.

Configure workspace dependencies and Turborepo task pipelines correctly. Do not assume every application uses the same build or development command. Keep Expo, TanStack Start, and Cloudflare Workers tooling compatible with their respective frameworks.

## Completed foundation milestone

The repository bootstrap and the three app development commands have been established. Continue with the next milestones below; do not repeat the foundation setup unless a concrete issue requires it.

## Next implementation milestones

After the foundation is verified, proceed incrementally. The following ordering includes the updated scope and leaves business and privacy decisions explicit:

1. **Resolve requirements, privacy, and security decisions.** Decide whether education videos are links or uploads; review the purpose, necessity, legal requirements, access, storage, retention, and deletion for PAN/Aadhaar; define bank-detail purpose and access; and confirm profile edit ownership. Do not assume answers.
2. **Configure database foundation.** Configure Neon PostgreSQL and Cloudflare Hyperdrive for the Workers-to-database connection, then Drizzle migrations and database access, after the plan and data boundaries are approved. Keep offer self-reported fields with the offer; preserve separate deal, delivery/inspection, and payment records; define restricted profile/bank data and education content boundaries at design level.
3. **Integrate authentication and authorization.** Integrate Better Auth and verify phone authentication and server-side roles. Define least-privilege access for restricted bank details and any identity fields that are explicitly approved.
4. **Implement approved farmer and farm profiles.** Add approved profile fields and link mobile number to phone-based authentication. Exclude PAN/Aadhaar unless collection and handling are explicitly approved.
5. **Implement daily prices and extended farmer offers.** Show the administrator-published daily base price on the farmer home screen. Add the requested quantity, expected price, self-reported moisture and bean count, and readiness/selling date to the existing quote workflow and administrator offer dashboard. A submitted quote is the farmer's explicit intent to sell; no separate willingness field or implicit offer is needed. Preserve offer price validation, one active offer, expiry, revision, withdrawal, price-change invalidation, and auditability.
6. **Implement offer acceptance and deal creation.** Acceptance creates a deal with locked terms unaffected by later base-price changes.
7. **Implement pickup scheduling, inspections, partial deliveries, and payment tracking.** Preserve rescheduling approval, external driver coordination, actual quality inspection, partial acceptance, accepted-quantity calculations, external payment execution, and administrator payment recording.
8. **Implement education administration and farmer viewing.** Add the two education areas and listed categories/content within the farmer app, with category/content management, publication status, and ordering in the admin web app. Select link or upload flow only after administrator clarification; add R2 only if uploads are confirmed.
9. **Implement approved restricted bank-information handling.** Add only after purpose, access, encryption, masking, logging, retention, and deletion requirements are defined. Existing external payments remain; do not add gateway or payout integration without explicit scope approval.
10. **Add notifications, tests, deployment configuration, and launch preparation.** Integrate push and WhatsApp when the core workflow is ready; retain SMS fallback as deferred unless separately approved.

Do not begin schema changes or feature implementation for the new requirements until this revised plan and its unresolved decisions are reviewed and approved. Keep the specified pnpm/Turborepo, Expo, TanStack Start, Hono on Cloudflare Workers, Neon PostgreSQL with Cloudflare Hyperdrive for Workers connectivity, Drizzle, Better Auth, Zod, TanStack Query, and Zustand stack. The requirements do not demonstrate a need to change the modular monolith architecture.

## Unresolved product and privacy decisions

- Will education videos be supplied as external links or uploaded and managed through Farmbridge? If uploaded, confirm constraints before selecting storage; R2 remains conditional.
- Are education categories fixed to the listed crop-advisory and post-harvest topics, or can administrators add categories?
- Who can view or edit bank information? Can farmers edit their own details? Are bank details needed for recording external payments or intended for a future payout integration? What retention/deletion rules apply?
- What business purpose justifies PAN collection? Is Aadhaar collection necessary at all? Review applicable legal requirements and confirm access, storage, retention, deletion, and appropriate handling before implementation; Aadhaar must not be implemented until confirmed.
- Are farmer name and mobile number editable by farmers, or controlled by authentication/admin processes?

Do not silently invent answers to these questions.

The revised offer workflow remains: admin publishes the daily base price; farmer submits a qualifying offer with the additional self-reported details; admin accepts or rejects; acceptance creates a deal with locked terms; admin coordinates pickup externally; delivery and actual quality inspection support partial acceptance; payable amount uses accepted quantity and agreed price; and admin records external partial or full payments and outstanding balance.

Keep unresolved decisions explicit. Do not silently invent business rules.
