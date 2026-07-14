# Orders, Product Page & Razorpay Payment Integration — Structure & Instructions

This covers turning your current **Catalog** (`/products`) into a real **ordering system**: product page → cart/checkout → Razorpay payment → order created in DB → connected to your **Admin Orders panel** → connected to **Inventory** (from the previous doc). Logic + security only, no UI code, as requested.

---

## 1. Product Page (`/products/:id`) — What It Needs

Based on your current catalog card (image, badge, title, tagline, description, weight, price, availability), the full product page should expose:

**Data fields (from `products` + `inventory` tables):**
- Product images (gallery, not just one)
- Title, tagline, full description
- SKU (internal, can be hidden from customer UI but must exist)
- Price (MRP + selling price if you want discounts)
- Weight/variant info (250g, 500g, etc. — if variants exist, each is its own SKU)
- Stock status — pulled live from `inventory.quantity_available`:
  - `available` → show "Add to Cart"
  - `low stock` (below threshold) → show "Only X left"
  - `0` → show "Currently Unavailable" (like your screenshot) and disable ordering
- Category/tags (Functional Food, Featured, etc.)
- Reviews/ratings (optional, later)

**Functional requirements:**
- "Add to Cart" button must be **disabled server-side too**, not just UI — never trust the frontend to block an out-of-stock purchase.
- Quantity selector should cap at `quantity_available`, re-validated on the backend at checkout.
- Price shown to the user must always be re-fetched/re-validated from DB at checkout — never trust a price sent from the client.

---

## 2. Cart & Checkout Flow (Logic)

```
Product Page → Add to Cart → Cart Page → Checkout → Payment (Razorpay) → Order Confirmed
```

### 2.1 Cart
- Cart can live in frontend state (localStorage/session) pre-login, but at checkout time, **recompute everything server-side**:
  - Re-check each item's `product_id`/`sku` exists and is active
  - Re-check `quantity_available >= requested_qty`
  - Re-fetch current price from DB (ignore any price sent from client)
- Never accept a total amount from the frontend — always calculate it server-side from DB prices.

### 2.2 Checkout (before payment)
1. Customer submits: cart items (product_id + qty only), shipping address, contact info.
2. Backend validates stock availability again (see Inventory doc — this is where you call `reserveStock()`).
3. Backend calculates final order total (items + shipping + tax) — server-side only.
4. Backend creates a `pending` order row in your `orders` table with a unique `order_reference`.
5. Backend creates a **Razorpay Order** (see section 3) using that same total.
6. Return the Razorpay order ID + amount to frontend to launch Razorpay Checkout.

---

## 3. Razorpay Integration

### 3.1 Server-side: Create Razorpay Order
- Use Razorpay's `orders.create` API with:
  - `amount` (in paise, i.e. ₹350 → 35000) — **calculated server-side, never from client**
  - `currency: "INR"`
  - `receipt`: your internal `order_reference`
- Store the returned `razorpay_order_id` on your internal order row.

### 3.2 Client-side: Launch Checkout
- Load Razorpay Checkout.js on the frontend, pass it the `razorpay_order_id`, `amount`, `key_id` (public key only — never expose the secret key on frontend).
- On success, Razorpay returns: `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`.

### 3.3 Server-side: Verify Payment (critical security step)
**Never mark an order as paid just because the frontend says "payment succeeded."** The frontend response can be spoofed. You must verify:

1. Compute HMAC SHA256 of `razorpay_order_id + "|" + razorpay_payment_id` using your **Razorpay Key Secret**.
2. Compare it to the `razorpay_signature` sent from frontend.
3. If it matches → payment is genuine → proceed. If not → reject and flag as suspicious.

### 3.4 Webhooks (do this in addition to step 3.3, not instead of)
- Configure a Razorpay webhook endpoint (e.g. `/api/webhooks/razorpay`) for events like `payment.captured`, `payment.failed`, `refund.processed`.
- Verify the webhook signature using your **Webhook Secret** (different from the API key secret) before trusting the payload.
- This is your source of truth for payment status — the browser-side confirmation can fail to reach your server (user closes tab, network drop), so webhooks are your safety net to still mark the order paid/failed correctly.
- Make webhook handling **idempotent** — Razorpay may send the same event more than once; check if you've already processed that `event.id` before acting on it again.

### 3.5 On Successful Payment
1. Update internal order status: `pending` → `paid`.
2. Call `inventoryService.deductStock(orderItems)` (from Inventory doc) to finalize stock deduction.
3. Insert transaction log entry.
4. Trigger order confirmation email/notification.

### 3.6 On Failed/Cancelled Payment
1. Update order status: `pending` → `payment_failed`.
2. Call `inventoryService.releaseStock(orderItems)` to release the reservation back.
3. Optionally auto-expire pending orders after X minutes (cron job) that never completed payment, releasing their reserved stock.

---

## 4. Order Data Model

### `orders` table
| Column | Notes |
|---|---|
| `id` | PK |
| `order_reference` | your internal unique order number shown to customer |
| `user_id` | FK, nullable if guest checkout allowed |
| `status` | `pending`, `paid`, `payment_failed`, `processing`, `shipped`, `delivered`, `cancelled`, `returned` |
| `subtotal`, `tax`, `shipping_fee`, `total_amount` | all server-calculated |
| `razorpay_order_id` | from section 3.1 |
| `razorpay_payment_id` | filled after successful payment |
| `shipping_address` (JSON or separate table) | |
| `created_at`, `updated_at` | |

### `order_items` table
| Column | Notes |
|---|---|
| `id` | PK |
| `order_id` | FK |
| `product_id` / `sku` | FK to products/inventory |
| `quantity` | |
| `unit_price` | price **at time of order**, not live product price (so historical orders stay accurate even if you change prices later) |

### `payment_events` table (recommended, for audit)
Log every webhook/payment callback received: `event_type`, `razorpay_event_id`, `payload`, `processed_at`, `signature_valid`. Helps debugging payment disputes later.

---

## 5. Connecting to Admin Orders Panel

- Admin Orders page reads directly from `orders` + `order_items`, joined with `products` for display.
- Admin actions (ship, cancel, mark returned) should **only change `orders.status`**, and that status change should trigger the correct `inventoryService` call (from the Inventory doc):

| Admin Action | Order Status Change | Inventory Call |
|---|---|---|
| Mark as Shipped | `processing` → `shipped` | none |
| Mark as Delivered | `shipped` → `delivered` | none |
| Cancel Order | any → `cancelled` | `releaseStock()` or `restoreStock()` depending on whether stock was already deducted |
| Mark as Returned | `delivered` → `returned` | `restoreStock()` |
| Refund | triggers Razorpay Refund API | log in `payment_events`, then run cancel/return inventory logic |

Centralize this the same way as before: an `orderService.updateStatus(orderId, newStatus)` function that internally calls the right inventory function — don't let the admin UI call inventory functions directly.

---

## 6. Security Checklist

**Payment security**
- [ ] Razorpay **Key Secret** and **Webhook Secret** live only in backend environment variables — never in frontend code or committed to git.
- [ ] Always verify `razorpay_signature` server-side (section 3.3) before marking paid.
- [ ] Always verify webhook signatures separately using the webhook secret.
- [ ] Make webhook processing idempotent (dedupe by `event.id`).
- [ ] Never trust `amount` from the frontend — always recalculate server-side.
- [ ] Use HTTPS everywhere (Razorpay requires it in production, and payment data must never travel over plain HTTP).

**Order/API security**
- [ ] Rate-limit checkout/order-creation endpoints to stop abuse/bot order spam.
- [ ] Require authentication (or at least a validated session/guest token) to create or view orders — a customer should never be able to fetch another customer's order by guessing an ID (use non-sequential order IDs/UUIDs, and check ownership server-side).
- [ ] Validate and sanitize all input (address fields, quantities, etc.) server-side — don't rely on frontend form validation alone.
- [ ] Use atomic stock checks (see Inventory doc, section 6) to prevent overselling under concurrent checkouts.
- [ ] Log all order status transitions with timestamp + actor (admin user or system) for auditability.
- [ ] Admin-only endpoints (status updates, refunds) must check admin role/auth, not just "logged in."
- [ ] CSRF protection on any state-changing endpoint if using cookie-based sessions.
- [ ] Set up request timeouts/retries for Razorpay API calls, and handle network failures gracefully (don't leave orders stuck in limbo — have a cron job to reconcile `pending` orders older than X minutes by checking their status directly with Razorpay's API).

---

## 7. Suggested Build Order

1. Extend `products` page/API to serve full product detail (section 1).
2. Build cart logic (frontend state is fine, but re-validate everything server-side at checkout).
3. Build `orders` + `order_items` + `payment_events` tables.
4. Build checkout endpoint: validate stock → calculate total → create internal `pending` order → create Razorpay order → return to frontend.
5. Integrate Razorpay Checkout.js on frontend.
6. Build payment verification endpoint (signature check, section 3.3).
7. Build Razorpay webhook endpoint (section 3.4) as the reliable source of truth.
8. Wire successful/failed payment outcomes into `inventoryService` calls.
9. Build `orderService.updateStatus()` and wire it into your Admin Orders panel actions.
10. Add the security checklist items (section 6) — do this before going live, not after.
11. Add a cron job to auto-expire/reconcile stuck `pending` orders.

---

## 8. Data Flow Diagram (text form)

```
[Customer on Product Page] --> Add to Cart --> [Cart]
        |
        v
   [Checkout Submitted: items + address]
        |
        v
 Backend: re-validate stock + recalculate total (server-side only)
        |
        v
 inventoryService.reserveStock(items)   --> inventory.quantity_reserved += qty
        |
        v
 Create internal order (status = pending)
        |
        v
 Create Razorpay Order (amount from server calc)
        |
        v
 [Frontend launches Razorpay Checkout]
        |
        v
 Customer pays --> Razorpay returns payment_id + signature
        |
        v
 Backend verifies signature (3.3) AND/OR receives webhook (3.4)
        |
        +--> Valid & captured --> order.status = paid
        |         --> inventoryService.deductStock(items)
        |         --> shows up in Admin Orders panel
        |
        +--> Failed/invalid --> order.status = payment_failed
                  --> inventoryService.releaseStock(items)

[Admin Panel] --> updateStatus(orderId, "shipped"/"cancelled"/"returned")
        --> orderService triggers matching inventoryService call automatically
```

---

This keeps Products → Orders → Payments → Inventory as one connected chain, with Razorpay verification and webhooks as the security backbone so payment status is never trusted blindly from the browser.
