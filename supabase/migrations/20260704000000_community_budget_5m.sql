-- Community building budgets, raised generously (July 4 2026).
-- Early adopters deserve great experiences: Opus 4.8 is now the default
-- community model and the old 750k/day ceiling would cut real building
-- sessions short. Individual rows can still be tuned per member.
-- (Applied to texakzqqenzpxawktbgx via management API on 2026-07-04.)

ALTER TABLE community_members ALTER COLUMN daily_token_budget SET DEFAULT 5000000;

UPDATE community_members
SET daily_token_budget = 5000000
WHERE daily_token_budget = 750000;
