"use client";

import { saveHomepageAction } from "@/app/(admin)/admin/(console)/actions";
import {
  AdminField,
  AdminTextarea,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SiteSettings } from "@prisma/client";

export function HomepageEditor({ settings }: { settings: SiteSettings | null }) {
  const { pending, state, onSubmit } = useAdminForm(saveHomepageAction);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Homepage content</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <AdminField label="Hero title" name="heroTitle" defaultValue={settings?.heroTitle} />
          <AdminField
            label="Hero subtitle"
            name="heroSubtitle"
            defaultValue={settings?.heroSubtitle}
            required={false}
          />
          <AdminTextarea
            label="Hero description"
            name="heroDescription"
            defaultValue={settings?.heroDescription}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Primary CTA text" name="ctaPrimaryText" defaultValue={settings?.ctaPrimaryText} />
            <AdminField label="Primary CTA link" name="ctaPrimaryHref" defaultValue={settings?.ctaPrimaryHref} />
            <AdminField
              label="Secondary CTA text"
              name="ctaSecondaryText"
              defaultValue={settings?.ctaSecondaryText}
            />
            <AdminField
              label="Secondary CTA link"
              name="ctaSecondaryHref"
              defaultValue={settings?.ctaSecondaryHref}
            />
          </div>
          <AdminTextarea
            label="Mission statement"
            name="missionStatement"
            defaultValue={settings?.missionStatement}
            required
          />
          <div className="flex items-center gap-3">
            <SaveButton pending={pending} label="Publish homepage" />
            <FormStatus state={state} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
