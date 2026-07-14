"use client";

import { useState, Fragment } from "react";
import type { BlogPost } from "@prisma/client";
import { Plus, X } from "lucide-react";
import { deleteBlogPostAction, saveBlogPostAction } from "@/app/(admin)/admin/(console)/blog-actions";
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

function PostEditor({ post, onDone }: { post?: BlogPost | null; onDone?: () => void }) {
  const creating = !post;
  const { pending, state, onSubmit } = useAdminForm(saveBlogPostAction, { onSuccess: creating ? onDone : undefined });

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Title" name="title" defaultValue={post?.title} />
        <AdminField label="Slug" name="slug" defaultValue={post?.slug} required={false} placeholder="auto-generated" />
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={post?.status ?? "draft"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>
      <AdminField label="Excerpt" name="excerpt" defaultValue={post?.excerpt ?? ""} required={false} />
      <ImageUploadField
        name="coverImageUrl"
        label="Cover image"
        defaultValue={post?.coverImageUrl ?? ""}
        aspect={16 / 9}
        required={false}
      />
      <AdminTextarea label="Body" name="body" defaultValue={post?.body ?? ""} rows={12} required />
      <div className="flex flex-wrap items-center gap-3">
        <SaveButton pending={pending} label={creating ? "Create post" : "Save post"} />
        {post ? <DeleteButton action={deleteBlogPostAction} id={post.id} label="Delete post" /> : null}
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function BlogModule({ posts }: { posts: BlogPost[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setAdding((v) => !v)} variant={adding ? "outline" : "default"}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Cancel" : "New post"}
        </Button>
      </div>

      {adding ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New blog post</CardTitle>
          </CardHeader>
          <CardContent>
            <PostEditor onDone={() => setAdding(false)} />
          </CardContent>
        </Card>
      ) : null}

      {posts.length === 0 && !adding ? (
        <EmptyState title="No posts yet" description="Create your first article to publish company news or research updates." />
      ) : posts.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => {
                  const open = openId === post.id;
                  return (
                    <Fragment key={post.id}>
                      <TableRow className={cn(open && "bg-muted/30")}>
                        <TableCell className="font-medium">{post.title}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{post.slug}</TableCell>
                        <TableCell>
                          <Badge variant={post.status === "published" ? "default" : "secondary"}>{post.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(post.updatedAt).toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpenId(open ? null : post.id)}
                          >
                            {open ? "Close" : "Edit"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/20 p-6">
                            <PostEditor post={post} />
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
