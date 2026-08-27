import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets, image optimization files, and
     * API routes. Route handlers under /api authenticate themselves
     * (e.g. the scheduler trigger's secret-header check, batch 7) — they
     * are a different trust boundary than the staff-session pages this
     * proxy governs, and must never be redirected to /login just because
     * no Supabase Auth cookie is present on a machine-to-machine request.
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
