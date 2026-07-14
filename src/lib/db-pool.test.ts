import { describe, expect, it } from "vitest";
import { databaseUrlLooksPooled } from "@/lib/db-pool";

describe("databaseUrlLooksPooled", () => {
  it("accepts connection_limit query param", () => {
    expect(
      databaseUrlLooksPooled(
        "postgresql://u:p@localhost:5432/db?schema=public&connection_limit=5&pool_timeout=10"
      )
    ).toBe(true);
  });

  it("accepts pgbouncer flag", () => {
    expect(databaseUrlLooksPooled("postgresql://u:p@db/host?pgbouncer=true")).toBe(true);
  });

  it("accepts Neon pooler hosts", () => {
    expect(
      databaseUrlLooksPooled("postgresql://u:p@ep-x-pooler.us-east-1.aws.neon.tech/neondb")
    ).toBe(true);
  });

  it("rejects bare local urls", () => {
    expect(databaseUrlLooksPooled("postgresql://postgres:postgres@localhost:5432/cashmir")).toBe(
      false
    );
  });
});
