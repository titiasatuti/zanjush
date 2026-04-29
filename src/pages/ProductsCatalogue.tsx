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
        supabase.from("products").select("id,name,sku,unit").order("created_at", { ascending: false }),
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

  return (
    <AppLayout title="Catalogue">
      <div className="mb-4">
        <Button asChild className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
          <Link to="/products/catalougue/new">Create New Catalogue</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {products.map((p, index) => (
          <div key={p.id} className="rounded-2xl border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Category</p>
            <p className="mb-2 text-base font-semibold text-slate-900">Products {index + 1}</p>
            <p className="text-sm font-medium text-slate-800">{p.name}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">Pricing: -</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Total Sales: -</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Stocks: {stockByProduct.get(p.id) || 0}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{p.unit}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{p.sku}</span>
            </div>
          </div>
        ))}
        {!products.length && <p className="text-sm text-slate-500">No catalogue yet. Create your first one.</p>}
      </div>
    </AppLayout>
  );
};

export default ProductsCatalogue;