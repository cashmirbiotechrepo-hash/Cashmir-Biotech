"use client";

import type { AdminSession } from "@prisma/client";
import { Monitor, Smartphone } from "lucide-react";
import {
  changeOwnPasswordAction,
  revokeMyOtherSessionsAction,
  updateOwnProfileAction
} from "@/app/(admin)/admin/(console)/account-actions";
import {
  AdminField,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SessionRow({ session, current }: { session: AdminSession; current: boolean }) {
  const isMobile = /mobile|android|iphone/i.test(session.userAgent ?? "");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm last:border-0">
      <div className="flex items-start gap-2">
        {isMobile ? <Smartphone className="mt-0.5 size-4 text-muted-foreground" /> : <Monitor className="mt-0.5 size-4 text-muted-foreground" />}
        <div>
          <p className="font-medium">
            {session.ipAddress ?? "Unknown IP"}
            {current ? (
              <Badge variant="outline" className="ml-2 text-[10px]">
                This device
              </Badge>
            ) : null}
          </p>
          <p className="max-w-md truncate text-xs text-muted-foreground">{session.userAgent ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            Last active {new Date(session.lastUsedAt).toLocaleString("en-IN")}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AccountSettings({
  email,
  name,
  role,
  sessionId,
  sessions
}: {
  email: string;
  name: string;
  role: string;
  sessionId?: string;
  sessions: AdminSession[];
}) {
  const profileForm = useAdminForm(updateOwnProfileAction);
  const passwordForm = useAdminForm(changeOwnPasswordAction);
  const revokeForm = useAdminForm(revokeMyOtherSessionsAction);

  const otherSessions = sessions.filter((s) => s.id !== sessionId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.onSubmit} className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
            <AdminField label="Display name" name="name" defaultValue={name} />
            <p className="text-xs text-muted-foreground">Role: {role}</p>
            <div className="flex items-center gap-3">
              <SaveButton pending={profileForm.pending} label="Save profile" />
              <FormStatus state={profileForm.state} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.onSubmit} className="space-y-4">
            <AdminField label="Current password" name="currentPassword" type="password" />
            <AdminField label="New password" name="newPassword" type="password" />
            <div className="flex items-center gap-3">
              <SaveButton pending={passwordForm.pending} label="Update password" />
              <FormStatus state={passwordForm.state} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Active sessions</CardTitle>
          {otherSessions.length > 0 ? (
            <form onSubmit={revokeForm.onSubmit}>
              <Button type="submit" variant="outline" size="sm" disabled={revokeForm.pending}>
                {revokeForm.pending ? "Signing out…" : "Sign out other devices"}
              </Button>
            </form>
          ) : null}
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            sessions.map((session) => (
              <SessionRow key={session.id} session={session} current={session.id === sessionId} />
            ))
          )}
          <FormStatus state={revokeForm.state} />
        </CardContent>
      </Card>
    </div>
  );
}
