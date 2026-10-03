// Service-role Supabase client. SERVER ONLY — bypasses Row-Level Security.
// Used exclusively by the demo seed / reset. Never import this in a client component.

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for seeding.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
