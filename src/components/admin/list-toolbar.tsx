"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type FilterConfig = {
  name: string;
  value: string;
  options: { label: string; value: string }[];
};

export function AdminListToolbar({
  searchPlaceholder = "Search…",
  filters = []
}: {
  searchPlaceholder?: string;
  filters?: FilterConfig[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function pushWith(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, val] of Object.entries(next)) {
      if (val) sp.set(key, val);
      else sp.delete(key);
    }
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-wrap items-center gap-2 p-4">
        <form
          className="flex flex-1 flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            pushWith({ q: typeof value === "string" ? value : "" });
          }}
        >
          <Input
            name="q"
            placeholder={searchPlaceholder}
            defaultValue={params.get("q") ?? ""}
            className="max-w-sm"
          />
          <Button type="submit">Search</Button>
        </form>
        {filters.map((filter) => (
          <select
            key={filter.name}
            value={filter.value}
            onChange={(e) => pushWith({ [filter.name]: e.target.value })}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </CardContent>
    </Card>
  );
}
