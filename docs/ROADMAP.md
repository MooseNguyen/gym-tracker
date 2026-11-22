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
| 22  | A finished workout saves by itself when the signal comes back         | #34 |
| 21  | Errors from production reported to Sentry (no personal data)          | #35 |
| 23  | Body weight log with a chart (kg / lb) and its own CSV export         | #37 |
| 25  | After a workout that differs from its routine, ask to update it       | #39 |
| 26  | Set a workout's duration by hand, while training or from History      | #40 |
| 27  | Sticky note per exercise, on the workout card and in How-to           | #43 |

Also shipped along the way: RepDB exercise library (#14, #15), admin form for
built-in exercises with photos (#16), UI polish and the live workout bar (#17),
faster start with a saved query cache and splash (#18), flaky rest-wheel e2e
test fixed by a real wheel bug fix (#27).

## Next

| #   | Status | Item                                                                                                                    | Effort | Why                                                                                                                                                                                                                                                                                                 |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | To do  | Restore a backup into an empty Supabase project, end to end; seed becomes a migration right after init                  | S–M    | The restore script has only run against a local database; a backup never restored is a hope, not a backup. The seed ran after the migrations in CI but right after init in production, so it had to replay every later change to the built-ins: now one migration order everywhere (seed part: #42) |
| 10  | To do  | Check on a real iPhone: glass blur, page transitions, Me sheet, CSV share sheet, Update routine dialog, Duration wheels | S      | Headless browsers in CI don't render `backdrop-filter` or the iOS share sheet, and wheels feel different under a finger                                                                                                                                                                             |
| 28  | Idea   | Warm-up sets generated from the working weight (e.g. 40 % × 10, 60 % × 5, 80 % × 3), rounded to the plates              | S      | Reuses the plate calculator and the Warm-up set type; no mental maths before a heavy lift. No schema change                                                                                                                                                                                         |
| 29  | Idea   | Weekly goal (e.g. 4 workouts) with progress and a streak on Home                                                        | S–M    | Keeps the habit going; builds on the 28-day strip. One column on `profiles`                                                                                                                                                                                                                         |
| 30  | Idea   | Bodyweight exercises' volume counts the logged body weight (pull-up = body + added)                                     | S      | Today only the added weight counts, so their volume is near zero. Needs a rule for days with no weigh-in                                                                                                                                                                                            |
| 31  | Idea   | Import history from a Hevy or Strong CSV                                                                                | M      | Someone moving from another app keeps their history; matters once others use the app                                                                                                                                                                                                                |
| 32  | Idea   | Automated accessibility checks (axe) in the e2e suite                                                                   | S      | Catches a11y regressions on every PR instead of by hand. New dev dependency `@axe-core/playwright` (test only, not in the bundle)                                                                                                                                                                   |

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
- ~~19. Account deletion~~ — dropped
- [x] 20. Error screen (error boundary) — #33
- [x] 21. Production error reporting — #35
- [x] 22. Auto-save when back online — #34
- [x] 23. Body weight log — #37
- ~~24. Supersets~~ — dropped
- [x] 25. Ask to update the routine after a workout — #39
- [x] 26. Duration set by hand — #40
- [x] 27. Sticky exercise notes — #43
- [ ] 28. Warm-up set generator
- [ ] 29. Weekly goal and streak
- [ ] 30. Bodyweight volume with logged body weight
- [ ] 31. Import from Hevy / Strong
- [ ] 32. Accessibility checks (axe)
