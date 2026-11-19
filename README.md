# Gym Tracker

Personal workout tracker: routines, set logging with "last time" values, rest timer, history and per-exercise progress charts.
Installable on iPhone as a PWA.

**Stack:** Vite + React 19 + TypeScript, React Router, TanStack Query, Supabase (Postgres, Auth, RLS), Recharts, dnd-kit, three.js, vite-plugin-pwa. Tests: Vitest + Playwright.

## Setup

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. **Schema and built-in exercises**, both from `supabase/migrations` (the first built-ins come from `20261106000001_seed_built_ins.sql`, right after the schema, so the later migrations that update them find them):
   1. Link the CLI to the project (it asks for the database password; the ref is the subdomain of the project URL, 20 lowercase letters):

      ```sh
      npx supabase link --project-ref <ref>
      ```

   2. Apply every migration:

      ```sh
      npx supabase db push --dry-run   # lists what will run
      npx supabase db push
      ```

   > **A database set up before #42** (`init.sql` and `seed.sql` pasted into the SQL Editor) already has these built-ins, renamed by later migrations. Mark the seed migration as applied there, without running it: `npx supabase migration repair --status applied 20261106000001`. The migration also skips itself on any database that already has built-ins.

   > **Changing the schema later:** add a new file to `supabase/migrations` (never edit one that already ran), then `npx supabase db push --dry-run` and `npx supabase db push`. Apply migrations **only** with `db push`, never by pasting them into the SQL Editor: the CLI records what ran in `supabase_migrations.schema_migrations`, and a migration run by hand is missing there, so the next push tries to run it again (`type "…" already exists`). If that happens, check that the migration's tables and columns exist, mark it with `npx supabase migration repair --status applied <version>`, and push again.

3. **Authentication → Sign In / Providers → Email**: keep Email enabled.
   - "Confirm email" **on**: after creating the account, click the link in the confirmation email once (opening it in Safari is fine), then sign in.
   - "Confirm email" **off**: you are signed in right after creating the account. Fine for a personal app.
   - The default email templates work as they are; no custom SMTP needed.
4. **Authentication → URL Configuration**:
   - **Site URL**: your deployed URL, for example `https://gym-tracker.vercel.app`.
   - **Redirect URLs**: add `https://<your-domain>/reset-password` and `http://localhost:5173/reset-password`, otherwise the reset-password link is rejected.
5. Once your own account exists: **Authentication → Sign In / Providers → turn off "Allow new users to sign up"**.
   The URL is public, so anyone could otherwise create an account. RLS keeps your data private either way.

> The built-in email sender is rate-limited (a few emails per hour). Only sign-up confirmation and password reset send email, so that's fine for one user.

> **Backups:** the free plan keeps none you can restore. Run `npm run backup` every month: [docs/BACKUP.md](docs/BACKUP.md).

### 2. Local dev

```bash
cp .env.example .env.local   # fill in Project URL + anon key (Settings → API)
npm install
npm run dev
```

### 3. Deploy (Vercel)

Import the repo in Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, and deploy.
`vercel.json` rewrites every path to `index.html` so deep links like `/history/:id` work.

#### Error reporting (optional, Sentry)

Without these variables the app sends nothing; with them, crashes and failed requests on any phone reach [Sentry](https://sentry.io) (free plan: 5,000 errors a month), with readable stacks.

1. Create a Sentry project (platform **React**). In its settings, turn on **Security & Privacy → Prevent Storing of IP Addresses**.
2. Create an **Organization Auth Token** (Settings → Auth Tokens). It is only used to upload source maps.
3. In Vercel → Settings → Environment Variables, for **Production** and **Preview**:

| Variable            | Value                                | Secret?                                                                         |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `VITE_SENTRY_DSN`   | Project settings → Client Keys (DSN) | No: it ends up in the bundle, by design                                         |
| `SENTRY_AUTH_TOKEN` | The token from step 2                | **Yes.** Build-time only; never `VITE_`-prefix it, or it would be in the bundle |
| `SENTRY_ORG`        | Your organization slug               | No                                                                              |
| `SENTRY_PROJECT`    | The project slug                     | No                                                                              |

4. Redeploy. New issues are emailed to you by default (Alerts in Sentry).

**What is sent:** the error and its stack, browser and OS, the page path, URLs of recent requests (without query strings), the account's UUID, and the release (build id) and environment (production / preview).
**Not sent:** email, IP address, request or response bodies (workouts), headers (the session token), cookies, or anything in localStorage ([`monitoring.ts`](src/lib/monitoring.ts)).
**Not reported:** requests that got no answer (no signal, timeouts): they are not bugs, and saves retry by themselves.

### 4. Install on iPhone

Open the deployed URL in **Safari** → Share → **Add to Home Screen** → open the app from the icon and sign in **there**.
The home-screen app has its own storage, separate from Safari: signing in inside Safari does not sign in the app.
That's why login is email + password (with Keychain autofill) and not a magic link.

Forgot your password? Use "Forgot password?". The email link opens in Safari, where you set a new password.
Then open the app from the home screen and sign in with it.

## Scripts

| Command                               | What it does                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                         | Dev server                                                                      |
| `npm run build`                       | Type-check + production build                                                   |
| `npm run lint`                        | ESLint                                                                          |
| `npm test`                            | Unit tests (calc + workout draft logic)                                         |
| `npm run test:e2e`                    | Playwright on an iPhone 13 WebKit profile, with Supabase mocked                 |
| `npm run db:types`                    | Generate TS types from the linked Supabase project (replace `src/types/db.ts`)  |
| `node scripts/repdb/fetch-images.mjs` | Re-download the RepDB exercise images listed in `scripts/repdb/library.json`    |
| `npm run backup`                      | Monthly backup of production data and photos ([docs/BACKUP.md](docs/BACKUP.md)) |
| `npm run restore -- <folder>`         | Restore a backup into a fresh project and check the counts                      |

### Flake hunt (scheduled CI)

[`e2e-repeat.yml`](.github/workflows/e2e-repeat.yml) runs the whole e2e suite 4 times every Sunday (20:00 UTC), with no retries and every CPU busy.
The PR checks retry a failed test once, so a flaky test passes there; this run fails on it instead.

- **Run it by hand:** Actions → **E2E repeated (flake hunt)** → **Run workflow** (pick the repeat count), or `gh workflow run e2e-repeat.yml -f repeat=8`.
- **When it fails** (GitHub emails whoever last changed the workflow file): download the `playwright-report-repeat` artifact and open the failing test's trace with `npx playwright show-trace <trace.zip>`. It shows the exact step and the page at that moment.
- A failure here is often a real timing bug, not just a bad test (the rest wheel, #27): reproduce it locally with `npx playwright test <file> --repeat-each=40 --workers=8` before changing the test.

### npm audit

`npm audit --omit=dev` (what ships to phones) must stay at **0**. The rest is build and lint tooling; what is left, checked on 2026-11-15, is accepted for now:

| Finding                                           | Pulled in by                                                 | Why it is accepted                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `glob`, `minimatch` (moderate), `deepmerge` (low) | `vite-plugin-pwa` → `workbox-build`                          | Build only, on this repo's own patterns. No fix: `npm audit` suggests a downgrade, and workbox-build 7.4.1 (latest) still uses them. |
| `minimatch` (moderate)                            | `typescript-eslint` → `@typescript-eslint/typescript-estree` | Lint only, on our own globs. Its latest (8.72.2) still asks for `minimatch@^10`; the fix is in 11.                                   |
| `glob` → `minimatch` (moderate)                   | `@sentry/vite-plugin` 11.10.0                                | Build only. Fixed in 11.12.0 (2026-11-10): move it and `@sentry/react` to 11.12 together once that release is two weeks old.         |

Re-check with `npm audit` when updating any of these.

## Architecture notes

- **Workout in progress = local draft** ([`draft.ts`](src/features/workout/draft.ts), [`draftStore.ts`](src/features/workout/draftStore.ts)).
  Every change is written to `localStorage`. "Finish" sends the whole workout in one `save_workout` RPC (one transaction).
  `workouts.id` is generated on the client, so retrying a save never creates duplicates.
- **Saving with a weak or lost signal** ([`useSaveWorkout`](src/features/workout/api.ts)). Offline, TanStack Query pauses the save and sends it when the phone is back online; a request that fails on the way (supabase-js reports status 0, turned into a `NetworkError` by [`unwrap`](src/lib/unwrap.ts)) or hangs past 15 s is retried with backoff up to 30 s. Meanwhile Finish reads "Waiting for signal…". Errors from the server are not retried.
  Sets edited while waiting are sent again with the same id once the first save lands. Only while the page is open: leave it or close the app and the draft stays, so pressing Finish again saves it.
- **RLS is the security boundary.** Every table is scoped to `auth.uid()`. The anon key in the bundle is public by design.
- **Derived numbers are not stored.** Volume, e1RM (Epley) and PRs are computed from sets ([`shared/calc`](src/shared/calc/index.ts)), so editing an old set can never leave stale stats.
- **Body weight** ([`src/features/body`](src/features/body), Me → Body weight): one weigh-in per account per day (`body_weights`, primary key `(user_id, measured_on)`), so a second one that day replaces the first. Stored in kg like sets and shown in the account's unit; the day is the phone's local date, not a timestamp. Exported as its own CSV from Me, next to the workouts. RLS is checked in CI ([`body_weights_rls.sql`](supabase/tests/body_weights_rls.sql)).
- **Routine vs workout** ([`routineSync.ts`](src/features/routines/routineSync.ts)): starting a routine copies it into the workout, so changes made while training never touch the routine by themselves. After Finish has saved the workout, it compares what was done (exercises with at least one saved set, their order and saved-set count) with the routine as the server has it now, and if they differ asks "Update routine?" listing the changes. Update rewrites the routine's exercise list through `save_routine`; name, notes, folder and the rest time of exercises it already had stay. Not asked when editing a saved workout. A failed update offers Try again / Skip; the workout is saved either way.
- **Duration set by hand** (tap Duration in the workout header, while training or editing a saved workout): the start stays and the draft's `endedAt` becomes start + the picked hours and minutes, which Finish / Save then sends as `ended_at`. While training this freezes the clock ("Duration (set)") until **Use live time**. At least 1 minute, at most 24 h and never past now, so `ended_at` is never in the future.
- **Rest timer** stores `restEndsAt` (a timestamp), not a counter, so it stays correct after the app is backgrounded.
  The screen is kept awake during a workout (Wake Lock API). iOS PWAs cannot schedule a notification for when the rest ends.

- **Error screen, not a blank page** ([`ErrorBoundary`](src/shared/ui/ErrorBoundary.tsx)). One boundary wraps the page inside the layout: a crashed page, or a lazy page whose code failed to download (offline, or after a deploy), shows "Something went wrong" + Reload while the tab bar keeps working, and another tab clears it. A second one in `main.tsx` catches the rest. Errors in event handlers and async code don't reach a boundary; queries and mutations show their own errors.
  `errorElement` would need a data router (`createBrowserRouter`); the app uses `<BrowserRouter>`.
- **Error reporting** ([`monitoring.ts`](src/lib/monitoring.ts)): React's root error options (`onCaughtError`, `onUncaughtError`, `onRecoverableError` in `main.tsx`) and TanStack Query's `QueryCache` / `MutationCache` `onError` send to Sentry; errors only, no tracing or replay. Sentry v11 collects request bodies, headers, cookies and query strings by default: all are turned off. Source maps are built `hidden` and deleted after the upload, only when `SENTRY_AUTH_TOKEN` is set. The e2e tests run with a fake DSN and check what is sent ([`monitoring.spec.ts`](e2e/monitoring.spec.ts)).

- **Drag and drop** uses dnd-kit ([`SortableList`](src/shared/ui/SortableList.tsx)): the HTML5 drag-and-drop API does not fire for touch on iOS.
  Only the ⠿ handle starts a drag (the card still scrolls), and Space + arrow keys reorder with the keyboard, announced by exercise name.
- **three.js is decoration, never required.** It lives in its own lazy chunk ([`src/three`](src/three)):
  - [`heroScene.ts`](src/three/heroScene.ts): dumbbell behind the Home / Login header. ~30 fps, pixel ratio ≤ 1.5, stops when the page is hidden or scrolled away, a still frame with Reduce Motion, and full disposal on unmount.
  - [`prBurst.ts`](src/three/prBurst.ts): 1.4 s particle burst when a set beats last time. One renderer per burst, released (`forceContextLoss`) right after: iOS allows few live WebGL contexts.
  - No WebGL, Reduce Motion, or chunk not loaded → a CSS gradient / the text banner only.
  - The chunk (~130 kB gzip) is precached by the service worker, so the burst also works offline.

## Exercise photos and instructions

Built-in exercises, photos (start and end of the movement) and steps come from [RepDB](https://repdb.co), free tier, pinned to one dataset commit ([`scripts/repdb`](scripts/repdb)).
Its license allows in-app use **with a visible credit** (shown on the Exercises page and in the How-to sheet), but not redistributing the data as a dataset or deriving from it with generative AI.
Instructions are loaded only when the "How to" sheet opens, so lists and history do not carry ~1 kB of text per exercise.
Retired built-ins RepDB doesn't cover are hidden: they keep their name for history but have no photo or steps.

### Adding built-ins from the app (admins)

An admin can add a built-in (for every user) from **Exercises → + New → Built-in**, with a start photo, an optional end photo and the steps, and edit or hide any built-in with ✎.
Photos are cropped to a 320px square JPEG on the phone and stored in the `exercise-images` Storage bucket (`own/<uuid>.jpg`, a new name for every upload, so they can be cached forever).
Only use photos you have the rights to.

Make an account admin once (SQL Editor), then **sign out and in again** so the new token carries the role:

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
where email = 'you@example.com';
```

The role lives in `app_metadata`, which users cannot change themselves; RLS (`is_admin()`, [migration](supabase/migrations/20261113000000_admin_exercises.sql)) enforces it, and CI checks it ([`admin_rls.sql`](supabase/tests/admin_rls.sql)).
Built-ins added this way exist only in that database (not in the migrations): the monthly backup ([docs/BACKUP.md](docs/BACKUP.md)) keeps them and their photos.

### Custom exercises (every user)

Anyone can add their own exercises (**+ New**) and edit or delete them later (✎, 🗑): name, muscle group, equipment. RLS lets each account change only its own (init migration).
Custom exercises have **no photo** (the placeholder icon): only admins upload photos, for built-ins.

- **Tracked as** can't be changed once the exercise exists: past sets were logged for that kind. This is a UI rule, not a database one; changing it through the API only mislabels that account's own history.

## Testing checklist that needs a real Supabase project

The E2E tests mock the network, so they do not cover SQL. After setting up Supabase, check by hand once:

- [ ] **RLS:** log in as user A, create a workout. Log in as user B (another email) → history is empty, and
      `supabase.from('workouts').select()` in the console returns `[]`.
- [ ] **RLS on exercises:** as user B, call `save_workout` with an `exercise_id` of one of user A's custom exercises
      → it fails with `new row violates row-level security policy`.
- [ ] Finish a workout, then start the same routine again → the "Previous" column shows the last values.
- [ ] Edit an old workout → the "Previous" column shows the workout _before_ it, not itself.
- [ ] Delete a custom exercise that is used in history → you get a clear error, not a silent delete.
- [ ] Create a folder, add a routine with "+" → it is saved in that folder. Delete the folder → the routine moves to "Unfiled".
- [ ] As user B, try to put a routine in one of user A's folders (`save_routine` with A's `folder_id`) → RLS error.

## Checklist on the iPhone

- [ ] Leave the phone on the bench during rest: the screen stays on (Wake Lock; broken in home-screen apps on some older iOS versions).
- [ ] Lock the phone with the side button during rest, unlock after a minute: the timer shows the right time left, ticked sets are still there.
- [ ] Drag an exercise by its ⠿ handle: it moves; dragging elsewhere on the card scrolls the page.
- [ ] Beat a set from last time: banner + particles. With Settings → Accessibility → Motion → Reduce Motion on: banner only.
