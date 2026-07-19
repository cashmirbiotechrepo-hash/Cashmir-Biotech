"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  X
} from "lucide-react";
import {
  deleteCategoryAction,
  duplicateCategoryAction,
  saveCategoryAction,
  syncCategoriesFromProductsAction
} from "@/app/(admin)/admin/(console)/category-actions";
import {
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  productCount: number;
};

type SortKey = "name" | "products" | "updated" | "sort";
type StatusFilter = "all" | "published" | "hidden";

function formatAge(d: Date | string) {
  const ms = Date.now() - new Date(d).getTime();
  const hours = ms / 3_600_000;
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function exportCsv(rows: CategoryRow[]) {
  const header = ["Name", "Slug", "Products", "Status", "Sort", "Updated"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.slug,
      String(r.productCount),
      r.active ? "Published" : "Hidden",
      String(r.sortOrder),
      new Date(r.updatedAt).toISOString()
    ]
      .map((cell) => `"${cell.replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `categories-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CategoryInspector({
  category,
  mode,
  onClose,
  onDeleted
}: {
  category: CategoryRow | null;
  mode: "edit" | "create";
  onClose: () => void;
  onDeleted: () => void;
}) {
  const creating = mode === "create";
  const { pending, state, onSubmit } = useAdminForm(saveCategoryAction, {
    refresh: true,
    onSuccess: () => {
      if (creating) onClose();
    }
  });
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    setName(category?.name ?? "");
    setSlug(category?.slug ?? "");
    setSlugTouched(false);
  }, [category?.id, category?.name, category?.slug, creating]);

  function slugifyLive(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  return (
    <aside className="flex h-full min-h-[28rem] flex-col border-l border-border/80 bg-background">
      <div className="flex h-11 items-center justify-between gap-2 border-b border-border/70 px-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {creating ? "New category" : "Edit category"}
          </p>
          <p className="truncate text-sm font-medium text-foreground">
            {creating ? "Untitled" : category?.name}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close">
          <X className="size-3.5" />
        </Button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        {category && !creating ? <input type="hidden" name="id" value={category.id} /> : null}

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <div className="space-y-1">
            <Label htmlFor="cat-name" className="text-[11px] font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              id="cat-name"
              name="name"
              required
              value={name}
              autoFocus={creating}
              onChange={(e) => {
                const next = e.target.value;
                setName(next);
                if (!slugTouched) setSlug(slugifyLive(next));
              }}
              className="h-8"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cat-slug" className="text-[11px] font-medium text-muted-foreground">
              Slug
            </Label>
            <Input
              id="cat-slug"
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className="h-8 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="cat-sort" className="text-[11px] font-medium text-muted-foreground">
                Sort order
              </Label>
              <Input
                id="cat-sort"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={category?.sortOrder ?? 0}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Visibility</Label>
              <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border/70 px-2 text-xs">
                <input type="hidden" name="active" value="" />
                <input
                  type="checkbox"
                  name="active"
                  value="on"
                  defaultChecked={category ? category.active : true}
                  className="size-3.5 accent-zinc-900"
                />
                Published
              </label>
            </div>
          </div>

          {!creating && category ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border/70 pt-3 text-[11px]">
              <div>
                <p className="text-muted-foreground">Products</p>
                <p className="tabular-nums text-foreground">{category.productCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Updated</p>
                <p className="text-foreground">{formatAge(category.updatedAt)}</p>
              </div>
            </div>
          ) : null}

          <FormStatus state={state} />
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border/70 bg-background/95 px-3 py-2.5">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <SaveButton pending={pending} label={creating ? "Create" : "Save changes"} />
        </div>
      </form>

      {!creating && category ? (
        <div className="border-t border-border/70 px-3 py-2.5">
          <DeleteCategoryButton
            id={category.id}
            name={category.name}
            productCount={category.productCount}
            onDeleted={onDeleted}
          />
        </div>
      ) : null}
    </aside>
  );
}

function DeleteCategoryButton({
  id,
  name,
  productCount,
  onDeleted
}: {
  id: string;
  name: string;
  productCount: number;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (productCount > 0) {
      window.alert(
        `Cannot delete “${name}” — ${productCount} product${productCount === 1 ? "" : "s"} still use it.`
      );
      return;
    }
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("id", id);
      const result = await deleteCategoryAction(fd);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      onDeleted();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-full justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={pending}
      onClick={() => void onClick()}
    >
      {pending ? "Deleting…" : "Delete category"}
    </Button>
  );
}

function RowActions({
  category,
  onEdit,
  onDeleted
}: {
  category: CategoryRow;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function duplicate() {
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("id", category.id);
      const result = await duplicateCategoryAction(fd);
      if (result?.error) window.alert(result.error);
      else router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function setVisibility(active: boolean) {
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("id", category.id);
      fd.append("name", category.name);
      fd.append("slug", category.slug);
      fd.append("sortOrder", String(category.sortOrder));
      fd.append("active", active ? "on" : "");
      const result = await saveCategoryAction(fd);
      if (result?.error) window.alert(result.error);
      else router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (category.productCount > 0) {
      window.alert(
        `Cannot delete “${category.name}” — ${category.productCount} product${category.productCount === 1 ? "" : "s"} still use it.`
      );
      return;
    }
    if (!window.confirm(`Delete “${category.name}”? This cannot be undone.`)) return;
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("id", category.id);
      const result = await deleteCategoryAction(fd);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      onDeleted();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Category actions"
            disabled={pending}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void duplicate()}>Duplicate</DropdownMenuItem>
        {category.active ? (
          <DropdownMenuItem onClick={() => void setVisibility(false)}>Hide</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => void setVisibility(true)}>Publish</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void remove()}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CategoriesTable({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("sort");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = categories;
    if (status === "published") rows = rows.filter((c) => c.active);
    if (status === "hidden") rows = rows.filter((c) => !c.active);
    if (q) {
      rows = rows.filter(
        (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
      );
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "products") return b.productCount - a.productCount;
      if (sort === "updated") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    });
    return sorted;
  }, [categories, query, status, sort]);

  const selected = useMemo(
    () => categories.find((c) => c.id === selectedId) ?? null,
    [categories, selectedId]
  );

  const inspectorOpen = creating || Boolean(selected);

  const openCreate = useCallback(() => {
    setSelectedId(null);
    setCreating(true);
  }, []);

  const openEdit = useCallback((id: string) => {
    setCreating(false);
    setSelectedId(id);
  }, []);

  const closeInspector = useCallback(() => {
    setCreating(false);
    setSelectedId(null);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openCreate();
      }
      if (e.key === "Escape" && inspectorOpen) {
        e.preventDefault();
        closeInspector();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCreate, closeInspector, inspectorOpen]);

  async function syncFromProducts() {
    setSyncPending(true);
    setSyncMessage(null);
    try {
      const result = await syncCategoriesFromProductsAction();
      if (result?.error) setSyncMessage(result.error);
      else {
        setSyncMessage(result?.message ?? "Synced.");
        router.refresh();
      }
    } finally {
      setSyncPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Sort"
        >
          <option value="sort">Sort order</option>
          <option value="name">Name</option>
          <option value="products">Products</option>
          <option value="updated">Updated</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter status"
        >
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={syncPending}
            onClick={() => void syncFromProducts()}
          >
            <RefreshCw className={cn("size-3.5", syncPending && "animate-spin")} />
            Sync
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => exportCsv(filtered)}
          >
            Export
          </Button>
          <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
            <Plus className="size-3.5" />
            New category
          </Button>
        </div>
      </div>

      {syncMessage ? (
        <p className="text-[11px] text-muted-foreground">{syncMessage}</p>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-md border border-border/80",
          inspectorOpen && "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]"
        )}
      >
        <div className="min-w-0">
          {categories.length === 0 && !creating ? (
            <div className="p-6">
              <EmptyState
                title="No categories yet"
                description="Create your first category, or sync labels from existing products."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" size="sm" onClick={openCreate}>
                      Create category
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={syncPending}
                      onClick={() => void syncFromProducts()}
                    >
                      Sync from products
                    </Button>
                  </div>
                }
              />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No categories match this search.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 text-[11px] font-medium">Name</TableHead>
                    <TableHead className="h-9 text-right text-[11px] font-medium">Products</TableHead>
                    <TableHead className="h-9 text-[11px] font-medium">Status</TableHead>
                    <TableHead className="h-9 text-[11px] font-medium">Updated</TableHead>
                    <TableHead className="h-9 w-10 text-[11px] font-medium" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((category) => {
                    const activeRow =
                      !creating && selectedId === category.id;
                    return (
                      <TableRow
                        key={category.id}
                        className={cn(
                          "h-10 cursor-pointer",
                          activeRow && "bg-muted/50"
                        )}
                        onClick={() => openEdit(category.id)}
                      >
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-2">
                            <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-sm text-foreground">{category.name}</p>
                              <p className="truncate font-mono text-[10px] text-muted-foreground/80">
                                {category.slug}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-sm tabular-nums text-muted-foreground">
                          {category.productCount}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge
                            variant={category.active ? "secondary" : "outline"}
                            className={cn(
                              "h-5 text-[10px] font-normal",
                              category.active
                                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                                : "text-muted-foreground"
                            )}
                          >
                            {category.active ? "Published" : "Hidden"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-[12px] text-muted-foreground">
                          {formatAge(category.updatedAt)}
                        </TableCell>
                        <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                          <RowActions
                            category={category}
                            onEdit={() => openEdit(category.id)}
                            onDeleted={() => {
                              if (selectedId === category.id) closeInspector();
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {inspectorOpen ? (
          <CategoryInspector
            key={creating ? "new" : selected?.id ?? "closed"}
            category={creating ? null : selected}
            mode={creating ? "create" : "edit"}
            onClose={closeInspector}
            onDeleted={closeInspector}
          />
        ) : null}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {filtered.length} of {categories.length} · Ctrl+N new · Esc close · Click a row to edit
      </p>
    </div>
  );
}
