import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SKELETON_ROWS = 5;

export default function ReferralSourcesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Skeleton className="h-16 w-72" />

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referral source</TableHead>
              <TableHead className="text-end">Patients</TableHead>
              <TableHead className="text-end">% of total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ms-auto h-4 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ms-auto h-4 w-12" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
