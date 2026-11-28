-- Tells exercises added from the app (an admin's built-ins, everyone's custom
-- exercises) apart from the library that ships with the app (RepDB and the
-- first seeded built-ins), for the "Added in app" filter.
--
-- Existing rows start as false (library), then the default becomes true, so
-- every row the app inserts from now on is marked without the client sending
-- anything (older cached app versions included). A future migration that
-- adds library exercises must set added_in_app = false itself.

alter table exercises add column added_in_app boolean not null default false;
alter table exercises alter column added_in_app set default true;

-- Backfill what the app already added. Custom exercises always come from the
-- app. Built-ins have no record of where they came from, so their photo
-- decides: an admin's built-in must have an uploaded start photo (own/...),
-- while a RepDB built-in whose start photo an admin replaced still keeps
-- RepDB's end photo. Check the result on production before relying on it:
--   select name, image_path, image_path_end from exercises
--   where user_id is null and added_in_app order by created_at;
update exercises set added_in_app = true
where user_id is not null
   or (image_path like 'own/%' and (image_path_end is null or image_path_end not like 'repdb-%'));
