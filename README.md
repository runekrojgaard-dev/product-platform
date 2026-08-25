# Product Lifecycle, QC & Production Platform — Stage 2 (Auth + Roles)

This is the working codebase, built stage-by-stage per the approved MVP plan.
Stage 2 delivered here: authentication, the 7 roles, permission model, and
user administration.

## What's included in this stage

- `prisma/schema.prisma` — full database schema (all entities from the
  architecture doc: Products, Versions, Master Samples, Production Batches,
  Observations, Measurements, Media, Documents, Approvals, Audit Log, etc.)
  so later stages don't require schema rework.
- `lib/auth.ts` — Auth.js (NextAuth) credentials login, JWT sessions.
- `lib/permissions.ts` — the single source of truth for what each role can do.
- `lib/authorize.ts` — server-side permission enforcement, used by every API route.
- `lib/audit.ts` — audit log helper, called inside the same transaction as any write.
- `middleware.ts` — blocks anonymous access to the whole app except `/login`.
- `app/(auth)/login` — login page.
- `app/(dashboard)/layout.tsx` — desktop sidebar (permission-filtered) + mobile
  bottom tab bar with the required "Scan" action.
- `app/(dashboard)/admin/users` — create users, assign roles, activate/deactivate.
- `prisma/seed.ts` — creates the 7 roles, one initial Administrator, and the
  default defect categories from the brief.

## Setup (run this locally — not run in the build sandbox)

The build sandbox used to write this code cannot reach `binaries.prisma.sh`,
so `prisma generate` could not be executed here. Run these steps in your own
environment:

```bash
npm install

# Point at a real Postgres instance
cp .env.example .env   # then edit DATABASE_URL

npx prisma generate
npx prisma migrate dev --name init

# Creates roles + one admin user (admin@example.com / ChangeMe123!, override via env vars)
npm run db:seed

npm run dev
```

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` environment variables before
seeding if you don't want the default admin credentials.

## Not yet built (next stages)

Products, Projects, Versions, Master Samples, QR scanning, media upload,
observations, measurements, comparison views, dashboard charts, PDF reports —
these follow in Stages 3–17 per the MVP plan, each building on this auth
foundation (every future route will call `requirePermission(...)` from
`lib/authorize.ts` before touching data).

## Stage 3 additions (Products + Projects)

- Customers, Projects, Products — full CRUD (create/list; update where it
  makes sense for each entity).
- `lib/product-id.ts` — generates the permanent Product ID (e.g. `CHR-00482`).
  **Flagged assumption**: prefix = first 3 letters of category + a 5-digit
  sequence. Tell me if your organization already has a numbering convention
  and I'll swap this one function out.
- New permissions: `project.manage`, `customer.manage` (granted to
  Administrator and Project Manager).
- Product detail page shows metadata only — version history, Master Sample,
  measurements and observations arrive in Stage 4 onward.
- Product creation intentionally does **not** let you set dimensions/materials
  directly on the Product — that data belongs to a ProductVersion (Stage 4),
  consistent with "never overwrite historical data."

## Stage 4 additions (Product Versions + version history)

- `ProductVersion` create/list/detail APIs. **No update/delete endpoint exists
  for a version** — this is intentional, not an oversight: it's how Rule 1
  ("never overwrite historical data") is enforced at the API layer, not just
  by convention.
- Creating a version auto-assigns the next `V{n}` number and updates the
  parent Product's `currentVersionId` and `status` in the same transaction.
- Structured spec fields (`lib/validation/product-version.ts`): dimensions,
  materials, finishes, components, specifications are validated arrays of
  objects, not free-form JSON — this is what makes the diff/compare and
  future tolerance features possible.
- `lib/version-diff.ts` — generic diff engine matching entries by a key field
  (dimension name, material component, etc.) and classifying each as
  added/removed/changed/unchanged.
- Product detail page: version timeline, "Add Version" form with dynamic
  dimension/material rows, link to Compare Versions once 2+ versions exist.
- Version detail page: full structured spec tables for one version.
- Compare Versions page: pick any two versions, see only what changed.

Master Sample designation (turning a version into the protected production
reference) is next — Stage 5.

## Stage 5 additions (Master Samples)

- `MasterSample` propose/approve/reject APIs, fully separated:
  - **Propose** (`product.mastersample.propose` — Product Designer, Administrator):
    links a version to a new, pending Master Sample. A version can only be
    proposed once (unique constraint).
  - **Approve/Reject** (`product.mastersample.approve` — Administrator, and
    **Quality Control** — flagged assumption, not stated explicitly in the
    brief; tell me if approval should sit with a different role or be
    Administrator-only).
- Approving one Master Sample **demotes the previous "current" one** in the
  same transaction — it is never edited, only its `isCurrent` flag changes.
  Its full approval history (who approved it, when, comments) stays on its
  own row forever. This is Master V1 → Master V2 exactly as described in
  Section 8.
- Approving also updates `product.currentMasterSampleId`, so the product
  record always points at the live production reference.
- UI: propose a version from a dropdown of versions that don't have a Master
  Sample yet; approve/reject buttons for authorized roles; status badges
  (pending/approved/rejected) shown both on the version timeline and in the
  Master Samples list.

Next: Production Batches, followed by QR generation/scanning and the mobile
camera flow — the point where the app becomes usable on the shop floor.

## Stage 6 additions (Production Batches)

- `ProductionBatch` create/list/update APIs, scoped to a product.
- **Enforced rule**: a batch can only reference a Master Sample whose
  `approvalStatus` is `APPROVED` — you cannot start production against
  something still pending or rejected. This is the "Master Sample is the
  production reference" rule (Section 8 / Rule 3) enforced server-side.
- `lib/batch-code.ts` generates codes like `2026-08-003`. **Flagged
  assumption**: sequence is scoped per year+month across the whole
  organization (matches the example format, which has no product reference
  in it) — tell me if it should be scoped per product or per customer instead.
- New permission `production.batch.manage` (Administrator, Production).
- UI: Production Batches section on the product page — create form (only
  shown once an approved Master Sample exists), status dropdown
  (Planned → In Production → Completed / On Hold) editable inline.

Next: QR code generation + the mobile scan flow — the point where a physical
product can be scanned to open its record directly, per Section 9.

## Stage 7 additions (QR codes + mobile scan flow)

- `lib/qrcode.ts` + `GET /api/v1/products/:id/qrcode` — generates a PNG QR
  code encoding the **raw Product ID** (e.g. `CHR-00482`), not a URL, so a
  printed label is readable by any generic QR scanner too, per Section 9.
- `GET /api/v1/products/lookup?productId=...` — resolves a scanned or typed
  Product ID to the product record; used by both the scan flow and as a
  manual-entry fallback.
- `/scan` page: camera-based QR scanning (`html5-qrcode`, works across
  Chrome/Safari/Firefox on mobile, unlike the native `BarcodeDetector` API
  which Safari doesn't support) with a manual Product ID entry field show
  automatically if the camera can't be used.
- Product page: QR code display + PNG download (for printing on labels),
  and a "Quick Actions" bar (View History / View Master Sample / Add
  Observation / Take Photo / Add Measurement) matching the Section 9
  quick-view spec — the last three are visibly present but disabled with a
  tooltip until Stages 9–11 build the features behind them, rather than
  being silently missing.
- Filled in the remaining mobile nav destinations (`/search`, `/add`,
  `/profile`) with minimal placeholders so the bottom tab bar has no dead
  links while those stages are pending.
- Schema fix: added proper Prisma relation fields for `Product.currentVersion`
  and `Product.currentMasterSample` (previously plain FK columns with no
  relation) — needed for the lookup endpoint and useful for every future
  quick-view query.

Next: mobile camera + photo storage (Stage 9) — this is what "Take Photo"
above will actually do, including the traceable metadata model from Section 10.

## Stage 8 additions (Camera + Media)

- `lib/storage/` — storage is behind an interface (`StorageDriver`) with a
  local filesystem implementation for this build environment. Swapping to
  real S3 in production means implementing one file (`s3.ts`) and changing
  `STORAGE_DRIVER=s3` — no API route changes needed. Files live outside
  `/public` and are only reachable through our own authenticated API routes,
  consistent with Section 27/28 (no direct bucket access, no exposed
  credentials).
- `POST /api/v1/products/:id/media` — multipart upload. Validates file type
  (jpeg/png/webp/heic) and size (15 MB cap), generates a thumbnail
  server-side with `sharp` (EXIF-rotation-aware, since phone photos are
  often mis-rotated without this), and cross-checks that any referenced
  version/batch/observation actually belongs to the product — every image
  stays traceable to the right product, not just "an" object (Section 10).
- `GET /api/v1/media/:id/file` and `/thumbnail` — permission-gated streaming,
  never a public URL.
- UI: Photos section on the product page. Upload control uses
  `capture="environment"` so it opens the phone's rear camera directly on
  mobile (falls back to the file picker on desktop) — no extra camera
  library needed for this. Shows a preview with Retake before saving, and a
  responsive thumbnail gallery below.
- "Take Photo" quick action is now live (was disabled placeholder in Stage 7).

**Not yet built** (next stage): annotation (circle/arrow/text on a photo —
Section 11) and linking media directly during Observation creation, which
needs Observations to exist first (Stage 10).

## Stage 9 additions (Quality Observations + Photo Annotation)

- `Observation` create/list/detail APIs, defect categories (seeded list from
  Section 13, admin-extensible via `admin.categories.manage`), severity
  (Low/Medium/High/Critical — always shown with a text label, not color
  alone, per Section 15), and location on the product.
- **Status workflow enforced server-side** (`lib/observation-workflow.ts`):
  a fixed transition map means the API rejects any status change that isn't
  in the allowed graph (e.g. `NEW` → `APPROVED` directly is rejected),
  independent of role. On top of that, moving to `APPROVED`/`REJECTED`
  specifically requires `observation.approve` (Quality Control,
  Administrator) — this is the "role-gated transitions" requirement from
  Section 16, not just a suggestion in the UI.
- Corrective actions and comments as their own endpoints — comments are
  deliberately low-friction (any signed-in user who can view the
  observation), while corrective actions and assignment require
  `observation.assign`.
- **Photo annotation** (Section 11): a canvas-based tool (circle, arrow,
  freehand, text — no external drawing library) draws on top of the
  original photo and saves the result as a **new Media row** with
  `parentMediaId` pointing at the untouched original. The original is never
  modified; annotation shapes are stored both as flattened pixels (for
  quick viewing) and as structured `Annotation` records (fractional
  coordinates, so they'd survive a future re-render at a different
  resolution).
- Product page: Quality Observations section (create + list), "Add
  Observation" quick action is now live.
- Observation detail page: only the *valid* next statuses are ever shown as
  buttons — there's no way to reach an invalid transition through the UI,
  and the API would reject it anyway if someone tried directly.
- Fixed a client-bundle issue found while building this: `lib/permissions.ts`
  was importing `RoleName` from `@prisma/client` as a value import, which
  risks pulling the Prisma client into browser bundles for any client
  component using `roleHasPermission`. Changed to `import type`.

Next: Measurements + automatic tolerance calculation, and the Master vs.
Production comparison view that measurements feed into.

## Stage 10 additions (Measurements + Master vs. Production comparison)

- `lib/measurement-tolerance.ts` — **PASS/WARNING/FAIL is always computed
  server-side** and never accepted as client input (Rule 7). **Flagged
  assumption**: the brief's Section 17 examples only show a binary
  PASS/FAIL outcome, but the schema and Section 18 both need a WARNING
  state. This implementation treats WARNING as "outside tolerance but
  within an extra 50% buffer" — this is a guess, not a stated rule; tell me
  if there's an existing QC convention and it's a one-function change.
- Every `Measurement` row carries its own reference/tolerance/measured
  values regardless of what it's linked to (version, Master Sample,
  production batch, or observation) — so nothing needs to look up another
  row's tolerance to know its own result, consistent with "never depend on
  data that might later change" (Rule 1's spirit applied here).
- `GET /api/v1/production-batches/:batchId/comparison` and the
  **Master vs. Production comparison page** (linked from each batch row):
  matches measurements by name between a batch and its Master Sample,
  re-deriving the result using the Master Sample's tolerance as the
  authority (Rule 3) rather than trusting whatever was stored on the
  production row, in case the two were entered inconsistently.
- The comparison page also links out to the existing Compare Versions view
  for materials/finishes/photos — Section 18 asks for those to be
  comparable too, and Stage 4 already built that diff engine, so this reuses
  it rather than duplicating it.
- Product page: Measurements section (record + list), "Add Measurement"
  quick action now live — **this completes the Section 35 MVP scope list**.

## What's left (polish, not core functionality)

Per the MVP plan (Stages 13, 15, 16, 17): Dashboard charts (issues by
category/product/project/time), global search across all entities, and PDF
report generation. The Audit Log (Section 25) is being written correctly by
every mutation already — it just doesn't have a viewing UI yet. None of
these block using the system end-to-end for the core product lifecycle.

## Review pass (bugs found and fixed)

Went through the codebase critically rather than re-describing what was
built. Found and fixed:

1. **`isMasterReference` checkbox did nothing.** `z.coerce.boolean()` uses
   JS `Boolean()`, and `Boolean("false")` is `true`. Since the upload form
   always sends the string `"true"`/`"false"` via FormData, unchecking the
   box still saved `true`. Fixed in `lib/validation/media.ts` with an
   explicit string comparison instead of coercion.
2. **Observation reporters couldn't act on their own reports.** The status
   transition permission check on the client compared a *name* string
   against a user *ID* (`observation.createdByName === currentUserId`),
   which can never match. This only affected which buttons were enabled —
   the server-side check already used real IDs and was correct — but it
   meant legitimate users saw disabled buttons for no reason. Fixed by
   passing `createdById` through from the server component.
3. **Deactivated defect categories were still usable.** Creating an
   observation checked a category existed but not that it was still
   `active`. Fixed.
4. Cosmetic: thumbnail keys kept a `.png` extension for PNG originals even
   though thumbnails are always re-encoded as JPEG. Harmless (content type
   is tracked separately) but confusing on disk — fixed.

## Known limitations to weigh before production use

- **Code generation (Product ID, batch code, observation code, version
  number) uses a count-then-insert pattern**, not a real atomic sequence.
  Under genuinely concurrent writes (two people creating a version for the
  same product in the same instant), the database's unique constraint will
  reject the second write rather than silently duplicating — but there's no
  automatic retry, so that person would see a raw error instead of it just
  working. Low risk at your team's scale, but worth a proper sequence
  (Postgres `SERIAL`/advisory lock) before scaling up concurrent users.
- **No automated test suite yet**, despite Section 37 asking for one.
  Everything here has been reasoned through and lint-checked, not
  exercised against a real running database, because this sandbox can't
  reach `binaries.prisma.sh` to generate the Prisma client. First real
  test of the schema will be your `npx prisma migrate dev` — I'd budget
  time to shake out any schema issues that only show up at that point.
- **No project/product-level access control** — role permissions are
  global (a Quality Control user can act on every product in the system,
  not just their assigned project). Matches the brief's role list as
  written, but confirm that's actually intended before go-live, since
  it's a bigger change to add later than to decide now.
- No rate limiting, virus scanning on uploads, or upload throttling — fine
  for internal MVP use, worth revisiting before any external-facing use.

## Stage 11 additions (Dashboard, Search, PDF Reports, Audit Log viewer)

This closes out the remaining Section 35 polish items.

- **Dashboard** (`lib/dashboard-metrics.ts`): the metric cards and six charts
  from Section 22 (issues by category/product/project/supplier/batch, and
  over time). Aggregation is done in JS after one bounded fetch rather than
  multiple SQL `groupBy` calls, because "issues by project" and "issues by
  supplier" need a join Prisma's `groupBy` can't express directly. Fine at
  MVP data volumes — flagged in the code as needing to move to a raw SQL
  aggregate if observation counts grow large.
- **Global search** (`/api/v1/search`, `/search` page): case-insensitive
  `contains` matching across products, projects, batches, and observations.
  This is explicitly an MVP implementation — Section 23 itself anticipates
  moving to Postgres full-text search (tsvector + pg_trgm) for scale, and
  that's a swap inside one function, not an API change.
- **PDF reports** (`lib/reports/product-quality-report.tsx`,
  `/api/v1/reports/:id/pdf`): used `@react-pdf/renderer` instead of the
  Puppeteer the architecture doc suggested, because Puppeteer needs to
  download a Chromium binary during install, which fails in constrained or
  serverless environments (this sandbox included) — `@react-pdf/renderer`
  is pure JS with no headless browser dependency, and is a better fit for
  most Next.js hosting. **Actually rendered a real PDF end-to-end during
  this build to confirm it works** (not just that it compiles) —
  screenshot-verified the layout matches Section 24's structure.
- **Found and fixed a real bug in my own PDF route while building it**: the
  Timeline section was querying `auditLog.objectId = product.id` only,
  which misses every event logged against the product's versions, Master
  Samples, batches, and observations (each writes audit rows under its own
  id). Fixed to gather all related object ids first, matching Section 20's
  "every event" requirement.
- **Audit Log viewer** (`/admin/audit-log`, Administrator only): paginated,
  filterable by object type, with expandable before/after JSON per entry.
  The log itself was already being written correctly since Stage 2 — this
  just gives it a screen.

This is now the complete MVP scope from Section 35, end to end.

## Deployment fixes (Next.js 16 + Prisma 7 breaking changes)

Two major version upgrades since this was originally built introduced real
breaking changes, found and fixed during actual Vercel deployment attempts:

1. **Next.js made dynamic route `params` and `searchParams` async** (a
   `Promise` instead of a plain object) in every API route and page that
   uses a `[bracket]` segment — affected 29 files (24 API routes, 5 pages).
   Each now destructures the incoming value under a temporary name
   (`paramsPromise`) and awaits it as the first line of the function, so
   every existing `params.xxx` reference elsewhere in the function keeps
   working unchanged.
2. **Prisma 7 removed `url = env("DATABASE_URL")` from schema.prisma** —
   connection strings now live in `prisma.config.ts` (for the CLI) and are
   passed as a driver adapter to the `PrismaClient` constructor (for the
   running app). Added `@prisma/adapter-pg` + `pg`, new `prisma.config.ts`,
   and rewrote `lib/db.ts` and `prisma/seed.ts` accordingly.

Plus three smaller bugs caught by the same build attempts:
- `null as const` isn't valid TypeScript (`as const` only works on string/
  number/boolean/array/object literals) — `app/(dashboard)/layout.tsx`.
- An annotation's `geometry` field (validated as `Record<string, unknown>`
  by Zod) needed an explicit cast to `Prisma.InputJsonValue` to satisfy
  Prisma's stricter JSON input type.
- The `MeasurementUnit` enum was defined uppercase (`MM`, `CM`...) in the
  schema while every validation schema and UI dropdown used lowercase
  (`mm`, `cm`...) — changed the enum to lowercase since far more code
  already assumed that casing.
