import * as React from "react";
import { CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Consistent label + required-indicator + input-slot + error-message
 * wrapper — replaces the "Label + Input + error paragraph" triplet that was
 * hand-repeated (with drifting FieldError implementations) across
 * patient-form.tsx, invoice-form-sheet.tsx, and product-form-sheet.tsx.
 */
function FormField({
  label,
  htmlFor,
  required,
  description,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  /** Persistent helper text shown below the input, regardless of error state. */
  description?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
      <CircleAlert className="size-3 shrink-0" />
      {message}
    </p>
  );
}

export { FormField, FieldError };
