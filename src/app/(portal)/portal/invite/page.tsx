import Link from "next/link";
import { getInviteByRawToken } from "@/modules/shop/services/org-invite.service";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { AcceptInviteButton } from "@/components/portal/accept-invite-button";

export const metadata = { title: "Accept organisation invite" };

export default async function PortalInvitePage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const invite = token ? await getInviteByRawToken(token) : null;
  const session = await getCurrentCustomer();

  if (!invite) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-medium">Invite unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link is invalid or has expired.</p>
        <Link href="/portal" className="mt-6 inline-block text-sm text-primary underline">
          Go to portal
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-medium">Join {invite.organization.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Invited as <strong>{invite.role}</strong> for <strong>{invite.email}</strong>.
      </p>

      {!session ? (
        <p className="mt-6 text-sm">
          <Link
            href={`/portal/login?next=${encodeURIComponent(`/portal/invite?token=${token}`)}`}
            className="text-primary underline"
          >
            Sign in as {invite.email}
          </Link>{" "}
          to accept.
        </p>
      ) : session.email.toLowerCase() !== invite.email.toLowerCase() ? (
        <p className="mt-6 text-sm text-destructive">
          You are signed in as {session.email}. Sign out and use {invite.email}.
        </p>
      ) : (
        <div className="mt-8">
          <AcceptInviteButton token={token} />
        </div>
      )}
    </main>
  );
}
