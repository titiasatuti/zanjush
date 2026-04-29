import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";

type ActivityLog = {
  id: string;
  action: string;
  description: string;
  created_at: string;
};

const badgeMap: Record<string, string> = {
  create_product: "bg-emerald-100 text-emerald-700",
  update_product: "bg-sky-100 text-sky-700",
  delete_product: "bg-rose-100 text-rose-700",
  create_ingredient: "bg-emerald-100 text-emerald-700",
  update_ingredient: "bg-sky-100 text-sky-700",
  delete_ingredient: "bg-rose-100 text-rose-700",
  stock_in: "bg-lime-100 text-lime-700",
  stock_out: "bg-amber-100 text-amber-700",
  scan_stock_in: "bg-teal-100 text-teal-700",
  scan_stock_out: "bg-orange-100 text-orange-700",
  blocked_negative_stock: "bg-red-100 text-red-700",
  create_label: "bg-violet-100 text-violet-700",
  add_recipe_ingredient: "bg-cyan-100 text-cyan-700",
  remove_recipe_ingredient: "bg-orange-100 text-orange-700",
};

const toTitle = (value: string) =>
  value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

const History = () => {
  const [rows, setRows] = useState<ActivityLog[]>([]);

  useEffect(() => {
    supabase
      .from("activity_logs")
      .select("id,action,description,created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data as ActivityLog[]) || []));
  }, []);

  return (
    <AppLayout title="Histori">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-3xl border bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeMap[row.action] || "bg-slate-100 text-slate-700"}`}>
                {toTitle(row.action)}
              </span>
              <span className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-slate-700">{row.description}</p>
          </div>
        ))}

        {!rows.length && (
          <div className="rounded-3xl border bg-white p-4 text-sm text-slate-500">
            Belum ada histori aktivitas.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default History;