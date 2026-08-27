import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SKELETON_ROWS = 4;

export default function CashReconciliationLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Skeleton className="h-16 w-72" />

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment method</TableHead>
              <TableHead className="text-end">Transactions</TableHead>
              <TableHead className="text-end">Gross</TableHead>
              <TableHead className="text-end">Refunds</TableHead>
              <TableHead className="text-end">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ms-auto h-4 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ms-auto h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ms-auto h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ms-auto h-4 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
