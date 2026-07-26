import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/types/database.generated";
import { VERIFIED_STAFF_ID_HEADER } from "@/lib/auth/verified-headers";

const PUBLIC_PATHS = ["/login"];

/**
 * Refreshes the Supabase session cookie on every request and enforces the
 * login/logout redirect boundary between the (auth) and (app) route groups.
 * Called from proxy.ts (Next.js 16's renamed middleware convention).
 */
export async function updateSession(request: NextRequest) {
  const cookiesToApply: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToApply.push(...cookiesToSet);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicPath) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Forward the already-verified user id to the render tree so
  // getCurrentStaff() can skip calling auth.getUser() a second time for
  // this same request. Always clear it first — a client can send this
  // header itself, and `.set()` below only overwrites it when we've just
  // confirmed a real session, so a spoofed value never survives.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(VERIFIED_STAFF_ID_HEADER);
  if (user) {
    requestHeaders.set(VERIFIED_STAFF_ID_HEADER, user.id);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  cookiesToApply.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );

  return response;
}
