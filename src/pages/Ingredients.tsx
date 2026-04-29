import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type Ingredient = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  photo_url: string | null;
};

type Movement = {
  item_id: string;
  movement_type: string;
  quantity: number;
  note: string | null;
};

const readCategoryFromSku = (sku: string) => {
  const match = sku.match(/\[CAT:(.*?)\]/);
  return match?.[1]?.trim() || "Uncategorized";
};

const Ingredients = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    const load = async () => {
      const [itemsRes, movementsRes] = await Promise.all([
        supabase
          .from("items")
          .select("id,name,sku,unit,photo_url")
          .eq("type", "ingredient")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase.from("stock_movements").select("item_id,movement_type,quantity,note"),
      ]);

      setIngredients((itemsRes.data as Ingredient[]) || []);
      setMovements((movementsRes.data as Movement[]) || []);
    };

    load();
  }, []);

  const stockByItem = useMemo(() => {
    const map = new Map<string, number>();
    movements.forEach((m) => {
      if (!m.item_id) return;
      const sign = ["in", "return", "adjust"].includes(m.movement_type) ? 1 : -1;
      map.set(m.item_id, (map.get(m.item_id) || 0) + sign * m.quantity);
    });
    return map;
  }, [movements]);

  const grouped = useMemo(() => {
    const map = new Map<string, Ingredient[]>();
    ingredients.forEach((item) => {
      const category = readCategoryFromSku(item.sku);
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push(item);
    });
    return Array.from(map.entries());
  }, [ingredients]);

  return (
    <AppLayout title="Atur Bahan Baku">
      <div className="mb-4">
        <Button asChild className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
          <Link to="/products/ingredients/new">+ New Ingredient</Link>
        </Button>
      </div>

      <div className="space-y-6">
        {grouped.map(([category, items]) => (
          <section key={category} className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">{category}</p>
              <p className="text-xs text-amber-700/80">{items.length} item(s)</p>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-3xl border bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-28 sm:w-28">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-400">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">{item.name}</p>
                      <div className="mt-2 flex flex-wrap justify-end gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-3 py-1">Stok: {stockByItem.get(item.id) || 0}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{item.unit}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{item.sku.replace(/\[CAT:.*?\]\s?/g, "")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {!ingredients.length && <p className="text-sm text-slate-500">Belum ada bahan baku. Tambahkan bahan baku pertama.</p>}
      </div>
    </AppLayout>
  );
};

export default Ingredients;