# Runners Guru — React scaffold

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
   git commit -m "Initial commit: Runners Guru scaffold"
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

## What's real vs. still mocked

Matches the prototype's fidelity — this is a faithful **frontend**
recreation, not a backend:

- **Real:** the training-plan generation algorithm, the weather API calls
  (Open-Meteo, no key required), logged-run persistence (localStorage),
  all client-side state/navigation.
- **Still mocked (same as the prototype, needs a real backend):**
  auth/session (no password check, no server), race lookup (`RACES_BY_DISTANCE`
  hardcoded table instead of a real geocoded search), partner matches, chat,
  leaderboard, and Garmin Connect (fully faked — real integration needs
  Garmin Developer Program approval, OAuth credentials, and a server to
  receive Garmin's webhook push data; there's no client-only path).

## Next steps for a real backend

Per the handoff README's "State Management" section, the pieces that need
a real per-user store are: auth/session, onboarding answers, the generated
plan (generate once, never recompute), logged runs, partner matches/chat,
and profile/settings. The reducer in `state/reducer.ts` is a reasonable map
of what your API payloads/tables should look like — each action roughly
corresponds to one endpoint.

## Known gaps in this scaffold

- No automated tests yet.
- "Recommended Gears / Nutrition / Strength" dashboard cards are inert
  placeholders (per the prototype — these are "coming soon" in the product).
- No accessibility pass beyond what the Industry component classes already
  provide (focus rings, semantic form labels) — worth a dedicated review
  before shipping.
