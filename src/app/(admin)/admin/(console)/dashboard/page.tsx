import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  getDashboardStats,
  listLowStockProducts,
  listRecentOrders
} from "@/modules/admin/services/dashboard.service";
import { listRecentSecurityEvents } from "@/modules/admin/services/audit.service";
import { AlertTriangle, FlaskConical, Handshake, IndianRupee, Megaphone, Package, ShoppingCart, Users } from "lucide-react";

export const metadata = { title: "Dashboard" };

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid" || status === "delivered") return "default";
  if (status === "cancelled" || status === "payment_failed" || status === "refunded") return "destructive";
  return "secondary";
}

export default async function AdminDashboardPage() {
  const [stats, recentOrders, lowStock, securityEvents] = await Promise.all([
    getDashboardStats(),
    listRecentOrders(),
    listLowStockProducts(),
    listRecentSecurityEvents(6)
  ]);

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="Live numbers from your catalog, orders, and content — no placeholders."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active products" value={stats.activeProducts} hint={`${stats.products} total`} icon={Package} />
        <KpiCard
          label="Open orders"
          value={stats.pendingOrders}
          hint={`${stats.orders} all time`}
          icon={ShoppingCart}
        />
        <KpiCard
          label="Revenue"
          value={formatInr(stats.revenueInr * 100)}
          hint="Paid & fulfilled orders"
          icon={IndianRupee}
        />
        <KpiCard
          label="Low stock SKUs"
          value={stats.lowStock}
          hint="At or below reorder threshold"
          icon={AlertTriangle}
          alert={stats.lowStock > 0}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Patents" value={stats.patents} icon={FlaskConical} />
        <KpiCard label="Open deals" value={stats.openDeals} hint={`₹${stats.pipelineValueInr.toLocaleString("en-IN")} pipeline`} icon={Handshake} />
        <KpiCard
          label="Coupons (admin only)"
          value={stats.couponsPendingStorefront}
          hint="Not applied at checkout yet"
          icon={Megaphone}
        />
        <KpiCard label="Newsletter" value={stats.subscribers} icon={Users} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/crm" className="text-primary hover:underline">CRM →</Link>
        <Link href="/admin/marketing" className="text-primary hover:underline">Marketing →</Link>
        <Link href="/admin/finance" className="text-primary hover:underline">Finance →</Link>
        <Link href="/admin/patents" className="text-primary hover:underline">Patent registry →</Link>
        <Link href="/admin/blog" className="text-primary hover:underline">Blog →</Link>
        <Link href="/admin/media" className="text-primary hover:underline">Media library →</Link>
        <Link href="/admin/audit-logs" className="text-primary hover:underline">Audit logs →</Link>
        <Link href="/admin/account" className="text-primary hover:underline">Account →</Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Security activity</CardTitle>
            <Link href="/admin/audit-logs" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {securityEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No security events logged yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {securityEvents.map((event) => (
                  <li key={event.id} className="border-b pb-2 last:border-0">
                    <p className="font-medium">{event.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.userEmail}
                      {event.ipAddress ? ` · ${event.ipAddress}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString("en-IN")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Recent orders</CardTitle>
            <Link href="/admin/orders" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet. They will appear here after checkout goes live.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatInr(order.totalCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Low stock</CardTitle>
            <Link href="/admin/products" className="text-xs text-primary hover:underline">
              Manage inventory
            </Link>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">All SKUs are above their reorder thresholds.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="max-w-[12rem] truncate">{product.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{product.stockQty}</TableCell>
                      <TableCell className="text-right tabular-nums">{product.lowStockThreshold}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
