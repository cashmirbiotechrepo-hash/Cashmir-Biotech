"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Inventory, Product, ProductCustomField } from "@prisma/client";
import {
  AlertTriangle,
  ChevronRight,
  Package,
  Plus,
  Search,
  X
} from "lucide-react";
import {
  deleteProductAction,
  saveProductAction,
  updateProductStockAction
} from "@/app/(admin)/admin/(console)/actions";
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
import {
  CustomFieldsEditor,
  FieldGrid,
  MEASUREMENT_FIELDS,
  OTHER_INFO_FIELDS,
  PricingPreview,
  SPEC_FIELDS,
  USAGE_FIELDS,
  useProductInfoState
} from "@/components/admin/product-editor-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sellingInrFromPaise } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type CatalogProduct = Product & {
  inventory: Pick<Inventory, "quantityOnHand" | "quantityReserved" | "lowStockThreshold"> | null;
  customFields: Pick<ProductCustomField, "id" | "label" | "value" | "sortOrder">[];
};

function stockStatus(product: CatalogProduct) {
  const onHand = product.inventory?.quantityOnHand ?? product.stockQty;
  const reserved = product.inventory?.quantityReserved ?? 0;
  const available = Math.max(0, onHand - reserved);
  const threshold = product.inventory?.lowStockThreshold ?? product.lowStockThreshold;
  const low = available <= threshold;
  return { onHand, reserved, available, threshold, low, label: low ? "Low" : "Healthy" };
}

function Section({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border/80 bg-background p-4", className)}>
      <header className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function ToggleField({
  name,
  label,
  hint,
  defaultChecked
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 px-3 py-2.5 transition-colors hover:bg-muted/40">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 accent-zinc-900"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

function InlineStockEditor({ product }: { product: CatalogProduct }) {
  const router = useRouter();
  const [value, setValue] = useState(String(product.stockQty));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== String(product.stockQty);

  useEffect(() => {
    setValue(String(product.stockQty));
    setError(null);
  }, [product.id, product.stockQty]);

  async function commit() {
    if (!dirty || pending) return;
    const next = Number(value);
    if (!Number.isInteger(next) || next < 0) {
      setError("Whole number ≥ 0");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("id", product.id);
      fd.append("stockQty", String(next));
      const result = await updateProductStockAction(fd);
      if (result.error) {
        setError(result.error);
        setValue(String(product.stockQty));
      } else {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="flex flex-col items-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Input
        type="number"
        min={0}
        step={1}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            setValue(String(product.stockQty));
            setError(null);
          }
        }}
        className={cn(
          "h-8 w-16 px-1.5 text-right text-sm tabular-nums",
          stockStatus(product).low && "text-destructive"
        )}
        aria-label={`Stock for ${product.name}`}
      />
      {error ? <span className="text-[10px] text-destructive">{error}</span> : null}
      {pending ? <span className="text-[10px] text-muted-foreground">Saving…</span> : null}
    </div>
  );
}

function ProductEditor({
  product,
  mode,
  onDiscard,
  onCreated
}: {
  product?: CatalogProduct | null;
  mode: "edit" | "create";
  onDiscard: () => void;
  onCreated?: () => void;
}) {
  const creating = mode === "create";
  const { pending, state, onSubmit } = useAdminForm(saveProductAction, {
    onSuccess: creating ? onCreated : undefined
  });
  const [dirty, setDirty] = useState(false);
  const stock = product ? stockStatus(product) : null;
  const info = useProductInfoState(product);

  useEffect(() => {
    setDirty(false);
  }, [product?.id, creating]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function handleDiscard() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    onDiscard();
  }

  function markDirty() {
    setDirty(true);
  }

  return (
    <form
      id="product-editor-form"
      onSubmit={onSubmit}
      onChange={markDirty}
      className="flex h-full min-h-0 flex-col"
    >
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <input type="hidden" name="mrpInr" value={info.mrpInr} />
      <input type="hidden" name="sellingPriceInr" value={info.sellingInr} />
      <input type="hidden" name="measurementsJson" value={info.hiddenJson.measurementsJson} />
      <input type="hidden" name="specsJson" value={info.hiddenJson.specsJson} />
      <input type="hidden" name="usageJson" value={info.hiddenJson.usageJson} />
      <input type="hidden" name="otherInfoJson" value={info.hiddenJson.otherInfoJson} />
      <input type="hidden" name="customFieldsJson" value={info.hiddenJson.customFieldsJson} />

      <div className="flex items-center gap-1.5 border-b border-border/80 px-4 py-3 text-xs text-muted-foreground">
        <span>Products</span>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">
          {creating ? "New product" : product?.name}
        </span>
        <ChevronRight className="size-3" />
        <span>{creating ? "Create" : "Editing"}</span>
        {dirty ? (
          <Badge variant="outline" className="ml-2 text-[10px]">
            Unsaved
          </Badge>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-28">
        <Tabs defaultValue="general" className="gap-3">
          <TabsList variant="line" className="h-8 w-full justify-start overflow-x-auto">
            <TabsTrigger value="general" className="text-xs">
              General
            </TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs">
              Pricing
            </TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs">
              Inventory
            </TabsTrigger>
            <TabsTrigger value="description" className="text-xs">
              Description
            </TabsTrigger>
            <TabsTrigger value="specs" className="text-xs">
              Specs
            </TabsTrigger>
            <TabsTrigger value="measurements" className="text-xs">
              Measurements
            </TabsTrigger>
            <TabsTrigger value="usage" className="text-xs">
              Usage
            </TabsTrigger>
            <TabsTrigger value="safety" className="text-xs">
              Safety
            </TabsTrigger>
            <TabsTrigger value="images" className="text-xs">
              Images
            </TabsTrigger>
            <TabsTrigger value="custom" className="text-xs">
              Custom
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4" keepMounted>
            <Section title="Basic information">
              <div className="grid gap-3">
                <AdminField label="Name" name="name" defaultValue={product?.name} />
                <AdminField
                  label="Category"
                  name="category"
                  defaultValue={product?.category ?? "Functional Food"}
                  required={false}
                />
                <AdminField
                  label="SKU"
                  name="sku"
                  defaultValue={product?.sku}
                  required={false}
                  placeholder="Auto-generated if blank"
                />
                <AdminField label="Size label" name="sizeLabel" defaultValue={product?.sizeLabel ?? ""} />
                <AdminField
                  label="Short benefit"
                  name="shortBenefit"
                  defaultValue={product?.shortBenefit ?? ""}
                />
                <AdminField
                  label="Lead time (days)"
                  name="leadTimeDays"
                  type="number"
                  defaultValue={product?.leadTimeDays ?? 7}
                  required={false}
                />
              </div>
            </Section>
            <Section title="Publishing" description="Storefront visibility and inventory tracking.">
              <div className="grid gap-2 sm:grid-cols-3">
                <ToggleField
                  name="active"
                  label="Active"
                  hint="Visible on the storefront"
                  defaultChecked={product ? product.active : true}
                />
                <ToggleField
                  name="featured"
                  label="Featured"
                  hint="Highlight on home / catalog"
                  defaultChecked={product ? product.featured : false}
                />
                <ToggleField
                  name="hasInventoryTracking"
                  label="Track inventory"
                  hint="Sync stock with inventory ledger"
                  defaultChecked={product ? product.hasInventoryTracking : true}
                />
              </div>
            </Section>
            {!creating && product ? (
              <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <header className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
                </header>
                <p className="mb-3 text-xs text-muted-foreground">
                  Deleting removes this SKU from the catalog. Orders that already reference it are not
                  deleted, but you cannot undo this action.
                </p>
                <DeleteButton
                  action={deleteProductAction}
                  id={product.id}
                  label="Delete product"
                  confirmText={`Delete “${product.name}”? This cannot be undone.`}
                />
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4" keepMounted>
            <Section title="Pricing" description="MRP vs selling price — discount is calculated automatically.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">MRP (INR)</label>
                  <Input
                    type="number"
                    min={1}
                    value={info.mrpInr}
                    onChange={(e) => {
                      markDirty();
                      info.setMrpInr(Number(e.target.value) || 0);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Selling price (INR)</label>
                  <Input
                    type="number"
                    min={1}
                    value={info.sellingInr}
                    onChange={(e) => {
                      markDirty();
                      info.setSellingInr(Number(e.target.value) || 0);
                    }}
                  />
                </div>
                <AdminField
                  label="Currency"
                  name="currency"
                  defaultValue={product?.currency ?? "INR"}
                  required={false}
                />
                <div className="flex items-end">
                  <ToggleField
                    name="taxIncluded"
                    label="Tax included"
                    hint="Prices are GST-inclusive (checkout behavior unchanged)"
                    defaultChecked={product ? product.taxIncluded : true}
                  />
                </div>
              </div>
              <div className="mt-4">
                <PricingPreview mrpInr={info.mrpInr} sellingInr={info.sellingInr} />
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4" keepMounted>
            <Section title="Inventory" description="On-hand stock and order quantity limits.">
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md bg-muted/50 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">On hand</p>
                  <p className="text-lg font-semibold tabular-nums">{stock?.onHand ?? "—"}</p>
                </div>
                <div className="rounded-md bg-muted/50 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reserved</p>
                  <p className="text-lg font-semibold tabular-nums">{stock?.reserved ?? "—"}</p>
                </div>
                <div className="rounded-md bg-muted/50 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Available</p>
                  <p className="text-lg font-semibold tabular-nums">{stock?.available ?? "—"}</p>
                </div>
                <div className="rounded-md bg-muted/50 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      stock?.low ? "text-destructive" : "text-emerald-700"
                    )}
                  >
                    {stock?.label ?? "—"}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField
                  label="Current stock"
                  name="stockQty"
                  type="number"
                  defaultValue={product?.stockQty ?? 0}
                />
                <AdminField
                  label="Low-stock threshold"
                  name="lowStockThreshold"
                  type="number"
                  defaultValue={product?.lowStockThreshold ?? 10}
                />
                <AdminField
                  label="Min order qty"
                  name="minOrderQty"
                  type="number"
                  defaultValue={product?.minOrderQty ?? 1}
                />
                <AdminField
                  label="Max order qty"
                  name="maxOrderQty"
                  type="number"
                  defaultValue={product?.maxOrderQty ?? ""}
                  required={false}
                  placeholder="Optional"
                />
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="description" className="space-y-4" keepMounted>
            <Section title="Description">
              <AdminTextarea
                label="Product description"
                name="description"
                defaultValue={product?.description ?? ""}
                required
                rows={8}
              />
            </Section>
          </TabsContent>

          <TabsContent value="specs" className="space-y-4" keepMounted>
            <Section title="Features & specs" description="All fields optional.">
              <FieldGrid
                fields={SPEC_FIELDS}
                values={info.specs}
                onChange={(next) => {
                  markDirty();
                  info.setSpecs(next);
                }}
              />
            </Section>
          </TabsContent>

          <TabsContent value="measurements" className="space-y-4" keepMounted>
            <Section title="Measurements" description="All fields optional.">
              <FieldGrid
                fields={MEASUREMENT_FIELDS}
                values={info.measurements}
                onChange={(next) => {
                  markDirty();
                  info.setMeasurements(next);
                }}
              />
            </Section>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4" keepMounted>
            <Section title="Usage instructions" description="All fields optional.">
              <FieldGrid
                fields={USAGE_FIELDS}
                values={info.usage}
                onChange={(next) => {
                  markDirty();
                  info.setUsage(next);
                }}
              />
            </Section>
          </TabsContent>

          <TabsContent value="safety" className="space-y-4" keepMounted>
            <Section title="Other information / safety" description="All fields optional.">
              <FieldGrid
                fields={OTHER_INFO_FIELDS}
                values={info.otherInfo}
                onChange={(next) => {
                  markDirty();
                  info.setOtherInfo(next);
                }}
              />
            </Section>
          </TabsContent>

          <TabsContent value="images" className="space-y-4" keepMounted>
            <Section title="Media" description="Cover image first — gallery supports multiple shots.">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
                <div className="space-y-2">
                  {product?.imageUrl ? (
                    <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="220px"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
                      <Package className="size-10 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <ImageUploadField
                    name="imageUrl"
                    label="Cover image"
                    defaultValue={product?.imageUrl ?? ""}
                    aspect={1}
                    required
                  />
                  <GalleryUploadField
                    name="images"
                    label="Gallery"
                    defaultValue={product?.images ?? []}
                    aspect={1}
                    max={8}
                  />
                </div>
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4" keepMounted>
            <Section title="Custom fields" description="Unlimited label/value pairs shown on the product page.">
              <CustomFieldsEditor
                fields={info.customFields}
                onChange={(next) => {
                  markDirty();
                  info.setCustomFields(next);
                }}
              />
            </Section>
          </TabsContent>
        </Tabs>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <SaveButton pending={pending} label={creating ? "Create product" : "Save changes"} />
        <Button type="button" variant="outline" onClick={handleDiscard} disabled={pending}>
          {creating ? "Cancel" : "Discard"}
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function ProductsTable({ products }: { products: CatalogProduct[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [listQuery, setListQuery] = useState("");

  const filtered = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }, [products, listQuery]);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? null,
    [products, selectedId]
  );

  const selectProduct = useCallback((id: string) => {
    setCreating(false);
    setSelectedId(id);
  }, []);

  const detailOpen = creating || Boolean(selected);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-background",
        detailOpen ? "lg:grid lg:grid-cols-[minmax(280px,360px)_1fr]" : ""
      )}
    >
      {/* Product list — stays visible while editing */}
      <div
        className={cn(
          "flex min-h-[420px] flex-col border-border",
          detailOpen ? "border-b lg:border-b-0 lg:border-r" : ""
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/80 p-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Filter this page…"
              className="h-9 pl-8"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setSelectedId(null);
              setCreating(true);
            }}
            variant={creating ? "secondary" : "default"}
          >
            {creating ? <X className="size-4" /> : <Plus className="size-4" />}
            <span className="hidden sm:inline">{creating ? "Close" : "New"}</span>
          </Button>
        </div>

        {products.length === 0 && !creating ? (
          <div className="p-6">
            <EmptyState
              title="No products yet"
              description="Add your first SKU to start managing the catalog."
              action={
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setCreating(true);
                  }}
                >
                  <Plus className="size-4" />
                  Add product
                </Button>
              }
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="sticky top-0 z-[1] grid grid-cols-[40px_1fr_64px_72px] gap-2 border-b border-border/60 bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <span />
              <span>Product</span>
              <span className="text-right">Stock</span>
              <span className="text-right">Price</span>
            </div>
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No products match this filter.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {filtered.map((product) => {
                  const stock = stockStatus(product);
                  const active = !creating && selectedId === product.id;
                  return (
                    <li
                      key={product.id}
                      className={cn(
                        "grid grid-cols-[40px_1fr_64px_72px] items-center gap-2 px-3 py-2.5 transition-colors",
                        active ? "bg-zinc-900 text-zinc-50" : "hover:bg-muted/50"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectProduct(product.id)}
                        className="contents text-left"
                      >
                        <span
                          className={cn(
                            "relative size-10 overflow-hidden rounded-md border",
                            active ? "border-zinc-700" : "border-border bg-muted"
                          )}
                        >
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="40px"
                              unoptimized
                            />
                          ) : (
                            <span className="flex size-full items-center justify-center">
                              <Package
                                className={cn(
                                  "size-4",
                                  active ? "opacity-50" : "text-muted-foreground opacity-50"
                                )}
                              />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{product.name}</span>
                          <span
                            className={cn(
                              "mt-0.5 flex items-center gap-1.5 text-[11px]",
                              active ? "text-zinc-400" : "text-muted-foreground"
                            )}
                          >
                            <span className="truncate">{product.category}</span>
                            <span>·</span>
                            <span className="truncate font-mono">{product.sku || product.slug}</span>
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <Badge
                              variant={product.active ? "default" : "secondary"}
                              className={cn(
                                "h-5 px-1.5 text-[10px]",
                                active && product.active && "bg-zinc-100 text-zinc-900"
                              )}
                            >
                              {product.active ? "Active" : "Hidden"}
                            </Badge>
                            {product.featured ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 px-1.5 text-[10px]",
                                  active && "border-zinc-600 text-zinc-200"
                                )}
                              >
                                Featured
                              </Badge>
                            ) : null}
                            {stock.low ? (
                              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                Low
                              </Badge>
                            ) : null}
                          </span>
                        </span>
                      </button>
                      <span
                        className={cn(
                          "justify-self-end",
                          active &&
                            "[&_input]:border-zinc-600 [&_input]:bg-zinc-800 [&_input]:text-zinc-50"
                        )}
                      >
                        <InlineStockEditor product={product} />
                      </span>
                      <button
                        type="button"
                        onClick={() => selectProduct(product.id)}
                        className={cn(
                          "justify-self-end text-sm tabular-nums",
                          active ? "text-zinc-200" : "text-foreground"
                        )}
                      >
                        ₹{sellingInrFromPaise(product.pricePaise, product.mrpInr)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {detailOpen ? (
        <div className="flex min-h-[520px] min-w-0 flex-col bg-muted/15">
          {creating ? (
            <ProductEditor
              mode="create"
              onDiscard={() => setCreating(false)}
              onCreated={() => setCreating(false)}
            />
          ) : selected ? (
            <ProductEditor
              key={`${selected.id}-${selected.updatedAt}`}
              mode="edit"
              product={selected}
              onDiscard={() => setSelectedId(null)}
            />
          ) : null}
        </div>
      ) : null}

      {!detailOpen && products.length > 0 ? (
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          Select a product to edit details. Click stock to adjust quantity without opening the editor.
        </p>
      ) : null}
    </div>
  );
}
