import { createClient } from '@supabase/supabase-js';

/**
 * Read-only Supabase client for the RTS Studio knowledge base.
 * Uses the public anon key — no authentication required.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  ?? 'https://ivrvpbqidysrwqrthpcp.supabase.co';

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cnZwYnFpZHlzcndxcnRocGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzQ4NDQsImV4cCI6MjA3NTQ1MDg0NH0.fBKxzaiUspapVYq7xT60EHHVgWR-DcolUW2Cy90GHHc';

// Read-only KB client: auth fully disabled so it never races the Builder
// client for magic-link tokens in the URL (they're different Supabase
// projects — consuming the wrong project's token 403s and can break sign-in)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
