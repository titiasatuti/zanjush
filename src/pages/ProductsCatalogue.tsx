import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string | null;
  sell_price: number | null;
  photo_url: string | null;
};

type Movement = {
  product_id: string;
  movement_type: string;
  quantity: number;
};

const ProductsCatalogue = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    const load = async () => {
      const [productsRes, movementsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id,name,sku,unit,category,sell_price,photo_url")
          .order("created_at", { ascending: false }),
        supabase.from("stock_movements").select("product_id,movement_type,quantity"),
      ]);
      setProducts((productsRes.data as Product[]) || []);
      setMovements((movementsRes.data as Movement[]) || []);
    };
    load();
  }, []);

  const stockByProduct = useMemo(() => {
    const map = new Map<string, number>();
    movements.forEach((m) => {
      const sign = ["in", "return", "adjust"].includes(m.movement_type) ? 1 : -1;
      map.set(m.product_id, (map.get(m.product_id) || 0) + sign * m.quantity);
    });
    return map;
  }, [movements]);

  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, Product[]>();
    products.forEach((product) => {
      const category = product.category?.trim() || "Uncategorized";
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(product);
    });
    return Array.from(grouped.entries());
  }, [products]);

  return (
    <AppLayout title="Catalogue">
      <div className="mb-4">
        <Button asChild className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
          <Link to="/products/catalougue/new">Create New Catalogue</Link>
        </Button>
      </div>

      <div className="space-y-6">
        {productsByCategory.map(([category, categoryProducts]) => (
          <section key={category} className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{category}</p>
              <p className="text-xs text-emerald-700/80">{categoryProducts.length} item(s)</p>
            </div>

            <div className="space-y-3">
              {categoryProducts.map((p) => (
                <div key={p.id} className="rounded-3xl border bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-28 sm:w-28">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-400">
                          No Image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 text-right">
                      <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">{p.name}</p>
                      <p className="mt-1 text-sm font-medium text-emerald-700">
                        {typeof p.sell_price === "number" ? `Rp ${p.sell_price.toLocaleString()}` : "Price not set"}
                      </p>

                      <div className="mt-2 flex flex-wrap justify-end gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-3 py-1">Total Sales: -</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">Stocks: {stockByProduct.get(p.id) || 0}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{p.unit}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{p.sku}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {!products.length && <p className="text-sm text-slate-500">No catalogue yet. Create your first one.</p>}
      </div>
    </AppLayout>
  );
};

export default ProductsCatalogue;