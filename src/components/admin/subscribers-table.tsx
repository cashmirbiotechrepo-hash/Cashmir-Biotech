"use client";

import type { Subscriber } from "@prisma/client";
import {
  addSubscriberAction,
  deleteSubscriberAction,
  updateSubscriberStatusAction
} from "@/app/(admin)/admin/(console)/actions";
import { FormStatus, SaveButton, useAdminForm } from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

function AddSubscriberForm() {
  const { pending, state, onSubmit } = useAdminForm(addSubscriberAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <Input name="email" type="email" placeholder="new@subscriber.com" className="max-w-xs" required />
      <SaveButton pending={pending} label="Add subscriber" />
      <FormStatus state={state} />
    </form>
  );
}

function SubscriberRow({ subscriber, canDelete }: { subscriber: Subscriber; canDelete: boolean }) {
  const statusForm = useAdminForm(updateSubscriberStatusAction);
  const deleteForm = useAdminForm(deleteSubscriberAction);
  const nextStatus = subscriber.status === "subscribed" ? "unsubscribed" : "subscribed";

  return (
    <TableRow>
      <TableCell>{subscriber.email}</TableCell>
      <TableCell className="text-muted-foreground">{subscriber.source}</TableCell>
      <TableCell>
        <Badge variant={subscriber.status === "subscribed" ? "default" : "secondary"}>{subscriber.status}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(subscriber.createdAt).toLocaleDateString("en-IN")}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <form onSubmit={statusForm.onSubmit}>
            <input type="hidden" name="id" value={subscriber.id} />
            <input type="hidden" name="status" value={nextStatus} />
            <button type="submit" disabled={statusForm.pending} className="text-xs text-primary hover:underline">
              {subscriber.status === "subscribed" ? "Unsubscribe" : "Resubscribe"}
            </button>
          </form>
          {canDelete ? (
            <form onSubmit={deleteForm.onSubmit}>
              <input type="hidden" name="id" value={subscriber.id} />
              <button type="submit" disabled={deleteForm.pending} className="text-xs text-destructive hover:underline">
                Delete
              </button>
            </form>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function SubscribersTable({
  subscribers,
  canDelete
}: {
  subscribers: Subscriber[];
  canDelete: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <AddSubscriberForm />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((sub) => (
                <SubscriberRow key={sub.id} subscriber={sub} canDelete={canDelete} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
