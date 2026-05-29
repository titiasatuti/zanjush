import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getExpiryBadgeClass, getExpiryMeta, formatDateId } from "@/lib/expiry-utils";

type Ingredient = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  photo_url: string | null;
  last_purchase_date: string | null;
  expiry_date: string | null;
};

type Movement = {
  product_id: string;
  movement_type: string;
  quantity: number;
  note: string | null;
};

type BatchSummary = {
  product_id: string;
  expiry_date: string | null;
  remaining_quantity: number;
};

const readCategoryFromSku = (sku: string) => {
  const match = sku.match(/\[CAT:(.*?)\]/);
  return match?.[1]?.trim() || "Tanpa Kategori";
};

const Ingredients = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [expiryFilter, setExpiryFilter] = useState<"all" | "near" | "expired">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorText("");

      const [itemsRes, movementsRes, batchesRes] = await Promise.all([
        supabase
          .from("items")
          .select("id,name,sku,unit,photo_url,last_purchase_date,expiry_date")
          .eq("type", "ingredient")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase.from("stock_movements").select("product_id,movement_type,quantity,note"),
        supabase.from("stock_batches").select("product_id,expiry_date,remaining_quantity"),
      ]);

      if (itemsRes.error || movementsRes.error || batchesRes.error) {
        setErrorText(itemsRes.error?.message || movementsRes.error?.message || batchesRes.error?.message || "Gagal memuat bahan baku");
        setIsLoading(false);
        return;
      }

      setIngredients((itemsRes.data as Ingredient[]) || []);
      setMovements((movementsRes.data as Movement[]) || []);
      setBatches((batchesRes.data as BatchSummary[]) || []);
      setIsLoading(false);
    };

    load();
  }, []);

  const stockByItem = useMemo(() => {
    const map = new Map<string, number>();
    movements.forEach((m) => {
      if (!m.product_id) return;
      const sign = ["in", "return", "adjust"].includes(m.movement_type) ? 1 : -1;
      map.set(m.product_id, (map.get(m.product_id) || 0) + sign * m.quantity);
    });
    return map;
  }, [movements]);

  const filteredIngredients = useMemo(() => {
    const nearestExpiryMap = new Map<string, string | null>();

    batches
      .filter((batch) => batch.remaining_quantity > 0)
      .forEach((batch) => {
        if (!batch.expiry_date) return;
        const current = nearestExpiryMap.get(batch.product_id);
        if (!current || new Date(batch.expiry_date) < new Date(current)) {
          nearestExpiryMap.set(batch.product_id, batch.expiry_date);
        }
      });

    if (expiryFilter === "all") return ingredients;

    return ingredients.filter((item) => {
      const batchExpiryDate = nearestExpiryMap.get(item.id) || item.expiry_date;
      const meta = getExpiryMeta(batchExpiryDate);
      if (expiryFilter === "expired") {
        return meta.status === "expired" || meta.status === "today";
      }
      return meta.status === "near";
    });
  }, [ingredients, expiryFilter, batches]);

  const grouped = useMemo(() => {
    const map = new Map<string, Ingredient[]>();
    filteredIngredients.forEach((item) => {
      const category = readCategoryFromSku(item.sku);
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push(item);
    });
    return Array.from(map.entries());
  }, [filteredIngredients]);

  const batchCountByItem = useMemo(() => {
    const map = new Map<string, number>();
    batches
      .filter((batch) => batch.remaining_quantity > 0)
      .forEach((batch) => {
      map.set(batch.product_id, (map.get(batch.product_id) || 0) + 1);
      });
    return map;
  }, [batches]);

  const nearestExpiryByItem = useMemo(() => {
    const map = new Map<string, string | null>();

    batches
      .filter((batch) => batch.remaining_quantity > 0)
      .forEach((batch) => {
        if (!batch.expiry_date) return;

        const current = map.get(batch.product_id);
        if (!current || new Date(batch.expiry_date) < new Date(current)) {
          map.set(batch.product_id, batch.expiry_date);
        }
      });

    return map;
  }, [batches]);

  return (
    <AppLayout title="Atur Bahan Baku" backTo="/products">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
          <Link to="/products/ingredients/new">Tambah Bahan Baku</Link>
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter Expired</span>
          <select
            className="h-10 rounded-xl border px-3 text-sm"
            value={expiryFilter}
            onChange={(event) => setExpiryFilter(event.target.value as "all" | "near" | "expired")}
          >
            <option value="all">Semua</option>
            <option value="near">Hampir expired (maks. 3 hari)</option>
            <option value="expired">Sudah expired</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">Memuat daftar bahan baku...</div>
      ) : errorText ? (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-sm font-medium text-rose-700 shadow-sm">{errorText}</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <section key={category} className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">{category}</p>
                <p className="text-xs text-amber-700/80">{items.length} item</p>
              </div>

              <div className="space-y-3">
                {items.map((item) => {
                  const batchExpiryDate = nearestExpiryByItem.get(item.id) || item.expiry_date;
                  const expiry = getExpiryMeta(batchExpiryDate);
                  const stock = stockByItem.get(item.id) || 0;
                  const batchCount = batchCountByItem.get(item.id) || 0;

                  return (
                    <Link key={item.id} to={`/products/ingredients/${item.id}`} className="block rounded-3xl border bg-white p-3 shadow-sm transition hover:shadow-md">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-28 sm:w-28">
                          {item.photo_url ? (
                            <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-400">
                              Tidak Ada Gambar
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">{item.name}</p>
                              <p className="mt-0.5 text-sm text-slate-500">Beli terakhir: {formatDateId(item.last_purchase_date)}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getExpiryBadgeClass(expiry.status)}`}>
                              {expiry.label}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-slate-500">Stok</p>
                              <p className="text-sm font-semibold text-slate-900">{stock}</p>
                            </div>
                            <div className="rounded-xl bg-indigo-50 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-indigo-500">Batch</p>
                              <p className="text-sm font-semibold text-indigo-700">{batchCount}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-slate-500">Expired</p>
                              <p className="truncate text-sm font-semibold text-slate-900">{formatDateId(batchExpiryDate)}</p>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>SKU: {item.sku.replace(/\[CAT:.*?\]\s?/g, "")}</span>
                            <span>Unit: {item.unit}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {!filteredIngredients.length && <p className="text-sm text-slate-500">Tidak ada bahan baku pada filter ini.</p>}
        </div>
      )}
    </AppLayout>
  );
};

export default Ingredients;