import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { LuxeButton } from "@/components/ui/luxe-button";
import { SITE_CONTACT } from "@/lib/site-contact";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Cashmir Biotech — product enquiries, partnerships, and institutional access."
};

export default function ContactPage() {
  return (
    <div className="pb-8">
      <PageHeader
        eyebrow="Say hello"
        title="We'd love to connect with you."
        accentWords={[4]}
        description="Questions about our products, research partnerships, or institutional access? Drop by our office in Kashmir or reach out directly."
      />

      <section className="frame grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="space-y-8">
          <Reveal>
            <div className="rounded-2xl border border-ink/10 bg-paper/70 p-8 shadow-glass">
              <p className="technical mb-5">Email</p>
              <ul className="space-y-3">
                {SITE_CONTACT.emails.map((email) => (
                  <li key={email}>
                    <a
                      href={`mailto:${email}`}
                      className="text-lg font-light text-ink transition-colors hover:text-gold"
                    >
                      {email}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-ink-mute">
                Support:{" "}
                <a href={`mailto:${SITE_CONTACT.supportEmail}`} className="text-ink hover:text-gold">
                  {SITE_CONTACT.supportEmail}
                </a>
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-ink/10 bg-paper/70 p-8 shadow-glass">
              <p className="technical mb-5">Phone</p>
              <a
                href={`tel:${SITE_CONTACT.phoneTel}`}
                className="text-2xl font-light tracking-tight text-ink transition-colors hover:text-gold"
              >
                {SITE_CONTACT.phone}
              </a>
              <p className="mt-4 text-sm text-ink-mute">{SITE_CONTACT.location}</p>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <LuxeButton href={SITE_CONTACT.mapsUrl}>Open in Google Maps</LuxeButton>
          </Reveal>
        </div>

        <Reveal delay={0.1} y={40}>
          <div className="overflow-hidden rounded-2xl border border-ink/10 bg-ivory shadow-glass">
            <iframe
              title="Cashmir Biotech location"
              src="https://maps.google.com/maps?q=Cashmir+BioTech&z=15&output=embed"
              className="h-[min(420px,60vh)] w-full border-0 grayscale-[30%] contrast-[1.05]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
