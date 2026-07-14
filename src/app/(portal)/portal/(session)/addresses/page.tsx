import type { Metadata } from "next";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerAddresses } from "@/lib/customer/portal";
import { deletePortalAddress, savePortalAddress, setDefaultPortalAddress } from "../actions";

export const metadata: Metadata = {
  title: "Addresses · Research Portal",
  robots: { index: false, follow: false }
};

export default async function PortalAddressesPage() {
  const session = await requireCustomerSession();
  const addresses = await getCustomerAddresses(session.id);

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Shipping</p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-ink">Addresses</h1>
      </header>

      <ul className="space-y-4">
        {addresses.map((a) => (
          <li key={a.id} className="rounded-2xl border border-ink/10 bg-paper/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {a.label}
                  {a.isDefault ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">Default</span>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-ink-mute">
                  {a.fullName}
                  <br />
                  {a.line1}
                  {a.line2 ? (
                    <>
                      <br />
                      {a.line2}
                    </>
                  ) : null}
                  <br />
                  {a.city}, {a.state} {a.postalCode}
                  <br />
                  {a.country}
                  <br />
                  {a.phone}
                </p>
              </div>
              <div className="flex gap-3">
                {!a.isDefault ? (
                  <form action={setDefaultPortalAddress.bind(null, a.id)}>
                    <button type="submit" className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink">
                      Set default
                    </button>
                  </form>
                ) : null}
                <form action={deletePortalAddress.bind(null, a.id)}>
                  <button type="submit" className="font-mono text-[10px] uppercase tracking-[0.14em] text-red-600/80 hover:text-red-700">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Add new</h2>
        <form action={savePortalAddress} className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Field name="label" label="Label" defaultValue="Home" />
          <Field name="fullName" label="Full name" required />
          <Field name="phone" label="Phone" required className="sm:col-span-2" />
          <Field name="line1" label="Address line 1" required className="sm:col-span-2" />
          <Field name="line2" label="Address line 2" className="sm:col-span-2" />
          <Field name="city" label="City" required />
          <Field name="state" label="State" required />
          <Field name="postalCode" label="PIN" required />
          <Field name="country" label="Country" defaultValue="India" />
          <label className="flex items-center gap-2 sm:col-span-2 text-sm text-ink-mute">
            <input type="checkbox" name="isDefault" className="rounded border-ink/20" />
            Set as default
          </label>
          <button
            type="submit"
            className="sm:col-span-2 mt-2 rounded-full bg-ink py-3 text-sm font-medium text-paper"
          >
            Save address
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  defaultValue,
  className
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <label className={className ?? ""}>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{label}</span>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
      />
    </label>
  );
}
