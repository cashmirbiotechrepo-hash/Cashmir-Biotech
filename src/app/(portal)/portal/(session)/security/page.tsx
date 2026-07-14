import type { Metadata } from "next";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerSecurityProfile } from "@/lib/customer/portal";

export const metadata: Metadata = {
  title: "Security · Research Portal",
  robots: { index: false, follow: false }
};

export default async function PortalSecurityPage() {
  const session = await requireCustomerSession();
  const profile = await getCustomerSecurityProfile(session.id);
  if (!profile) return null;

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Access</p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-ink">Security</h1>
      </header>

      <dl className="max-w-lg space-y-5 border-y border-ink/10 py-6">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Email</dt>
          <dd className="mt-1 text-sm text-ink">{profile.email}</dd>
          <dd className="mt-1 text-xs text-ink-mute">
            {profile.emailVerifiedAt
              ? `Verified ${profile.emailVerifiedAt.toLocaleDateString("en-IN")}`
              : "Verify via OTP to claim guest orders"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Phone</dt>
          <dd className="mt-1 text-sm text-ink">{profile.phone || "Not set"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Sign-in</dt>
          <dd className="mt-1 text-sm text-ink-mute">
            Passwordless — email one-time code.{" "}
            {profile.passwordHash ? "A password is also on file for future use." : "No password required."}
          </dd>
        </div>
      </dl>

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Devices</h2>
        <ul className="space-y-3">
          {profile.sessions.map((s) => (
            <li key={s.id} className="rounded-xl border border-ink/10 px-4 py-3 text-sm">
              <p className="text-ink truncate">{s.userAgent || "Unknown device"}</p>
              <p className="mt-1 font-mono text-[10px] text-ink-faint">
                {s.ipAddress || "IP —"} · Last used{" "}
                {s.lastUsedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                {s.id === session.sessionId ? " · This session" : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
