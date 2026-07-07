import { z } from "zod";

// Only NEXT_PUBLIC_* vars belong here — this module is imported by
// src/lib/supabase/client.ts, which runs in the browser. Server-only
// secrets (e.g. SUPABASE_SECRET_KEY, used by scripts/seed-auth-users.ts)
// must never be added to this schema.
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a non-empty string"),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(
    "Invalid or missing environment variable(s):\n" +
      `${issues}\n\n` +
      "Check your .env.local file (or the deployment environment's configuration) " +
      "and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set correctly.",
  );
}

export const env = {
  supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
