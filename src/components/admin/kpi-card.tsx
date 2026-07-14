import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  alert?: boolean;
};

export function KpiCard({ label, value, hint, icon: Icon, alert }: KpiCardProps) {
  return (
    <Card className="min-w-0 overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
          {Icon ? (
            <Icon className={cn("size-4 shrink-0", alert ? "text-destructive" : "text-muted-foreground")} />
          ) : null}
        </div>
        <p
          className={cn(
            "truncate text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
            alert ? "text-destructive" : "text-foreground"
          )}
        >
          {value}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
