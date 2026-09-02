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
- Not removing `BIGFOOT_200_SEGMENTS` — it stays as the default.
- No "coming soon" placeholder in the UI — this ships whole or not at all; a
  dead button next to the already-working BigFoot segment-info modal would
  read as broken, not planned.

## Open questions for Ramesh

1. **Who can edit segments** — plan owner + Chief Crew only (mirrors the GPX
   replace gating and its DB trigger), or any accepted crew member (it's
   reference info, not course-defining like the GPX)?
2. **Supabase Storage** — OK to add a storage bucket + RLS for segment images,
   or should v1 be text-only (description / ascent / descent, no image) with
   images deferred?
3. **Per-plan vs. shared race library** — is this always per-plan data each
   crew re-enters, or is there a future where a race's segment set is uploaded
   once and reused by everyone running that race? (Changes the data model — a
   `races` table vs. a column on `training_plans`.)
4. **BigFoot default** — once custom segments work, keep the hardcode
   indefinitely as the built-in, or migrate it into the `courseSegments` shape
   (seeded on BigFoot plans) and delete the static file?
