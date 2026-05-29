import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { QrCameraScanner } from "@/components/qr-camera-scanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canReduceStock, readItemStock } from "@/lib/stock-utils";
import { logActivity } from "@/lib/activity-log";
import { formatDateId, getExpiryBadgeClass, getExpiryMeta } from "@/lib/expiry-utils";

type ResolvedItem = {
  id: string;
  name: string;
  unit?: string | null;
  sell_price?: number | null;
  kind: "product" | "ingredient";
  stock: number;
  batchId: string;
  productionDate: string | null;
  expiryDate: string | null;
};

const Scan = () => {
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const [payload, setPayload] = useState("");
  const [qty, setQty] = useState(1);
  const [resolved, setResolved] = useState<ResolvedItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const safeQty = useMemo(() => (qty > 0 ? qty : 1), [qty]);

  useEffect(() => {
    manualInputRef.current?.focus();
  }, []);

  const resolveToken = async (rawPayload: string) => {
    const cleanPayload = rawPayload.trim();
    if (!cleanPayload || isResolving) return;

    setIsResolving(true);

    const token = cleanPayload.startsWith("v1:") ? cleanPayload.replace("v1:", "") : cleanPayload;
    const { data: batch, error } = await supabase
      .from("stock_batches")
      .select("id,product_id,production_date,expiry_date")
      .eq("qr_payload", token)
      .maybeSingle();

    if (error || !batch) {
      setIsResolving(false);
      showError("Token tidak ditemukan");
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
      readItemStock(batch.product_id),
    ]);

    setIsResolving(false);

    if (productRes.data) {
      setResolved({
        id: productRes.data.id,
        name: productRes.data.name,
        unit: productRes.data.unit,
        sell_price: productRes.data.sell_price,
        kind: "product",
        stock,
        batchId: batch.id,
        productionDate: batch.production_date,
        expiryDate: batch.expiry_date,
      });
      setPayload(cleanPayload);
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
        productionDate: batch.production_date,
        expiryDate: batch.expiry_date,
      });
      setPayload(cleanPayload);
      setIsOpen(true);
      showSuccess("Label bahan baku ditemukan");
      return;
    }

    showError("Data item tidak ditemukan dari token");
  };

  const resolve = async () => {
    if (!payload.trim()) {
      showError("Scan atau masukkan payload terlebih dahulu");
      return;
    }
    await resolveToken(payload.trim());
  };

  const closeResult = () => {
    setIsOpen(false);
    setPayload("");
    setResolved(null);
    setQty(1);
    window.setTimeout(() => manualInputRef.current?.focus(), 100);
  };

  const postMovement = async (type: "in" | "out") => {
    if (!resolved || isPosting) return;

    setIsPosting(true);

    if (resolved.kind === "product") {
      setIsPosting(false);
      return showError("Produk dibuat per pesanan. Gunakan halaman detail produk untuk proses pesanan.");
    }

    if (type === "out") {
      const stockCheck = await canReduceStock(resolved.id, safeQty);
      if (!stockCheck.allowed) {
        await logActivity(
          "blocked_negative_stock",
          `Scan ditolak: ${resolved.name} stok ${stockCheck.currentStock}, diminta keluar ${safeQty}`,
        );
        showError(`Stok tidak cukup. Stok tersedia: ${stockCheck.currentStock}`);
        setResolved({ ...resolved, stock: stockCheck.currentStock });
        setIsPosting(false);
        return;
      }
    }

    const { data: currentBatch, error: batchReadError } = await supabase
      .from("stock_batches")
      .select("id,remaining_quantity")
      .eq("id", resolved.batchId)
      .single();

    if (batchReadError || !currentBatch) {
      setIsPosting(false);
      return showError(batchReadError?.message || "Batch tidak ditemukan");
    }

    const previousRemaining = currentBatch.remaining_quantity;
    const nextRemaining = type === "in" ? previousRemaining + safeQty : previousRemaining - safeQty;

    if (type === "out" && nextRemaining < 0) {
      setIsPosting(false);
      return showError(`Qty batch tidak cukup. Sisa batch: ${previousRemaining}`);
    }

    const { data: updatedBatch, error: batchUpdateError } = await supabase
      .from("stock_batches")
      .update({ remaining_quantity: nextRemaining })
      .eq("id", resolved.batchId)
      .eq("remaining_quantity", previousRemaining)
      .select("id")
      .single();

    if (batchUpdateError || !updatedBatch) {
      setIsPosting(false);
      return showError("Batch berubah saat diproses. Silakan ulang scan.");
    }

    const { error } = await supabase.from("stock_movements").insert({
      product_id: resolved.id,
      batch_id: resolved.batchId,
      movement_type: type,
      quantity: safeQty,
      note: `Operasi scan ${resolved.kind}`,
    });

    if (error) {
      await supabase
        .from("stock_batches")
        .update({ remaining_quantity: previousRemaining })
        .eq("id", resolved.batchId);
      setIsPosting(false);
      return showError(error.message);
    }

    const newStock = type === "in" ? resolved.stock + safeQty : resolved.stock - safeQty;
    setResolved({ ...resolved, stock: newStock });
    await logActivity(
      type === "in" ? "scan_stock_in" : "scan_stock_out",
      `Scan ${type === "in" ? "tambah" : "kurangi"} stok ${resolved.name} sebanyak ${safeQty} pada batch`,
    );
    showSuccess(type === "in" ? "Stok berhasil ditambah" : "Stok berhasil dikurangi");
    setIsPosting(false);
  };

  return (
    <AppLayout title="Scan QR">
      <div className="grid gap-4">
        <QrCameraScanner onDetected={resolveToken} />

        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Input scanner USB / manual
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Kolom ini otomatis fokus. Scan barcode/QR dengan scanner USB lalu tekan Enter.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              ref={manualInputRef}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") resolve();
              }}
              placeholder="v1:token..."
              className="h-12 rounded-2xl"
            />
            <Button
              onClick={resolve}
              disabled={isResolving}
              className="h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600"
            >
              {isResolving ? "Mencari..." : "Cari"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : closeResult())}>
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
                  <p className="text-sm text-slate-500">Stok</p>
                  <p className="font-semibold text-slate-900">
                    {resolved.stock} {resolved.unit || ""}
                  </p>
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

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-500">{resolved.kind === "product" ? "Tanggal pembuatan" : "Tanggal pembelian"}</p>
                  <p className="font-semibold text-slate-900">{formatDateId(resolved.productionDate)}</p>
                </div>
                <div className={`rounded-xl p-3 ${getExpiryBadgeClass(getExpiryMeta(resolved.expiryDate).status)}`}>
                  <p className="text-sm text-slate-500">Tanggal expired</p>
                  <p className="font-semibold">{formatDateId(resolved.expiryDate)}</p>
                  <p className="mt-1 text-xs">{getExpiryMeta(resolved.expiryDate).label}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Jumlah</p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 5, 10].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={qty === value ? "default" : "secondary"}
                      className="rounded-xl"
                      onClick={() => setQty(value)}
                    >
                      {value}
                    </Button>
                  ))}
                  <Input
                    className="rounded-xl text-center"
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                  />
                </div>
              </div>

              {resolved.kind === "ingredient" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    onClick={() => postMovement("in")}
                    disabled={isPosting}
                    className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600"
                  >
                    Tambah Stok Batch
                  </Button>
                  <Button
                    onClick={() => postMovement("out")}
                    disabled={isPosting}
                    variant="secondary"
                    className="h-12 rounded-xl"
                  >
                    Kurangi Stok Batch
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  Produk bersifat made-by-order. Proses pesanan produk dilakukan dari halaman detail produk agar bahan baku otomatis terpakai (FEFO).
                </div>
              )}

              <Button type="button" variant="ghost" onClick={closeResult} className="w-full rounded-xl">
                Selesai & Scan Lagi
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Scan;