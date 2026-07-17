-- Partial index for open support tickets (audit Top-100 #26).
CREATE INDEX IF NOT EXISTS "SupportTicket_open_createdAt_idx"
  ON "SupportTicket" ("createdAt")
  WHERE status = 'open';
