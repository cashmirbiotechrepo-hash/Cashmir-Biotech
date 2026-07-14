"use client";

import { Fragment, useState } from "react";
import type { Contact, Deal, DealStage } from "@prisma/client";
import { Pencil, X } from "lucide-react";
import {
  deleteContactAction,
  deleteDealAction,
  saveContactAction,
  saveDealAction
} from "@/app/(admin)/admin/(console)/phase2-actions";
import {
  AdminField,
  AdminTextarea,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ContactRow = Contact & { _count: { deals: number } };
type DealRow = Deal & { contact: Contact };

const STAGES: DealStage[] = ["lead", "qualified", "proposal", "won", "lost"];

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function ContactForm({ contact, onSaved }: { contact?: ContactRow; onSaved?: () => void }) {
  const { pending, state, onSubmit } = useAdminForm(saveContactAction, { onSuccess: onSaved });
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {contact ? <input type="hidden" name="id" value={contact.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Name" name="name" defaultValue={contact?.name} />
        <AdminField label="Email" name="email" type="email" defaultValue={contact?.email ?? ""} required={false} />
        <AdminField label="Company" name="company" defaultValue={contact?.company} required={false} />
        <AdminField label="Phone" name="phone" defaultValue={contact?.phone} required={false} />
        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Type</label>
          <select
            name="type"
            defaultValue={contact?.type ?? "lead"}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="lead">Lead</option>
            <option value="customer">Customer</option>
            <option value="partner">Partner</option>
          </select>
        </div>
      </div>
      <AdminTextarea label="Notes" name="notes" defaultValue={contact?.notes} required={false} rows={3} />
      <div className="flex items-center gap-3">
        <SaveButton pending={pending} label={contact ? "Save contact" : "Add contact"} />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function DealForm({ contacts, deal, onSaved }: { contacts: Contact[]; deal?: DealRow; onSaved?: () => void }) {
  const { pending, state, onSubmit } = useAdminForm(saveDealAction, { onSuccess: onSaved });
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {deal ? <input type="hidden" name="id" value={deal.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Deal title" name="title" defaultValue={deal?.title} />
        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Contact</label>
          <select
            name="contactId"
            defaultValue={deal?.contactId ?? contacts[0]?.id}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            required
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Stage</label>
          <select
            name="stage"
            defaultValue={deal?.stage ?? "lead"}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <AdminField
          label="Value (INR)"
          name="valueCents"
          type="number"
          defaultValue={deal ? Math.round(deal.valueCents / 100) : 0}
        />
        <AdminField
          label="Expected close"
          name="expectedCloseAt"
          type="date"
          defaultValue={deal?.expectedCloseAt ? new Date(deal.expectedCloseAt).toISOString().slice(0, 10) : ""}
          required={false}
        />
      </div>
      <div className="flex items-center gap-3">
        <SaveButton pending={pending} label={deal ? "Save deal" : "Add deal"} />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function CrmPanel({ contacts, deals }: { contacts: ContactRow[]; deals: DealRow[] }) {
  const [tab, setTab] = useState("pipeline");
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [editDeal, setEditDeal] = useState<DealRow | null>(null);

  const byStage = STAGES.map((stage) => ({
    stage,
    deals: deals.filter((d) => d.stage === stage)
  }));

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
        <TabsTrigger value="add-contact">Add contact</TabsTrigger>
        <TabsTrigger value="add-deal">Add deal</TabsTrigger>
      </TabsList>

      <TabsContent value="pipeline" className="mt-6 space-y-4">
        {editDeal ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Edit deal</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditDeal(null)}>
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <DealForm contacts={contacts} deal={editDeal} onSaved={() => setEditDeal(null)} />
              <form action={deleteDealAction}>
                <input type="hidden" name="id" value={editDeal.id} />
                <button type="submit" className="text-xs text-destructive hover:underline">
                  Delete deal
                </button>
              </form>
            </CardContent>
          </Card>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-5">
          {byStage.map(({ stage, deals: stageDeals }) => (
            <Card key={stage} className="min-h-[12rem]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {stage} ({stageDeals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stageDeals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No deals</p>
                ) : (
                  stageDeals.map((deal) => (
                    <button
                      key={deal.id}
                      type="button"
                      onClick={() => setEditDeal(deal)}
                      className="w-full rounded-lg border border-border bg-card p-3 text-left text-sm transition hover:border-primary hover:bg-muted/40"
                    >
                      <p className="font-medium leading-snug">{deal.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{deal.contact.name}</p>
                      <p className="mt-2 font-mono text-xs tabular-nums">{formatInr(deal.valueCents)}</p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="contacts" className="mt-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => {
                  const open = editContactId === c.id;
                  return (
                    <Fragment key={c.id}>
                      <TableRow className={cn(open && "bg-muted/40")}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.company || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.type}</Badge>
                        </TableCell>
                        <TableCell>{c._count.deals}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setEditContactId(open ? null : c.id)}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Pencil className="size-3" />
                              {open ? "Close" : "Edit"}
                            </button>
                            <form action={deleteContactAction}>
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" className="text-xs text-destructive hover:underline">
                                Delete
                              </button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/20 p-4">
                            <ContactForm contact={c} onSaved={() => setEditContactId(null)} />
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
      </TabsContent>

      <TabsContent value="add-contact" className="mt-6">
        <Card>
          <CardContent className="pt-6">
            <ContactForm onSaved={() => setTab("contacts")} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="add-deal" className="mt-6">
        <Card>
          <CardContent className="pt-6">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a contact before creating deals.</p>
            ) : (
              <DealForm contacts={contacts} onSaved={() => setTab("pipeline")} />
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
