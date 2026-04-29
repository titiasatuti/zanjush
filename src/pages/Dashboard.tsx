import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

type InventoryItem = {
  id: string;
  name: string;
  type: "product" | "ingredient";
  min_stock: number;
};

type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
};

const Dashboard = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    const load = async () => {
      const [itemsRes, movementsRes] = await Promise.all([
        supabase
          .from("items")
          .select("id,name,type,min_stock")
          .eq("is_active", true),
        supabase.from("stock_movements").select("id,product_id,movement_type,quantity"),
      ]);

      setItems((itemsRes.data as InventoryItem[]) || []);
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

  const totalProducts = items.filter((item) => item.type === "product").length;
  const totalIngredients = items.filter((item) => item.type === "ingredient").length;

  const totalStock = useMemo(() => {
    return items.reduce((sum, item) => sum + (stockMap.get(item.id) || 0), 0);
  }, [items, stockMap]);

  const lowStock = useMemo(() => {
    return items
      .map((item) => ({
        ...item,
        stock: stockMap.get(item.id) || 0,
        threshold: item.min_stock > 0 ? item.min_stock : 10,
      }))
      .filter((item) => item.stock < item.threshold)
      .sort((a, b) => a.stock - b.stock);
  }, [items, stockMap]);

  const detailPath = (item: InventoryItem) =>
    item.type === "ingredient" ? `/products/ingredients/${item.id}` : `/products/catalogue/${item.id}`;

  return (
    <AppLayout title="Dashboard">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Total Produk</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalProducts}</CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Total Bahan Baku</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalIngredients}</CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Total Stok</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalStock}</CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Perlu Restock</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{lowStock.length}</CardContent>
        </Card>
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
                  to={detailPath(item)}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm transition hover:bg-slate-100"
                >
                  <div>
                    <span className="font-medium text-slate-800">{item.name}</span>
                    <p className="mt-0.5 text-xs capitalize text-slate-500">{item.type}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Sisa: {item.stock} / Min: {item.threshold}
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