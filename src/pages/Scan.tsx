import { useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { QrCameraScanner } from "@/components/qr-camera-scanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ResolvedItem = {
  id: string;
  name: string;
  unit?: string | null;
  sell_price?: number | null;
  kind: "product" | "ingredient";
  stock: number;
  batchId: string;
};

const Scan = () => {
  const [payload, setPayload] = useState("");
  const [qty, setQty] = useState(1);
  const [resolved, setResolved] = useState<ResolvedItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const safeQty = useMemo(() => (qty > 0 ? qty : 1), [qty]);

  const readStock = async (itemId: string) => {
    const { data } = await supabase
      .from("stock_movements")
      .select("movement_type,quantity")
      .eq("product_id", itemId);

    return (data || []).reduce((sum, row) => {
      const sign = ["in", "return", "adjust"].includes(row.movement_type) ? 1 : -1;
      return sum + sign * row.quantity;
    }, 0);
  };

  const resolveToken = async (rawPayload: string) => {
    const token = rawPayload.startsWith("v1:") ? rawPayload.replace("v1:", "") : rawPayload;
    const { data: batch, error } = await supabase
      .from("stock_batches")
      .select("id,product_id")
      .eq("qr_payload", token)
      .maybeSingle();

    if (error || !batch) {
      showError("Token not found");
      return;
    }

    const [productRes, ingredientRes, stock] = await Promise.all([
      supabase.from("products").select("id,name,unit,sell_price").eq("id", batch.product_id).maybeSingle(),
      supabase
        .from("items")
        .select("id,name,unit,type")
        .eq("id", batch.product_id)
        .eq("type", "ingredient")
        .maybeSingle(),
      readStock(batch.product_id),
    ]);

    if (productRes.data) {
      setResolved({
        id: productRes.data.id,
        name: productRes.data.name,
        unit: productRes.data.unit,
        sell_price: productRes.data.sell_price,
        kind: "product",
        stock,
        batchId: batch.id,
      });
      setPayload(rawPayload);
      setIsOpen(true);
      showSuccess("Label produk ditemukan");
      return;
    }

    if (ingredientRes.data) {
      setResolved({
        id: ingredientRes.data.id,
        name: ingredientRes.data.name,
        unit: ingredientRes.data.unit,
        kind: "ingredient",
        stock,
        batchId: batch.id,
      });
      setPayload(rawPayload);
      setIsOpen(true);
      showSuccess("Label bahan baku ditemukan");
      return;
    }

    showError("Data item tidak ditemukan dari token");
  };

  const resolve = async () => {
    if (!payload.trim()) {
      showError("Please scan or enter a payload");
      return;
    }
    await resolveToken(payload.trim());
  };

  const postMovement = async (type: "in" | "out") => {
    if (!resolved) return;
    const { error } = await supabase.from("stock_movements").insert({
      product_id: resolved.id,
      batch_id: resolved.batchId,
      movement_type: type,
      quantity: safeQty,
      note: `Scan ${resolved.kind} operation`,
    });

    if (error) return showError(error.message);

    const newStock = type === "in" ? resolved.stock + safeQty : resolved.stock - safeQty;
    setResolved({ ...resolved, stock: newStock });
    showSuccess("Stock updated");
  };

  return (
    <AppLayout title="Scan QR">
      <div className="grid gap-4">
        <QrCameraScanner onDetected={resolveToken} />

        <div className="rounded-3xl border bg-white p-4">
          <p className="mb-2 text-sm text-slate-600">
            Manual / USB scanner input fallback (opaque token only).
          </p>
          <div className="flex gap-2">
            <Input
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="v1:token..."
              className="rounded-xl"
            />
            <Button onClick={resolve} className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
              Resolve
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolved?.kind === "product" ? "Detail Produk" : "Detail Bahan Baku"}
            </DialogTitle>
          </DialogHeader>

          {resolved && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Nama</p>
                <p className="font-semibold text-slate-900">{resolved.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-500">Stock</p>
                  <p className="font-semibold text-slate-900">{resolved.stock}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-500">Harga Jual</p>
                  <p className="font-semibold text-slate-900">
                    {resolved.kind === "product" && typeof resolved.sell_price === "number"
                      ? `Rp ${resolved.sell_price.toLocaleString()}`
                      : "-"}
                  </p>
                </div>
              </div>

              <Input
                className="rounded-xl"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />

              <div className="flex gap-2">
                <Button onClick={() => postMovement("in")} className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600">
                  Tambah Stok
                </Button>
                <Button onClick={() => postMovement("out")} variant="secondary" className="flex-1 rounded-xl">
                  Kurangi Stok
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Scan;