# The Runners Guru — React scaffold

Recreation of the Claude-Design prototype (`Runners_Guru_dc.html`) in a real
React + Vite + TypeScript app, per the design handoff README.

## Run it

```bash
npm install
npm run dev
```

Then open the printed localhost URL. Start at `/` (Landing) → Join free →
complete onboarding → you'll land on the Dashboard with a generated plan.

`npm run build` produces a production build in `dist/`; `npm run preview`
serves it locally to sanity-check the build output.

## Deploying to GitHub Pages

This repo includes `.github/workflows/deploy.yml`, which builds and deploys
automatically on every push to `main`.

1. Push this project to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: The Runners Guru scaffold"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. In the repo on GitHub: **Settings → Pages → Source → GitHub Actions**.
3. Push (or re-run the workflow from the **Actions** tab) — it'll build and
   deploy. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

`vite.config.ts` auto-detects the repo name from GitHub Actions' environment
and sets the base path accordingly, so you don't need to edit anything for
a standard project Pages site. (If you're deploying to a *user/org* Pages
site — a repo literally named `<your-username>.github.io` — or a custom
domain, the base path is already correctly left as `/`.)

The workflow also copies `index.html` to `404.html` after building, so deep
links (e.g. `/profile`) survive a hard refresh — GitHub Pages can't do
server-side rewrites, but it does serve `404.html` for unmatched paths,
which lets the client-side router take over from there.

## Project structure

```
src/
  styles.css          Industry design-system tokens/components (copied as-is)
  app.css             App-level layout scaffolding (grids, chat layout, etc.)
  types/               Domain types (AppState, TrainingPlan, LoggedRun, ...)
  data/constants.ts     Seed/mock data ported from the prototype
  lib/
    planGenerator.ts    Training-plan algorithm (ported from generateDynamicPlan)
    weather.ts           Open-Meteo geocode + temperature lookup
    storage.ts            localStorage persistence for logged runs
    format.ts              Duration/pace formatting helpers
  state/
    actions.ts / reducer.ts / AppContext.tsx   App state machine
    selectors.ts                                 Derived values (home stats, etc.)
  components/
    ui/                Blueprint, Button, Form primitives, Dialog
    layout/             AppNav, AppLayout, RequireAuth
    Logo.tsx
  routes/               One file/folder per screen (Landing, SignUp, SignIn,
                         Onboarding/, Dashboard, TrainingPlan, LogRun,
                         Partners, Run, Chat, Profile/)
  App.tsx               Router wiring
  main.tsx               Entry point
```

## Backend: Supabase

This app now uses [Supabase](https://supabase.com) (managed Postgres + auth)
for real accounts, training plans, and logged runs. Set it up:

1. Create a free project at supabase.com.
2. **Project → SQL Editor → New query** → paste the contents of
   `supabase/schema.sql` → **Run**. This creates every table, plus row-level
   security policies so each user can only see their own data.
3. **Project Settings → API** → copy the **Project URL** and **anon public**
   key.
4. Locally: `cp .env.example .env.local` and fill in those two values.
5. For the deployed (GitHub Pages) build: repo → **Settings → Secrets and
   variables → Actions** → add two repository secrets:
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, same values as above.
   The deploy workflow reads these at build time.
6. (Optional, for smoother testing) **Authentication → Providers → Email** →
   turn off "Confirm email" so sign-up doesn't require clicking an email
   link before you can use the app. Turn it back on before real users sign up.

Once both `.env.local` (local) and the two repo secrets (deployed) are set,
`npm run dev` and the GitHub Pages deploy both talk to the same real
database — sign up on one, and the account/plan/logged runs are there
when you sign in from the other.

## What's real vs. still mocked

- **Real, backed by Supabase:** sign-up/sign-in (real accounts, real
  passwords, real sessions), the generated training plan (persisted once,
  never regenerated), logged runs, address/profile, Garmin connected/
  disconnected status.
- **Real, no backend needed:** the training-plan generation algorithm, the
  weather API calls (Open-Meteo, no key required).
- **Still mocked (needs more backend work — see "Next steps" below):**
  race lookup (`RACES_BY_DISTANCE` hardcoded table — a real geocoded
  search was investigated, but the obvious provider, RunSignup, gates
  broad race search behind partner/affiliate approval rather than a
  self-serve key, so this stayed mocked), partner matches, chat, and
  leaderboard. Garmin Connect (the *toggle* is real and persisted, but
  there's no actual OAuth flow or synced data behind it — see the Garmin
  note below).

## Next steps for a real backend

The remaining phased steps from the original plan:

1. ~~Auth~~ ✅ done — real Supabase Auth.
2. ~~Profile + onboarding + training plan~~ ✅ done — persisted to
   `profiles` / `training_plans` / `training_plan_weeks`.
3. ~~Logged runs~~ ✅ done — persisted to `logged_runs`, replacing localStorage.
4. **Matches + chat** — needs a `matches` table (schema already included in
   `supabase/schema.sql`) plus real user discovery (currently there's only
   one signed-in user's perspective — matching needs a way to see *other*
   real users, e.g. a "find nearby runners" query). Chat is a good fit for
   [Supabase Realtime](https://supabase.com/docs/guides/realtime) so
   messages appear live without polling — the schema file has the table
   ready and a commented-out line to enable realtime on it.
5. **Garmin** — real integration needs Garmin Developer Program approval,
   OAuth 1.0a/2.0 credentials, and a server endpoint to receive Garmin's
   webhook push data (there's no client-only path). Supabase **Edge
   Functions** are a reasonable place to host that webhook receiver when
   you get there.

## Known gaps in this scaffold

- No automated tests yet.
- "Recommended Gears / Nutrition / Strength" dashboard cards are inert
  placeholders (per the prototype — these are "coming soon" in the product).
- No accessibility pass beyond what the Industry component classes already
  provide (focus rings, semantic form labels) — worth a dedicated review
  before shipping.
