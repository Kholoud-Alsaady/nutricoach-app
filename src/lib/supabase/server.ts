import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

export const createClient = (cookieStore?: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      async getAll() {
        const store = cookieStore || (await cookies());
        return store.getAll();
      },
      async setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          const store = cookieStore || (await cookies());
          cookiesToSet.forEach(({ name, value, options }) =>
            (store as any).set(name, value, options)
          );
        } catch {
          // Handled if called from Server Component
        }
      },
    },
  });
};
