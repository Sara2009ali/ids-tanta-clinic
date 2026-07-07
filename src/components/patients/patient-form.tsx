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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
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
          <div className="space-y-2">
            <Label htmlFor="first_name">First name *</Label>
            <Input
              id="first_name"
              name="first_name"
              required
              defaultValue={defaultValues?.first_name ?? ""}
              aria-invalid={!!fieldErrors.first_name}
            />
            <FieldError message={fieldErrors.first_name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name *</Label>
            <Input
              id="last_name"
              name="last_name"
              required
              defaultValue={defaultValues?.last_name ?? ""}
              aria-invalid={!!fieldErrors.last_name}
            />
            <FieldError message={fieldErrors.last_name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of birth</Label>
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
            <FieldError message={fieldErrors.date_of_birth} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
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
            <FieldError message={fieldErrors.gender} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={defaultValues?.phone ?? ""}
              aria-invalid={!!fieldErrors.phone}
            />
            <FieldError message={fieldErrors.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultValues?.email ?? ""}
              aria-invalid={!!fieldErrors.email}
            />
            <FieldError message={fieldErrors.email} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={defaultValues?.address ?? ""} />
            <FieldError message={fieldErrors.address} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="national_id">National ID</Label>
            <Input id="national_id" name="national_id" defaultValue={defaultValues?.national_id ?? ""} />
            <FieldError message={fieldErrors.national_id} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input id="occupation" name="occupation" defaultValue={defaultValues?.occupation ?? ""} />
            <FieldError message={fieldErrors.occupation} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergency_contact_name">Emergency contact name</Label>
            <Input
              id="emergency_contact_name"
              name="emergency_contact_name"
              defaultValue={defaultValues?.emergency_contact_name ?? ""}
            />
            <FieldError message={fieldErrors.emergency_contact_name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergency_contact_phone">Emergency contact phone</Label>
            <Input
              id="emergency_contact_phone"
              name="emergency_contact_phone"
              type="tel"
              defaultValue={defaultValues?.emergency_contact_phone ?? ""}
            />
            <FieldError message={fieldErrors.emergency_contact_phone} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medical Information</CardTitle>
          <CardDescription>Known allergies, medications, conditions, and risk flags.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Input
                id="allergies"
                name="allergies"
                placeholder="Penicillin, Latex"
                defaultValue={defaultValues?.allergies ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_medications">Current medications</Label>
              <Input
                id="current_medications"
                name="current_medications"
                placeholder="Aspirin, Metformin"
                defaultValue={defaultValues?.current_medications ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medical_conditions">Medical conditions</Label>
              <Input
                id="medical_conditions"
                name="medical_conditions"
                placeholder="Asthma"
                defaultValue={defaultValues?.medical_conditions ?? ""}
              />
            </div>
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

          <div className="space-y-2">
            <Label htmlFor="clinical_notes">Notes</Label>
            <Textarea id="clinical_notes" name="clinical_notes" defaultValue={defaultValues?.clinical_notes ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dental Information</CardTitle>
          <CardDescription>Reason for visit, referral, and coverage.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="chief_complaint">Chief complaint</Label>
            <Textarea
              id="chief_complaint"
              name="chief_complaint"
              defaultValue={defaultValues?.chief_complaint ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referral_source">Referral source</Label>
            <Input
              id="referral_source"
              name="referral_source"
              defaultValue={defaultValues?.referral_source ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferred_dentist_id">Preferred dentist</Label>
            <DoctorSelect doctors={doctors} defaultValue={defaultValues?.preferred_dentist_id} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="insurance_provider">Insurance provider</Label>
            <Input
              id="insurance_provider"
              name="insurance_provider"
              defaultValue={defaultValues?.insurance_provider ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="insurance_policy_number">Insurance policy number</Label>
            <Input
              id="insurance_policy_number"
              name="insurance_policy_number"
              defaultValue={defaultValues?.insurance_policy_number ?? ""}
            />
          </div>
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
