# Feature spec: Crew Plan as the centerpiece for ultra runners

## Current structure (verified against the codebase, not assumed)

- Landing route after login/onboarding is always `/home` (`Dashboard.tsx`),
  regardless of race distance.
- Dashboard renders a grid of cards (`NAV_CARDS`). Order today: **Your
  Training Plan** first, then Log a Run, then disabled "coming soon" cards
  (Gears, Nutrition, Strength).
- **Crew Plan only appears at all when `state.trainingPlan?.distanceGoal ===
  'ultra'`**, and even then it's inserted as the *second* card, after
  Training Plan.
- The top-level nav bar (`AppNav.tsx`) doesn't list Training Plan or Crew
  Plan as nav items at all — only Home and Profile are visible (Partners,
  Run, Chat exist but are flagged `hidden: true`).

So the app already has ultra-aware logic (the `isUltra` check), it's just
not prioritizing Crew Plan within it.

## Goal

For a runner whose race is an ultra, Crew Plan should read as the primary
thing this app does — not a secondary card below Training Plan. Training
Plan and shorter races remain fully supported, just not the default framing.

## Proposed changes

1. **Reorder the Dashboard cards for ultra users**: Crew Plan first, Training
   Plan second — simplest change, lowest risk, uses the `isUltra` branch
   that already exists in `Dashboard.tsx`.
2. **Open question (see below) on whether to go further**: should an ultra
   runner land directly on `/crew-plan` instead of `/home`, or does the
   Dashboard stay the landing page with Crew Plan just promoted to the top
   card? These are different amounts of change — the first alters the actual
   default route and requires `/home` to still exist for non-ultra users and
   for anyone who wants the overview; the second is a pure reorder.
3. **Non-ultra runners are unaffected** — the existing `NAV_CARDS` (no Crew
   Plan card) stays exactly as-is for them; this is scoped to the `isUltra`
   branch only.

## Non-goals for v1

- Not removing Training Plan or demoting it out of reach — ultra runners
  still train, they just shouldn't have to scroll past a secondary card to
  reach crew logistics.
- Not touching the hidden nav items (Partners/Run/Chat) — out of scope here.
- Not redesigning the Dashboard's visual layout beyond card order/routing —
  that's a separate, larger design pass if you want it.

## Open questions for Ramesh

1. **Reorder only, or change the actual default landing route** for ultra
   users (straight to `/crew-plan` on login instead of `/home`)? Reordering
   is the safer first step; redirecting is the bigger structural statement
   but means rethinking what an ultra runner loses by skipping the Dashboard
   overview (recent runs, stats, etc.) — or whether Crew Plan itself should
   absorb some of that.
2. Should the Crew Plan card (or a promoted landing view) look visually
   different/more prominent than a same-size Dashboard card — a hero
   treatment rather than one card among several?

---

# Feature spec: Per-race segment info (generalizing the BigFoot-only data)

## Current structure (verified against the codebase, not assumed)

- `src/data/bigfoot200Segments.ts` exports `BIGFOOT_200_SEGMENTS:
  CourseSegment[]` — 13 hardcoded legs for BigFoot 200, transcribed from that
  race's 2026 Runner's Manual.
- `CourseSegment` = `{ title, distanceMiles, ascentFt, descentFt, description,
  profileImage }`. `profileImage` is a Vite-bundled asset import
  (`src/assets/segments/segment-01.png` … `-13.png`).
- `CrewPlan.tsx` matches segments to GPX waypoints purely **by order**: segment
  `i` is the leg between real-waypoint `i` and real-waypoint `i+1`, where
  "real" excludes `ALTERNATE`-named waypoints (`realWaypointIndices`). No name
  matching.
- Each station card renders a "Segment info" link only when
  `!isAlternate && realPos !== -1 && realPos < BIGFOOT_200_SEGMENTS.length`
  (`segmentInfoIndex`). Clicking sets `selectedSegment`, which opens a modal:
  title, `distanceMiles` mi · +`ascentFt` / −`descentFt`, the `description`
  paragraph, and the `profileImage` elevation chart.
- The `bigfoot200Segments.ts` header comment already flags the generalization
  as wanted but non-trivial ("reliable docx parsing … in the browser is a
  meaningfully bigger undertaking than this").
- Nothing about segments is persisted — it's a static import, identical for
  every user, only meaningful because the one race being run is BigFoot 200.

## Goal

Any race's Crew Plan can carry the same per-leg detail — distance, ascent,
descent, a written description, and an elevation-profile image — sourced from
that race's runner manual, instead of it being a BigFoot-only hardcode.

## Proposed approach (structured entry first, manual-parse later)

1. **Persist per-plan segments.** Add `courseSegments: CourseSegment[] | null`
   to `TrainingPlan`, saved alongside `crewNotes` as part of the Crew Plan
   state. `null`/absent = fall back to the built-in default.
2. **Keep `BIGFOOT_200_SEGMENTS` as the built-in default.** When a plan has no
   `courseSegments` and its race is BigFoot, use the hardcode; custom data
   overrides it. Avoids regressing the race actually being run.
3. **Structured entry UI on Crew Plan.** An editable segment list (add / edit /
   remove rows); each row = title, distance, ascent, descent, description
   textarea, and one profile-image upload. This is the entire feature for v1 —
   no file parsing.
4. **"Prefill from manual" is a later layer, not v1.** If added, it reads a
   PDF/DOCX, best-effort splits it into legs, and populates the same table for
   the user to correct. Needs a parsing library (pdf.js / mammoth) — a
   CLAUDE.md "no libraries" deviation that needs sign-off — and is unreliable
   on arbitrary manual layouts. Explicitly deferred.

## Images need their own storage — they can't follow the GPX pattern

- The GPX rule is "store the parsed summary, never the raw file." An elevation
  chart has no parsed summary; the image *is* the data.
- Inline base64 on the plan row is out — ~13 charts would add megabytes to a
  single DB row that's read on every Crew Plan load.
- So this needs a **Supabase Storage bucket** for segment images: upload on
  add/replace, delete on row removal and on GPX replace, URL stored in
  `CourseSegment.profileImage`. New infra: the bucket + RLS (crew of a plan can
  read; write ties to the gating decision below).

## Segment ↔ waypoint alignment

- Matching stays index-order for v1 — consistent with today's behavior and the
  `ALTERNATE`-skip logic.
- Add a mismatch warning when `courseSegments.length !==
  realWaypointIndices.length - 1`, same treatment as the existing
  cutoff-out-of-order warning, so a miscounted list surfaces instead of
  silently mis-labelling legs.
- An explicit "segment = Aid X → Aid Y" binding is a possible v2, not v1.

## Non-goals for v1

- No PDF/DOCX parsing (see approach #4).
- No new parsing / OCR / image libraries.
- No change to how segments map to waypoints beyond the mismatch warning.
- No "coming soon" placeholder in the UI — this ships whole or not at all; a
  dead button next to the already-working BigFoot segment-info modal would
  read as broken, not planned.

## Resolved design decisions

1. **Edit access — owner + Chief Crew only.** Segment info is authoritative
   course setup, the same category as the GPX. Reuse the existing chief-crew
   concept and its Postgres trigger rather than inventing a new policy; this
   also keeps the image-bucket write policy to a single role. Crew who want to
   contribute route info to the chief.
2. **Images are in v1, via Supabase Storage.** The elevation profile is the
   most useful part of a leg preview — text-only would ship the feature
   missing its point and still need a Storage pass later. Free plan has room
   (1 GB storage, 0 used, ~0.8 MB per race). Scope: one bucket, RLS (any
   accepted crew reads; owner + chief writes), one migration, upload/delete
   lifecycle.
3. **Per-plan storage — a column on `training_plans`.** `courseSegments:
   CourseSegment[] | null`, persisted exactly like `crewNotes` / `gpxRoute`.
   A shared race library (`races` table, canonical race identity, per-year
   course versions, curation) is a much bigger design and speculative at
   current scale; per-plan now doesn't block it later — a library would just
   seed this same field.
4. **BigFoot hardcode is migrated in, not kept as a parallel path.** Fold
   `BIGFOOT_200_SEGMENTS` into the `courseSegments` shape, seed it onto the
   BigFoot plan(s), then delete `src/data/bigfoot200Segments.ts` and the
   `bigfootSegmentsApply` name/count guard added in the stopgap commit. The 13
   bundled PNGs move into the Storage bucket as part of that migration. One
   rendering path, no special-casing; BigFoot crew still get segment info with
   zero setup via the seed.

## Implementation order (low-risk first)

1. `CourseSegment` type stays as-is; add `courseSegments: CourseSegment[] |
   null` to `TrainingPlan`; persist it through the existing `updateCrewPlan` /
   `updateCrewPlanById` paths and the `TRAINING_PLAN_UPDATED` reducer. No UI
   yet — just the field round-tripping. `npx tsc --noEmit` + build.
2. Supabase Storage bucket + RLS migration in `supabase/`: read for any
   accepted crew of the plan, write for owner + chief (mirror the GPX trigger's
   role check).
3. Chief/owner-gated entry UI on Crew Plan — editable segment list (add / edit
   / remove rows: title, distance, ascent, descent, description, one image
   upload each), plus the `courseSegments.length !== realWaypointIndices.length
   - 1` mismatch warning. Rendering switches from `BIGFOOT_200_SEGMENTS` to
   `plan.courseSegments`.
4. BigFoot migration: upload the 13 PNGs to the bucket, seed the BigFoot
   plan's `courseSegments`, delete `bigfoot200Segments.ts` and the
   `bigfootSegmentsApply` guard.

---

# Feature spec: multiple races per account ("My Races")

## Why (critical, structural)

The app is hard-wired to one plan per user. A real ultra runner does
several races a year (the person asking for this runs 5). Today the only
way to "start a new race" is to re-run onboarding, which **overwrites**
the existing plan. There is no list, no switch, no delete. This blocks
the core use case and every downstream feature (per-race segments, crew,
weather) is scoped to that single plan.

This is squarely the "structural work matters as much as new features"
priority in CLAUDE.md.

## Current shape (verified against the codebase)

- **DB:** `training_plans.user_id` has a `unique` constraint — one row per
  user. `training_plan_weeks`, `crew_plan_access`, and the
  `course-segments` storage paths are already keyed by `plan_id`, so only
  `training_plans` itself assumes singularity.
- **API (`src/lib/api.ts`):**
  - `hydrateUserData()` calls `fetchTrainingPlan(userId)` →
    `.eq('user_id', userId).maybeSingle()` → one plan.
  - `saveTrainingPlan(userId, plan)` → `.upsert(..., { onConflict:
    'user_id' })` → creating a second plan silently overwrites the first.
  - `updateCrewPlan(userId, updates)` → `.eq('user_id', userId)` (owner
    path). `updateCrewPlanById(planId, …)` already exists for the shared
    path and is the pattern to converge on.
  - `fetchTrainingPlanById(planId)` and `fetchSharedPlans(userId)` (returns
    an array of `{ accessId, ownerUserId, plan }`) already prove
    list + id-based access.
- **State (`src/state`):** `AppState.trainingPlan: TrainingPlan | null` —
  a single slot, "generated ONCE, persisted, never recomputed".
  `sharedPlans: SharedPlanEntry[]` is already a list.
- **Routing (`src/App.tsx`):** `/crew-plan` and `/training-plan` read the
  single `state.trainingPlan`. `/crew-plan/shared/:planId` already routes
  by id. `RequirePlan` redirects to `/onboarding` when
  `!state.trainingPlan`.
- **Dashboard:** `hasPlan = !!state.trainingPlan`; `isUltra =
  state.trainingPlan?.distanceGoal === 'ultra'` drives card order.
- **Onboarding (`src/routes/Onboarding/index.tsx`):** the wizard calls
  `saveTrainingPlan` once at the end and is gated as the post-signup step.

## Target model

- **Own plans become a list**, exactly like `sharedPlans` already is. Each
  plan is addressed by its `id`. "The plan you're currently looking at" is
  a function of the route (`/crew-plan/:planId`), not a global singleton.
- **A "My Races" screen** lists the user's own plans: race name, date,
  distance, a countdown, and (later) crew count / readiness. Actions: open
  (→ that race's Crew Plan), **add a race**, **delete a race**.
- **Add a race** re-enters the onboarding wizard in an additive mode —
  inserts a new `training_plans` row, does not touch existing ones,
  returns to My Races (or straight into the new race's Crew Plan) on
  finish.
- **Delete a race** removes the plan; `training_plan_weeks` and
  `crew_plan_access` already cascade via FK. Segment images in Storage
  need an explicit cleanup pass (list `course-segments/<planId>/` and
  remove) since Storage objects don't cascade.

## Decisions

1. **Where "My Races" lives — its own nav item**, reachable from the top
   nav (alongside Home / Profile) and surfaced on the Dashboard as the
   first thing an ultra runner sees. Not buried in Profile: switching
   races is a frequent action, not a settings task.
2. **Post-login landing:**
   - 0 own plans → onboarding (unchanged)
   - exactly 1 own plan → straight into that race (current behaviour
     preserved for the common case)
   - 2+ own plans → the My Races list
   A remembered "last opened race" (localStorage) can later refine the
   2+ case, but list-first is the safe default.
3. **`state.trainingPlan` stays during the transition** as a derived
   "active plan" (the one the current route resolves), so the migration
   doesn't have to touch every `state.trainingPlan` reader at once. New
   code reads the route param; old screens read the derived value until
   they're ported.
4. **Shared plans and own plans stay separate lists** (`sharedPlans` vs.
   the new own-plans list). They render similarly but have different
   permissions and entry points; merging them is out of scope.

## Non-goals for v1

- No shared "race library" / templates (already deferred in the segments
  spec).
- No cross-race dashboard/rollup ("all my races this season" analytics).
- No reordering, tagging, or archiving of races beyond add/open/delete.
- Training Plan screen stays single-race-at-a-time; no multi-plan
  training view.
- No change to the crew-invite or lock model — both are already
  `plan_id`-scoped.

## Implementation order (low-risk first)

1. **DB + API, no UI change.** Drop `unique (user_id)` on
   `training_plans`; add `is_primary boolean not null default false` +
   partial unique index `where is_primary` (schema.sql + migration note).
   Add `fetchTrainingPlans(userId): TrainingPlan[]` (order by
   `is_primary desc, race_date asc`), `createTrainingPlan(userId, plan,
   { primary })` (plain insert, no upsert), `deleteTrainingPlan(planId)`
   (+ Storage image cleanup). Keep `fetchTrainingPlan` returning the
   primary (or most-recent) as a shim. `hydrateUserData` fetches the
   array; state gains `ownPlans: TrainingPlan[]` alongside the existing
   `trainingPlan` slot. `TrainingPlan` type gains `isPrimary: boolean`.
   Everything still renders the same single plan.
2. **Route by id for own plans.** Add `/crew-plan/:planId` and
   `/training-plan/:planId`; make `state.trainingPlan` a selector over
   `ownPlans` + the route param (falls back to the primary plan when no
   param). `RequirePlan` checks `ownPlans.length`. Training Plan screen
   always resolves to the primary plan regardless of param.
3. **My Races screen + nav.** New route `/races`, nav item, Dashboard
   entry point. List `ownPlans` — race name, date, distance, countdown,
   a "Primary" badge — each opening that race's Crew Plan. Landing logic
   (0 → onboarding / 1 → that race / 2+ → the list) from decision 2.
4. **Add a race (short flow).** "Add race" on My Races → a trimmed
   onboarding: race name, date, distance/ultra-distance, GPX upload.
   Skips training-preference steps and does NOT generate
   `training_plan_weeks`. `createTrainingPlan(..., { primary: false })`
   → redirect to the new race's Crew Plan. Wizard local state resets on
   entry so it doesn't prefill from the primary race.
5. **Delete a race.** Confirm dialog naming the shared-crew count,
   `deleteTrainingPlan`, Storage cleanup, refresh the list. Can't delete
   the primary race while other races exist (must reassign primary
   first); deleting the last race → back to onboarding.
6. **Cleanup.** Remove the `fetchTrainingPlan` shim and any lingering
   direct `state.trainingPlan` reads once all screens route by id. Add
   the "make primary" switch on My Races.

## Resolved (was: open questions)

1. **Copy / duplicate a race — no, not in v1.** No guarantee a runner
   repeats a race year to year, and a real copy needs its own Storage
   image objects (no folder-copy in Supabase; sharing refs breaks on
   delete). Re-onboarding is the path. `courseSegments` stays
   self-contained on the plan row so a "Duplicate" button is a clean
   follow-up if annual repeats turn out to be common.
2. **Delete a race — warn, then hard-cascade. No crew notification.**
   The delete confirm names the blast radius ("shared with N people —
   they'll lose access"); on confirm, the FK cascade drops
   `training_plan_weeks` and `crew_plan_access`, and an explicit pass
   clears `course-segments/<planId>/` in Storage. No notification is sent
   — the app has no notification system (invites are already out-of-band,
   "let them know directly"). A crew member opening a deleted plan gets
   the existing "this plan isn't available" state. Soft-delete rejected:
   a `deleted_at` filter on every plan query + a cleanup job is more
   machinery than this needs.
3. **Training Plan — one "primary" race owns the weekly schedule.**
   - The first race (full onboarding) gets a generated
     `training_plan_weeks` schedule and is the primary race.
   - "Add a race" runs a SHORT flow (race name, date, distance, GPX only
     — skips the training-preference steps) and creates a **Crew-Plan-only**
     plan with no `training_plan_weeks`. Fast to add, which matters when
     adding several.
   - The Training Plan screen always shows the primary race. A "make this
     my primary race" switch on My Races is a later add.
   - Serves both audiences: a beginner has one goal race with a training
     plan; a repeat runner has a primary race + crew-only secondary
     races. Real multi-race periodization (overlapping training blocks)
     is a separate effort, bundled with the existing "insufficient
     runway" open work.
   - Schema: add `training_plans.is_primary boolean not null default
     false` with a partial unique index (`where is_primary`) so at most
     one primary per user; the onboarded plan sets it true.
