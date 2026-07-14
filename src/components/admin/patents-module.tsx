"use client";

import { useState, Fragment } from "react";
import type { Patent, Product } from "@prisma/client";
import { Plus, X } from "lucide-react";
import {
  deletePatentAction,
  savePatentFullAction,
  inventorsToText
} from "@/app/(admin)/admin/(console)/phase2-actions";
import {
  AdminField,
  AdminTextarea,
  DeleteButton,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { EmptyState } from "@/components/admin/empty-state";
import { ImageUploadField } from "@/components/admin/image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PatentRow = Patent & { products: Pick<Product, "id" | "name">[] };

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

const today = () => new Date().toISOString().slice(0, 10);

function PatentEditor({
  patent,
  products,
  onDone
}: {
  patent?: PatentRow | null;
  products: Product[];
  onDone?: () => void;
}) {
  const creating = !patent;
  const { pending, state, onSubmit } = useAdminForm(savePatentFullAction, {
    onSuccess: creating ? onDone : undefined
  });
  const linked = patent ? patent.products.map((p) => p.id).join(",") : "";

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {patent ? <input type="hidden" name="id" value={patent.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Title" name="title" defaultValue={patent?.title ?? ""} />
        <AdminField label="Patent / filing code" name="patentCode" defaultValue={patent?.patentCode ?? ""} />
        <AdminField
          label="Application number"
          name="applicationNumber"
          defaultValue={patent?.applicationNumber || patent?.patentCode || ""}
          required={false}
        />
        <AdminField label="Display status" name="status" defaultValue={patent?.status ?? "Granted"} />
        <div className="space-y-1.5">
          <Label htmlFor="lifecycleStatus">Lifecycle</Label>
          <select
            id="lifecycleStatus"
            name="lifecycleStatus"
            defaultValue={patent?.lifecycleStatus ?? "granted"}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="granted">Granted</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <AdminField label="Jurisdiction" name="jurisdiction" defaultValue={patent?.jurisdiction ?? "India"} />
        <AdminField
          label="Country"
          name="country"
          defaultValue={patent?.country || patent?.jurisdiction || "India"}
          required={false}
        />
        <AdminField
          label="Filed"
          name="filedAt"
          type="date"
          defaultValue={fmtDate(patent?.filedAt ?? patent?.publishedAt)}
          required={false}
        />
        <AdminField label="Granted" name="grantedAt" type="date" defaultValue={fmtDate(patent?.grantedAt)} required={false} />
        <AdminField
          label="Published"
          name="publishedAt"
          type="date"
          defaultValue={fmtDate(patent?.publishedAt) || today()}
          required={false}
        />
        <AdminField label="Document URL" name="documentUrl" defaultValue={patent?.documentUrl ?? ""} required={false} />
      </div>
      <ImageUploadField
        name="imageUrl"
        label="Patent image"
        defaultValue={patent?.imageUrl ?? ""}
        aspect={null}
        helpText="Certificates keep their original proportions. Crop only if you want a tighter frame."
      />
      <AdminTextarea label="Summary" name="summary" defaultValue={patent?.summary ?? ""} required rows={4} />
      <AdminField
        label="Inventors (comma-separated)"
        name="inventors"
        defaultValue={patent ? inventorsToText(patent.inventors) : ""}
        required={false}
      />
      <div className="space-y-1.5">
        <Label htmlFor="linkedProductIds">Linked product IDs (comma-separated)</Label>
        <input
          id="linkedProductIds"
          name="linkedProductIds"
          defaultValue={linked}
          list="product-ids"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-xs"
        />
        <datalist id="product-ids">
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">Links catalog SKUs to this patent for storefront cross-reference.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SaveButton pending={pending} label={creating ? "Create patent" : "Save changes"} />
        {patent ? <DeleteButton action={deletePatentAction} id={patent.id} label="Delete patent" /> : null}
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function PatentsModule({ patents, products }: { patents: PatentRow[]; products: Product[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setAdding((v) => !v)} variant={adding ? "outline" : "default"}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Cancel" : "Add patent"}
        </Button>
      </div>

      {adding ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New patent</CardTitle>
          </CardHeader>
          <CardContent>
            <PatentEditor products={products} onDone={() => setAdding(false)} />
          </CardContent>
        </Card>
      ) : null}

      {patents.length === 0 && !adding ? (
        <EmptyState
          title="No patents"
          description="Add your first IP record to build the patent registry."
          action={
            <Button type="button" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add patent
            </Button>
          }
        />
      ) : patents.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead>Products</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patents.map((patent) => {
                  const open = openId === patent.id;
                  return (
                    <Fragment key={patent.id}>
                      <TableRow
                        className={cn("cursor-pointer", open && "bg-muted/40")}
                        onClick={() => setOpenId(open ? null : patent.id)}
                      >
                        <TableCell className="font-mono text-xs">{patent.patentCode}</TableCell>
                        <TableCell className="max-w-[14rem] truncate">{patent.title}</TableCell>
                        <TableCell>
                          <Badge variant={patent.lifecycleStatus === "granted" ? "default" : "secondary"}>
                            {patent.lifecycleStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{patent.products.length}</TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-muted/20 p-4">
                            <PatentEditor patent={patent} products={products} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
