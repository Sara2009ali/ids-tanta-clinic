import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Chair } from "@/types/domain";

/**
 * Sentinel value for the "Unassigned" option — Base UI's Select doesn't
 * allow an empty-string item value, so the appointment sheet's submit
 * handler strips this back out to nothing before calling createAppointment
 * (chair_id is optional/nullable per appointmentFormSchema).
 */
export const UNASSIGNED_CHAIR_VALUE = "unassigned";

export function ChairSelect({
  chairs,
  defaultValue,
  onValueChange,
  id = "chair_id",
  name = "chair_id",
}: {
  chairs: Chair[];
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  id?: string;
  name?: string;
}) {
  return (
    <Select
      name={name}
      items={{ [UNASSIGNED_CHAIR_VALUE]: "Unassigned", ...Object.fromEntries(chairs.map((c) => [c.id, c.label])) }}
      defaultValue={defaultValue ?? UNASSIGNED_CHAIR_VALUE}
      onValueChange={(value) => {
        if (value) onValueChange?.(value);
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED_CHAIR_VALUE}>Unassigned</SelectItem>
        {chairs.map((chair) => (
          <SelectItem key={chair.id} value={chair.id}>
            {chair.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
