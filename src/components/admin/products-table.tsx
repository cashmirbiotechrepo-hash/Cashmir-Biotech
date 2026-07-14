"use client";

import { useState, Fragment } from "react";
import type { Product } from "@prisma/client";
import { Plus, X } from "lucide-react";
import { deleteProductAction, saveProductAction } from "@/app/(admin)/admin/(console)/actions";
import {
  AdminField,
  AdminTextarea,
  DeleteButton,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { EmptyState } from "@/components/admin/empty-state";
import { ImageUploadField, GalleryUploadField } from "@/components/admin/image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function ProductEditor({ product, onDone }: { product?: Product | null; onDone?: () => void }) {
  const creating = !product;
  const { pending, state, onSubmit } = useAdminForm(saveProductAction, { onSuccess: creating ? onDone : undefined });

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Name" name="name" defaultValue={product?.name} />
        <AdminField label="Category" name="category" defaultValue={product?.category ?? "Functional Food"} required={false} />
        <AdminField
          label="SKU"
          name="sku"
          defaultValue={product?.sku}
          required={false}
          placeholder="Auto-generated if blank"
        />
        <AdminField label="MRP (INR)" name="mrpInr" type="number" defaultValue={product?.mrpInr ?? 0} />
        <AdminField label="Size label" name="sizeLabel" defaultValue={product?.sizeLabel ?? ""} />
        <AdminField label="Stock qty" name="stockQty" type="number" defaultValue={product?.stockQty ?? 0} />
        <AdminField
          label="Low-stock threshold"
          name="lowStockThreshold"
          type="number"
          defaultValue={product?.lowStockThreshold ?? 10}
        />
        <AdminField
          label="Lead time (days)"
          name="leadTimeDays"
          type="number"
          defaultValue={product?.leadTimeDays ?? 7}
          required={false}
        />
      </div>
      <AdminField label="Short benefit" name="shortBenefit" defaultValue={product?.shortBenefit ?? ""} />
      <AdminTextarea label="Description" name="description" defaultValue={product?.description ?? ""} required />
      <ImageUploadField
        name="imageUrl"
        label="Product image"
        defaultValue={product?.imageUrl ?? ""}
        aspect={1}
        required
      />
      <GalleryUploadField
        name="images"
        label="Additional images (gallery)"
        defaultValue={product?.images ?? []}
        aspect={1}
        max={8}
      />
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product ? product.active : true}
            className="size-4 accent-primary"
          />
          Active on storefront
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product ? product.featured : false}
            className="size-4 accent-primary"
          />
          Featured product
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="hasInventoryTracking"
            defaultChecked={product ? product.hasInventoryTracking : true}
            className="size-4 accent-primary"
          />
          Track inventory
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SaveButton pending={pending} label={creating ? "Create product" : "Save changes"} />
        {product ? <DeleteButton action={deleteProductAction} id={product.id} label="Delete product" /> : null}
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function ProductsTable({ products }: { products: Product[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setAdding((v) => !v)} variant={adding ? "outline" : "default"}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Cancel" : "Add product"}
        </Button>
      </div>

      {adding ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New product</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductEditor onDone={() => setAdding(false)} />
          </CardContent>
        </Card>
      ) : null}

      {products.length === 0 && !adding ? (
        <EmptyState
          title="No products yet"
          description="Add your first SKU to start managing the catalog."
          action={
            <Button type="button" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add product
            </Button>
          }
        />
      ) : products.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">MRP</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const low = product.stockQty <= product.lowStockThreshold;
                  const open = openId === product.id;
                  return (
                    <Fragment key={product.id}>
                      <TableRow
                        className={cn("cursor-pointer", open && "bg-muted/40")}
                        onClick={() => setOpenId(open ? null : product.id)}
                      >
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{product.category}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{product.sku || product.slug}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", low && "text-destructive")}>
                          {product.stockQty}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">₹{product.mrpInr}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={product.active ? "default" : "secondary"}>
                              {product.active ? "Active" : "Hidden"}
                            </Badge>
                            {product.featured ? <Badge variant="outline">Featured</Badge> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/20 p-4">
                            <ProductEditor key={`${product.id}-${product.updatedAt}`} product={product} />
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
