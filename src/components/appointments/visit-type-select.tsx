import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VisitType } from "@/types/domain";

export function VisitTypeSelect({
  visitTypes,
  defaultValue,
  onValueChange,
  id = "visit_type_id",
  name = "visit_type_id",
  placeholder = "Select a visit type",
  emptyPlaceholder = "No visit types yet",
}: {
  visitTypes: VisitType[];
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  id?: string;
  name?: string;
  /** Both default to English for callers outside the localized booking form. */
  placeholder?: string;
  emptyPlaceholder?: string;
}) {
  return (
    <Select
      name={name}
      items={Object.fromEntries(
        visitTypes.map((visitType) => [
          visitType.id,
          <span key={visitType.id} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: visitType.color }}
              aria-hidden
            />
            {visitType.name}
          </span>,
        ]),
      )}
      defaultValue={defaultValue ?? undefined}
      onValueChange={(value) => {
        if (value) onValueChange?.(value);
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={visitTypes.length ? placeholder : emptyPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {visitTypes.map((visitType) => (
          <SelectItem key={visitType.id} value={visitType.id}>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: visitType.color }}
              aria-hidden
            />
            {visitType.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
