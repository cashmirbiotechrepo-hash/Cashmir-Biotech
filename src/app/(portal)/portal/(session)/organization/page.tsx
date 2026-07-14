import { requireCustomerSession } from "@/lib/customer/auth";
import { listOrgMembershipsForCustomer } from "@/modules/shop/services/org-invite.service";
import { inviteOrgMemberAction, type ActionMsg } from "@/app/(portal)/portal/(session)/org-circle-actions";
import { OrgInviteForm } from "@/components/portal/org-invite-form";

export const metadata = { title: "Organisation" };

export default async function PortalOrganizationPage({
  searchParams
}: {
  searchParams: Promise<{ joined?: string }>;
}) {
  const session = await requireCustomerSession();
  const sp = await searchParams;
  const memberships = await listOrgMembershipsForCustomer(session.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight text-foreground">Organisation seats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite lab colleagues to the same institutional account. Admins can send email invites.
        </p>
        {sp.joined ? (
          <p className="mt-3 text-sm text-emerald-700">You joined the organisation successfully.</p>
        ) : null}
      </div>

      {memberships.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You are not on an organisation yet. Ask an admin to invite {session.email}, or have ops create one
          under Admin → B2B.
        </p>
      ) : (
        memberships.map((m) => {
          const canInvite = m.role === "admin" || m.role === "owner";
          return (
            <section key={m.id} className="border-t border-border/60 pt-6">
              <h2 className="text-lg font-medium">{m.organization.name}</h2>
              <p className="text-xs text-muted-foreground">
                Your role: {m.role}
                {m.organization.gstin ? ` · GSTIN ${m.organization.gstin}` : ""}
              </p>

              <ul className="mt-4 divide-y text-sm">
                {m.organization.members.map((mem) => (
                  <li key={mem.id} className="flex justify-between gap-4 py-2">
                    <span>
                      {mem.customer.name || mem.customer.email}
                      <span className="ml-2 text-xs text-muted-foreground">{mem.customer.email}</span>
                    </span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{mem.role}</span>
                  </li>
                ))}
              </ul>

              {m.organization.invites.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pending invites
                  </p>
                  <ul className="mt-2 text-sm text-muted-foreground">
                    {m.organization.invites.map((inv) => (
                      <li key={inv.id}>
                        {inv.email} · {inv.role} · expires {inv.expiresAt.toLocaleDateString("en-IN")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {canInvite ? (
                <div className="mt-6">
                  <OrgInviteForm
                    organizationId={m.organization.id}
                    action={inviteOrgMemberAction as (
                      prev: ActionMsg,
                      formData: FormData
                    ) => Promise<ActionMsg>}
                  />
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}
