"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StaffStatusActions } from "@/components/staff/staff-status-actions";
import { StaffRoleSelect } from "@/components/staff/staff-role-select";
import { useTranslation } from "@/components/locale-provider";
import type { StaffForManagement } from "@/lib/staff/queries";
import { isStaffAssignableRole, type StaffInvitationStatus } from "@/lib/staff/schema";

function StatusBadge({ status, labels }: { status: StaffInvitationStatus; labels: Record<StaffInvitationStatus, string> }) {
  const variant = status === "active" ? "secondary" : status === "pending" ? "outline" : "outline";
  return <Badge variant={variant}>{labels[status]}</Badge>;
}

export function StaffTable({ staff, currentStaffId }: { staff: StaffForManagement[]; currentStaffId: string }) {
  const dict = useTranslation().staff;

  if (staff.length === 0) {
    return <EmptyState title={dict.noStaffTitle} description={dict.noStaffDescription} />;
  }

  const statusLabels: Record<StaffInvitationStatus, string> = {
    pending: dict.statusPending,
    active: dict.statusActive,
    inactive: dict.statusInactive,
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{dict.nameColumn}</TableHead>
            <TableHead>{dict.roleColumn}</TableHead>
            <TableHead>{dict.statusColumn}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span>{member.full_name}</span>
                  {member.email && <span className="text-xs text-muted-foreground">{member.email}</span>}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {isStaffAssignableRole(member.role) && member.id !== currentStaffId ? (
                  <StaffRoleSelect staffId={member.id} role={member.role} />
                ) : (
                  dict.roles[member.role]
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={member.status} labels={statusLabels} />
              </TableCell>
              <TableCell>
                {member.role !== "doctor" && member.role !== "super_admin" && (
                  <StaffStatusActions staffId={member.id} isActive={member.is_active} status={member.status} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
