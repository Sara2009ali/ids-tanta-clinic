"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Plus, Power, PowerOff, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createPriceList,
  deletePriceList,
  renamePriceList,
  togglePriceListActive,
} from "@/lib/pricing/actions";
import type { PriceListForManagement } from "@/lib/pricing/queries";
import type { Dictionary } from "@/lib/i18n/types";

function itemsCountText(dict: Dictionary["priceLists"], count: number): string {
  if (count === 0) return dict.itemsCountEmpty;
  return dict.itemsCountLabel.replace("{count}", String(count));
}

function PriceListRow({
  priceList,
  dict,
  onDeleteRequest,
}: {
  priceList: PriceListForManagement;
  dict: Dictionary["priceLists"];
  onDeleteRequest: (priceList: PriceListForManagement) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(priceList.name);
  const [error, setError] = useState<string | undefined>();

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      const result = await renamePriceList(priceList.id, formData);
      if (result.error) {
        setError(result.fieldErrors?.name ?? result.error);
        toast.error(result.error);
      } else {
        setEditing(false);
        setError(undefined);
        router.refresh();
      }
    });
  }

  function handleCancelEdit() {
    setEditing(false);
    setName(priceList.name);
    setError(undefined);
  }

  function handleToggle() {
    startTransition(async () => {
      const result = await togglePriceListActive(priceList.id, !priceList.is_active);
      if (result.error) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        {editing ? (
          <div className="space-y-1">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              aria-invalid={!!error}
              aria-label={dict.rename}
              className="h-8 w-48"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium">{priceList.name}</span>
            {priceList.is_default && <Badge variant="secondary">{dict.defaultBadge}</Badge>}
            {!priceList.is_active && <Badge variant="outline">{dict.disabledBadge}</Badge>}
          </div>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{itemsCountText(dict, priceList.item_count)}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <Button size="icon-sm" variant="ghost" disabled={pending} onClick={handleSave} aria-label={dict.save}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              </Button>
              <Button size="icon-sm" variant="ghost" disabled={pending} onClick={handleCancelEdit} aria-label={dict.cancel}>
                <X className="size-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" render={<Link href={`/procedures/price-lists/${priceList.id}`} />}>
                {dict.editPrices}
              </Button>
              {!priceList.is_default && (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setEditing(true)}
                    aria-label={dict.rename}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={handleToggle}
                    aria-label={priceList.is_active ? dict.disable : dict.enable}
                  >
                    {priceList.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => onDeleteRequest(priceList)}
                    aria-label={dict.delete}
                    className="hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function PriceListsManager({
  priceLists,
  dict,
}: {
  priceLists: PriceListForManagement[];
  dict: Dictionary["priceLists"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<PriceListForManagement | null>(null);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createPriceList(formData);
      if (result.error) {
        setCreateError(result.fieldErrors?.name ?? result.error);
        toast.error(result.error);
      } else {
        setNewName("");
        setCreateError(undefined);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deletePriceList(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <form action={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="new_price_list_name" className="text-xs">
            {dict.addPriceList}
          </Label>
          <Input
            id="new_price_list_name"
            name="name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={dict.newPriceListPlaceholder}
            aria-invalid={!!createError}
            disabled={pending}
            className="h-8 w-56"
          />
        </div>
        {createError && <p className="text-xs text-destructive">{createError}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {dict.addPriceList}
        </Button>
      </form>

      {priceLists.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noPriceLists}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.nameColumn}</TableHead>
              <TableHead>{dict.pricingColumn}</TableHead>
              <TableHead className="text-right">{dict.actionsColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceLists.map((priceList) => (
              <PriceListRow key={priceList.id} priceList={priceList} dict={dict} onDeleteRequest={setDeleteTarget} />
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dict.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dict.deleteConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{dict.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
              {dict.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
