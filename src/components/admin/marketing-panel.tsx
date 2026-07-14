"use client";

import { Fragment, useState } from "react";
import type { Coupon, EmailCampaign } from "@prisma/client";
import { Pencil } from "lucide-react";
import {
  deleteCouponAction,
  saveCampaignAction,
  saveCouponAction,
  sendCampaignAction,
  toggleCouponAction
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

function CouponForm({ coupon, onSaved }: { coupon?: Coupon; onSaved?: () => void }) {
  const { pending, state, onSubmit } = useAdminForm(saveCouponAction, { onSuccess: onSaved });
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {coupon ? <input type="hidden" name="id" value={coupon.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Code" name="code" placeholder="WELCOME10" defaultValue={coupon?.code} />
        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Type</label>
          <select name="type" defaultValue={coupon?.type ?? "percent"} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed INR off</option>
          </select>
        </div>
        <AdminField label="Value (% or INR)" name="value" type="number" defaultValue={coupon?.value ?? 10} />
        <AdminField label="Max uses" name="maxUses" type="number" required={false} defaultValue={coupon?.maxUses ?? ""} />
        <AdminField
          label="Expires"
          name="expiresAt"
          type="date"
          required={false}
          defaultValue={coupon?.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 10) : ""}
        />
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="active" defaultChecked={coupon ? coupon.active : true} className="accent-primary" />
          Active
        </label>
      </div>
      <div className="flex items-center gap-3">
        <SaveButton pending={pending} label={coupon ? "Save coupon" : "Create coupon"} />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function CampaignForm() {
  const { pending, state, onSubmit } = useAdminForm(saveCampaignAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <AdminField label="Campaign name" name="name" />
      <AdminField label="Email subject" name="subject" />
      <AdminTextarea label="Body" name="body" rows={8} required />
      <div className="flex items-center gap-3">
        <SaveButton pending={pending} label="Save draft" />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function MarketingPanel({ coupons, campaigns }: { coupons: Coupon[]; campaigns: EmailCampaign[] }) {
  const [editCouponId, setEditCouponId] = useState<string | null>(null);

  return (
    <Tabs defaultValue="campaigns">
      <TabsList>
        <TabsTrigger value="campaigns">Campaigns ({campaigns.length})</TabsTrigger>
        <TabsTrigger value="new-campaign">New campaign</TabsTrigger>
        <TabsTrigger value="coupons">Coupons (preview)</TabsTrigger>
      </TabsList>

      <TabsContent value="campaigns" className="mt-6 space-y-4">
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet. Create a draft under New campaign.</p>
        ) : null}
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
              <div>
                <CardTitle className="text-base">{campaign.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{campaign.subject}</p>
              </div>
              <Badge variant={campaign.status === "sent" ? "default" : "secondary"}>{campaign.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{campaign.body}</p>
              {campaign.status === "draft" ? (
                <form action={sendCampaignAction} className="space-y-2">
                  <input type="hidden" name="id" value={campaign.id} />
                  <Button type="submit" size="sm">
                    Send to subscribers
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Delivers sequentially via SMTP with a short pause between sends. Requires SMTP env vars.
                    Large lists may need a background job — keep campaigns under a few hundred recipients for now.
                  </p>
                </form>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sent to {campaign.recipientCount} on{" "}
                  {campaign.sentAt ? new Date(campaign.sentAt).toLocaleString("en-IN") : "—"}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="new-campaign" className="mt-6">
        <Card>
          <CardContent className="pt-6">
            <CampaignForm />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="coupons" className="mt-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coupons not live at checkout</CardTitle>
            <p className="text-sm text-muted-foreground">
              Admin can store coupon definitions here, but storefront checkout does not accept or apply codes
              yet. Create drafts for readiness — do not promote them to customers until redemption is wired.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      No coupon drafts yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {coupons.map((c) => {
                  const open = editCouponId === c.id;
                  return (
                    <Fragment key={c.id}>
                      <TableRow className={cn(open && "bg-muted/40")}>
                        <TableCell className="font-mono text-xs">{c.code}</TableCell>
                        <TableCell>{c.type}</TableCell>
                        <TableCell>{c.type === "percent" ? `${c.value}%` : `₹${c.value}`}</TableCell>
                        <TableCell>
                          {c.usedCount}
                          {c.maxUses ? ` / ${c.maxUses}` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.active ? "default" : "secondary"}>
                            {c.active ? "Draft active" : "Off"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setEditCouponId(open ? null : c.id)}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Pencil className="size-3" />
                              {open ? "Close" : "Edit"}
                            </button>
                            <form action={toggleCouponAction}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="active" value={String(!c.active)} />
                              <button type="submit" className="text-xs text-muted-foreground hover:underline">
                                {c.active ? "Disable" : "Enable"}
                              </button>
                            </form>
                            <form action={deleteCouponAction}>
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
                          <TableCell colSpan={6} className="bg-muted/20 p-4">
                            <CouponForm coupon={c} onSaved={() => setEditCouponId(null)} />
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New coupon draft</CardTitle>
          </CardHeader>
          <CardContent>
            <CouponForm />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
