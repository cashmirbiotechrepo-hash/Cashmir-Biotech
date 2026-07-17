-- CreateTable (idempotent: safe if already applied via prisma db push)
CREATE TABLE IF NOT EXISTS "CustomerRefreshToken" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerRefreshToken_tokenHash_key" ON "CustomerRefreshToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "CustomerRefreshToken_sessionId_idx" ON "CustomerRefreshToken"("sessionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerRefreshToken_sessionId_fkey'
  ) THEN
    ALTER TABLE "CustomerRefreshToken"
      ADD CONSTRAINT "CustomerRefreshToken_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "CustomerSession"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
