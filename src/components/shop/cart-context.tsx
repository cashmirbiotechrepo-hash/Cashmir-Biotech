"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  sizeLabel: string;
  /** Display price only — the server always re-prices at checkout. */
  priceInr: number;
  imageUrl: string;
  quantity: number;
  /** Advisory stock cap captured when added; re-validated server-side. */
  maxQty: number;
};

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  repricing: boolean;
  priceWarning: string | null;
  count: number;
  subtotalInr: number;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  refreshPrices: () => Promise<void>;
};

const STORAGE_KEY = "cb-cart-v1";
const MAX_QTY = 20;

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [repricing, setRepricing] = useState(false);
  const [priceWarning, setPriceWarning] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed.map(normalizeItem).filter((x): x is CartItem => x !== null));
      }
    } catch {
      // corrupt storage — start fresh
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setPriceWarning(null);
    } catch {
      setPriceWarning("Your cart couldn't be saved locally. It may reset if you leave this page.");
    }
  }, [items, ready]);

  useEffect(() => {
    if (!ready) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) setItems(parsed.map(normalizeItem).filter((x): x is CartItem => x !== null));
      } catch {
        // ignore corrupt cross-tab payload
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [ready]);

  const refreshPrices = useCallback(async () => {
    if (items.length === 0) return;
    setRepricing(true);
    try {
      const res = await fetch("/api/cart/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !Array.isArray(data.items)) {
        setPriceWarning(data.error ?? "Could not refresh prices. Totals will be confirmed at checkout.");
        return;
      }

      const nextItems = data.items.filter(isValidItem);
      if (nextItems.length === 0) {
        setItems([]);
        return;
      }

      const changed = items.some((item) => {
        const next = nextItems.find((n: CartItem) => n.productId === item.productId);
        return !next || next.priceInr !== item.priceInr || next.name !== item.name;
      });

      setItems(nextItems);
      if (changed) {
        setPriceWarning("Prices were updated to match our current catalog.");
      }
    } catch {
      setPriceWarning("Could not refresh prices. Totals will be confirmed at checkout.");
    } finally {
      setRepricing(false);
    }
  }, [items]);

  useEffect(() => {
    if (!ready || items.length === 0) return;
    void refreshPrices();
    // Only re-run when cart becomes ready or item count changes — not on every price refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, items.length]);

  const clampQty = (qty: number, max: number) => Math.max(1, Math.min(qty, max > 0 ? max : MAX_QTY, MAX_QTY));

  const add = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId
            ? { ...i, ...item, quantity: clampQty(i.quantity + quantity, item.maxQty) }
            : i
        );
      }
      return [...prev, { ...item, quantity: clampQty(quantity, item.maxQty) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: clampQty(quantity, i.maxQty) } : i))
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotalInr = items.reduce((sum, i) => sum + i.priceInr * i.quantity, 0);
    return {
      items,
      ready,
      repricing,
      priceWarning,
      count,
      subtotalInr,
      add,
      setQuantity,
      remove,
      clear,
      refreshPrices
    };
  }, [items, ready, repricing, priceWarning, add, setQuantity, remove, clear, refreshPrices]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

function normalizeItem(x: unknown): CartItem | null {
  if (!x || typeof x !== "object") return null;
  const i = x as Record<string, unknown>;
  if (typeof i.productId !== "string" || typeof i.quantity !== "number" || typeof i.priceInr !== "number") {
    return null;
  }
  return {
    productId: i.productId,
    slug: typeof i.slug === "string" ? i.slug : "",
    name: typeof i.name === "string" ? i.name : "Product",
    sizeLabel: typeof i.sizeLabel === "string" ? i.sizeLabel : "",
    imageUrl: typeof i.imageUrl === "string" ? i.imageUrl : "",
    priceInr: i.priceInr,
    quantity: Math.max(1, Math.floor(i.quantity)),
    maxQty: typeof i.maxQty === "number" ? i.maxQty : 20
  };
}

function isValidItem(x: unknown): x is CartItem {
  return normalizeItem(x) !== null;
}
