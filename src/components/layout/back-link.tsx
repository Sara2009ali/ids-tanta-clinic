import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type BackLinkProps =
  | { href: string; label: React.ReactNode; ariaLabel?: never }
  | { href: string; label?: never; ariaLabel: string };

/**
 * Shared "back to X" pattern — icon-only (compact page headers) or
 * text-labeled (report/sub-page headers) — with the arrow mirrored for RTL,
 * matching the rtl:rotate-180 convention already used by the calendar and
 * doctor-schedule chevron nav. Replaces 27 hand-rolled, RTL-blind copies of
 * this same button.
 */
export function BackLink(props: BackLinkProps) {
  if (props.label) {
    return (
      <Button variant="ghost" size="sm" className="-ms-2" render={<Link href={props.href} />}>
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {props.label}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon" render={<Link href={props.href} aria-label={props.ariaLabel} />}>
      <ArrowLeft className="size-4 rtl:rotate-180" />
    </Button>
  );
}
