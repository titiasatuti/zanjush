import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ArrowDownCircle, ArrowUpCircle, Search } from "lucide-react";
import { Link } from "react-router-dom";

type StockMovement = {
  id: string;
  product_id: string;
  batch_id: string | null;
  movement_type: string;
  quantity: number;
  note: string | null;
  created_at: string;
};

type ItemName = {
  id: string;
  name: string;
  type: string;
};

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
  print_label: "bg-indigo-100 text-indigo-700",
  add_recipe_ingredient: "bg-cyan-100 text-cyan-700",
  remove_recipe_ingredient: "bg-orange-100 text-orange-700",
};

const toTitle = (value: string) =>
  value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

const incomingTypes = ["in", "return", "adjust"];

const Stock = () => {
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [activityRows, setActivityRows] = useState<ActivityLog[]>([]);
  const [items, setItems] = useState<ItemName[]>([]);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorText("");

      const [movementsRes, itemsRes, logsRes] = await Promise.all([
        supabase
          .from("stock_movements")
          .select("id,product_id,batch_id,movement_type,quantity,note,created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("items").select("id,name,type"),
        supabase
          .from("activity_logs")
          .select("id,action,description,created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (movementsRes.error || itemsRes.error || logsRes.error) {
        setErrorText(movementsRes.error?.message || itemsRes.error?.message || logsRes.error?.message || "Gagal memuat histori stok");
        setIsLoading(false);
        return;
      }

      setRows((movementsRes.data as StockMovement[]) || []);
      setItems((itemsRes.data as ItemName[]) || []);
      setActivityRows((logsRes.data as ActivityLog[]) || []);
      setIsLoading(false);
    };

    load();
  }, []);

  const itemMap = useMemo(() => {
    const map = new Map<string, ItemName>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  const filteredRows = useMemo(() => {
    const cleanType = type.trim().toLowerCase();
    const cleanSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      const item = itemMap.get(row.product_id);
      const matchesType = cleanType ? row.movement_type.toLowerCase().includes(cleanType) : true;
      const matchesSearch = cleanSearch
        ? (item?.name || "Unknown item").toLowerCase().includes(cleanSearch) ||
          (row.note || "").toLowerCase().includes(cleanSearch) ||
          row.id.toLowerCase().includes(cleanSearch) ||
          (row.batch_id || "").toLowerCase().includes(cleanSearch)
        : true;

      return matchesType && matchesSearch;
    });
  }, [rows, type, search, itemMap]);

  const filteredActivityRows = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    if (!cleanSearch) return activityRows;

    return activityRows.filter((row) => {
      return (
        row.action.toLowerCase().includes(cleanSearch) ||
        row.description.toLowerCase().includes(cleanSearch) ||
        row.id.toLowerCase().includes(cleanSearch)
      );
    });
  }, [activityRows, search]);

  const itemDetailPath = (item?: ItemName) => {
    if (!item) return "/products";
    return item.type === "ingredient" ? `/products/ingredients/${item.id}` : `/products/catalogue/${item.id}`;
  };

  const formatMovementNote = (note: string | null) => {
    if (!note) return null;

    // Convert UUID references in notes into human-readable item names when available.
    return note.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, (value) => {
      const item = itemMap.get(value);
      return item?.name || value;
    });
  };

  return (
    <AppLayout title="Histori Stock">
      <div className="mb-4 grid gap-3 rounded-3xl border bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Cari item / catatan / ID</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-12 rounded-2xl pl-9"
              placeholder="Contoh: alpukat, scan, batch id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Filter tipe movement</p>
          <Input
            className="h-12 rounded-2xl"
            placeholder="in, out, use, waste, return..."
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">Memuat histori stock...</div>
      ) : errorText ? (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-sm font-medium text-rose-700 shadow-sm">{errorText}</div>
      ) : (
        <div className="space-y-4">
          <section className="space-y-3">
            <div className="rounded-2xl bg-emerald-50 px-4 py-2">
              <p className="text-sm font-semibold text-emerald-700">Pergerakan Stok</p>
            </div>
            {filteredRows.map((row) => {
              const item = itemMap.get(row.product_id);
              const isIncoming = incomingTypes.includes(row.movement_type);
              const Icon = isIncoming ? ArrowUpCircle : ArrowDownCircle;

              return (
                <div key={row.id} className="rounded-3xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isIncoming ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <Link to={itemDetailPath(item)} className="font-semibold text-slate-900 hover:text-emerald-700">
                            {item?.name || "Unknown item"}
                          </Link>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item?.type === "ingredient" ? "bahan baku" : item?.type || "item"}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${isIncoming ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {isIncoming ? "+" : "-"}
                          {row.quantity}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-3 py-1">Tipe: {row.movement_type}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{new Date(row.created_at).toLocaleString()}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">Movement ID: {row.id.slice(0, 8)}</span>
                        {row.batch_id && <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">Batch: {row.batch_id.slice(0, 8)}</span>}
                      </div>

                      {row.note && <p className="mt-3 text-sm text-slate-600">{formatMovementNote(row.note)}</p>}
                    </div>
                  </div>
                </div>
              );
            })}

            {!filteredRows.length && (
              <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
                Tidak ada data pergerakan stok yang cocok dengan filter.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="rounded-2xl bg-sky-50 px-4 py-2">
              <p className="text-sm font-semibold text-sky-700">Aktivitas Sistem</p>
            </div>
            {filteredActivityRows.map((row) => (
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

            {!filteredActivityRows.length && (
              <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
                Tidak ada aktivitas sistem yang cocok dengan filter.
              </div>
            )}
          </section>
        </div>
      )}
    </AppLayout>
  );
};

export default Stock;