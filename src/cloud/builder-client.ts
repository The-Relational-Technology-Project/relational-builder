import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for the Builder's own backend — accounts, cloud projects,
 * and collaboration. This is a separate Supabase project from the RTS Studio
 * knowledge base (which stays read-only via src/knowledge/supabase-client.ts).
 *
 * Cloud features are optional: without these env vars the builder runs in
 * local-only mode (localStorage), exactly as before.
 */

const BUILDER_URL = import.meta.env.VITE_BUILDER_SUPABASE_URL ?? '';
const BUILDER_ANON_KEY = import.meta.env.VITE_BUILDER_SUPABASE_ANON_KEY ?? '';

export const cloudEnabled = Boolean(BUILDER_URL && BUILDER_ANON_KEY);

export const builderClient: SupabaseClient | null = cloudEnabled
  ? createClient(BUILDER_URL, BUILDER_ANON_KEY)
  : null;
