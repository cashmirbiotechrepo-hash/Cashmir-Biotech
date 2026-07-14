import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  FileText,
  FlaskConical,
  Handshake,
  Home,
  ImageIcon,
  IndianRupee,
  LayoutDashboard,
  Megaphone,
  Package,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  UsersRound
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  shortLabel?: string;
  roles?: Array<"owner" | "admin" | "editor">;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Overview", shortLabel: "Home", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", shortLabel: "Catalog", icon: Package },
  { href: "/admin/inventory", label: "Inventory", shortLabel: "Stock", icon: Boxes, roles: ["owner", "admin"] },
  { href: "/admin/orders", label: "Orders", shortLabel: "Orders", icon: ShoppingCart },
  { href: "/admin/patents", label: "Patents", shortLabel: "IP", icon: FlaskConical },
  { href: "/admin/crm", label: "CRM", shortLabel: "CRM", icon: Handshake },
  { href: "/admin/marketing", label: "Marketing", shortLabel: "Mktg", icon: Megaphone },
  { href: "/admin/finance", label: "Finance", shortLabel: "Finance", icon: IndianRupee },
  { href: "/admin/content/homepage", label: "Homepage", icon: Home },
  { href: "/admin/content/team", label: "Board", icon: UsersRound },
  { href: "/admin/subscribers", label: "Subscribers", icon: Users },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/account", label: "Account", icon: Settings },
  { href: "/admin/users", label: "Users", icon: Shield, roles: ["owner"] },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText, roles: ["owner", "admin"] }
];

export function navForRole(role: string): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => !item.roles || item.roles.includes(role as "owner" | "admin" | "editor"));
}

export const MOBILE_NAV = ADMIN_NAV.filter((item) =>
  ["/admin/dashboard", "/admin/products", "/admin/orders", "/admin/patents", "/admin/crm"].includes(item.href)
);
