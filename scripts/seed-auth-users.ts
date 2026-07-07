/**
 * Creates a demo clinic plus one demo staff account per role, using the
 * Supabase Admin API (secret key). Raw SQL can't create auth.users
 * safely on a hosted project, so this is the standard way to seed staff
 * logins for local testing. Never run this against a production project.
 *
 * Usage: npm run seed
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_CLINIC = {
  name: "IDS Tanta (Demo)",
  slug: "ids-tanta-demo",
  timezone: "Africa/Cairo",
};

const DEMO_STAFF = [
  { email: "admin@idstanta.demo", full_name: "Amira Hassan", role: "admin" as const },
  { email: "doctor@idstanta.demo", full_name: "Dr. Karim Youssef", role: "doctor" as const },
  { email: "reception@idstanta.demo", full_name: "Mona Adel", role: "reception" as const },
];

const DEMO_PASSWORD = "IdsTanta!Demo123";

async function main() {
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .upsert(DEMO_CLINIC, { onConflict: "slug" })
    .select()
    .single();

  if (clinicError || !clinic) {
    throw new Error(`Failed to create demo clinic: ${clinicError?.message}`);
  }

  console.log(`Demo clinic ready: ${clinic.name} (${clinic.id})`);

  for (const staff of DEMO_STAFF) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: staff.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });

    if (createError && !createError.message.includes("already been registered")) {
      throw new Error(`Failed to create ${staff.email}: ${createError.message}`);
    }

    const userId =
      created?.user?.id ??
      (await supabase.auth.admin.listUsers()).data.users.find((u) => u.email === staff.email)?.id;

    if (!userId) {
      throw new Error(`Could not resolve user id for ${staff.email}`);
    }

    const { error: profileError } = await supabase.from("staff_profiles").upsert(
      {
        id: userId,
        clinic_id: clinic.id,
        full_name: staff.full_name,
        role: staff.role,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      throw new Error(`Failed to upsert staff_profiles for ${staff.email}: ${profileError.message}`);
    }

    console.log(`  - ${staff.role.padEnd(10)} ${staff.email} / ${DEMO_PASSWORD}`);
  }

  console.log("\nSeeding complete. Sign in at /login with any of the accounts above.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
