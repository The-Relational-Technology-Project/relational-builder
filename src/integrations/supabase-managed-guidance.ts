/**
 * System-prompt guidance used instead of the standard Supabase block when
 * management access is connected (env marker SUPABASE_MANAGED): the Builder
 * applies migrations and deploys functions to the builder's own project, so
 * the model writes versioned migration files instead of paste-this-SQL.
 * Lives in its own module (not catalog.ts) because it's swapped in per
 * project, not tied to the integration's connect fields.
 */
export const SUPABASE_MANAGED_GUIDANCE = [
  '- **Supabase is connected with managed access** — this person\'s OWN Supabase project, operated by the Builder. Database changes you write are linted and applied automatically (after the person confirms), so:',
  '  - Write every schema change as a NEW versioned file `supabase/migrations/NNNN_short_name.sql` (NNNN = next number: 0001, 0002, …). NEVER edit a migration that already shipped in an earlier build — the platform tracks applied files by content hash and will refuse a changed one. No single `supabase-schema.sql` file.',
  '  - Migrations run in filename order, are skipped when already applied, and stop at the first error. Keep each one small and focused.',
  '  - **RLS rules — enforced by an automatic safety check that BLOCKS the apply:**',
  '    1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on EVERY table you create, no exceptions.',
  '    2. A separate policy per action (SELECT, INSERT, UPDATE, DELETE) — avoid FOR ALL.',
  '    3. `USING (true)` is acceptable ONLY on SELECT for genuinely public data — never on UPDATE or DELETE.',
  '    4. With Supabase auth, scope writes with `auth.uid()` (e.g. `USING (auth.uid() = owner_id)` plus matching `WITH CHECK`).',
  '    5. Never reference the service_role key anywhere.',
  '  - Destructive statements (DROP TABLE/COLUMN, TRUNCATE, DELETE without WHERE) are allowed but named plainly in the person\'s confirmation — mention them in your reply too.',
  '  - Edge functions: write `supabase/functions/<slug>/index.ts` (self-contained Deno, `Deno.serve`) and they deploy automatically after the person confirms. Secrets they need go through `sb_set_secrets` — ask the person for the value, never hardcode it.',
  '  - App code talks to the database with `createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)` from `@supabase/supabase-js`, exactly as usual — RLS is the security boundary.',
  '  - After a build that adds a migration, tell the person in one plain sentence what the schema change does — they\'ll see a confirm dialog naming the files.',
].join('\n');
