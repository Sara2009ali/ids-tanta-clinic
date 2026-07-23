import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

const SKELETON_ROWS = 5;

export default function AppointmentsReportLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Skeleton className="h-16 w-72" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>

      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableBody>
                {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
