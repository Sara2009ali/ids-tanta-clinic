-- Fix: duplicate national IDs were never checked anywhere. Unlike phone,
-- which has both an app-level pre-check (findPatientByPhone) and this exact
-- kind of DB-level constraint, national_id had neither — two patient
-- records could be saved under the same national ID with no warning.
-- National ID should if anything be *more* strictly unique than phone (a
-- household can legitimately share a phone; a national ID never can), so
-- this closes the gap using the same technique already used for phone.
create unique index patients_clinic_national_id_unique_idx
  on public.patients (clinic_id, national_id)
  where national_id is not null and deleted_at is null;
