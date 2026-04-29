import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { PackageCheck, QrCode, Save, Trash2 } from "lucide-react";
import { canReduceStock } from "@/lib/stock-utils";
import { logActivity } from "@/lib/activity-log";

type Ingredient = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  photo_url: string | null;
};

type Movement = {
  movement_type: string;
  quantity: number;
};

const IngredientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [adjustQty, setAdjustQty] = useState("1");
  const [isSaving, setIsSaving] = useState(false);

  const [labelPayload, setLabelPayload] = useState("");
  const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);

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

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id,name,sku,unit,photo_url")
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
    };

    load();
    loadMovements();
  }, [id, navigate]);

  const saveChanges = async () => {
    if (!id) return;
    if (!name.trim()) return showError("Nama bahan baku wajib diisi");
    if (!sku.trim()) return showError("Kode / SKU wajib diisi");
    if (!unit.trim()) return showError("Satuan wajib diisi");

    setIsSaving(true);

    const { error } = await supabase
      .from("items")
      .update({
        name: name.trim(),
        sku: sku.trim(),
        unit: unit.trim().toLowerCase(),
      })
      .eq("id", id);

    setIsSaving(false);

    if (error) return showError(error.message);
    await logActivity("update_ingredient", `Mengubah bahan baku: ${name.trim()}`);
    showSuccess("Perubahan bahan baku disimpan");
  };

  const generateLabel = async () => {
    if (!id || !ingredient) return;
    setIsGeneratingLabel(true);

    const token = crypto.randomUUID().replace(/-/g, "");
    const securePayload = `v1:${token}`;
    const today = new Date().toISOString().slice(0, 10);
    const farFuture = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { error } = await supabase.from("stock_batches").insert({
      product_id: id,
      batch_code: `LBL-ING-${Date.now()}`,
      production_date: today,
      expiry_date: farFuture,
      qr_payload: token,
    });

    setIsGeneratingLabel(false);

    if (error) return showError(error.message);
    setLabelPayload(securePayload);
    await logActivity("create_label", `Membuat label QR bahan baku: ${ingredient.name}`);
    showSuccess("Label bahan baku berhasil dibuat");
  };

  const printLabel = () => window.print();

  const addStock = async () => {
    if (!id) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Qty harus lebih dari 0");

    const { error } = await supabase.from("stock_movements").insert({
      product_id: id,
      movement_type: "in",
      quantity: qty,
      note: "Manual stock adjustment from ingredient detail page",
    });

    if (error) return showError(error.message);

    await logActivity("stock_in", `Menambah stok bahan baku ${name} sebanyak ${qty}`);
    showSuccess("Stok bahan baku berhasil ditambah");
    loadMovements();
  };

  const removeStock = async () => {
    if (!id) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Qty harus lebih dari 0");

    const stockCheck = await canReduceStock(id, qty);
    if (!stockCheck.allowed) {
      await logActivity("blocked_negative_stock", `Pengurangan bahan baku ${name} ditolak: stok ${stockCheck.currentStock}, diminta ${qty}`);
      return showError(`Stok tidak cukup. Stok tersedia: ${stockCheck.currentStock}`);
    }

    const { error } = await supabase.from("stock_movements").insert({
      product_id: id,
      movement_type: "out",
      quantity: qty,
      note: "Manual stock adjustment from ingredient detail page",
    });

    if (error) return showError(error.message);

    await logActivity("stock_out", `Mengurangi stok bahan baku ${name} sebanyak ${qty}`);
    showSuccess("Stok bahan baku berhasil dikurangi");
    loadMovements();
  };

  const deactivateIngredient = async () => {
    if (!id) return;

    const { error } = await supabase.from("items").update({ is_active: false }).eq("id", id);
    if (error) return showError(error.message);

    await logActivity("delete_ingredient", `Menghapus bahan baku: ${name}`);
    showSuccess("Bahan baku dihapus");
    navigate("/products/ingredients");
  };

  if (!ingredient) {
    return (
      <AppLayout title="Detail Ingredient" backTo="/products/ingredients">
        <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Detail Ingredient" backTo="/products/ingredients">
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Informasi Bahan Baku</h3>
                <p className="text-sm text-slate-500">Ubah nama, kode, dan satuan bahan baku.</p>
              </div>
            </div>

            {ingredient.photo_url && (
              <img src={ingredient.photo_url} alt={ingredient.name} className="mb-5 h-56 w-full rounded-3xl object-cover" />
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

              <Button className="h-12 rounded-2xl bg-emerald-500 text-base hover:bg-emerald-600" onClick={saveChanges} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Adjust Stok</h3>
                <p className="text-sm text-slate-500">Tambah atau kurangi stok bahan baku.</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-right">
                <p className="text-xs font-medium text-emerald-700">Stok tersisa</p>
                <p className="text-2xl font-bold text-emerald-800">{stockLeft}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <Label className="text-sm font-semibold text-slate-700">Jumlah</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" type="number" min={1} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Button className="h-12 flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-600 sm:flex-none" onClick={addStock}>
                  Tambah
                </Button>
                <Button variant="secondary" className="h-12 flex-1 rounded-2xl sm:flex-none" onClick={removeStock}>
                  Kurangi
                </Button>
              </div>
            </div>

            <Button variant="destructive" className="mt-4 h-11 rounded-2xl" onClick={deactivateIngredient}>
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus Bahan Baku
            </Button>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Label QR</h3>
                <p className="text-sm text-slate-500">Buat label aman untuk scan stok.</p>
              </div>
            </div>

            <Button className="h-12 w-full rounded-2xl bg-violet-500 text-base hover:bg-violet-600" onClick={generateLabel} disabled={isGeneratingLabel}>
              {isGeneratingLabel ? "Generating..." : "Generate Label 512x512"}
            </Button>

            {labelPayload && (
              <div className="mt-4 rounded-3xl border bg-slate-50 p-4">
                <div className="mx-auto flex aspect-square w-full max-w-[512px] flex-col items-center justify-center gap-3 rounded-3xl bg-white p-5">
                  <img src={qrUrl} alt="QR Label" className="h-64 w-64 rounded-2xl border object-contain" />
                  <p className="text-center text-lg font-bold text-slate-900">{ingredient.name}</p>
                </div>
                <Button variant="secondary" className="mt-3 h-11 w-full rounded-2xl" onClick={printLabel}>
                  Print Label
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </AppLayout>
  );
};

export default IngredientDetail;