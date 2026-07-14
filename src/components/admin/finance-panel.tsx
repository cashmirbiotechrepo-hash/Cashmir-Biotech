"use client";

import type { Expense, Invoice, Order } from "@prisma/client";
import Link from "next/link";
import { Fragment, useState } from "react";
import { Pencil } from "lucide-react";
import {
  createInvoiceAction,
  deleteExpenseAction,
  saveExpenseAction
} from "@/app/(admin)/admin/(console)/phase2-actions";
import {
  AdminField,
  AdminTextarea,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type InvoiceRow = Invoice & { order: Order | null };

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function ExpenseForm({ expense, onSaved }: { expense?: Expense; onSaved?: () => void }) {
  const { pending, state, onSubmit } = useAdminForm(saveExpenseAction, { onSuccess: onSaved });
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {expense ? <input type="hidden" name="id" value={expense.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Title" name="title" defaultValue={expense?.title} />
        <AdminField label="Category" name="category" placeholder="Lab supplies" defaultValue={expense?.category} />
        <AdminField
          label="Amount (INR)"
          name="amountCents"
          type="number"
          defaultValue={expense ? Math.round(expense.amountCents / 100) : undefined}
        />
        <AdminField
          label="GST (INR)"
          name="gstCents"
          type="number"
          defaultValue={expense ? Math.round(expense.gstCents / 100) : 0}
        />
        <AdminField label="Vendor" name="vendor" required={false} defaultValue={expense?.vendor} />
        <AdminField
          label="Date"
          name="incurredAt"
          type="date"
          required={false}
          defaultValue={expense ? new Date(expense.incurredAt).toISOString().slice(0, 10) : ""}
        />
      </div>
      <AdminTextarea label="Notes" name="notes" required={false} rows={3} defaultValue={expense?.notes} />
      <div className="flex items-center gap-3">
        <SaveButton pending={pending} label={expense ? "Save expense" : "Log expense"} />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function InvoiceFromOrderForm({ orders }: { orders: Order[] }) {
  const { pending, state, onSubmit } = useAdminForm(createInvoiceAction);
  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground">Create an order first to generate GST invoices.</p>;
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Order</label>
          <select name="orderId" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" required>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} — {formatInr(o.totalCents)}
              </option>
            ))}
          </select>
        </div>
        <AdminField label="GSTIN (optional)" name="gstin" required={false} />
        <AdminField label="Place of supply" name="placeOfSupply" defaultValue="Jammu & Kashmir" />
      </div>
      <div className="flex items-center gap-3">
        <SaveButton pending={pending} label="Generate invoice" />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function FinancePanel({
  invoices,
  expenses,
  billableOrders
}: {
  invoices: InvoiceRow[];
  expenses: Expense[];
  billableOrders: Order[];
}) {
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const expenseTotal = expenses.reduce((s, e) => s + e.amountCents, 0);
  const invoiceTotal = invoices.reduce((s, i) => s + i.totalCents, 0);

  return (
    <Tabs defaultValue="invoices">
      <TabsList>
        <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
        <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
        <TabsTrigger value="new-invoice">GST invoice</TabsTrigger>
        <TabsTrigger value="new-expense">Log expense</TabsTrigger>
      </TabsList>

      <TabsContent value="invoices" className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Invoiced</p>
              <p className="mt-1 text-2xl font-light tabular-nums">{formatInr(invoiceTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Expenses</p>
              <p className="mt-1 text-2xl font-light tabular-nums">{formatInr(expenseTotal)}</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.order?.orderNumber ?? "—"}</TableCell>
                    <TableCell>{new Date(inv.issuedAt).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(inv.totalCents)}</TableCell>
                    <TableCell>
                      <Link href={`/admin/finance/invoices/${inv.id}`} className="text-xs text-primary hover:underline">
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="expenses" className="mt-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => {
                  const open = editExpenseId === e.id;
                  return (
                    <Fragment key={e.id}>
                      <TableRow className={cn(open && "bg-muted/40")}>
                        <TableCell>{e.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{e.category}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{e.vendor || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatInr(e.amountCents)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setEditExpenseId(open ? null : e.id)}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Pencil className="size-3" />
                              {open ? "Close" : "Edit"}
                            </button>
                            <form action={deleteExpenseAction}>
                              <input type="hidden" name="id" value={e.id} />
                              <button type="submit" className="text-xs text-destructive hover:underline">
                                Delete
                              </button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/20 p-4">
                            <ExpenseForm expense={e} onSaved={() => setEditExpenseId(null)} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="new-invoice" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GST-compliant invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoiceFromOrderForm orders={billableOrders} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="new-expense" className="mt-6">
        <Card>
          <CardContent className="pt-6">
            <ExpenseForm />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
