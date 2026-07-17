"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCustomerSession } from "@/lib/customer/auth";
import {
  acceptOrganizationInvite,
  canManageOrg,
  createOrganizationInvite
} from "@/modules/shop/services/org-invite.service";
import {
  cancelCircleSubscription,
  startCircleSubscription
} from "@/modules/shop/services/research-circle.service";

export type ActionMsg = { ok?: true; error?: string; acceptUrl?: string };

export async function inviteOrgMemberAction(
  _prev: ActionMsg,
  formData: FormData
): Promise<ActionMsg> {
  const session = await requireCustomerSession();
  const organizationId = String(formData.get("organizationId") || "");
  const email = String(formData.get("email") || "");
  const role = String(formData.get("role") || "buyer");

  if (!(await canManageOrg(session.id, organizationId))) {
    return { error: "Only org admins can invite members." };
  }

  const result = await createOrganizationInvite({
    organizationId,
    email,
    role,
    invitedBy: session.email
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/portal/organization");
  return { ok: true, acceptUrl: result.acceptUrl };
}

export async function acceptOrgInviteAction(token: string): Promise<ActionMsg> {
  const session = await requireCustomerSession();
  const result = await acceptOrganizationInvite({ token, customerId: session.id });
  if (!result.ok) return { error: result.error };
  revalidatePath("/portal/organization");
  redirect("/portal/organization?joined=1");
}

export async function joinResearchCircleAction(
  _prev: ActionMsg,
  formData: FormData
): Promise<ActionMsg> {
  const session = await requireCustomerSession();
  const planId = String(formData.get("planId") || "");
  const result = await startCircleSubscription({ customerId: session.id, planId });
  if (!result.ok) return { error: result.error };
  return {
    error: "Complete payment in checkout via Razorpay to activate your membership."
  };
}

export async function cancelResearchCircleAction(): Promise<void> {
  const session = await requireCustomerSession();
  await cancelCircleSubscription(session.id);
  revalidatePath("/portal/circle");
}
