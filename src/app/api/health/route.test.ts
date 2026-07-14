import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ health: 1 }])
  }
}));

describe("GET /api/health", () => {
  it("returns minimal ok payload publicly", async () => {
    const res = await GET(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.checks).toBeUndefined();
  });

  it("returns detailed payload with cron bearer", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-16");
    const res = await GET(
      new Request("http://localhost/api/health", {
        headers: { Authorization: "Bearer test-cron-secret-16" }
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.checks.database.status).toBe("ok");
    expect(typeof json.uptimeSeconds).toBe("number");
    vi.unstubAllEnvs();
  });
});
