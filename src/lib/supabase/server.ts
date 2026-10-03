// Supabase client for Server Components, Route Handlers and Server Actions.
// Uses the signed-in user's session cookie, so Row-Level Security applies.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseConfigured() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && key);
}

export async function createClient() {
  const cookieStore = await cookies();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => (cookieStore as any).set(name, value, options));
        } catch {
          // Server Component: cookies are read-only
        }
      },
    },
  });
}
