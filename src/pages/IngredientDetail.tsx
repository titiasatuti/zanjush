import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { Boxes, PackageCheck, QrCode, Save, Trash2, Printer } from "lucide-react";
import { canReduceStock } from "@/lib/stock-utils";
import { logActivity } from "@/lib/activity-log";
import { DetailPhotoUploadButton } from "@/components/detail-photo-upload-button";
import { formatDateId } from "@/lib/expiry-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Ingredient = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  min_stock: number;
  photo_url: string | null;
  last_purchase_date: string | null;
  expiry_date: string | null;
};

type Movement = {
  movement_type: string;
  quantity: number;
};

type BatchRow = {
  id: string;
  batch_code: string;
  production_date: string;
  expiry_date: string;
  initial_quantity: number;
  remaining_quantity: number;
  qr_payload: string | null;
  created_at: string;
};

const IngredientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [minStock, setMinStock] = useState("10");
  const [lastPurchaseDate, setLastPurchaseDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [adjustQty, setAdjustQty] = useState("1");
  const [stockInPurchaseDate, setStockInPurchaseDate] = useState("");
  const [stockInExpiryDate, setStockInExpiryDate] = useState("");
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [stockActionLoading, setStockActionLoading] = useState<"in" | "out" | null>(null);

  const [labelPayload, setLabelPayload] = useState("");
  const [labelTitle, setLabelTitle] = useState("");
  const [isPreparingBatchLabelId, setIsPreparingBatchLabelId] = useState<string | null>(null);
  const [isDeletingBatchId, setIsDeletingBatchId] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  const stockLeft = useMemo(() => {
    return movements.reduce((sum, movement) => {
      const sign = ["in", "return", "adjust"].includes(movement.movement_type) ? 1 : -1;
      return sum + sign * movement.quantity;
    }, 0);
  }, [movements]);

  const qrUrl = useMemo(() => {
    if (!labelPayload) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(labelPayload)}`;
  }, [labelPayload]);

  const loadMovements = async () => {
    if (!id) return;

    const { data } = await supabase
      .from("stock_movements")
      .select("movement_type,quantity")
      .eq("product_id", id);

    setMovements((data as Movement[]) || []);
  };

  const loadBatches = async () => {
    if (!id) return;

    const { data } = await supabase
      .from("stock_batches")
      .select("id,batch_code,production_date,expiry_date,initial_quantity,remaining_quantity,qr_payload,created_at")
      .eq("product_id", id)
      .order("created_at", { ascending: false });

    setBatches((data as BatchRow[]) || []);
  };

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id,name,sku,unit,min_stock,photo_url,last_purchase_date,expiry_date")
        .eq("id", id)
        .eq("type", "ingredient")
        .single();

      if (error || !data) {
        showError("Bahan baku tidak ditemukan");
        navigate("/products/ingredients");
        return;
      }

      setIngredient(data as Ingredient);
      setName(data.name);
      setSku(data.sku);
      setUnit(data.unit);
      setMinStock(data.min_stock?.toString() || "10");
      setLastPurchaseDate(data.last_purchase_date || "");
      setExpiryDate(data.expiry_date || "");
    };

    load();
    loadMovements();
    loadBatches();
  }, [id, navigate]);

  const updateIngredientPhoto = (photoUrl: string) => {
    setIngredient((current) => (current ? { ...current, photo_url: photoUrl } : current));
  };

  const saveChanges = async () => {
    if (!id) return;
    if (!name.trim()) return showError("Nama bahan baku wajib diisi");
    if (!sku.trim()) return showError("Kode / SKU wajib diisi");
    if (!unit.trim()) return showError("Satuan wajib diisi");

    const minStockNumber = Number(minStock || 0);
    if (Number.isNaN(minStockNumber) || minStockNumber < 0) {
      return showError("Minimum stok tidak valid");
    }

    if (lastPurchaseDate && expiryDate && expiryDate < lastPurchaseDate) {
      return showError("Tanggal expired tidak boleh lebih awal dari tanggal pembelian");
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("items")
      .update({
        name: name.trim(),
        sku: sku.trim(),
        unit: unit.trim().toLowerCase(),
        min_stock: minStockNumber,
        last_purchase_date: lastPurchaseDate || null,
        expiry_date: expiryDate || null,
      })
      .eq("id", id);

    setIsSaving(false);

    if (error) return showError(error.message);
    await logActivity("update_ingredient", `Mengubah bahan baku: ${name.trim()}`);
    showSuccess("Perubahan bahan baku disimpan");
  };

  const ensureBatchToken = async (batch: BatchRow) => {
    if (batch.qr_payload) return batch.qr_payload;

    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase
      .from("stock_batches")
      .update({ qr_payload: token })
      .eq("id", batch.id);

    if (error) throw error;

    setBatches((current) =>
      current.map((row) => (row.id === batch.id ? { ...row, qr_payload: token } : row)),
    );

    return token;
  };

  const showBatchQr = async (batch: BatchRow) => {
    if (!ingredient) return;

    setIsPreparingBatchLabelId(batch.id);

    try {
      const token = await ensureBatchToken(batch);
      const payload = `v1:${token}`;
      setLabelPayload(payload);
      setLabelTitle(`${ingredient.name} - ${batch.batch_code}`);
      setIsQrDialogOpen(true);
      await logActivity("create_label", `Membuka label QR batch ${batch.batch_code} untuk bahan baku ${ingredient.name}`);
      showSuccess("QR batch ditampilkan");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyiapkan label batch";
      showError(message);
    }

    setIsPreparingBatchLabelId(null);
  };

  const deleteBatch = async (batch: BatchRow) => {
    if (!ingredient) return;
    if (batch.remaining_quantity > 0) {
      return showError("Batch hanya bisa dihapus jika sisa qty sudah 0");
    }

    const confirmed = window.confirm(`Hapus batch ${batch.batch_code}? Riwayat pergerakan stok tetap disimpan.`);
    if (!confirmed) return;

    setIsDeletingBatchId(batch.id);

    const { error: detachError } = await supabase
      .from("stock_movements")
      .update({ batch_id: null })
      .eq("batch_id", batch.id);

    if (detachError) {
      setIsDeletingBatchId(null);
      return showError(detachError.message);
    }

    const { data: removedBatchRows, error } = await supabase
      .from("stock_batches")
      .delete()
      .eq("id", batch.id)
      .select("id");

    setIsDeletingBatchId(null);

    if (error) return showError(error.message);
    if (!removedBatchRows || removedBatchRows.length === 0) {
      return showError("Batch gagal dihapus. Cek izin akses atau relasi data.");
    }

    await logActivity("delete_batch", `Menghapus batch ${batch.batch_code} pada bahan baku ${ingredient.name}`);
    showSuccess("Batch berhasil dihapus");
    setBatches((current) => current.filter((row) => row.id !== batch.id));
    await loadBatches();
  };

  const addStock = async () => {
    if (!id) return;
    if (stockActionLoading) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Jumlah harus lebih dari 0");

    if (!stockInPurchaseDate) return showError("Tanggal pembelian batch wajib diisi");
    if (!stockInExpiryDate) return showError("Tanggal expired batch wajib diisi");
    if (stockInExpiryDate < stockInPurchaseDate) {
      return showError("Tanggal expired batch tidak boleh lebih awal dari tanggal pembelian");
    }

    setStockActionLoading("in");

    const { data: insertedBatch, error: batchError } = await supabase
      .from("stock_batches")
      .insert({
        product_id: id,
        batch_code: `ING-${Date.now()}`,
        production_date: stockInPurchaseDate,
        expiry_date: stockInExpiryDate,
        initial_quantity: qty,
        remaining_quantity: qty,
        note: "Batch pembelian bahan baku",
        qr_payload: crypto.randomUUID().replace(/-/g, ""),
      })
      .select("id")
      .single();

    if (batchError || !insertedBatch) {
      setStockActionLoading(null);
      return showError(batchError?.message || "Gagal membuat batch");
    }

    const { error } = await supabase.from("stock_movements").insert({
      product_id: id,
      batch_id: insertedBatch.id,
      movement_type: "in",
      quantity: qty,
      note: "Penyesuaian stok manual dari halaman detail bahan baku",
    });

    if (error) {
      setStockActionLoading(null);
      return showError(error.message);
    }

    setStockActionLoading(null);

    await logActivity("stock_in", `Menambah stok bahan baku ${name} sebanyak ${qty}`);
    showSuccess("Stok bahan baku berhasil ditambah");
    setStockInPurchaseDate("");
    setStockInExpiryDate("");
    loadMovements();
    loadBatches();
  };

  const removeStock = async () => {
    if (!id) return;
    if (stockActionLoading) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Jumlah harus lebih dari 0");

    setStockActionLoading("out");

    const stockCheck = await canReduceStock(id, qty);
    if (!stockCheck.allowed) {
      setStockActionLoading(null);
      await logActivity("blocked_negative_stock", `Pengurangan bahan baku ${name} ditolak: stok ${stockCheck.currentStock}, diminta ${qty}`);
      return showError(`Stok tidak cukup. Stok tersedia: ${stockCheck.currentStock}`);
    }

    const { error } = await supabase.from("stock_movements").insert({
      product_id: id,
      movement_type: "out",
      quantity: qty,
      note: "Penyesuaian stok manual dari halaman detail bahan baku",
    });

    if (error) {
      setStockActionLoading(null);
      return showError(error.message);
    }

    setStockActionLoading(null);

    await logActivity("stock_out", `Mengurangi stok bahan baku ${name} sebanyak ${qty}`);
    showSuccess("Stok bahan baku berhasil dikurangi");
    loadMovements();
    loadBatches();
  };

  const deactivateIngredient = async () => {
    if (!id) return;

    const { error } = await supabase.from("items").update({ is_active: false }).eq("id", id);
    if (error) return showError(error.message);

    await logActivity("delete_ingredient", `Menghapus bahan baku: ${name}`);
    showSuccess("Bahan baku dihapus");
    navigate("/products/ingredients");
  };

  if (!ingredient || !id) {
    return (
      <AppLayout title="Detail Bahan Baku" backTo="/products/ingredients">
        <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">Memuat data bahan baku...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Detail Bahan Baku" backTo="/products/ingredients">
      <div className="space-y-4">
        <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ringkasan Bahan Baku</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{ingredient.name}</h2>
              <p className="text-sm text-slate-500">SKU: {ingredient.sku || "-"}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-right">
              <p className="text-xs font-medium text-emerald-700">Stok Tersisa</p>
              <p className="text-2xl font-bold text-emerald-800">{stockLeft}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pembelian Terakhir</p>
              <p className="font-semibold text-slate-900">{lastPurchaseDate ? formatDateId(lastPurchaseDate) : "Belum diisi"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tanggal Expired</p>
              <p className="font-semibold text-slate-900">{expiryDate ? formatDateId(expiryDate) : "Belum diisi"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Minimum Stok</p>
              <p className="font-semibold text-slate-900">{minStock || "0"}</p>
            </div>
          </div>
        </section>

        <Tabs defaultValue="master" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="master" className="rounded-xl">Data Bahan</TabsTrigger>
            <TabsTrigger value="stock" className="rounded-xl">Stok & Batch</TabsTrigger>
          </TabsList>

          <TabsContent value="master" className="space-y-4">
          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Informasi Bahan Baku</h3>
                <p className="text-sm text-slate-500">Khusus edit data master bahan baku.</p>
              </div>
            </div>

            {ingredient.photo_url ? (
              <div className="relative mb-5">
                <img src={ingredient.photo_url} alt={ingredient.name} className="h-56 w-full rounded-3xl object-cover" />
                <DetailPhotoUploadButton
                  itemId={id}
                  itemType="ingredient"
                  title={ingredient.name}
                  onUploaded={updateIngredientPhoto}
                  className="absolute bottom-3 right-3"
                />
              </div>
            ) : (
              <div className="mb-5">
                <DetailPhotoUploadButton
                  itemId={id}
                  itemType="ingredient"
                  title={name || "bahan baku"}
                  variant="full"
                  onUploaded={updateIngredientPhoto}
                />
              </div>
            )}

            <div className="grid gap-4">
              <div>
                <Label className="text-sm font-semibold text-slate-700">Nama</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Kode / SKU</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Satuan</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Minimum stok</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking umur bahan</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Tanggal pembelian terakhir</Label>
                    <Input className="mt-1 h-12 rounded-2xl bg-white text-base" type="date" value={lastPurchaseDate} onChange={(e) => setLastPurchaseDate(e.target.value)} />
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Tanggal expired</Label>
                    <Input className="mt-1 h-12 rounded-2xl bg-white text-base" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                  </div>
                </div>
              </div>

              <Button className="h-12 rounded-2xl bg-emerald-500 text-base hover:bg-emerald-600" onClick={saveChanges} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </section>
          </TabsContent>

          <TabsContent value="stock" className="space-y-4">
          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Atur Stok</h3>
                <p className="text-sm text-slate-500">Khusus transaksi tambah/kurangi stok.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <Label className="text-sm font-semibold text-slate-700">Jumlah</Label>
                <Input
                  className="mt-1 h-12 rounded-2xl text-base"
                  type="number"
                  min={1}
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  disabled={stockActionLoading !== null}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  className="h-12 flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-600 sm:flex-none"
                  onClick={addStock}
                  disabled={stockActionLoading !== null}
                >
                  {stockActionLoading === "in" ? "Menambah..." : "Tambah"}
                </Button>
                <Button
                  variant="secondary"
                  className="h-12 flex-1 rounded-2xl sm:flex-none"
                  onClick={removeStock}
                  disabled={stockActionLoading !== null}
                >
                  {stockActionLoading === "out" ? "Mengurangi..." : "Kurangi"}
                </Button>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data batch stok masuk</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">Tanggal pembelian batch</Label>
                  <Input
                    className="mt-1 h-12 rounded-2xl bg-white text-base"
                    type="date"
                    value={stockInPurchaseDate}
                    onChange={(e) => setStockInPurchaseDate(e.target.value)}
                    disabled={stockActionLoading !== null}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">Tanggal expired batch</Label>
                  <Input
                    className="mt-1 h-12 rounded-2xl bg-white text-base"
                    type="date"
                    value={stockInExpiryDate}
                    onChange={(e) => setStockInExpiryDate(e.target.value)}
                    disabled={stockActionLoading !== null}
                  />
                </div>
              </div>
            </div>

            <Button variant="destructive" className="mt-4 h-11 rounded-2xl" onClick={deactivateIngredient}>
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus Bahan Baku
            </Button>
          </section>

          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Riwayat Batch Bahan Baku</h3>
            <p className="mt-1 text-sm text-slate-500">Fokus pada tanggal pembelian, expired, dan qty tersisa tiap batch.</p>

            <div className="mt-4 space-y-2">
              {batches.length ? (
                batches.map((batch) => (
                  <div key={batch.id} className="rounded-2xl border bg-slate-50 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kode Batch</p>
                        <p className="font-semibold text-slate-900">{batch.batch_code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qty Tersisa</p>
                        <p className={`text-2xl font-bold ${batch.remaining_quantity > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {batch.remaining_quantity}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Pembelian</p>
                        <p className="text-sm font-semibold text-slate-900">{formatDateId(batch.production_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Expired</p>
                        <p className="text-sm font-semibold text-slate-900">{formatDateId(batch.expiry_date)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-500">Qty awal: {batch.initial_quantity}</p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => showBatchQr(batch)}
                          disabled={isPreparingBatchLabelId === batch.id || isDeletingBatchId === batch.id}
                          aria-label={`Tampilkan QR ${batch.batch_code}`}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => deleteBatch(batch)}
                          disabled={batch.remaining_quantity > 0 || isDeletingBatchId === batch.id || isPreparingBatchLabelId === batch.id}
                          aria-label={`Hapus batch ${batch.batch_code}`}
                          title={batch.remaining_quantity > 0 ? "Hanya bisa dihapus jika qty tersisa 0" : "Hapus batch"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada batch tersimpan.</p>
              )}
            </div>
          </section>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labelTitle || "QR Batch"}</DialogTitle>
          </DialogHeader>
          {labelPayload ? (
            <div className="space-y-3">
              <div className="mx-auto flex aspect-square w-full max-w-[360px] items-center justify-center rounded-2xl border bg-slate-50 p-4">
                <img src={qrUrl} alt="Label QR" className="h-64 w-64 rounded-xl border bg-white object-contain" />
              </div>
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-violet-500 hover:bg-violet-600"
                onClick={() => {
                  const params = new URLSearchParams({
                    name: labelTitle || ingredient.name,
                    payload: labelPayload,
                    type: "Bahan Baku",
                  });
                  window.open(`/print-label?${params.toString()}`, "_blank", "noopener,noreferrer");
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print QR Batch
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">QR batch belum dipilih.</p>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default IngredientDetail;