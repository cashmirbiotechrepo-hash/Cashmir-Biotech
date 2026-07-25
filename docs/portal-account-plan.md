# Customer Account & Portal Experience Plan

**Date:** 25 Jul 2026 (revised through seven design-review rounds)  
**Scope:** Customer sign-in, saved profile/addresses, portal navigation (mobile + desktop), storefront account access  
**Goal:** Make the customer account feel as dependable as Amazon / Flipkart / Shopify Customer Accounts — save once, reuse everywhere, always one tap from shopping.

**Revision notes:** Through round 6 (lock + required fingerprint unique, type-correct advisory lock). **Round 7 (delivery):** fingerprint unique must be preceded by an explicit **dry-run count + merge/dedup** of existing duplicate addresses — live data almost certainly already has near-duplicates from the pre-dedup era (§2.2). Plan is ready to build; Phase A+B implementation follows this doc.

---

## 1. Executive summary

The portal already has solid bones: OTP login, order list/detail, invoices, saved-address *model*, checkout prefill for logged-in users, and a mobile bottom tab bar.

What breaks the experience is not missing “pages” — it’s **missing loops**:

| Loop | Today | Should be |
|------|--------|-----------|
| Shop → Account | Buried in hamburger (`Sign in` only at `lg+`) | Always one tap (avatar / Account) |
| Portal → Store home | Desktop brand links to `/`; mobile header only goes to `/portal` | Explicit “Store” in chrome on both |
| Checkout → Saved address | Can *pick* saved addresses if logged in | Persist only with explicit consent; dedupe via defined match key |
| Profile details | `name` / `phone` exist in DB but **not editable** | Editable once, under Account (Security is devices-only) |
| Address book | Add / delete / default only | Full CRUD + atomic default invariant |

Until those loops close, customers will correctly report: *“my details aren’t saved”* and *“I can’t get home / to my account.”*

---

## 2. Current state (audited)

### 2.1 What exists

**Auth**
- Passwordless OTP via `/portal/login`
- Session refresh + keepalive
- Guest checkout still possible with email

**Portal routes**
- `/portal` — overview (orders summary, quick actions including Shop again → `/products`)
- `/portal/orders`, `/portal/orders/[orderNumber]`
- `/portal/documents` — invoices
- `/portal/addresses` — address book + hub links (Org, Circle, Security)
- `/portal/security` — email/phone **read-only**, device sessions
- `/portal/support`, `/portal/organization`, `/portal/circle`

**Data model (`Customer` / `CustomerAddress`)**
- Customer: `email`, `name?`, `phone?`
- Address: label, fullName, phone, line1/2, city, state, PIN, country, `isDefault`
- **No unique constraint** guaranteeing one default per customer today

**Checkout**
- If logged in, loads `savedAddresses` and lets user tap to fill the form
- Submits order with inline address payload
- **Does not write** a `CustomerAddress` row after successful payment
- **Does not update** `Customer.name` / `Customer.phone` from checkout

**Navigation**
- Desktop portal sidebar: brand → `/` (store home) ✅
- Mobile portal header: avatar → `/portal` only; **no store home** ❌
- Storefront header: Account / Sign in is `hidden … lg:inline-flex` — **invisible on phones** ❌
- Mobile storefront menu: Sign in / name exists after recent redesign ✅ (but only after opening the menu)
- Portal mobile tabs: Home(=portal), Orders, Invoices, Account(=addresses hub), Help

### 2.2 Confirmed gaps that match the complaint

1. **No easy account access while shopping on mobile**  
2. **Hard to leave portal for the storefront on mobile**  
3. **“Details aren’t being saved”** — no profile edit; checkout doesn’t persist addresses; no address edit; weak save feedback; default not enforced  
4. **Account IA confusion** — “Home” tab ≠ store home; “Account” tab lands on addresses hub  

---

## 3. Competitive benchmark (Amazon / Flipkart / Shopify / Nykaa)

### 3.1 Capability matrix

| Capability | Amazon / Flipkart | Shopify customer accounts | Cashmir today |
|------------|-------------------|---------------------------|---------------|
| Persistent account entry in header (mobile) | Avatar / “You” | Account icon | ❌ Desktop only in header |
| Store logo always returns to shop home | Yes | Yes | ⚠️ Portal desktop only |
| Editable profile (name, phone) | Yes | Yes | ❌ Read-only |
| Address book with edit | Yes | Yes | ⚠️ Add/delete only |
| Checkout: choose saved address | Yes | Yes | ✅ |
| Checkout: save this address | Default / checkbox | Usually yes | ❌ |
| Default address auto-selected | Yes | Yes | ⚠️ Only if flagged |
| Order → buy again | Yes | Often | ❌ |
| Track package from account | Yes | Carrier link | ⚠️ Partial |
| Returns / cancel request | Yes | Apps / flows | ❌ Support ticket only |
| Wishlist / save for later | Yes | Common | ❌ |
| Invoice download | Yes | Yes | ✅ |
| Device / session management | Limited | Rare | ✅ |

### 3.2 Copy first (highest ROI)

**P0** — Always-visible Account; Store escape hatch; editable profile; consent-correct checkout save; address CRUD + default invariant  
**P1** — Buy again; tracking CTA; wishlist; cancel/return *request*  
**P2** — CoA from order; hide empty Circle/Org; notification prefs  

**Defer:** stored cards / 1-click, full returns warehouse, recommendations  

---

## 4. Product principles

1. **One identity** — email OTP account is the source of truth for name, phone, addresses.  
2. **Save by default, respect opt-out** — checkbox defaults to on; if the user unchecks it, **never** write an address. (No silent override.)  
3. **Two homes, clearly labeled** — *Store* (`/`) vs *Account overview* (`/portal`). Never call both “Home.”  
4. **Mobile chrome parity** — anything desktop reaches in 1 click, mobile reaches in 1 tap **or** we keep the existing 1-tap surface (see §5.2 tab decision).  
5. **Progressive disclosure** — Org / Circle / Security live under Account, not in the primary tab bar.  
6. **Paid order > sync** — address/profile persistence after payment is best-effort and must never fail the order.  
7. **Authorize every mutation** — every address/profile action verifies `session.customerId` owns the row.

---

## 5. Proposed information architecture

### 5.1 Storefront header (mobile)

```
[ Logo → / ]     [ Account/Avatar ]  [ Cart ]  [ Menu ]
```

- Logged out: Account icon → `/portal/login?next=/portal`  
- Logged in: Initials avatar → **`/portal`** (same destination as Overview tab — see §5.2)  
- Keep hamburger for Shop / Tools / Patents / etc.  
- Do **not** hide Account behind the menu.

### 5.2 Portal chrome

**Desktop sidebar**
- Logo / “Cashmir Biotech” → `/` (Store)  
- Subtitle “Account”  
- Primary nav: Overview (`/portal`), Orders, Invoices, Addresses, Support  
- Secondary: Organisation, Research Circle, Security (devices)  
- Sign out  
- Profile fields live on `/portal/account`, linked from Overview + sidebar “Account details” — **not** duplicated as editable on Security  

**Mobile top bar**
- Left: “Store” (or logo) → `/`  
- Center: section title  
- Right: theme + Sign out  

**Mobile bottom tabs — decision (no silent Invoices demotion)**

Swapping Invoices for Store would turn a current **one-tap** path into **two taps**, conflicting with principle #4. Do **not** demote Invoices without usage data.

**Ship Phase A with this tab bar (preserve Invoices):**

| Tab | Route | Label |
|-----|-------|-------|
| 1 | `/portal` | Overview |
| 2 | `/portal/orders` | Orders |
| 3 | `/portal/documents` | Invoices |
| 4 | `/portal/account` | Account |
| 5 | `/portal/support` | Help |

**Store home access (still one tap, without killing Invoices):**
- Mobile top-bar **Store** control → `/`  
- Desktop sidebar brand → `/`  
- Overview quick action remains “Shop again” → `/products`  

**Optional A/B later (Phase A+):** if analytics show Store exits ≫ Invoice tab taps, test a 5th-slot swap or a center FAB. Do not assume.

**Landing destination consistency**
- Storefront avatar (logged in) → `/portal`  
- Bottom tab “Overview” → `/portal`  
- Same page. Do not invent a second landing route.

### 5.3 New `/portal/account` hub

Single mobile-friendly account home:

- **Your details** (name, phone, email) — edit here only  
- Addresses → `/portal/addresses`  
- Invoices → `/portal/documents`  
- Security → `/portal/security` (sessions / devices only)  
- Organisation / Circle (if membership exists; hide when empty — Phase D)  
- Sign out  

### 5.4 Security vs Account (reconcile overlap)

| Concern | Owner |
|---------|--------|
| Edit name / phone | `/portal/account` only |
| Email (read-only) + verified state | `/portal/account` (primary) and optional one-line on Security |
| Active sessions / revoke | `/portal/security` only |

**Change:** Remove editable-looking / “Not set” profile blocks from Security that imply management. Security becomes **Access & devices**. Account hub owns identity fields. One write path → no stale dual UI.

---

## 6. Functional requirements

### 6.1 Profile (Your details)

**Fields**
- Email — read-only (OTP identity)  
- Full name — editable  
- Phone — editable (**India-only for P0:** same 10-digit mobile rules as checkout; E.164 / international is explicitly out of scope until we ship outside India — see §6.10)  

**Behaviors**
- `updateCustomerProfileAction` updates only `Customer` where `id === session.customerId`  
- Prefill checkout contact from profile when logged in  
- After successful paid/created order (logged in): if profile name/phone empty, **best-effort** backfill from order contact (see §6.5 resilience)  

### 6.2 Address book

**CRUD:** create, **edit**, delete, set default  

**UX**
- Toast on success; refresh list; reset create form  
- Cards: Edit | Default | Remove (text actions)  

**Portal create/edit dedup (normative — same match key as checkout)**

`createPortalAddress` and `updatePortalAddressAction` must not leave two rows with the same match key for one customer (success metric: duplicate-address rate → ~0).

On **create:** run `upsertCustomerAddress` (or equivalent find-match → update vs create). Do not blindly insert.

On **update** of address `A` to new fields:
1. Assert owned.  
2. If another owned address `B` (`B.id !== A.id`) matches the new normalized fields → **reject** with a clear error: “You already have this address saved.” (Do not silently merge in P0 — merging could surprise which label/default wins; explicit merge can be Phase C+.)  
3. Else apply update + default invariant as usual.

Shared helper preferred: `findMatchingAddress(customerId, fields, { excludeId?: string })`.
**Default invariant — atomic rules (normative)**

All default changes run inside a **single DB transaction** via one helper: `withDefaultAddressInvariant(customerId, mutate)`.

| Event | Behavior |
|-------|----------|
| Create first address | Force `isDefault: true` (ignore client false) |
| Create subsequent | Honor `isDefault`; if true, clear others’ default in same txn |
| Set default | Clear all defaults for customer → set this id true (same txn) |
| Update address | If setting `isDefault: true`, same as set default |
| Delete non-default | Delete row |
| Delete current default | Delete row, then promote **most recently updated** remaining address (`orderBy updatedAt desc`); if none left, customer has zero defaults (valid) |
| Concurrent set-default | Transaction + row lock / updateMany pattern; last commit wins but never two `true` |

**Optional hardening (Phase B):** partial unique index  
`CREATE UNIQUE INDEX … ON CustomerAddress (customerId) WHERE isDefault = true`  
(Postgres) so the invariant cannot be violated even if a code path forgets the helper.

### 6.3 Address “upsert” — match key (normative)

**Problem to avoid:** every checkout with “Save” checked inserting a new row → “why do I have 5 Homes?”

**Match key (normalized equality), scoped to `customerId`:**

Normalize before compare:
- `line1`, `line2`, `city`, `state`, `postalCode`, `country`: trim, collapse internal whitespace, case-fold  
- `postalCode`: digits-only for India  
- `phone`: digits-only, drop leading country code `91` if 12 digits  
- `fullName`: trim + case-fold  
- **`label` is NOT part of the match key** (user may rename Home → Flat without forking a duplicate)

**Algorithm `upsertCustomerAddress(customerId, payload, { makeDefault })`:**

1. Authorize: caller already authenticated as `customerId`.  
2. Compute `fingerprint` from normalized match-key fields; find first address for this customer where fingerprint (or normalized fields) equals.  
3. **If found:** `update` that row (refresh fullName/phone/label/lines; keep fingerprint in sync; bump `updatedAt`; apply default invariant if `makeDefault`).  
4. **If not found:** `create` with fingerprint; on `P2002` unique violation → re-fetch by fingerprint and update (or portal collision per §6.2); apply default invariant (first address → default).  
5. Never create a second row for the same match key / fingerprint.

**Concurrency note:** check-then-act races are closed by **`UNIQUE (customerId, fingerprint)`** plus Prisma **native `upsert`** (`INSERT … ON CONFLICT`) via shared `upsertAddressWithinTx` — both portal `upsertCustomerAddress` and `syncAccountAfterOrder` call that helper inside their transaction. **Do not** catch `P2002` and continue on the same interactive `tx` (Postgres aborts the transaction). Portal edit collisions still pre-check + map boundary `P2002` to a user error after the txn rolls back.

**Checkout chip path — reuse vs edit-in-place (normative)**

Selecting a saved-address chip is **reuse**, not an implicit address-book edit.

| Checkout state | What happens to `CustomerAddress` |
|----------------|-----------------------------------|
| Chip selected, fields **unchanged** (normalized match to that row) | No address write required; optional `lastUsedAt` bump only. If `saveAddress` checked, still no duplicate insert. |
| Chip selected, user **tweaks any match-key field** for this order only | Treat as a **one-off delivery override**. Do **not** update the chip’s saved row. If `saveAddress` is checked → `upsert` by match key (may create a **new** row or update a different existing match). If unchecked → order ships to the override; address book unchanged. |
| Chip selected, user only changes **label** | Label is not in the match key. If `saveAddress` checked → update **that owned row’s label** only (explicit rename). If unchecked → ignore label for persistence. |
| No chip / “use a different address” | Blank form; upsert rules as above when save checked. |

**UI requirement:** once a chip is selected, show a clear secondary control:

```
Using: Home · 12 Dal Lake Rd
[ Use a different address ]
```

Editing fields after chip select does **not** show “Update saved address” unless we later add an explicit opt-in control (deferred; default is fork-on-change). Never conflate “reuse this address” with “edit my address book.”

Clear `selectedAddressId` on the client as soon as a match-key field diverges from the chip snapshot (UX convenience).

**Server backstop (normative — never trust the client for integrity):**

On payment-confirmed sync (and any checkout upsert entrypoint), if `selectedAddressId` is present:

1. `assertAddressOwned(customerId, selectedAddressId)` — else ignore id.  
2. Load that row; compare incoming shipping fields with `addressesMatch(...)`.  
3. **If match:** treat as unchanged reuse (optional `lastUsedAt`; no field overwrite unless only label rename with save on).  
4. **If mismatch:** **ignore** `selectedAddressId` for mutation purposes (same as client dirty). Apply save/consent rules as a normal upsert by match key — **never** `update` the chip row with divergent fields.  

Client clearing is convenience; server re-derivation is the correctness guarantee. A buggy or malicious client sending stale id + mutated payload must not overwrite the saved copy.

### 6.4 Checkout persistence & consent

UI on delivery step (logged in only):

```
☑ Save this address to my account   ← default checked
Label: [ Home ▼ ]                   ← Home / Work / Other
        └ when Other → text field “Custom label” (required, 1–40 chars)
```

**Label rules**
- Presets: `Home`, `Work`, `Other`  
- If preset is **Other**, show a required free-text input (placeholder e.g. “Mom’s house”, “Office 2”); persist that string as `CustomerAddress.label`, not the literal `"Other"`.  
- If user leaves Other blank → validation error before pay.  
- Portal address form uses the same preset + custom pattern for consistency.
**Consent rules (normative)**

| Situation | Save address? |
|-----------|----------------|
| Logged out | No (no account) |
| Logged in, checkbox **checked** | Yes — upsert per §6.3 |
| Logged in, checkbox **unchecked** | **No** — do not write `CustomerAddress`, even if address book is empty |
| Empty address book + first checkout | Checkbox still default **on**; copy explains “Save so you don’t retype next time.” If they uncheck, respect it. |
| First address ever, checkbox on | Saved as default |

**Do not** implement: “if no addresses exist, save even when unchecked.” That was removed as a consent bug.

**Profile backfill** (name/phone) is separate from address save: may run when order succeeds and profile fields are empty, regardless of address checkbox (contact details already submitted for the shipment). Document this in the checkout privacy line: “We’ll keep your name and phone on your account for future orders.”

### 6.5 Checkout resilience & sync trigger (normative)

**When sync may run (payment-gated)**

Cashmir creates an order row before / around Razorpay, then confirms payment via webhook / verification (`payment_confirmed` / status → `paid`, etc.).

Account sync (**profile backfill + address upsert**) runs **only when payment is confirmed** — not on mere pending order creation.

| Order state | Sync? |
|-------------|--------|
| `pending` / awaiting Razorpay / abandoned | **No** |
| Payment failed | **No** |
| Payment confirmed (`paid` or equivalent post-webhook success path) | **Yes** (best-effort) |
| Non-webhook success paths (today: Razorpay `test_skip_` / any future COD or zero-total that marks the order paid without a provider webhook) | **Yes** — call `syncWithBudget` from the **same server function that transitions the order to paid / successfully placed** (existing order-state / outbox `payment_confirmed` path), **before** returning success to the client. Do not invent a second ad-hoc call site. |

Hook the sync into the **existing payment-confirmation path** (e.g. outbox / `payment_confirmed` handler / order-state transition to paid) — one call site for webhook and non-webhook paid transitions, idempotent on `orderId` (safe if webhook retries).

**How to run sync on Amplify SSR / serverless (normative)**

Do **not** use un-awaited `void syncAccountAfterOrder(...).catch(...)`. After the response is sent, Amplify’s SSR Lambda (same class of problem as Vercel) may freeze or tear down the isolate and **silently drop** the work.

Allowed patterns (pick one for P0):

1. **Preferred P0:** `await syncAccountAfterOrder(...)` inside the payment-confirmation request, wrapped so failures are caught/logged and **do not** change the HTTP success already implied by payment handling. Latency is one/two small DB writes.  
2. **Alternative:** platform `waitUntil(syncAccountAfterOrder(...))` only if the host runtime exposes it and we verify it on Amplify; do not assume Vercel APIs exist here.  
3. **Later:** durable queue / outbox consumer (fits existing `outbox.service` patterns) — Phase C+ if await becomes a latency concern.

**Webhook ACK budget (normative — closes the await side-effect)**

Razorpay (and similar) expect a fast HTTP ACK. An unbounded `await sync…` that hangs on a slow DB pool can time out the webhook → provider retries → concurrent handlers racing idempotency.

**Important:** `Promise.race([sync…, sleep(budget)])` alone only stops *waiting* — it does **not** cancel the DB write. If you ACK after the race “wins” on timeout while `syncAccountAfterOrder` is still running, that promise becomes an **orphaned, un-awaited** continuation after the response — reintroducing the round-2 serverless freeze/drop risk on the exact slow path most likely to fail.

**Chosen P0 approach: (b) budgeted wait + explicit unknown + required idempotent column**

We accept that a timed-out sync may **finish or die non-deterministically** after ACK. The timeout protects webhook latency; it does **not** claim to cancel the write. Safety comes from:

1. Payment status transition / outbox `payment_confirmed` write remains the critical path and must complete first.  
2. Then `await` sync under a soft budget (target **≤ 400ms**; hard ceiling **800ms**) via `Promise.race`.  
3. On **success within budget:** set `Order.accountSyncedAt = now()` in the same sync txn (or immediately after successful writes).  
4. On **timeout or rejection before ACK:**  
   - Do **not** set `accountSyncedAt`.  
   - Log `checkout_account_sync_timeout` or `checkout_account_sync_failed` with `sync_status: "unknown"` (may still complete in-flight, or Amplify may drop it).  
   - Still return **200** to Razorpay.  
5. On webhook **retry** / later reconciliation: if `accountSyncedAt` is set → no-op. If null → attempt sync again (under concurrency control below).  
6. Do **not** imply the timeout aborts Postgres statements. Optional later: statement_timeout inside the sync txn, or move sync to outbox consumer if timeout rates are high.  
7. Do **not** change webhook HTTP status away from success once payment is recorded.

**Concurrency: orphan + retry can run together (normative — closes the round-4 gap)**

Accepting non-deterministic orphans means **two `syncAccountAfterOrder` calls for the same `orderId` can overlap**: the lingering timed-out invocation and a webhook retry that still sees `accountSyncedAt = null`. The null-check is check-then-act and is **not** sufficient alone. The find-then-create upsert in §6.3 is also not atomic without a lock or unique constraint — concurrent creates can both miss a match and insert duplicates, breaking the §10 duplicate-address metric.

**Phase B required: Postgres advisory lock around the sync body**

```
syncAccountAfterOrder(orderId):
  1. BEGIN
  2. -- hashtext() returns int4; single-arg pg_advisory_xact_lock expects bigint.
  -- Prefer either:
  SELECT pg_advisory_xact_lock(
    hashtext('account_sync'),
    hashtext(orderId::text)
  );  -- two-arg form (int4, int4)
  -- or: SELECT pg_advisory_xact_lock(hashtextextended('account_sync:' || orderId, 0));  -- bigint
  3. Re-read order; if accountSyncedAt IS NOT NULL → COMMIT / return (no-op)
  4. Profile backfill + address upsert (match-key + fingerprint) as today
  5. SET accountSyncedAt = now()
  6. COMMIT
```

Rules:
- Lock key is **per `orderId`** (not only customerId) so unrelated orders don’t serialize.  
- Second concurrent caller **blocks** until the first finishes, then sees `accountSyncedAt` and no-ops — or, if the first timed out client-side but the DB txn still holds the lock, the retry waits rather than racing creates.  
- Prefer **transaction-scoped** `pg_advisory_xact_lock` so a crashed backend can’t leave a session lock stranded.  
- The early `accountSyncedAt` read must happen **after** acquiring the lock (not before).  
- Do **not** call `pg_advisory_xact_lock(hashtext(...))` with one `int4` argument — type mismatch at runtime.

**Phase B required: fingerprint unique index (covers sync-vs-portal and any cross-path race)**

The orderId advisory lock only serializes **sync vs sync**. A portal `createPortalAddress` / address-book edit does **not** take that lock. An orphaned or delayed sync can still race a concurrent portal create through the same find→create window — same duplicate-address failure mode, different callers.

**Required:** `CustomerAddress.fingerprint` = stable hash of the **normalized match-key fields** (same fields as §6.3; label excluded), plus `UNIQUE (customerId, fingerprint)`.

On create:
1. Attempt insert with computed fingerprint.  
2. On unique violation (`P2002`): re-fetch the existing row for that `(customerId, fingerprint)` and **update** it (sync path) or return a collision error (portal create/update that should not overwrite another row’s identity — follow §6.2 collision rules).  

This does **not** replace the advisory lock for sync orchestration; the lock keeps orphan+retry from double-running profile/stamp work. The fingerprint unique is the **only** DB guard that works when callers do not share a lock key.

```
1. Payment confirmed → order status updated (must succeed)
2. result = await race(syncAccountAfterOrder(orderId) /* holds advisory lock */, budget 400ms)
3. if success → accountSyncedAt set; if timeout/fail → log sync_status: "unknown"
4. Return webhook ACK 200
```

**Rejected for P0 without more infra:** treating AbortController / statement timeout as the *sole* safety story.

Inside `syncAccountAfterOrder`:
- Acquire **advisory xact lock** on `orderId` (required; type-correct form above)  
- **Re-read** order; early exit if `accountSyncedAt` is non-null  
- Profile backfill if name/phone empty  
- Address upsert only if `saveAddress === true` (writes fingerprint; handles `P2002`)  
- On full success: set `accountSyncedAt`  
- Log failures/timeouts with `sync_status: "unknown"` when applicable  
- Lock (sync-vs-sync) + fingerprint unique (any writer) keep duplicates out under retry/orphan and sync-vs-portal races

**Consent flag survival:** because sync runs on the webhook (not the browser create-order response), store `saveAddress`, `addressLabel`, and normalized shipping snapshot (or `selectedAddressId`) on the order at create time so confirmation can read them without trusting the client again.

### 6.6 Authorization / IDOR (normative)

Every portal mutation **must**:

1. `customer = await requireCustomerSession()`  
2. For address ops: `findFirst({ where: { id: addressId, customerId: customer.id } })` — if null → `{ error: "Address not found." }` (same message for missing and not-owned; no existence leak)  
3. Never `update({ where: { id } })` without `customerId` in the where clause  
4. Profile update: `update({ where: { id: customer.id }, data: { name, phone } })` only  

Apply to: create, update, delete, setDefault, and checkout upsert (uses session customer id only).

### 6.7 Rate limiting (backlog note — not P0-blocking)

IDOR checks authorize *who*; they do not stop *abuse volume*.

| Surface | Guidance |
|---------|----------|
| OTP request/verify | Already rate-limited (keep; do not regress) |
| Profile update | Soft limit per customer (e.g. Upstash): ~20/min — backlog if missing |
| Address create/update/delete | Soft limit per customer: ~30/min — backlog |
| Checkout sync | Idempotent on orderId; no extra public endpoint |

Add a QA/backlog ticket; not required to close Phase B exit criteria.

### 6.8 Guest order → account claim (P1 — full spec)

**Trigger:** After successful OTP login/verify, if customer has `orders` placed as guest with the **same email** and those orders’ shipping snapshots are not yet represented in `CustomerAddress`.

**Matching key:** `Order.customerEmail` (normalized) === `Customer.email` **and** `Order.customerId` is null **or** already linked to this customer after claim-on-login. Prefer linking guest orders to `customerId` on OTP if not already linked (existing behavior if any — preserve).

**Address claim:**
- Source: shipping fields stored on the order (not a free-form guess)  
- For each distinct normalized shipping snapshot, run `upsertCustomerAddress`  
- **Not silent forever:** show a one-time banner on `/portal` or `/portal/account`:  
  “We found N addresses from previous orders. **Add to your address book?** [Add] [Not now]”  
- **Add** = explicit confirmation; then upsert  
- **Not now** = dismiss; set `Customer.addressClaimPromptDismissedAt` (add nullable field in P1 migration) so we don’t nag every login  
- Never attach addresses without that confirmation (historical PII → account is a trust moment)

### 6.9 Navigation fixes

| Surface | Change |
|---------|--------|
| Storefront header all breakpoints | Account / avatar always visible |
| Portal mobile header | **Store** → `/` |
| Portal mobile tabs | Keep Invoices; Account → `/portal/account`; Overview → `/portal` |
| Portal desktop | Brand → `/`; subtitle Account |
| Avatar & Overview | Both land on `/portal` |

### 6.10 Phone / locale assumption (normative)

**P0 store is India-only.** Checkout and profile use Indian 10-digit mobile validation (optional leading `+91` / `91` stripped for storage compare).

- Document in helper text if useful (“Indian mobile number”).  
- International E.164 is **out of scope** until we expand shipping countries.  
- **Shared validator now (P0):** implement one function, e.g. `src/lib/customer/phone-in.ts` → `parseIndianMobile(input) → { ok, digits } | { ok: false, error }`, imported by checkout validation **and** `updateCustomerProfileAction` / profile form. Do not copy-paste two regexes that will drift. When international ships, extend this module (country-aware) rather than forking again.

### 6.11 Order convenience (Phase C)

- **Buy again:** multi-line add to cart from order detail (skip inactive/missing products); primary CTA on detail.  
- **Track:** shared `trackingHref(carrier, awb)` for portal + email; primary “Track package” when AWB present; overview Tracking deep-links in-transit orders.  
- **Cancel / return request:** support topics `cancel_order` / `return_request`; deep-link `/portal/support?order=…&intent=cancel|return`; verifies order ownership; does **not** mutate `Order.status` (ops uses admin).  
- **Wishlist:** `CustomerWishlistItem` unique `(customerId, productId)`; PDP heart; `/portal/wishlist` with add-all-to-cart.  
- Invoice CTA above progress on mobile order detail.  

---

## 7. UX / UI notes (mobile-first)

- Account hub + address editor: single column, ≥44px targets  
- After save: Sonner toast + list refresh (don’t rely on muted inline text)  
- Empty states with one CTA  
- Checkout: if address book empty, checkbox helper text clarifies first-save benefit; uncheck remains available  

---

## 8. Technical approach

### 8.1 Backend

```
src/lib/customer/addresses.ts
  normalizeAddressFields(input) → NormalizedAddress
  addressesMatch(a, b) → boolean
  findMatchingAddress(customerId, fields, { excludeId? })
  withDefaultAddressInvariant(tx, customerId, fn)
  upsertCustomerAddress(customerId, payload, opts)  // sets fingerprint; P2002 → re-fetch/update or collide
  assertAddressOwned(customerId, addressId) → address | null
  resolveCheckoutAddressMutation(...)  // server chip dirty re-derive §6.3
  syncAccountAfterOrder(orderId)       // advisory xact lock → re-read accountSyncedAt → work → stamp
  addressFingerprint(normalized) → string

src/lib/customer/phone-in.ts
  parseIndianMobile(input) → result   // shared by checkout + profile
```

Portal actions:
- `updateCustomerProfileAction` — ownership = session id; phone via `parseIndianMobile`  
- `createPortalAddress` / `updatePortalAddressAction` / `delete` / `setDefault` — assert + invariant + **match-key collision check on create/update** (§6.2)  

Checkout / order service:
- Persist `saveAddress`, label (incl. custom Other), shipping snapshot, optional `selectedAddressId` on order at create  
- On **payment confirmed** path only (webhook **and** non-webhook paid transitions such as `test_skip_`): `await syncWithBudget(orderId, { ms: 400 })` — timeout/fail → log `sync_status: "unknown"`, leave `accountSyncedAt` null; response still success  
- Inside sync: **advisory lock → re-read `accountSyncedAt` → upsert → stamp** (§6.5)  
- Retry/idempotency gate: **lock + `accountSyncedAt`** (required)  
- **Forbidden:** starting sync *after* the response is returned; timed-out in-flight work is acknowledged as non-deterministic, not “cancelled”  

### 8.2 Frontend

- `PortalProfileForm` on `/portal/account`  
- `PortalAddressForm` modes: `create` | `edit`  
- Checkout: `saveAddress` (default true) + label presets; **Other → required custom label field**; chip select with “Use a different address”; clear `selectedAddressId` when match-key fields diverge  
- Shared `parseIndianMobile` in profile + checkout client/server validation  
  
- `SiteNav` account control all breakpoints  
- `PortalShell` Store link; tabs per §5.2; Security copy trimmed  

### 8.3 Data / migrations

**Phase B (required):**
- Partial unique index on `(customerId) WHERE isDefault` (Postgres)  
- **`Order.accountSyncedAt DateTime?`** — set only after a fully successful sync; null means “not confirmed synced”. **Required** idempotency gate.  
- **Advisory lock in `syncAccountAfterOrder`** (per `orderId`, transaction-scoped) — **required** so orphan + retry cannot double-create addresses (§6.5 concurrency).  
- **`CustomerAddress.fingerprint` + `UNIQUE (customerId, fingerprint)`** — **required** cross-path duplicate fence. **Do not** add the unique index until after the merge step below — production almost certainly already has near-duplicates (§2.2 / §3.1).

**Fingerprint migration sequence (normative — don’t get surprised in staging)**

Live checkout/portal never had match-key dedup. Enabling `UNIQUE (customerId, fingerprint)` on backfilled rows **will fail** if duplicate groups already exist. **Two migrations + a human gate** enforce this (not deploy-order folklore):

| Step | Artifact |
|------|----------|
| 1. Add nullable fingerprint + Order sync columns + default partial unique (**no pgcrypto**) | `prisma/migrations/20260725120000_account_address_fingerprint/` |
| 2. Marker migration (merge deferred to Node) | `prisma/migrations/20260725121000_account_address_fingerprint_merge_unique/` |
| 3. **Node ensure** — sha256 backfill (matches JS), count surplus, merge when allowed, `NOT NULL` + UNIQUE | `scripts/ensure-address-fingerprints.cjs` (Amplify runs after `migrate deploy`) |
| 4. Optional dry-run review | `npx tsx scripts/count-address-fingerprint-dupes.ts` |

Amplify app DB roles often **cannot** `CREATE EXTENSION pgcrypto`, so SQL `digest()` backfill is not used. Local/staging can still run the count script before setting `ALLOW_ADDRESS_FINGERPRINT_MERGE=1` for a cautious cutover; Amplify build sets that flag and logs surplus before merging.

Dry-run SQL (same as the script):

```sql
-- How many duplicate groups exist?
SELECT "customerId", fingerprint, COUNT(*) AS n
FROM "CustomerAddress"
WHERE fingerprint IS NOT NULL
GROUP BY "customerId", fingerprint
HAVING COUNT(*) > 1
ORDER BY n DESC;

-- Total surplus rows that would block UNIQUE
SELECT COALESCE(SUM(n - 1), 0) AS surplus_rows
FROM (
  SELECT COUNT(*) AS n
  FROM "CustomerAddress"
  WHERE fingerprint IS NOT NULL
  GROUP BY "customerId", fingerprint
  HAVING COUNT(*) > 1
) d;
```

Log the counts in the migration runbook / deploy notes. If surplus is large, review a sample before merge.  
Step 3’s merge SQL keeps one survivor per `(customerId, fingerprint)` (prefer default, else latest), re-asserts ≤1 default, then sets `fingerprint NOT NULL` + unique index. Re-run the count script after merge — expect surplus **0**. App code relies on Prisma native `upsert` on that unique (not catch-`P2002`-inside-`tx`).

**Also in Phase B migrations (can be separate):**
- Partial unique on default address (created in step-1 migration; documented on `CustomerAddress` in `schema.prisma`)  
- `Order.accountSyncedAt`

**Phase B (optional):**
- `CustomerAddress.lastUsedAt`  
- Statement-level timeout / outbox promotion if timeout logs spike  

**Phase P1:**
- `Customer.addressClaimPromptDismissedAt DateTime?`

### 8.4 QA checklist (expanded)

**Automation:** `npm test` runs `src/lib/customer/address-account.test.ts`, `portal-idor-sync.test.ts`, and `portal-account-qa.test.ts` for consent/chip/phone/nav/schema/IDOR policy/sync hooks/marketing recipients. Remaining items need staging browser + live DB (marked **manual**).

**Happy path**
- [x] Consent/chip/save-off encoded in `resolveCheckoutAddressMutation` tests  
- [x] Shared `parseIndianMobile` tests  
- [x] Mobile avatar / Store / Overview / Account routes encoded in policy tests  
- [ ] **manual** Portal save address → appears at checkout  
- [ ] **manual** Checkout save on → one portal row; second identical checkout updates same row  
- [ ] **manual** Checkout save off → order OK; address book unchanged  
- [ ] **manual** Edit address → chips/checkout reflect change  
- [ ] **manual** Profile edit → checkout contact prefills  

**Default invariant**
- [x] Partial unique + merge migration present in SQL  
- [ ] **manual** First address always default / set default / delete promote / last delete  

**Upsert / consent**
- [x] Chip dirty / label-only / save-off unit tests  
- [x] Other label custom-text gate (checkout source)  
- [ ] **manual** Portal edit Address A to match Address B → rejected  

**Security**
- [x] IDOR: delete/update/assert owned helpers + actions source policy  
- [x] Support ticket order ownership check  
- [ ] **manual** Live cross-customer addressId attempt  

**Resilience / trigger**
- [x] `syncWithBudget` + advisory lock + `accountSyncedAt` policy  
- [x] `markOrderPaid` hooks sync  
- [x] Idempotent early-exit when `accountSyncedAt` set (unit)  
- [ ] **manual** Webhook timeout / concurrent orphan+retry on staging  

**Migrations / cutover**
- [x] Split migrations: backfill (`…120000`) then merge+unique (`…121000`) with count-script gate  
- [ ] **manual** Staging dry-run count + surplus log + sign-off before merge migrate on prod  

**Marketing / toasts**
- [x] Campaign send uses `listMarketingRecipientEmails` (honors `notifyMarketing`)  
- [x] Portal Sonner toasts on profile/address/prefs/claim  

**Claim (P1)**
- [x] Schema + banner + actions present  
- [ ] **manual** Guest orders + OTP → banner; dismiss persists; Add dedupes  

**Rate limit (backlog)**
- [ ] Ticket filed for profile/address mutation limits if not already covered  

---

## 9. Phased delivery plan

### Phase A — Navigation & access

1. Storefront Account/avatar all breakpoints  
2. Portal mobile **Store** → `/`  
3. Tabs: Overview · Orders · **Invoices** · Account · Help (Invoices retained)  
4. `/portal/account` hub  
5. Security trimmed to devices; profile editing surface lives on Account only  

**Exit:** Shop → account in one tap; portal → store home in one tap; avatar === Overview destination.

### Phase B — Persistence (blocked on §6.2–6.6 + §6.3 chip rules being implemented as specified)

1. Profile edit actions + UI  
2. Address edit + toast UX  
3. Default invariant helper (+ partial unique index)  
4. Checkout save checkbox (default on, honor off) + match-key upsert + chip fork-on-edit + server dirty backstop  
5. Best-effort **awaited** sync on **payment-confirmed** path with **≤400ms budget**; timeout → `sync_status: "unknown"` + null `accountSyncedAt`  
6. **Advisory lock** inside sync (per `orderId`) so orphan + retry cannot race creates  
7. **Fingerprint unique** so sync-vs-portal (and any cross-path) cannot double-create  
8. IDOR tests; portal edit collision; shared `parseIndianMobile`; Other → custom label  
9. Migration: **`accountSyncedAt` + default partial unique + fingerprint column → dry-run count → merge duplicates → then unique** (all required; see §8.3 sequence)  

**Exit:** One logged-in **paid** order with save on → profile + single address; save off → order only; no duplicates under retry/orphan **or** sync-vs-portal concurrency; chip dirty cannot overwrite saved copy; webhook ACK stays fast; retries idempotent via lock + `accountSyncedAt`; staging dry-run shows known surplus before merge.

### Phase C — Order habits

Buy again (multi-line → cart); tracking deep links; cancel/return **request** via support; wishlist (PDP + `/portal/wishlist`). See §6.11.  

### Phase D — Biotech + claim

CoA from order (lot-preferring downloads + request); hide empty Org/Circle in nav/account; notification prefs (`notifyOrderUpdates` / `notifyMarketing`); guest address claim banner (§6.8).  

---

## 10. Success metrics

- % logged-in checkouts with `saveAddress=true` that yield exactly one new-or-updated address (not N dupes)  
- % customers with non-null name + phone after first logged-in order  
- Duplicate-address rate (same match key, count > 1) → target ~0  
- Mobile taps: PDP → `/portal` = 1; `/portal/orders` → `/` = 1  
- Support volume: “address not saved” / “can’t find account”  

---

## 11. Out of scope

- OTP redesign; admin CRM overhaul; full returns warehouse; native apps; stored cards  

---

## 12. Recommended next step

Implement **Phase A + Phase B** together, but Phase B must ship the helpers in §6.2–6.6 **and** chip fork rules in §6.3 **before** wiring payment-confirmed sync.

Build order:

1. `SiteNav` account affordance  
2. `PortalShell` Store link + tabs + `/portal/account` + Security trim  
3. `lib/customer/addresses.ts` (normalize, match, invariant, upsert, assertOwned)  
4. Profile + address CRUD actions (IDOR-safe)  
5. Checkout `saveAddress` + chip dirty handling + **awaited budgeted** sync on payment-confirmed path  
6. Shared `parseIndianMobile`; Other → custom label  

---

## Appendix A — Review disposition

### First review

| # | Review finding | Resolution |
|---|----------------|------------|
| 1 | Upsert match key undefined | §6.3 normalized field equality; label excluded |
| 2 | Silent save vs unchecked | Removed; §6.4 consent table; principle #2 |
| 3 | Default invariant weak | §6.2 atomic helper + delete promotion + optional unique index |
| 4 | IDOR not stated | §6.6 + principle #7 + QA |
| 5 | Upsert fail vs paid order | §6.5 best-effort; must not fail payment path |
| 6 | Invoices tab regression | §5.2 keep Invoices; Store via top bar |
| 7 | Security vs Account overlap | §5.4 single edit surface |
| 8 | Guest claim underspecified | §6.8 match key + explicit confirm banner |
| 9 | Avatar vs Overview | Both → `/portal` |
| 10 | QA gaps | §8.4 expanded |

### Second review

| # | Review finding | Resolution |
|---|----------------|------------|
| 1 | Un-awaited sync dies on serverless | §6.5 / §8.1: **await** inside payment-confirmed path; `void` forbidden on Amplify SSR |
| 2 | Chip edit overwrites saved address | §6.3: fork-on-change; clear `selectedAddressId` when dirty; “Use a different address” |
| 3 | Sync before payment | §6.5: sync only on payment confirmed / successfully placed; not `pending` |
| 4 | India-only phone implicit | §6.10: India-only normative for P0; international deferred |
| 5 | No rate limits on mutations | §6.7 backlog note; OTP already limited |

### Third review

| # | Review finding | Resolution |
|---|----------------|------------|
| 1 | Awaited sync can hang webhook | §6.5: budgeted wait ≤400ms; ACK still 200 |
| 2 | Client-only dirty clearing | §6.3 server backstop: re-`addressesMatch`; ignore id if mismatch |
| 3 | Portal edit skips dedup | §6.2: create via upsert; update rejects collision |
| 4 | Shared phone validator deferred | §6.10: `parseIndianMobile` required in P0 |
| 5 | Other label underspecified | §6.4: Other → required custom label |

### Fourth review

| # | Review finding | Resolution |
|---|----------------|------------|
| 1 | `Promise.race` doesn’t cancel the write | §6.5: approach **(b)** — timeout does not abort; `sync_status: "unknown"`; reconcile via retry + `accountSyncedAt` |
| 2 | `accountSyncedAt` listed optional while idempotency required | §8.3: **Phase B required** |

### Fifth review

| # | Review finding | Resolution |
|---|----------------|------------|
| 1 | Orphan + retry can double-create addresses | §6.5: required `pg_advisory_xact_lock` per `orderId` around sync; re-read `accountSyncedAt` after lock |
| 2 | COD / non-webhook “placed” moment vague | §6.5 table: sync from same paid-transition function as webhook (order-state / outbox); includes today’s `test_skip_` path |

### Sixth review

| # | Review finding | Resolution |
|---|----------------|------------|
| 1 | OrderId lock doesn’t cover sync vs portal create | §6.5 / §8.3: fingerprint + `UNIQUE (customerId, fingerprint)` **Phase B required**; upsert catches `P2002` |
| 2 | `hashtext` → single-arg advisory lock type mismatch | §6.5: two-arg `(hashtext, hashtext)` or `hashtextextended` → bigint |

### Seventh review

| # | Review finding | Resolution |
|---|----------------|------------|
| 1 | Fingerprint UNIQUE will fail on existing near-duplicates | §8.3: ordered migration — backfill → dry-run count → merge/dedup → re-count zero → then UNIQUE |

---

## Appendix B — File map (current)

| Area | Primary files |
|------|----------------|
| Portal chrome | `src/components/portal/portal-shell.tsx` |
| Addresses UI | `src/app/(portal)/portal/(session)/addresses/page.tsx`, `portal-address-form.tsx` |
| Portal actions | `src/app/(portal)/portal/(session)/actions.ts` |
| Security | `…/security/page.tsx` |
| Checkout | `src/components/shop/checkout-view.tsx`, order create API/service |
| Storefront nav | `src/components/experience/site-nav.tsx` |
| Schema | `prisma/schema.prisma` → `Customer`, `CustomerAddress` |
| **New (Phase B)** | `src/lib/customer/addresses.ts`, `src/lib/customer/phone-in.ts` |
