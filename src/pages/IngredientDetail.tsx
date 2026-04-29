import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";

type Ingredient = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  photo_url: string | null;
};

const IngredientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [adjustQty, setAdjustQty] = useState("1");
  const [isSaving, setIsSaving] = useState(false);

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
  }, [id, navigate]);

  const saveChanges = async () => {
    if (!id) return;
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
    showSuccess("Perubahan bahan baku disimpan");
  };

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
    showSuccess("Stok bahan baku berhasil ditambah");
  };

  const removeStock = async () => {
    if (!id) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Qty harus lebih dari 0");
    const { error } = await supabase.from("stock_movements").insert({
      product_id: id,
      movement_type: "out",
      quantity: qty,
      note: "Manual stock adjustment from ingredient detail page",
    });
    if (error) return showError(error.message);
    showSuccess("Stok bahan baku berhasil dikurangi");
  };

  const deactivateIngredient = async () => {
    if (!id) return;

    const { error } = await supabase.from("items").update({ is_active: false }).eq("id", id);
    if (error) return showError(error.message);

    showSuccess("Bahan baku dihapus");
    navigate("/products/ingredients");
  };

  if (!ingredient) {
    return (
      <AppLayout title="Detail Ingredient">
        <p className="text-sm text-slate-500">Loading...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Detail Ingredient">
      <div className="grid gap-3 rounded-2xl border bg-white p-4">
        {ingredient.photo_url && (
          <img src={ingredient.photo_url} alt={ingredient.name} className="h-48 w-full rounded-2xl object-cover" />
        )}
        <div><Label>Nama</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Kode / SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} /></div>
        <div><Label>Satuan</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
        <Button className="rounded-xl bg-emerald-500 hover:bg-emerald-600" onClick={saveChanges} disabled={isSaving}>
          {isSaving ? "Saving..." : "Simpan Perubahan"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border bg-white p-4">
        <Label>Adjust Stok</Label>
        <Input type="number" min={1} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-xl bg-emerald-500 hover:bg-emerald-600" onClick={addStock}>Tambah Stok</Button>
          <Button variant="secondary" className="rounded-xl" onClick={removeStock}>Kurangi Stok</Button>
          <Button variant="destructive" className="rounded-xl" onClick={deactivateIngredient}>Hapus Bahan Baku</Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default IngredientDetail;