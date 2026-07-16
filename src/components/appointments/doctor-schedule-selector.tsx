import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { DoctorOption } from "@/lib/patients/queries";

/** Pure links — no client state needed, so this stays a Server Component. */
export function DoctorScheduleSelector({
  doctors,
  selectedDoctorId,
}: {
  doctors: DoctorOption[];
  selectedDoctorId: string | undefined;
}) {
  if (doctors.length === 0) {
    return <p className="text-sm text-muted-foreground">No doctors found for this clinic yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {doctors.map((doctor) => (
        <Button
          key={doctor.id}
          size="sm"
          variant={doctor.id === selectedDoctorId ? "default" : "outline"}
          render={<Link href={`/appointments/doctor-schedule?doctorId=${doctor.id}`} />}
        >
          {doctor.full_name}
        </Button>
      ))}
    </div>
  );
}
