import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package2, QrCode, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package2 },
  { to: "/scan", label: "Scan", icon: QrCode, center: true },
  { to: "/labels", label: "Labels", icon: Tags },
];

export const BottomNav = () => {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex h-16 max-w-xl items-center justify-around px-2">
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
                    "relative -mt-7 h-14 w-14 rounded-full border-4 border-white bg-emerald-500 text-white shadow-lg",
                )
              }
            >
              <Icon className={cn("h-5 w-5", item.center && "h-6 w-6")} />
              {!item.center && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};