// Supabase client for Client Components (browser-side).
// Uses @supabase/ssr createBrowserClient for automatic session and cookie handling.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}
