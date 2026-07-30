import { PrismaClient } from "@prisma/client";
import { SITE_CONTACT } from "../src/lib/site-contact";

const db = new PrismaClient();

async function updateAllInvoices() {
  const legal = SITE_CONTACT.legal;
  console.log("Updating invoices to use current company legal info:", legal);

  const invoices = await db.invoice.findMany();
  let updatedCount = 0;

  for (const invoice of invoices) {
    if (invoice.gstDetails) {
      const details = invoice.gstDetails as any;
      const updatedDetails = {
        ...details,
        gstin: legal.gstin,
        pan: legal.pan,
        cin: legal.cin
      };
      
      await db.invoice.update({
        where: { id: invoice.id },
        data: { gstDetails: updatedDetails }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} invoices.`);
}

updateAllInvoices()
  .catch(console.error)
  .finally(() => db.$disconnect().then(() => process.exit(0)));
