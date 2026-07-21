import { Badge } from "@/components/ui/badge";
import { PURCHASE_ORDER_STATUS_LABELS, type PurchaseOrderStatus } from "@/types/domain";

// Mirrors InvoiceStatusBadge's exact shape and variant reasoning: draft is
// neutral, ordered is in-progress (default), partially_received is
// in-progress-with-partial-completion (warning), received is the
// settled/positive state (success), cancelled is destructive.
const STATUS_BADGE_VARIANT: Record<
  PurchaseOrderStatus,
  "default" | "secondary" | "outline" | "destructive" | "success" | "warning"
> = {
  draft: "outline",
  ordered: "default",
  partially_received: "warning",
  received: "success",
  cancelled: "destructive",
};

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{PURCHASE_ORDER_STATUS_LABELS[status]}</Badge>;
}
