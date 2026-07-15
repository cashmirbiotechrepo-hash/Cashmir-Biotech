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
  LifeBuoy,
  Megaphone,
  Package,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Tags,
  Truck,
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

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

/** Flat list kept for role filtering / mobile picks. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Overview", shortLabel: "Home", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", shortLabel: "Orders", icon: ShoppingCart },
  { href: "/admin/shipping", label: "Shipping", shortLabel: "Ship", icon: Truck, roles: ["owner", "admin"] },
  { href: "/admin/products", label: "Products", shortLabel: "Catalog", icon: Package },
  { href: "/admin/categories", label: "Categories", shortLabel: "Cats", icon: Tags, roles: ["owner", "admin"] },
  { href: "/admin/inventory", label: "Inventory", shortLabel: "Stock", icon: Boxes, roles: ["owner", "admin"] },
  { href: "/admin/support", label: "Support", shortLabel: "Help", icon: LifeBuoy, roles: ["owner", "admin"] },
  { href: "/admin/crm", label: "CRM", shortLabel: "CRM", icon: Handshake },
  { href: "/admin/marketing", label: "Marketing", shortLabel: "Mktg", icon: Megaphone },
  { href: "/admin/finance", label: "Finance", shortLabel: "Finance", icon: IndianRupee },
  { href: "/admin/b2b", label: "B2B", shortLabel: "B2B", icon: Handshake, roles: ["owner", "admin"] },
  { href: "/admin/circle", label: "Research Circle", shortLabel: "Circle", icon: Users, roles: ["owner", "admin"] },
  { href: "/admin/patents", label: "Patents", shortLabel: "IP", icon: FlaskConical },
  { href: "/admin/content/homepage", label: "Homepage", icon: Home },
  { href: "/admin/content/team", label: "Board", icon: UsersRound },
  { href: "/admin/subscribers", label: "Subscribers", icon: Users },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/account", label: "Account", icon: Settings },
  { href: "/admin/users", label: "Users", icon: Shield, roles: ["owner"] },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText, roles: ["owner", "admin"] }
];

const GROUP_DEFS: { id: string; label: string; hrefs: string[] }[] = [
  {
    id: "commerce",
    label: "Commerce",
    hrefs: [
      "/admin/dashboard",
      "/admin/orders",
      "/admin/shipping",
      "/admin/products",
      "/admin/categories",
      "/admin/inventory",
      "/admin/support"
    ]
  },
  {
    id: "business",
    label: "Business",
    hrefs: ["/admin/crm", "/admin/marketing", "/admin/finance", "/admin/b2b"]
  },
  {
    id: "research",
    label: "Research",
    hrefs: ["/admin/circle", "/admin/patents"]
  },
  {
    id: "content",
    label: "Content",
    hrefs: [
      "/admin/content/homepage",
      "/admin/content/team",
      "/admin/subscribers",
      "/admin/media",
      "/admin/blog"
    ]
  },
  {
    id: "system",
    label: "System",
    hrefs: ["/admin/account", "/admin/users", "/admin/audit-logs"]
  }
];

export function navForRole(role: string): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => !item.roles || item.roles.includes(role as "owner" | "admin" | "editor"));
}

export function navGroupsForRole(role: string): AdminNavGroup[] {
  const allowed = navForRole(role);
  const byHref = new Map(allowed.map((item) => [item.href, item]));
  return GROUP_DEFS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.hrefs.map((href) => byHref.get(href)).filter(Boolean) as AdminNavItem[]
  })).filter((g) => g.items.length > 0);
}

export const MOBILE_NAV = ADMIN_NAV.filter((item) =>
  ["/admin/dashboard", "/admin/orders", "/admin/products", "/admin/crm", "/admin/finance"].includes(
    item.href
  )
);
