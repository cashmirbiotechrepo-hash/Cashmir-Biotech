import "server-only";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createOrganizationInvite(input: {
  organizationId: string;
  email: string;
  role?: string;
  invitedBy?: string;
}) {
  const org = await db.organization.findUnique({ where: { id: input.organizationId } });
  if (!org || !org.active) return { ok: false as const, error: "Organisation not found." };

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false as const, error: "Invalid email." };

  const existingMember = await db.customer.findUnique({
    where: { email },
    include: { organizationMembers: { where: { organizationId: org.id } } }
  });
  if (existingMember?.organizationMembers.length) {
    return { ok: false as const, error: "This email is already a member." };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.organizationInvite.updateMany({
    where: { organizationId: org.id, email, acceptedAt: null },
    data: { expiresAt: new Date() }
  });

  const invite = await db.organizationInvite.create({
    data: {
      organizationId: org.id,
      email,
      role: input.role ?? "buyer",
      tokenHash: hashToken(token),
      invitedBy: input.invitedBy ?? "",
      expiresAt
    }
  });

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false as const, error: "Site URL is not configured. Cannot send invite." };
    }
  }
  const acceptUrl = `${site || "http://localhost:3000"}/portal/invite?token=${encodeURIComponent(token)}`;

  const mailed = await (async () => {
    const { buildOrgInviteMail } = await import("@/lib/email/transactional");
    const { sendTransactionalMail } = await import("@/lib/admin/mail");
    const mail = buildOrgInviteMail({
      orgName: org.name,
      role: invite.role,
      acceptUrl
    });
    return sendTransactionalMail({ to: email, mail });
  })();

  logger.info(
    { event: "org_invite_created", organizationId: org.id, email, mailed },
    "organisation invite created"
  );

  return { ok: true as const, inviteId: invite.id, acceptUrl, mailed };
}

export async function getInviteByRawToken(token: string) {
  if (!token) return null;
  const invite = await db.organizationInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { select: { id: true, name: true, active: true } } }
  });
  if (!invite || invite.acceptedAt) return null;
  if (invite.expiresAt.getTime() < Date.now()) return null;
  if (!invite.organization.active) return null;
  return invite;
}

export async function acceptOrganizationInvite(input: { token: string; customerId: string }) {
  const invite = await getInviteByRawToken(input.token);
  if (!invite) return { ok: false as const, error: "Invite is invalid or expired." };

  const customer = await db.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) return { ok: false as const, error: "Sign in required." };

  if (customer.email.toLowerCase() !== invite.email.toLowerCase()) {
    return {
      ok: false as const,
      error: `Sign in as ${invite.email} to accept this invite.`
    };
  }

  await db.$transaction(async (tx) => {
    await tx.organizationMember.upsert({
      where: {
        organizationId_customerId: {
          organizationId: invite.organizationId,
          customerId: customer.id
        }
      },
      create: {
        organizationId: invite.organizationId,
        customerId: customer.id,
        role: invite.role
      },
      update: { role: invite.role }
    });
    await tx.organizationInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() }
    });
  });

  return { ok: true as const, organizationId: invite.organizationId, organizationName: invite.organization.name };
}

export async function listOrgMembershipsForCustomer(customerId: string) {
  return db.organizationMember.findMany({
    where: { customerId },
    include: {
      organization: {
        include: {
          members: {
            include: { customer: { select: { id: true, email: true, name: true } } },
            orderBy: { createdAt: "asc" }
          },
          invites: {
            where: { acceptedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" }
          }
        }
      }
    }
  });
}

export async function canManageOrg(customerId: string, organizationId: string) {
  const member = await db.organizationMember.findUnique({
    where: { organizationId_customerId: { organizationId, customerId } }
  });
  return member?.role === "admin" || member?.role === "owner";
}
