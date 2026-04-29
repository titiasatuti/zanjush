import { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { LayoutDashboard, Package2, QrCode, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scan", label: "Scan QR", icon: QrCode },
  { to: "/products", label: "Products", icon: Package2 },
];

type AppLayoutProps = {
  children: ReactNode;
  title: string;
  backTo?: string;
};

export const AppLayout = ({ children, title, backTo }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-64 border-r bg-white p-4 md:block">
          <div className="mb-8 rounded-2xl bg-emerald-500 p-4 text-white">
            <p className="text-xs uppercase tracking-wider text-emerald-100">Operations</p>
            <h1 className="text-xl font-semibold">Juice Inventory</h1>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                      isActive ? "bg-emerald-100 text-emerald-800" : "text-slate-600 hover:bg-slate-100",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <main className="w-full p-4 pb-24 md:p-8 md:pb-8">
          <header className="mb-6 flex items-start gap-3">
            {backTo && (
              <Button asChild variant="secondary" size="icon" className="mt-0.5 rounded-xl">
                <Link to={backTo} aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500">Fast daily operations first, details second.</p>
            </div>
          </header>
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
};