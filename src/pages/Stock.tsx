import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

const Stock = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState("");

  useEffect(() => {
    const load = async () => {
      let query = supabase.from("stock_movements").select("*").order("created_at", { ascending: false });
      if (type) query = query.eq("movement_type", type);
      const { data } = await query.limit(100);
      setRows(data || []);
    };
    load();
  }, [type]);

  return (
    <AppLayout title="Stock Ledger">
      <div className="mb-3 max-w-xs">
        <Input placeholder="Filter movement type" value={type} onChange={(e) => setType(e.target.value)} />
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-white p-3 text-sm">
            <p className="font-medium">{r.movement_type} • qty {r.quantity}</p>
            <p className="text-slate-500">{new Date(r.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

export default Stock;