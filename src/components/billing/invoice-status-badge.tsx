import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/types/domain";

const STATUS_BADGE_VARIANT: Record<InvoiceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  unpaid: "destructive",
  partially_paid: "default",
  paid: "secondary",
  cancelled: "destructive",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}
