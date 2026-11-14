# Gym Tracker

Personal workout tracker: routines, set logging with "last time" values, rest timer, history and per-exercise progress charts.
Installable on iPhone as a PWA.

**Stack:** Vite + React 19 + TypeScript, React Router, TanStack Query, Supabase (Postgres, Auth, RLS), Recharts, dnd-kit, three.js, vite-plugin-pwa. Tests: Vitest + Playwright.

## Setup

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run, in this order:
   1. [`supabase/migrations/20261106000000_init.sql`](supabase/migrations/20261106000000_init.sql)
   2. [`supabase/seed.sql`](supabase/seed.sql)
   3. [`supabase/migrations/20261107000000_folders_images.sql`](supabase/migrations/20261107000000_folders_images.sql) (folders + exercise photos)
   4. [`supabase/migrations/20261108000000_exercise_instructions.sql`](supabase/migrations/20261108000000_exercise_instructions.sql) (step-by-step instructions)

   Steps 3 and 4 must run **after** the seed: they update the built-in exercises it creates.
   If step 4 is missing, the app still works; the "How to" sheet just shows no steps.

   Or with the CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push --include-seed`.

   > **Upgrading an existing database?** Run only the migrations you have not run yet. Never edit a migration that already ran: add a new one.

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

## Architecture notes

- **Workout in progress = local draft** ([`draft.ts`](src/features/workout/draft.ts), [`draftStore.ts`](src/features/workout/draftStore.ts)).
  Every change is written to `localStorage`. "Finish" sends the whole workout in one `save_workout` RPC (one transaction).
  `workouts.id` is generated on the client, so retrying a save never creates duplicates.
- **RLS is the security boundary.** Every table is scoped to `auth.uid()`. The anon key in the bundle is public by design.
- **Derived numbers are not stored.** Volume, e1RM (Epley) and PRs are computed from sets ([`shared/calc`](src/shared/calc/index.ts)), so editing an old set can never leave stale stats.
- **Rest timer** stores `restEndsAt` (a timestamp), not a counter, so it stays correct after the app is backgrounded.
  The screen is kept awake during a workout (Wake Lock API). iOS PWAs cannot schedule a notification for when the rest ends.

- **Error screen, not a blank page** ([`ErrorBoundary`](src/shared/ui/ErrorBoundary.tsx)). One boundary wraps the page inside the layout: a crashed page, or a lazy page whose code failed to download (offline, or after a deploy), shows "Something went wrong" + Reload while the tab bar keeps working, and another tab clears it. A second one in `main.tsx` catches the rest. Errors in event handlers and async code don't reach a boundary; queries and mutations show their own errors.
  `errorElement` would need a data router (`createBrowserRouter`); the app uses `<BrowserRouter>`.

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
Built-ins added this way exist only in that database (not in `seed.sql`): the monthly backup ([docs/BACKUP.md](docs/BACKUP.md)) keeps them and their photos.

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
