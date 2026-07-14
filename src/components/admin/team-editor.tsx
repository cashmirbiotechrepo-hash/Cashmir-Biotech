"use client";

import { useState, Fragment } from "react";
import type { TeamMember } from "@prisma/client";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import {
  deleteTeamMemberAction,
  moveTeamMemberAction,
  saveTeamMemberAction
} from "@/app/(admin)/admin/(console)/actions";
import {
  AdminField,
  AdminTextarea,
  DeleteButton,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { EmptyState } from "@/components/admin/empty-state";
import { ImageUploadField } from "@/components/admin/image-upload";
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

function TeamEditor({ member, onDone }: { member?: TeamMember | null; onDone?: () => void }) {
  const creating = !member;
  const { pending, state, onSubmit } = useAdminForm(saveTeamMemberAction, {
    onSuccess: creating ? onDone : undefined
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {member ? <input type="hidden" name="id" value={member.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Full name" name="fullName" defaultValue={member?.fullName ?? ""} />
        <AdminField label="Role" name="role" defaultValue={member?.role ?? ""} />
      </div>
      <AdminTextarea label="Bio" name="bio" defaultValue={member?.bio ?? ""} required rows={5} />
      <ImageUploadField
        name="avatarUrl"
        label="Photo"
        defaultValue={member?.avatarUrl ?? ""}
        aspect={1}
        required
        helpText="Square headshot works best. PNG, JPG, WEBP up to 8 MB."
      />
      <div className="flex flex-wrap items-center gap-3">
        <SaveButton pending={pending} label={creating ? "Add member" : "Save changes"} />
        {member ? <DeleteButton action={deleteTeamMemberAction} id={member.id} label="Remove member" /> : null}
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function TeamEditorList({ team }: { team: TeamMember[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setAdding((v) => !v)} variant={adding ? "outline" : "default"}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Cancel" : "Add board member"}
        </Button>
      </div>

      {adding ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New board member</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamEditor onDone={() => setAdding(false)} />
          </CardContent>
        </Card>
      ) : null}

      {team.length === 0 && !adding ? (
        <EmptyState
          title="No board members"
          description="Add your first leadership profile to populate the team page."
          action={
            <Button type="button" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add board member
            </Button>
          }
        />
      ) : team.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-24 text-right">Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((member, index) => {
                  const open = openId === member.id;
                  return (
                    <Fragment key={member.id}>
                      <TableRow
                        className={cn("cursor-pointer", open && "bg-muted/40")}
                        onClick={() => setOpenId(open ? null : member.id)}
                      >
                        <TableCell className="font-medium">{member.fullName}</TableCell>
                        <TableCell className="text-muted-foreground">{member.role}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                          <div className="flex justify-end gap-1">
                            <form action={moveTeamMemberAction}>
                              <input type="hidden" name="id" value={member.id} />
                              <input type="hidden" name="direction" value="up" />
                              <button
                                type="submit"
                                disabled={index === 0}
                                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                                aria-label="Move up"
                              >
                                <ArrowUp className="size-3.5" />
                              </button>
                            </form>
                            <form action={moveTeamMemberAction}>
                              <input type="hidden" name="id" value={member.id} />
                              <input type="hidden" name="direction" value="down" />
                              <button
                                type="submit"
                                disabled={index === team.length - 1}
                                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                                aria-label="Move down"
                              >
                                <ArrowDown className="size-3.5" />
                              </button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={3} className="bg-muted/20 p-4">
                            <TeamEditor member={member} />
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
      ) : null}
    </div>
  );
}
