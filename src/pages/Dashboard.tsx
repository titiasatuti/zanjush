import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, PackageCheck } from "lucide-react";

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
  created_at?: string;
};

const Dashboard = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorText("");

      const [itemsRes, movementsRes] = await Promise.all([
        supabase
          .from("items")
          .select("id,name,type,min_stock")
          .eq("is_active", true),
        supabase.from("stock_movements").select("id,product_id,movement_type,quantity,created_at"),
      ]);

      if (itemsRes.error || movementsRes.error) {
        setErrorText(itemsRes.error?.message || movementsRes.error?.message || "Gagal memuat dashboard");
        setIsLoading(false);
        return;
      }

      setItems((itemsRes.data as InventoryItem[]) || []);
      setMovements((movementsRes.data as Movement[]) || []);
      setIsLoading(false);
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

  const todayMovements = useMemo(() => {
    const today = new Date().toDateString();
    return movements.filter((movement) => {
      if (!movement.created_at) return false;
      return new Date(movement.created_at).toDateString() === today;
    });
  }, [movements]);

  const stockInToday = todayMovements
    .filter((movement) => ["in", "return", "adjust"].includes(movement.movement_type))
    .reduce((sum, movement) => sum + movement.quantity, 0);

  const stockOutToday = todayMovements
    .filter((movement) => !["in", "return", "adjust"].includes(movement.movement_type))
    .reduce((sum, movement) => sum + movement.quantity, 0);

  const mostActiveItems = useMemo(() => {
    const movementCount = new Map<string, number>();
    movements.forEach((movement) => {
      movementCount.set(movement.product_id, (movementCount.get(movement.product_id) || 0) + 1);
    });

    return Array.from(movementCount.entries())
      .map(([itemId, count]) => ({
        item: items.find((item) => item.id === itemId),
        count,
      }))
      .filter((row) => row.item)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [items, movements]);

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
    <AppLayout title="Dasbor">
      {isLoading ? (
        <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">Memuat data operasional...</div>
      ) : errorText ? (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-sm font-medium text-rose-700 shadow-sm">{errorText}</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-emerald-100">
              <CardHeader>
                <CardTitle className="text-sm">Total Produk</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-semibold">{totalProducts}</span>
                <PackageCheck className="h-6 w-6 text-emerald-600" />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-amber-100">
              <CardHeader>
                <CardTitle className="text-sm">Total Bahan Baku</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{totalIngredients}</CardContent>
            </Card>

            <Card className="rounded-2xl border-sky-100">
              <CardHeader>
                <CardTitle className="text-sm">Stok Masuk Hari Ini</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-semibold">{stockInToday}</span>
                <ArrowUpCircle className="h-6 w-6 text-sky-600" />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-orange-100">
              <CardHeader>
                <CardTitle className="text-sm">Stok Keluar Hari Ini</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-semibold">{stockOutToday}</span>
                <ArrowDownCircle className="h-6 w-6 text-orange-600" />
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-3">
            <Card className="rounded-2xl lg:col-span-2">
              <CardHeader>
                <CardTitle>Perlu Restock Sekarang</CardTitle>
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
                          <p className="mt-0.5 text-xs capitalize text-slate-500">{item.type === "product" ? "produk" : "bahan baku"}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          Sisa: {item.stock} / Min: {item.threshold}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Tidak ada item yang perlu restock mendesak.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-rose-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                  Ringkasan Stok
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-slate-500">Total stok tercatat</p>
                  <p className="text-2xl font-bold text-slate-900">{totalStock}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="text-amber-700">Item di bawah minimum</p>
                  <p className="text-2xl font-bold text-amber-800">{lowStock.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Item Paling Aktif</CardTitle>
            </CardHeader>
            <CardContent>
              {mostActiveItems.length ? (
                <div className="space-y-2">
                  {mostActiveItems.map((row) => (
                    <Link
                      key={row.item!.id}
                      to={detailPath(row.item!)}
                      className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm transition hover:bg-slate-100"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{row.item!.name}</p>
                        <p className="text-xs text-slate-500">{row.item!.type === "product" ? "Produk" : "Bahan baku"}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {row.count} movement
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Belum ada aktivitas stok.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
};

export default Dashboard;