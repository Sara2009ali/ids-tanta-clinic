import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

const SKELETON_ROWS = 5;

export default function ClinicalActivityReportLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-9 w-44" />
      </div>

      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, tableIndex) => (
              <div key={tableIndex} className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableBody>
                    {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="ml-auto h-4 w-10" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
