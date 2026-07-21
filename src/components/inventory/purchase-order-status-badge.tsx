import { Badge } from "@/components/ui/badge";
import { PURCHASE_ORDER_STATUS_LABELS, type PurchaseOrderStatus } from "@/types/domain";

// Mirrors InvoiceStatusBadge's exact shape and variant reasoning: draft is
// neutral, ordered/partially_received are in-progress, received is the
// settled/positive state, cancelled is destructive.
const STATUS_BADGE_VARIANT: Record<PurchaseOrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  ordered: "default",
  partially_received: "default",
  received: "secondary",
  cancelled: "destructive",
};

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{PURCHASE_ORDER_STATUS_LABELS[status]}</Badge>;
}
