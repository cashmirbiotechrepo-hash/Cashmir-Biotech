"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import type { AdminSession, AdminUser } from "@prisma/client";
import { Plus, Shield, ShieldOff, Unlock, X } from "lucide-react";
import {
  createAdminUserAction,
  revokeSessionAction,
  revokeUserSessionsAction,
  toggleTwoFactorAction,
  unlockAdminUserAction,
  updateAdminUserAction,
  resetAdminPasswordAction
} from "@/app/(admin)/admin/(console)/users-actions";
import {
  AdminField,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function SessionRevokeRow({ session }: { session: AdminSession }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function revoke() {
    if (!window.confirm("Revoke this session?")) return;
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("sessionId", session.id);
      const result = await revokeSessionAction(fd);
      if (result?.error) window.alert(result.error);
      else router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <div className="min-w-0 text-muted-foreground">
        <p className="truncate font-mono text-xs">{session.id.slice(0, 8)}…</p>
        <p className="truncate">{session.ipAddress ?? "Unknown IP"}</p>
        <p className="truncate text-xs">{session.userAgent?.slice(0, 80) ?? "—"}</p>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void revoke()}>
        {pending ? "Revoking…" : "Revoke"}
      </Button>
    </div>
  );
}

type UserWithSessions = AdminUser & {
  sessions: AdminSession[];
};

function CreateUserForm({ onDone }: { onDone?: () => void }) {
  const { pending, state, onSubmit } = useAdminForm(createAdminUserAction, { onSuccess: onDone });

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Email" name="email" type="email" />
        <AdminField label="Display name" name="name" />
        <AdminField label="Temporary password" name="password" type="password" />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="editor"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SaveButton pending={pending} label="Create account" />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function UserEditor({ user, onDone }: { user: UserWithSessions; onDone?: () => void }) {
  const { pending, state, onSubmit } = useAdminForm(updateAdminUserAction, { onSuccess: onDone });
  const unlockForm = useAdminForm(unlockAdminUserAction);
  const revokeAllForm = useAdminForm(revokeUserSessionsAction);
  const toggle2faForm = useAdminForm(toggleTwoFactorAction);
  const resetPwForm = useAdminForm(resetAdminPasswordAction);

  const locked = user.lockedUntil && user.lockedUntil > new Date();
  const activeSessions = user.sessions.filter((s) => !s.isRevoked && s.expiresAt > new Date());

  return (
    <div className="grid gap-6">
      <form onSubmit={onSubmit} className="grid gap-4">
        <input type="hidden" name="id" value={user.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Display name" name="name" defaultValue={user.name} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`role-${user.id}`}>
              Role
            </label>
            <select
              id={`role-${user.id}`}
              name="role"
              defaultValue={user.role}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={user.active}
            className="size-4 accent-primary"
          />
          Account active
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <SaveButton pending={pending} label="Save user" />
          <FormStatus state={state} />
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {locked ? (
          <form onSubmit={unlockForm.onSubmit}>
            <input type="hidden" name="id" value={user.id} />
            <Button type="submit" variant="outline" size="sm" disabled={unlockForm.pending}>
              <Unlock className="mr-1 size-3.5" />
              Unlock
            </Button>
          </form>
        ) : null}
        <form onSubmit={toggle2faForm.onSubmit}>
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="enabled" value={user.isTwoFactorEnabled ? "false" : "true"} />
          <Button type="submit" variant="outline" size="sm" disabled={toggle2faForm.pending}>
            {user.isTwoFactorEnabled ? (
              <>
                <ShieldOff className="mr-1 size-3.5" />
                Disable 2FA
              </>
            ) : (
              <>
                <Shield className="mr-1 size-3.5" />
                Enable 2FA
              </>
            )}
          </Button>
        </form>
        <form onSubmit={revokeAllForm.onSubmit}>
          <input type="hidden" name="id" value={user.id} />
          <Button type="submit" variant="outline" size="sm" disabled={revokeAllForm.pending}>
            Revoke all sessions ({activeSessions.length})
          </Button>
        </form>
      </div>

      <form onSubmit={resetPwForm.onSubmit} className="grid gap-3 rounded-lg border p-4">
        <input type="hidden" name="id" value={user.id} />
        <p className="text-sm font-medium">Reset password</p>
        <AdminField label="New password" name="password" type="password" />
        <div className="flex items-center gap-3">
          <SaveButton pending={resetPwForm.pending} label="Reset password" />
          <FormStatus state={resetPwForm.state} />
        </div>
      </form>

      {activeSessions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Active sessions</p>
          <div className="divide-y rounded-lg border">
            {activeSessions.map((session) => (
              <SessionRevokeRow key={session.id} session={session} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UsersModule({ users }: { users: UserWithSessions[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setAdding((v) => !v)} variant={adding ? "outline" : "default"}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Cancel" : "Add admin"}
        </Button>
      </div>

      {adding ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New admin account</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateUserForm onDone={() => setAdding(false)} />
          </CardContent>
        </Card>
      ) : null}

      {users.length === 0 ? (
        <EmptyState title="No admin accounts" description="Create the first admin account to get started." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const open = openId === user.id;
                  const locked = user.lockedUntil && user.lockedUntil > new Date();
                  const sessions = user.sessions.filter((s) => !s.isRevoked && s.expiresAt > new Date());
                  return (
                    <Fragment key={user.id}>
                      <TableRow className={cn(open && "bg-muted/30")}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.name || user.email}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {locked ? (
                            <Badge variant="destructive">Locked</Badge>
                          ) : user.active ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isTwoFactorEnabled ? "default" : "secondary"}>
                            {user.isTwoFactorEnabled ? "On" : "Off"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{sessions.length}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpenId(open ? null : user.id)}
                          >
                            {open ? "Close" : "Manage"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/20 p-6">
                            <UserEditor user={user} />
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
      )}
    </div>
  );
}
