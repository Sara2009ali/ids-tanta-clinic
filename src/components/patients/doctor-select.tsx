import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DoctorOption } from "@/lib/patients/queries";

export function DoctorSelect({
  doctors,
  defaultValue,
  id = "preferred_dentist_id",
  name = "preferred_dentist_id",
}: {
  doctors: DoctorOption[];
  defaultValue?: string | null;
  id?: string;
  name?: string;
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? undefined}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={doctors.length ? "Select a doctor" : "No doctors yet"} />
      </SelectTrigger>
      <SelectContent>
        {doctors.map((doctor) => (
          <SelectItem key={doctor.id} value={doctor.id}>
            Dr. {doctor.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
