# Inventory Management System — Structure & Logic

This document describes how to add an **Inventory Management** module to your admin panel so it connects to your existing **Products** and **Orders** tools. No UI included — just data structure, relationships, and the logic that keeps stock accurate automatically.

---

## 1. Core Idea

Right now you probably have:

- **Products** table (name, price, description, images, etc.)
- **Orders** table + **Order Items** table (what was bought, quantity, price)

Inventory Management sits **between** these two. It doesn't replace Products — it **extends** it with stock data, and it **listens** to Orders to update stock automatically.

Think of it as 3 new pieces:

1. `inventory` — current stock per product (per SKU/variant)
2. `inventory_transactions` — a log of every stock change (audit trail)
3. **Hooks/triggers** — code that runs when an order is placed, cancelled, or returned

---

## 2. Database Structure

### 2.1 `inventory` table

This is the "live" stock count. One row per SKU (if you have variants like size/color, one row per variant, not per product).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID / INT (PK) | primary key |
| `product_id` | FK → products.id | links to your existing product |
| `variant_id` | FK → product_variants.id (nullable) | only if you support variants (size, color) |
| `sku` | VARCHAR, UNIQUE | the SKU code, source of truth for matching |
| `quantity_on_hand` | INT | total physical stock in warehouse |
| `quantity_reserved` | INT, default 0 | stock tied to unfulfilled/pending orders |
| `quantity_available` | INT (computed or stored) | `quantity_on_hand - quantity_reserved` |
| `low_stock_threshold` | INT, default 5 | for low-stock alerts |
| `warehouse_id` | FK (optional) | only if you have multiple warehouses/locations |
| `updated_at` | TIMESTAMP | auto-update on change |

**Why "reserved" matters:** if you only track `quantity_on_hand` and subtract at checkout, two customers can buy your last item at the same time before payment confirms. `reserved` prevents overselling — reserve stock when an order is *placed*, deduct from `on_hand` when it's *confirmed/paid*, release the reservation if it's *cancelled*.

If you want to keep this simpler at first, you can skip `reserved` and just use `quantity_on_hand` directly — just know overselling risk goes up under concurrent orders.

### 2.2 `inventory_transactions` table (the audit log)

Every single stock change gets logged here. This is what lets you debug "why is stock wrong" and show a history in the admin panel later.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID / INT (PK) | primary key |
| `inventory_id` | FK → inventory.id | which stock record changed |
| `change_type` | ENUM | `order_placed`, `order_cancelled`, `order_returned`, `manual_adjustment`, `restock`, `damaged`, `initial_stock` |
| `quantity_change` | INT | negative for deductions, positive for additions |
| `quantity_before` | INT | snapshot before change |
| `quantity_after` | INT | snapshot after change |
| `reference_type` | VARCHAR | e.g. `order`, `manual`, `purchase_order` |
| `reference_id` | FK (nullable) | the order ID that caused this, if applicable |
| `note` | TEXT (nullable) | e.g. "restocked from supplier X" |
| `created_by` | FK → admin_users.id (nullable) | who did a manual change |
| `created_at` | TIMESTAMP | |

This table is **append-only** — never edit or delete rows, only insert. It's your source of truth if `inventory.quantity_on_hand` ever looks wrong; you can replay the log.

---

## 3. Connecting to Products

- Add a `has_inventory_tracking` boolean flag on the `products` table (some products, like services or digital goods, might not need stock tracking).
- Every product (or product variant) that tracks stock gets **exactly one row** in `inventory`, created automatically when the product is created.
- Match by `sku`, not by name — SKU should already be unique in your products table, or add it now if it isn't.

**Trigger point:** when a product is created in the admin panel → automatically insert a row into `inventory` with `quantity_on_hand = 0` (or whatever initial value the admin enters in the product form).

**On the Product page in admin**, you'll eventually just pull the linked `inventory` row via `product_id` to show current stock — but that's UI, so skipping it here as requested.

---

## 4. Connecting to Orders

This is the part that makes it "automatic."

### 4.1 When an order is placed

For each `order_item` in the new order:

1. Look up the matching `inventory` row via `sku` (or `product_id` + `variant_id`).
2. Check `quantity_available >= order_item.quantity`. If not → reject the order / show "out of stock" **before** payment.
3. If OK:
   - Increase `quantity_reserved` by the ordered quantity (if using the reserved-stock pattern), **or**
   - Directly decrease `quantity_on_hand` (if using the simple pattern).
4. Insert a row into `inventory_transactions` with `change_type = order_placed`, negative `quantity_change`, and `reference_id = order.id`.

### 4.2 When an order is confirmed / paid (if using reserved-stock pattern)

1. Move the quantity from `quantity_reserved` to a real deduction: decrease both `quantity_reserved` and `quantity_on_hand`.
2. Log it (`change_type = order_confirmed`, optional — you can merge this into step 4.1 if you don't need the reserved/paid distinction).

### 4.3 When an order is cancelled

1. For each item in the cancelled order:
   - If stock was reserved → release it: decrease `quantity_reserved`.
   - If stock was already deducted from `quantity_on_hand` → add it back.
2. Insert a transaction row: `change_type = order_cancelled`, positive `quantity_change`, `reference_id = order.id`.

### 4.4 When an order is returned

1. For each returned item:
   - Increase `quantity_on_hand` by the returned quantity.
   - (Optional) if you want a "quality check" step before returned stock is resellable, add a `quantity_pending_inspection` field instead of adding straight back to `on_hand`.
2. Insert a transaction row: `change_type = order_returned`, positive `quantity_change`, `reference_id = order.id`.

### 4.5 Partial cancellations/returns

Handle at the `order_item` level, not the whole order — a customer might return 1 of 3 units ordered. Always loop per item, never per order.

---

## 5. Where This Logic Lives (Implementation Pattern)

Don't scatter inventory-updating code across your order controllers. Centralize it:

```
/services/inventoryService.js (or .py, whatever your stack is)
  - reserveStock(orderItems)
  - deductStock(orderItems)
  - releaseStock(orderItems)      // for cancellations
  - restoreStock(orderItems)      // for returns
  - adjustStockManually(inventoryId, delta, note, adminUserId)
  - getAvailableQuantity(sku)
```

Your **order status change handler** (wherever you already update order status: pending → paid → shipped → cancelled/returned) should call the relevant `inventoryService` function. This keeps inventory logic in one place, testable and reusable, instead of duplicated in every place orders get modified.

**Recommended flow:**

```
Order Created        → inventoryService.reserveStock(items)
Order Paid/Confirmed → inventoryService.deductStock(items)
Order Cancelled       → inventoryService.releaseStock(items)  [or restoreStock if already deducted]
Order Returned        → inventoryService.restoreStock(items)
```

---

## 6. Concurrency Safety (Important)

If two orders for the same last-in-stock item come in at nearly the same time, a naive "read quantity, check, then write" can let both succeed. Prevent this with either:

- **Database-level atomic update**: `UPDATE inventory SET quantity_reserved = quantity_reserved + X WHERE id = ? AND quantity_available >= X` — check the affected-rows count; if 0 rows updated, the order fails due to insufficient stock. This is the simplest fix and works in any SQL database.
- Or a **transaction/row lock** (`SELECT ... FOR UPDATE` in Postgres/MySQL) around the check-and-update.

Don't do the check and the update as two separate queries without a lock or atomic condition — that's the classic overselling bug.

---

## 7. Low Stock Alerts (optional but easy to add)

After any deduction, compare `quantity_available` to `low_stock_threshold`. If it drops at or below the threshold, fire an event/notification (email, admin dashboard flag, whatever you use). This can just be a check inside `inventoryService.deductStock()`.

---

## 8. Suggested Build Order

1. Add `sku` (if missing) and `has_inventory_tracking` to `products`.
2. Create `inventory` table, one row per trackable product/variant.
3. Create `inventory_transactions` table.
4. Build `inventoryService` with the functions listed in section 5.
5. Wire `reserveStock`/`deductStock` into your order-creation flow.
6. Wire `releaseStock` into your order-cancellation flow.
7. Wire `restoreStock` into your order-return flow.
8. Add the atomic stock-check (section 6) so you can't oversell.
9. (Optional) Add low-stock alerting.
10. Later: build the admin UI screens on top of this — they just read/write these tables, no new logic needed.

---

## 9. Quick Reference — Data Flow Diagram (text form)

```
[Product Created] --> creates row in --> [inventory: qty=0]

[Customer Places Order]
      |
      v
 [order + order_items created]
      |
      v
 inventoryService.reserveStock()  --> inventory.quantity_reserved += qty
      |                                 (transaction log: order_placed)
      v
 [Payment Confirmed] --> inventoryService.deductStock()
      |                     --> inventory.quantity_on_hand -= qty
      |                     --> inventory.quantity_reserved -= qty
      |                         (transaction log: order_confirmed)
      v
 [Order Cancelled] --> inventoryService.releaseStock()
      |                   --> inventory.quantity_reserved -= qty (or on_hand += qty if already deducted)
      |                       (transaction log: order_cancelled)
      v
 [Order Returned] --> inventoryService.restoreStock()
                          --> inventory.quantity_on_hand += qty
                              (transaction log: order_returned)
```

---

This gives you a self-contained inventory layer that's driven entirely by SKU matching to Products, and kept in sync automatically by hooking into your existing Order status changes — without needing to touch how Products or Orders themselves are structured.
