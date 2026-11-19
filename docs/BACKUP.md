# Backup and restore

The Supabase project is on the free plan, which keeps **no backups we can
restore**. This is our own: a monthly copy of everything that isn't in git,
made from this machine, and a tested way back.

| In the backup                                                       | Not in it (and where it lives instead)                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Every `public` table: workouts, sets, routines, folders, exercises… | Schema, functions, policies: `supabase/migrations` (git)                 |
| `auth.users` + `auth.identities`: password hashes, the admin role   | Sessions: everyone signs in again after a restore                        |
| Admin-uploaded photos (`exercise-images` bucket)                    | RepDB photos: `public/exercises` (git)                                   |
| Row counts of that day (`counts.txt`), to check a restore           | Auth settings, Vercel env vars: copied by hand (README, Setup steps 3–5) |

A backup folder holds **password hashes and every workout**: treat it like a
password file.

## One-time setup

- [ ] PostgreSQL client tools, same major version as the server or newer
      (the server runs 17): `scoop install postgresql`, check with
      `pg_dump --version`. The scripts find scoop's folder on their own;
      elsewhere put the tools on `PATH` or set `PG_BIN`.
- [ ] `.env.backup` at the repo root (gitignored by `.env.*`). Connection
      string from the dashboard → **Connect** → **Session pooler** (the direct
      connection is IPv6-only on the free plan); the user is `postgres.<ref>`.

```ini
BACKUP_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres
# Optional, default: <home>/gym-tracker-backups
BACKUP_DIR=
```

`npm run backup` also reads `VITE_SUPABASE_URL` from `.env.local` (photos are
downloaded from their public URL, so no service key is needed).

## Every month

Put a repeating reminder in your calendar, e.g. the 1st of each month.

- [ ] `npm run backup`. It prints the previous backup's date, then ends with
      `Done: <folder>`. On a problem it stops with one `Error: …` line
      (`DEBUG=1` adds the stack trace). A folder still named `….partial` is
      an aborted run: delete it and run again.
- [ ] Open `counts.txt` in the new folder: `workouts` and `sets` should be at
      least last month's numbers. A drop means data was lost **before** the
      backup: keep the older backups and find out why.
- [ ] Copy it off this machine, encrypted, e.g. with 7-Zip
      (`scoop install 7zip`), to Google Drive / OneDrive:

```powershell
7z a -p -mhe=on "gym-tracker-2026-12-01.7z" "$HOME\gym-tracker-backups\2026-12-01"
```

- [ ] Keep the last 6 months (local and cloud); delete older ones.
- [ ] Every 6 months, and after any migration that changes tables: the
      **restore test** below. A backup that was never restored is a hope, not a
      backup.

Also run `npm run backup` right before pushing a risky migration to production.

## Restore

Into a **fresh** project only: the restore refuses a project that already has
accounts or workouts, so it can never overwrite production.

1. Create a new Supabase project (for a test: any free project, deleted after).
2. `.env.restore` at the repo root (gitignored). Keys: Project Settings → API
   Keys → `service_role` (secret; only used to upload the photos).

```ini
RESTORE_DB_URL=postgresql://postgres.<new-ref>:<password>@<host>:5432/postgres
RESTORE_URL=https://<new-ref>.supabase.co
RESTORE_SERVICE_KEY=
```

3. Schema, from the migrations (they also add the built-in exercises; the
   restore replaces them with the backup's, ids included):

```powershell
npx supabase db push --db-url "<RESTORE_DB_URL>"
```

4. Data and photos, then a count check against the backup:

```powershell
npm run restore -- "$HOME\gym-tracker-backups\2026-12-01"
```

It runs in one transaction (any error: nothing is kept, fix and rerun) and
ends with `Restore complete: every count matches.` A `COPY` error about a
missing column means production's schema has drifted from the migrations:
add a migration for the difference, push it, rerun.

5. **For a test**: sign in to the new project once (any local build with its
   URL and anon key in `.env.local`), then delete the project and
   `.env.restore`.
   **For real**: auth settings by hand (README, Setup steps 3–5), then Vercel
   → `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → redeploy, and the same
   in `.env.local`.
