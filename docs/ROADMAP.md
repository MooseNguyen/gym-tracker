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

Also shipped along the way: RepDB exercise library (#14, #15), admin form for
built-in exercises with photos (#16), UI polish and the live workout bar (#17),
faster start with a saved query cache and splash (#18).

## Next

| #   | Status | Item                                                                            | Effort | Why                                                                                                     |
| --- | ------ | ------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 10  | To do  | Check on a real iPhone: glass blur, page transitions, Me sheet, CSV share sheet | S      | Headless browsers in CI don't render `backdrop-filter` or the iOS share sheet                           |
| 12  | To do  | UI to unhide built-in exercises                                                 | S      | Hidden built-ins can only be restored in SQL today                                                      |
| 13  | To do  | Edit custom exercises, with a photo                                             | M      | The admin form already resizes and uploads photos; custom exercises can't be edited after creating them |
| 14  | To do  | Backup / export of the exercises table                                          | S      | Admin-added built-ins live only in the production database                                              |
| 15  | To do  | Check the Supabase project region                                               | S      | Latency from Vietnam; moving later means a migration                                                    |

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
- [ ] 12. Unhide built-ins
- [ ] 13. Edit custom exercises
- [ ] 14. Exercises backup
- [ ] 15. Supabase region
