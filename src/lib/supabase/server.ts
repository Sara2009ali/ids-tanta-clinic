import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/types/database.generated";

/**
 * Server-side Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Cookie writes silently no-op when called from a
 * Server Component render — proxy.ts is responsible for keeping the
 * session cookie fresh in that case.
 *
 * Wrapped in React's `cache()` so the many query modules that each call
 * `createClient()` independently (patients, appointments, billing,
 * inventory, compensation, reports, …) share one client instance per
 * request instead of re-reading the cookie jar and re-constructing
 * `createServerClient` dozens of times per page load.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — proxy.ts refreshes the
            // session cookie on navigations, so this is safe to ignore.
          }
        },
      },
    },
  );
});
