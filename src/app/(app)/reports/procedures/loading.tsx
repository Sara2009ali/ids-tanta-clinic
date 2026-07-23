import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

const SKELETON_ROWS = 5;

export default function ProceduresReportLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Skeleton className="h-16 w-72" />

      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableBody>
                {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
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
