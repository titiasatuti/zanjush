import { ReactNode, useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { LayoutDashboard, Package2, QrCode, ArrowLeft, ClipboardList, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess } from "@/utils/toast";
import { BrandingSettings, defaultBranding, getBrandingIcon, loadBrandingSettings } from "@/lib/branding";

const navItems = [
  { to: "/", label: "Dasbor", icon: LayoutDashboard },
  { to: "/scan", label: "Scan QR", icon: QrCode },
  { to: "/products", label: "Produk", icon: Package2 },
  { to: "/stock", label: "Ledger Stok", icon: ClipboardList },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings },
];

type AppLayoutProps = {
  children: ReactNode;
  title: string;
  backTo?: string;
};

export const AppLayout = ({ children, title, backTo }: AppLayoutProps) => {
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);

  useEffect(() => {
    loadBrandingSettings().then(setBranding);

    const updateBranding = (event: Event) => {
      const customEvent = event as CustomEvent<BrandingSettings>;
      setBranding(customEvent.detail);
    };

    window.addEventListener("branding-updated", updateBranding);
    return () => window.removeEventListener("branding-updated", updateBranding);
  }, []);

  const BrandIcon = getBrandingIcon(branding.icon_name);

  const signOut = async () => {
    await supabase.auth.signOut();
    showSuccess("Berhasil logout");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-64 border-r bg-white p-4 md:flex md:flex-col">
          <div className="mb-8 rounded-2xl bg-emerald-500 p-4 text-white">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="Logo dashboard" className="h-16 w-full rounded-xl object-contain" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                  <BrandIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-emerald-100">Operasional</p>
                  <h1 className="truncate text-xl font-semibold">{branding.dashboard_name}</h1>
                </div>
              </div>
            )}
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

          <Button
            type="button"
            variant="secondary"
            onClick={signOut}
            className="mt-auto h-11 justify-start rounded-xl text-slate-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </aside>

        <main className="w-full p-4 pb-24 md:p-8 md:pb-8">
          <header className="mb-6 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {backTo && (
                <Button asChild variant="secondary" size="icon" className="mt-0.5 rounded-xl">
                  <Link to={backTo} aria-label="Kembali">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
                <p className="text-sm text-slate-500">Operasional harian cepat, detail tetap rapi.</p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={signOut}
              className="hidden rounded-xl sm:inline-flex md:hidden"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </header>
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
};