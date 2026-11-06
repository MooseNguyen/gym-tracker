-- Split chest, back and shoulders into sub-muscles (one primary target per
-- exercise) so stats can count sets per muscle. The plain group values stay
-- valid: custom exercises keep them and count as "<group> (general)".
-- Only built-in exercises (user_id is null) are re-classified; seed.sql already
-- uses the new values for fresh databases.

update exercises set muscle_group = 'mid-chest'
where user_id is null and name in ('Bench Press', 'Dumbbell Bench Press', 'Dumbbell Fly', 'Machine Chest Press', 'Pec Deck', 'Push Up');

update exercises set muscle_group = 'upper-chest'
where user_id is null and name in ('Incline Bench Press', 'Incline Dumbbell Press');

update exercises set muscle_group = 'lower-chest'
where user_id is null and name in ('Cable Crossover', 'Chest Dip');

update exercises set muscle_group = 'lower-back'
where user_id is null and name in ('Back Extension', 'Deadlift');

update exercises set muscle_group = 'upper-back'
where user_id is null and name in ('Barbell Row', 'Machine Row', 'Seated Cable Row', 'T-Bar Row');

update exercises set muscle_group = 'lats'
where user_id is null and name in ('Chin Up', 'Dumbbell Row', 'Lat Pulldown', 'Pull Up', 'Straight Arm Pulldown');

update exercises set muscle_group = 'traps'
where user_id is null and name in ('Barbell Shrug');

update exercises set muscle_group = 'side-delts'
where user_id is null and name in ('Cable Lateral Raise', 'Lateral Raise');

update exercises set muscle_group = 'rear-delts'
where user_id is null and name in ('Face Pull', 'Rear Delt Fly');

update exercises set muscle_group = 'front-delts'
where user_id is null and name in ('Front Raise', 'Machine Shoulder Press', 'Overhead Press', 'Seated Dumbbell Press');
