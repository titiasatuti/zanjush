import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package2, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dasbor", icon: LayoutDashboard },
  { to: "/scan", label: "Scan", icon: QrCode, center: true },
  { to: "/products", label: "Produk", icon: Package2 },
];

export const BottomNav = () => {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto grid h-16 max-w-xl grid-cols-3 items-center px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 min-w-11 flex-col items-center justify-center rounded-2xl px-2 text-[11px] font-medium",
                  isActive ? "text-emerald-700" : "text-slate-500",
                  item.center &&
                    "mx-auto -mt-7 h-16 w-16 rounded-full border-4 border-white bg-emerald-500 text-white shadow-lg",
                )
              }
            >
              <Icon className={cn("h-5 w-5", item.center && "h-7 w-7")} />
              {!item.center && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};