import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  inviteOrgMemberAdminAction,
  saveOrganizationAction,
  saveQuoteAction
} from "@/app/(admin)/admin/(console)/b2b-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "B2B" };

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

async function saveOrg(formData: FormData) {
  "use server";
  await saveOrganizationAction(formData);
}

async function saveQuote(formData: FormData) {
  "use server";
  await saveQuoteAction(formData);
}

async function inviteMember(formData: FormData) {
  "use server";
  await inviteOrgMemberAdminAction(formData);
}

export default async function AdminB2bPage() {
  const [orgs, quotes, invites] = await Promise.all([
    db.organization.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    db.quote.findMany({
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    db.organizationInvite.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30
    })
  ]);

  return (
    <>
      <AdminPageHeader
        title="B2B / institutions"
        description="Organisations, multi-seat invites, GSTIN, and institutional quotes / PO tracking."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organisations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y text-sm">
              {orgs.length === 0 ? (
                <li className="py-2 text-muted-foreground">None yet.</li>
              ) : (
                orgs.map((o) => (
                  <li key={o.id} className="py-2">
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      GSTIN {o.gstin || "—"} · {o.billingEmail || "no billing email"} ·{" "}
                      {o._count.members} seats
                    </p>
                  </li>
                ))
              )}
            </ul>
            <form action={saveOrg} className="space-y-3 border-t pt-4">
              <div>
                <Label htmlFor="org-name">Name</Label>
                <Input id="org-name" name="name" required />
              </div>
              <div>
                <Label htmlFor="org-gstin">GSTIN</Label>
                <Input id="org-gstin" name="gstin" />
              </div>
              <div>
                <Label htmlFor="org-email">Billing email</Label>
                <Input id="org-email" name="billingEmail" type="email" />
              </div>
              <Button type="submit">Add organisation</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seat invites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y text-sm">
              {invites.length === 0 ? (
                <li className="py-2 text-muted-foreground">No pending invites.</li>
              ) : (
                invites.map((inv) => (
                  <li key={inv.id} className="py-2">
                    <p className="font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.organization.name} · {inv.role} · expires{" "}
                      {inv.expiresAt.toLocaleDateString("en-IN")}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <form action={inviteMember} className="space-y-3 border-t pt-4">
              <div>
                <Label htmlFor="inv-org">Organisation</Label>
                <select
                  id="inv-org"
                  name="organizationId"
                  required
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="inv-email">Email</Label>
                <Input id="inv-email" name="email" type="email" required />
              </div>
              <div>
                <Label htmlFor="inv-role">Role</Label>
                <select
                  id="inv-role"
                  name="role"
                  defaultValue="buyer"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="buyer">Buyer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button type="submit" disabled={orgs.length === 0}>
                Send invite
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Quotes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y text-sm">
              {quotes.length === 0 ? (
                <li className="py-2 text-muted-foreground">No quotes yet.</li>
              ) : (
                quotes.map((q) => (
                  <li key={q.id} className="py-2">
                    <p className="font-medium">{q.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.organization.name} · {inr.format(q.totalCents / 100)} · {q.status}
                      {q.poNumber ? ` · PO ${q.poNumber}` : ""}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <form action={saveQuote} className="grid gap-3 border-t pt-4 md:grid-cols-2">
              <div>
                <Label htmlFor="q-org">Organisation</Label>
                <select
                  id="q-org"
                  name="organizationId"
                  required
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="q-title">Title</Label>
                <Input id="q-title" name="title" required />
              </div>
              <div>
                <Label htmlFor="q-total">Total (INR)</Label>
                <Input id="q-total" name="totalInr" type="number" step="0.01" min="0" required />
              </div>
              <div>
                <Label htmlFor="q-po">PO number</Label>
                <Input id="q-po" name="poNumber" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="q-notes">Notes</Label>
                <Input id="q-notes" name="notes" />
              </div>
              <div>
                <Button type="submit" disabled={orgs.length === 0}>
                  Create quote
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
