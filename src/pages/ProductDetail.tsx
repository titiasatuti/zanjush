import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";

type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string | null;
  sell_price: number | null;
  cost_price: number | null;
  photo_url: string | null;
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [adjustQty, setAdjustQty] = useState("1");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("products")
      .select("id,name,sku,unit,category,sell_price,cost_price,photo_url")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          showError("Item tidak ditemukan");
          navigate("/products/catalogue");
          return;
        }
        setProduct(data as Product);
        setName(data.name);
        setSku(data.sku);
        setUnit(data.unit);
        setCategory(data.category || "");
        setSellPrice(data.sell_price?.toString() || "");
        setCostPrice(data.cost_price?.toString() || "");
      });
  }, [id, navigate]);

  const saveChanges = async () => {
    if (!id) return;
    setIsSaving(true);
    const { error } = await supabase
      .from("products")
      .update({
        name: name.trim(),
        sku: sku.trim(),
        unit: unit.trim().toLowerCase(),
        category: category.trim() || null,
        sell_price: sellPrice ? Number(sellPrice) : null,
        cost_price: costPrice ? Number(costPrice) : null,
      })
      .eq("id", id);

    setIsSaving(false);

    if (error) return showError(error.message);
    showSuccess("Perubahan katalog disimpan");
  };

  const addStock = async () => {
    if (!id) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Qty harus lebih dari 0");
    const { error } = await supabase.from("stock_movements").insert({
      product_id: id,
      movement_type: "in",
      quantity: qty,
      note: "Manual stock adjustment from detail page",
    });
    if (error) return showError(error.message);
    showSuccess("Stok berhasil ditambah");
  };

  const removeStock = async () => {
    if (!id) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Qty harus lebih dari 0");
    const { error } = await supabase.from("stock_movements").insert({
      product_id: id,
      movement_type: "out",
      quantity: qty,
      note: "Manual stock adjustment from detail page",
    });
    if (error) return showError(error.message);
    showSuccess("Stok berhasil dikurangi");
  };

  const deleteItem = async () => {
    if (!id) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return showError(error.message);
    showSuccess("Item katalog dihapus");
    navigate("/products/catalogue");
  };

  if (!product) {
    return (
      <AppLayout title="Detail Catalogue">
        <p className="text-sm text-slate-500">Loading...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Detail Catalogue">
      <div className="grid gap-3 rounded-2xl border bg-white p-4">
        {product.photo_url && (
          <img src={product.photo_url} alt={product.name} className="h-48 w-full rounded-2xl object-cover" />
        )}
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} /></div>
        <div><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
        <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
        <div><Label>Harga Jual</Label><Input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} /></div>
        <div><Label>Harga Modal</Label><Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} /></div>
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
          <Button variant="destructive" className="rounded-xl" onClick={deleteItem}>Hapus Item</Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProductDetail;