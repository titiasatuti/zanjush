import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type Item = {
  id: string;
  name: string;
  type: "product" | "ingredient";
  min_stock: number;
};

type Movement = {
  id: string;
  item_id: string;
  movement_type: string;
  quantity: number;
  created_at: string;
};

type Batch = {
  id: string;
  product_id: string;
  expiry_date: string;
};

const Dashboard = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const load = async () => {
      const [itemsRes, movementsRes, batchesRes] = await Promise.all([
        supabase.from("items").select("id,name,type,min_stock").eq("is_active", true),
        supabase.from("stock_movements").select("id,item_id,movement_type,quantity,created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("stock_batches").select("id,product_id,expiry_date"),
      ]);
      setItems((itemsRes.data as Item[]) || []);
      setMovements((movementsRes.data as Movement[]) || []);
      setBatches((batchesRes.data as Batch[]) || []);
    };
    load();
  }, []);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    movements.forEach((m) => {
      const sign = ["in", "return", "adjust"].includes(m.movement_type) ? 1 : -1;
      map.set(m.item_id, (map.get(m.item_id) || 0) + sign * m.quantity);
    });
    return map;
  }, [movements]);

  const lowStock = items.filter((i) => (stockMap.get(i.id) || 0) <= i.min_stock);
  const expiringSoon = batches.filter((b) => {
    const days = (new Date(b.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 14;
  });

  return (
    <AppLayout title="Dashboard">
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Total Products</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{items.filter(i => i.type === "product").length}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Total Stock</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Array.from(stockMap.values()).reduce((a, b) => a + b, 0)}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Low Stock</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{lowStock.length}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Expiring Soon</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{expiringSoon.length}</CardContent></Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild className="rounded-xl bg-emerald-500 hover:bg-emerald-600"><Link to="/products">Create Product</Link></Button>
        <Button asChild variant="secondary" className="rounded-xl"><Link to="/scan">Scan QR</Link></Button>
        <Button asChild variant="secondary" className="rounded-xl"><Link to="/labels">Create Label</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl"><CardHeader><CardTitle>Need Restock Now</CardTitle></CardHeader><CardContent>{lowStock.length ? lowStock.map(i => <p key={i.id} className="text-sm">{i.name}</p>) : <p className="text-sm text-slate-500">No urgent restock items.</p>}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle>Expiring Soon</CardTitle></CardHeader><CardContent>{expiringSoon.length ? expiringSoon.map(b => <p key={b.id} className="text-sm">Batch {b.id.slice(0, 8)}…</p>) : <p className="text-sm text-slate-500">No upcoming expiries.</p>}</CardContent></Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;