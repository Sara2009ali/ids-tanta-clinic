/**
 * Request header proxy.ts sets after it has already verified the session
 * against Supabase over the network for this exact request. getCurrentStaff()
 * trusts it to skip a second, redundant auth.getUser() round trip for the
 * same request — see both call sites for the full explanation.
 *
 * Never trust this header from anywhere except proxy.ts: it must always be
 * cleared and re-set there so a client-supplied value can't survive.
 */
export const VERIFIED_STAFF_ID_HEADER = "x-verified-staff-id";
