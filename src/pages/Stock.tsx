import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ArrowDownCircle, ArrowUpCircle, Search } from "lucide-react";

type StockMovement = {
  id: string;
  product_id: string;
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

const incomingTypes = ["in", "return", "adjust"];

const Stock = () => {
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [items, setItems] = useState<ItemName[]>([]);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const [movementsRes, itemsRes] = await Promise.all([
        supabase.from("stock_movements").select("id,product_id,movement_type,quantity,note,created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("items").select("id,name,type"),
      ]);

      setRows((movementsRes.data as StockMovement[]) || []);
      setItems((itemsRes.data as ItemName[]) || []);
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
          (row.note || "").toLowerCase().includes(cleanSearch)
        : true;

      return matchesType && matchesSearch;
    });
  }, [rows, type, search, itemMap]);

  return (
    <AppLayout title="Ledger Stok" backTo="/products">
      <div className="mb-4 grid gap-3 rounded-3xl border bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Cari item / catatan</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-12 rounded-2xl pl-9"
              placeholder="Contoh: alpukat, scan, manual..."
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

      <div className="space-y-3">
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
                      <p className="font-semibold text-slate-900">{item?.name || "Unknown item"}</p>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item?.type || "item"}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${isIncoming ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {isIncoming ? "+" : "-"}
                      {row.quantity}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">Tipe: {row.movement_type}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">{new Date(row.created_at).toLocaleString()}</span>
                  </div>

                  {row.note && <p className="mt-3 text-sm text-slate-600">{row.note}</p>}
                </div>
              </div>
            </div>
          );
        })}

        {!filteredRows.length && (
          <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
            Tidak ada riwayat stok yang cocok dengan filter.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Stock;