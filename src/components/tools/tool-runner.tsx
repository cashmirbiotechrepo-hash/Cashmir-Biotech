"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { LuxeButton } from "@/components/ui/luxe-button";
import type { Tool, ToolField } from "@/components/tools/catalog";
import { ToolResult } from "@/components/tools/tool-result";

type FormState = Record<string, string | number | boolean>;

function initialState(fields: ToolField[]): FormState {
  const state: FormState = {};
  for (const f of fields) state[f.name] = f.defaultValue ?? (f.type === "checkbox" ? false : "");
  return state;
}

export function ToolRunner({ tool }: { tool: Tool }) {
  const fields = tool.fields ?? [];
  const [form, setForm] = useState<FormState>(() => initialState(fields));
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const update = (name: string, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tool.api || status === "loading") return;
    setStatus("loading");
    setError("");
    setResult(null);

    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = form[f.name];
      payload[f.name] = f.type === "number" ? Number(raw) : raw;
    }

    try {
      const res = await fetch(tool.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setStatus("done");
      } else {
        setError(json.error ?? "Computation failed.");
        setStatus("error");
      }
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <form
        onSubmit={submit}
        className="h-fit rounded-2xl border border-ink/10 bg-paper/70 p-6 shadow-glass backdrop-blur-md md:p-8"
      >
        <div className="space-y-5">
          {fields.map((field) => (
            <div key={field.name}>
              {field.type !== "checkbox" ? (
                <label
                  htmlFor={field.name}
                  className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint"
                >
                  {field.label}
                </label>
              ) : null}

              {field.type === "textarea" ? (
                <textarea
                  id={field.name}
                  value={String(form[field.name] ?? "")}
                  onChange={(e) => update(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  rows={5}
                  spellCheck={false}
                  className="w-full resize-y rounded-xl border border-ink/15 bg-paper px-4 py-3 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-faint/60 focus:border-gold focus:outline-none"
                />
              ) : field.type === "select" ? (
                <select
                  id={field.name}
                  value={String(form[field.name] ?? "")}
                  onChange={(e) => update(field.name, e.target.value)}
                  className="w-full rounded-xl border border-ink/15 bg-paper px-4 py-3 text-sm text-ink focus:border-gold focus:outline-none"
                >
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <label className="flex cursor-pointer items-center gap-3 text-sm text-ink-soft">
                  <input
                    id={field.name}
                    type="checkbox"
                    checked={Boolean(form[field.name])}
                    onChange={(e) => update(field.name, e.target.checked)}
                    className="h-4 w-4 accent-gold"
                  />
                  {field.label}
                </label>
              ) : (
                <input
                  id={field.name}
                  type={field.type}
                  value={String(form[field.name] ?? "")}
                  onChange={(e) => update(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  className="w-full rounded-xl border border-ink/15 bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-faint/60 focus:border-gold focus:outline-none"
                />
              )}
              {field.hint ? <p className="mt-1.5 text-xs text-ink-faint">{field.hint}</p> : null}
            </div>
          ))}
        </div>

        <div className="mt-7">
          <LuxeButton type="submit" variant="primary" magnetic={false} className="w-full justify-center">
            {status === "loading" ? "Computing…" : "Run analysis"}
          </LuxeButton>
        </div>
      </form>

      <div className="min-h-[16rem]">
        {status === "idle" ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-ink/15 p-10 text-center">
            <p className="max-w-xs text-sm text-ink-mute">
              Enter your input and run the analysis — results compute server-side and appear here.
            </p>
          </div>
        ) : null}

        {status === "loading" ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-ink/10 bg-paper/60 p-10">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink/20 border-t-gold" />
          </div>
        ) : null}

        {status === "error" ? (
          <div className="rounded-2xl border border-red-300/50 bg-red-50/60 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {status === "done" && result ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
          >
            <ToolResult data={result} />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
