"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/app/(admin)/admin/(console)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function AdminField({
  label,
  name,
  defaultValue,
  type = "text",
  required = true,
  className,
  placeholder
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  // Base UI Input is uncontrolled; always pass a stable string so undefined ↔ ""
  // (or post-refresh prop updates) don't flip the default after mount.
  const initial = defaultValue === undefined || defaultValue === null ? "" : String(defaultValue);

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={initial}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

export function AdminTextarea({
  label,
  name,
  defaultValue,
  required = false,
  rows = 4
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Textarea id={name} name={name} defaultValue={defaultValue ?? ""} required={required} rows={rows} />
    </div>
  );
}

export function useAdminForm(
  action: (formData: FormData) => Promise<ActionState>,
  options?: { onSuccess?: () => void; refresh?: boolean }
) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<ActionState>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setState({});
    try {
      const result = await action(new FormData(event.currentTarget));
      setState(result ?? {});
      if (result?.ok) {
        if (options?.refresh !== false) router.refresh();
        options?.onSuccess?.();
      }
    } catch {
      setState({ error: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return { pending, state, onSubmit };
}

export function DeleteButton({
  action,
  id,
  label = "Delete",
  confirmText = "Delete this permanently? This cannot be undone."
}: {
  action: (formData: FormData) => Promise<ActionState>;
  id: string;
  label?: string;
  confirmText?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (typeof window !== "undefined" && !window.confirm(confirmText)) return;
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("id", id);
      const result = await action(fd);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="destructive" onClick={onClick} disabled={pending}>
      <Trash2 className="size-4" />
      {pending ? "Deleting…" : label}
    </Button>
  );
}

export function FormStatus({ state }: { state: ActionState }) {
  if (state.ok) return <p className="text-sm text-emerald-600">{state.message}</p>;
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  return null;
}

export function SaveButton({
  pending,
  label = "Save changes",
  disabled,
  variant = "default"
}: {
  pending: boolean;
  label?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
}) {
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
