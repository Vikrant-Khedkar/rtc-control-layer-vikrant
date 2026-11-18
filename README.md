# RTC Logistics Control Layer

A working assessment for one synthetic Sea Import Customs workflow. Operations takes an enquiry through quoting and job milestones. A Manager approves the internal quote. Accounts closes the billing-ready job.

## Assumptions

The sample defaults are editable. Intake requires customer, bill of lading reference, arrival port and estimated arrival in ISO date format. The optional consignee field can be made required. The three milestones are **Documents reviewed → Customs cleared → Release confirmed**, with 24 hours per stage starting when it becomes current. One illustrative ₹1,250.00 rate uses a 15% gross margin (`price = cost / (1 - margin)`, rounded to paise). Every open exception blocks billing readiness. One shared synthetic workspace is visible to all four demo users, subject to the role permission matrix.

The assessment plan uses a private source repository and a protected preview. Its submission sections disagree on repository visibility, deadline and video length. Confirm the submission terms and obtain Totem's real sample workflow rules before sharing the assessment externally.

## Run locally

Prerequisites are Node.js 24, npm and Docker Compose. The Compose database binds to loopback and uses local-only synthetic credentials.

```bash
npm ci
cp .env.example .env.local
docker compose up -d --wait
npm run db:setup
npm run dev
```

Open the printed address, enter as Operations and select **Guided tour → Start at the enquiry inbox**. The inbox starts with complete and incomplete synthetic enquiries. The tour adds hints to the normal screens. Select **Simulate incoming enquiries** to load a fresh batch, or **New enquiry** for manual intake.

Use **Jobs** in the navigation to open a specific record and update its status or complete a milestone. As Admin, add an option under **Configuration → Custom job statuses** and save. Operations can select that status on any open job, and the change appears in the audit history and God View. Billing readiness continues to follow milestone completion and exception resolution.

The **Needs your action** section starts with approved demo jobs. As Operations, pick up **Atlas Hardware** for document review or **Marigold Appliances** for an assigned customs query. As Accounts, pick up **Juniper Warehousing** for billing closure. When the last milestone and any open exception are complete, the job moves from Operations’ action list to Accounts’. Rerunning setup preserves progress.

Installations with an existing Postgres server can skip Docker and provide their own dedicated demo database, owner URL and separate runtime role. Run `db/local-role.sql` only on a local demo database, or create a restricted runtime role using a locally generated secret. Setup is safe to rerun on the same dedicated database. It seeds users, settings and a starter inbox without resetting existing work.

[Narrated walkthrough (5:56)](docs/rtc-walkthrough.mp4) · [Walkthrough script](docs/walkthrough.md) · [Business journey](docs/rtc-business-journey.svg) · [Detailed flow](docs/rtc-flow.svg) · [Architecture](docs/rtc-architecture.svg)

## How the modules connect

- Next.js pages and Server Actions are the presentation and transport layer. They resolve a server-side identity, display what the actor can do and call framework-independent use cases.
- `createWorkflow({ store, rates, now, id })` in `src/core/workflow.ts` exposes enquiry creation and editing, quote drafting and approval, milestone advancement, exception raising and resolution, close and configuration changes. Tests pass a seeded actor directly to this interface. Transport code derives the actor from the validated session.
- `src/core/ports.ts` defines the read and transaction interfaces, identity provider and rate provider. The Postgres adapter supplies real transactions. The rate adapter returns a synthetic amount. Fixtures in `demo/` only flow into wiring, setup and tests. Next.js can be replaced by calling the same use cases from another server.
- Postgres stores enquiries, quotes and jobs in separate tables. Unique source references, one quote per enquiry and one job per quote are relational constraints. Milestones and exceptions are part of the small job aggregate, which is locked per change. Jobs retain the configured milestone version at creation. Drafts retain the rate and margin used.
- Each material workflow change and its audit event commit together. The runtime role can select and insert audit events. The migration role owns the schema. Session cookies hold random tokens, with the hashes and expiry in Postgres.
- Demo roles start with read access. Operations writes enquiries, drafts quotes, advances stages and manages exceptions. Manager approves. Accounts closes ready jobs. Admin edits configuration. Role permissions are checked on the server and configuration is read at request time. Manager approval and Accounts closure remain explicit workflow rules.

The architecture maps ICEGATE, ELMS/Winsoft, carrier and accounting interfaces as mocked boundaries. The runnable slice has a mock rate provider and a bill of lading placeholder. It makes no external bookings, sends or billing calls.

## Verify

```bash
npm run typecheck
npm run test:local
npm run build
```

`test:local` starts PostgreSQL on a temporary loopback port using installed Postgres tools and provisions a separate database. Set `PGBIN` if needed. To test against a dedicated provisioned Postgres database, apply migrations using its owner then set `TEST_DATABASE_URL` to that database's restricted runtime URL and run `npm test`. Use fresh test state. The integration suite covers closure, invalid intake, concurrent duplicate input and approval, permission denial, exception recovery, configuration changes, transaction rollback, audit grants and session rotation.

## Private preview

See [deployment steps](docs/deployment.md). Use preview-only environment variables and a separate Neon demo project. The app's reviewer code is in addition to Vercel access protection. Reviewers can switch between seeded roles after entering the demo.

For a future live rollout, replace demo identity with an approved identity provider, enforce organization and shipment-level access, establish data retention and audit export, add backups and restore checks, and vet real integrations and operational acceptance rules. Implement monitoring, reconciliation and operational support before handling live data.

Material dependencies are Next.js, React, Tailwind CSS, Zod, node-postgres, Vercel Functions helpers and Lucide. Vitest and agent-browser support verification. Codex helped plan, write and verify the assessment.
