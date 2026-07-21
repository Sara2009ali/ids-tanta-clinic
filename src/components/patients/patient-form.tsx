"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createPatient, updatePatient } from "@/lib/patients/actions";
import { calculateAge, MEDICAL_FLAG_KEYS, medicalFlagLabel } from "@/lib/patients/utils";
import type { DoctorOption } from "@/lib/patients/queries";
import { DoctorSelect } from "@/components/patients/doctor-select";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PatientFormDefaultValues {
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  national_id?: string | null;
  occupation?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  medical_conditions?: string | null;
  is_pregnant?: boolean | null;
  is_smoker?: boolean | null;
  has_hypertension?: boolean | null;
  has_diabetes?: boolean | null;
  has_heart_disease?: boolean | null;
  has_bleeding_disorder?: boolean | null;
  clinical_notes?: string | null;
  chief_complaint?: string | null;
  referral_source?: string | null;
  preferred_dentist_id?: string | null;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
}

interface PatientFormProps {
  mode: "create" | "edit";
  patientId?: string;
  defaultValues?: PatientFormDefaultValues;
  doctors: DoctorOption[];
}

export function PatientForm({ mode, patientId, defaultValues, doctors }: PatientFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dateOfBirth, setDateOfBirth] = useState(defaultValues?.date_of_birth ?? "");

  const age = calculateAge(dateOfBirth);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result =
        mode === "create" ? await createPatient(formData) : await updatePatient(patientId!, formData);

      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success(mode === "create" ? "Patient created" : "Patient updated");
        router.push(`/patients/${result.patientId}`);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Core identifying and contact details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="first_name" required error={fieldErrors.first_name}>
            <Input
              id="first_name"
              name="first_name"
              required
              defaultValue={defaultValues?.first_name ?? ""}
              aria-invalid={!!fieldErrors.first_name}
            />
          </FormField>
          <FormField label="Last name" htmlFor="last_name" required error={fieldErrors.last_name}>
            <Input
              id="last_name"
              name="last_name"
              required
              defaultValue={defaultValues?.last_name ?? ""}
              aria-invalid={!!fieldErrors.last_name}
            />
          </FormField>
          <FormField label="Date of birth" htmlFor="date_of_birth" error={fieldErrors.date_of_birth}>
            <div className="flex items-center gap-3">
              <Input
                id="date_of_birth"
                name="date_of_birth"
                type="date"
                value={dateOfBirth ?? ""}
                onChange={(event) => setDateOfBirth(event.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="flex-1"
                aria-invalid={!!fieldErrors.date_of_birth}
              />
              {age !== null && (
                <span className="whitespace-nowrap text-sm text-muted-foreground">Age: {age}</span>
              )}
            </div>
          </FormField>
          <FormField label="Gender" htmlFor="gender" error={fieldErrors.gender}>
            <Select name="gender" defaultValue={defaultValues?.gender ?? undefined}>
              <SelectTrigger id="gender" className="w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="unspecified">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Phone" htmlFor="phone" error={fieldErrors.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={defaultValues?.phone ?? ""}
              aria-invalid={!!fieldErrors.phone}
            />
          </FormField>
          <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultValues?.email ?? ""}
              aria-invalid={!!fieldErrors.email}
            />
          </FormField>
          <FormField label="Address" htmlFor="address" error={fieldErrors.address} className="sm:col-span-2">
            <Input id="address" name="address" defaultValue={defaultValues?.address ?? ""} />
          </FormField>
          <FormField label="National ID" htmlFor="national_id" error={fieldErrors.national_id}>
            <Input id="national_id" name="national_id" defaultValue={defaultValues?.national_id ?? ""} />
          </FormField>
          <FormField label="Occupation" htmlFor="occupation" error={fieldErrors.occupation}>
            <Input id="occupation" name="occupation" defaultValue={defaultValues?.occupation ?? ""} />
          </FormField>
          <FormField
            label="Emergency contact name"
            htmlFor="emergency_contact_name"
            error={fieldErrors.emergency_contact_name}
          >
            <Input
              id="emergency_contact_name"
              name="emergency_contact_name"
              defaultValue={defaultValues?.emergency_contact_name ?? ""}
            />
          </FormField>
          <FormField
            label="Emergency contact phone"
            htmlFor="emergency_contact_phone"
            error={fieldErrors.emergency_contact_phone}
          >
            <Input
              id="emergency_contact_phone"
              name="emergency_contact_phone"
              type="tel"
              defaultValue={defaultValues?.emergency_contact_phone ?? ""}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medical Information</CardTitle>
          <CardDescription>Known allergies, medications, conditions, and risk flags.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Allergies" htmlFor="allergies">
              <Input
                id="allergies"
                name="allergies"
                placeholder="Penicillin, Latex"
                defaultValue={defaultValues?.allergies ?? ""}
              />
            </FormField>
            <FormField label="Current medications" htmlFor="current_medications">
              <Input
                id="current_medications"
                name="current_medications"
                placeholder="Aspirin, Metformin"
                defaultValue={defaultValues?.current_medications ?? ""}
              />
            </FormField>
            <FormField label="Medical conditions" htmlFor="medical_conditions">
              <Input
                id="medical_conditions"
                name="medical_conditions"
                placeholder="Asthma"
                defaultValue={defaultValues?.medical_conditions ?? ""}
              />
            </FormField>
          </div>

          <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
            {MEDICAL_FLAG_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox id={key} name={key} defaultChecked={defaultValues?.[key] ?? false} />
                <Label htmlFor={key} className="font-normal">
                  {medicalFlagLabel(key)}
                </Label>
              </div>
            ))}
          </div>

          <FormField label="Notes" htmlFor="clinical_notes">
            <Textarea id="clinical_notes" name="clinical_notes" defaultValue={defaultValues?.clinical_notes ?? ""} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dental Information</CardTitle>
          <CardDescription>Reason for visit, referral, and coverage.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Chief complaint" htmlFor="chief_complaint" className="sm:col-span-2">
            <Textarea
              id="chief_complaint"
              name="chief_complaint"
              defaultValue={defaultValues?.chief_complaint ?? ""}
            />
          </FormField>
          <FormField label="Referral source" htmlFor="referral_source">
            <Input
              id="referral_source"
              name="referral_source"
              defaultValue={defaultValues?.referral_source ?? ""}
            />
          </FormField>
          <FormField label="Preferred dentist" htmlFor="preferred_dentist_id">
            <DoctorSelect doctors={doctors} defaultValue={defaultValues?.preferred_dentist_id} />
          </FormField>
          <FormField label="Insurance provider" htmlFor="insurance_provider">
            <Input
              id="insurance_provider"
              name="insurance_provider"
              defaultValue={defaultValues?.insurance_provider ?? ""}
            />
          </FormField>
          <FormField label="Insurance policy number" htmlFor="insurance_policy_number">
            <Input
              id="insurance_policy_number"
              name="insurance_policy_number"
              defaultValue={defaultValues?.insurance_policy_number ?? ""}
            />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          You&apos;ll be able to upload photos, X-rays, and documents after saving.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Create patient" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
