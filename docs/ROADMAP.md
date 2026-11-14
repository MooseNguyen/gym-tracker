# Roadmap

Next steps, in order of value. Tick an item when its PR is merged and add the PR
number. Effort: **S** ≈ under half a day, **M** ≈ 1–2 days.

## Done

| #   | Item                                                                  | PR  |
| --- | --------------------------------------------------------------------- | --- |
| 1   | Next-target suggestions while logging ("last time 80×8 → try 82.5×8") | #11 |
| 2   | Replace the remaining `confirm()` / `prompt()` with the in-app dialog | #11 |
| 3   | Seed exercises keep their photos on a fresh database (CI checks it)   | #14 |
| 4   | Database types generated from the migrations, checked in CI           | #23 |
| 5   | PR markers on History ("🏆 2 PRs"), computed by the `workout_prs` RPC | #21 |
| 6   | Plate calculator                                                      | #19 |
| 7   | Two-frame animation in How-to                                         | #14 |
| 8   | Secondary muscles count in the weekly stats                           | #20 |
| 9   | kg / lb per account, CSV export (Me tab)                              | #22 |
| 11  | Flaky "drags a card from anywhere" e2e test fixed                     | #24 |
| 12  | Admins can unhide built-in exercises                                  | #26 |
| 13  | Members edit their custom exercises (no photo)                        | #28 |
| 14  | Monthly backup of the whole database and photos, tested restore       | #25 |
| 15  | Supabase region checked: Sydney, kept (moving was not worth it)       | #25 |
| 17  | Weekly CI run of the e2e suite × 4, no retries (flake hunt)           | #31 |
| 20  | Error screen instead of a blank page (error boundary)                 | #33 |

Also shipped along the way: RepDB exercise library (#14, #15), admin form for
built-in exercises with photos (#16), UI polish and the live workout bar (#17),
faster start with a saved query cache and splash (#18), flaky rest-wheel e2e
test fixed by a real wheel bug fix (#27).

## Next

| #   | Status | Item                                                                            | Effort | Why                                                                                                                                  |
| --- | ------ | ------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 16  | To do  | Restore a backup into an empty Supabase project, end to end                     | S      | The restore script has only run against a local database; a backup never restored is a hope, not a backup                            |
| 10  | To do  | Check on a real iPhone: glass blur, page transitions, Me sheet, CSV share sheet | S      | Headless browsers in CI don't render `backdrop-filter` or the iOS share sheet                                                        |
| 21  | To do  | Error reporting from production (Sentry free tier, or a Supabase table)         | S–M    | Crashes on other people's phones are invisible today; plugs into React 19's `createRoot` error options after item 20                 |
| 22  | To do  | Save a finished workout automatically when the phone is back online             | S      | Gyms have poor signal; today a failed save waits for the user to press Try again. Safe to retry: the workout id is made on the phone |
| 23  | To do  | Body weight log with a chart (kg / lb)                                          | S–M    | Not tracked today; a new table with RLS, a form in Me, Recharts is already there                                                     |
| 19  | Later  | Members can delete their account and all its data                               | M      | Not possible today; expected once the app has outside users                                                                          |
| 24  | Later  | Supersets: two or three exercises done in turn, rest after the group            | M–L    | Touches the schema, the workout draft, the rest timer and the UI; only worth it if supersets are used often                          |

## Checklist

- [x] 1. Next-target suggestions — #11
- [x] 2. In-app confirm / prompt dialogs — #11
- [x] 3. Seed photos on a fresh database — #14
- [x] 4. Generated Supabase types — #23
- [x] 5. PR markers on History — #21
- [x] 6. Plate calculator — #19
- [x] 7. Two-frame How-to animation — #14
- [x] 8. Secondary muscles — #20
- [x] 9. kg / lb, CSV export — #22
- [ ] 10. iPhone check
- [x] 11. Flaky drag test — #24
- [x] 12. Unhide built-ins — #26
- [x] 13. Edit custom exercises — #28
- [x] 14. Database backup — #25
- [x] 15. Supabase region: Sydney, kept — #25
- [ ] 16. Restore test on a real project
- [x] 17. Scheduled repeated e2e run — #31
- ~~18. Upload cap per account~~ — dropped: custom exercises have no photos
- [ ] 19. Account deletion
- [x] 20. Error screen (error boundary) — #33
- [ ] 21. Production error reporting
- [ ] 22. Auto-save when back online
- [ ] 23. Body weight log
- [ ] 24. Supersets
