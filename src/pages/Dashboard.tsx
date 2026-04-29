import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type ProductItem = {
  id: string;
  name: string;
  type: "product" | "ingredient";
};

type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
};

const Dashboard = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    const load = async () => {
      const [itemsRes, movementsRes] = await Promise.all([
        supabase
          .from("items")
          .select("id,name,type")
          .eq("is_active", true)
          .eq("type", "product"),
        supabase.from("stock_movements").select("id,product_id,movement_type,quantity"),
      ]);

      setProducts((itemsRes.data as ProductItem[]) || []);
      setMovements((movementsRes.data as Movement[]) || []);
    };

    load();
  }, []);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    movements.forEach((m) => {
      if (!m.product_id) return;
      const sign = ["in", "return", "adjust"].includes(m.movement_type) ? 1 : -1;
      map.set(m.product_id, (map.get(m.product_id) || 0) + sign * m.quantity);
    });
    return map;
  }, [movements]);

  const totalProducts = products.length;

  const totalStock = useMemo(() => {
    return products.reduce((sum, product) => sum + (stockMap.get(product.id) || 0), 0);
  }, [products, stockMap]);

  const lowStock = useMemo(() => {
    return products
      .map((p) => ({
        ...p,
        stock: stockMap.get(p.id) || 0,
      }))
      .filter((p) => p.stock < 10)
      .sort((a, b) => a.stock - b.stock);
  }, [products, stockMap]);

  return (
    <AppLayout title="Dashboard">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Total Products</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalProducts}</CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Total Stock</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalStock}</CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Low Stock (under 10)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{lowStock.length}</CardContent>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
          <Link to="/products">Create Product</Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-xl">
          <Link to="/scan">Scan QR</Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-xl">
          <Link to="/labels">Create Label</Link>
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Need Restock Now</CardTitle>
        </CardHeader>
        <CardContent>
          {lowStock.length ? (
            <div className="space-y-2">
              {lowStock.map((item) => (
                <Link
                  key={item.id}
                  to={`/products/catalogue/${item.id}`}
                  className="flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2 text-sm transition hover:bg-slate-100"
                >
                  <span className="font-medium text-slate-800">{item.name}</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Sisa: {item.stock}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No urgent restock items.</p>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default Dashboard;