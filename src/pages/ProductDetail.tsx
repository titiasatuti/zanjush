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

type IngredientOption = {
  id: string;
  name: string;
  unit: string;
};

type ProductIngredient = {
  id: string;
  ingredient_id: string;
  qty_per_unit: number;
  unit_label: string | null;
  ingredient_name?: string;
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

  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [recipeRows, setRecipeRows] = useState<ProductIngredient[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [qtyPerUnit, setQtyPerUnit] = useState("1");
  const [unitLabel, setUnitLabel] = useState("");
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);

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

  useEffect(() => {
    supabase
      .from("items")
      .select("id,name,unit")
      .eq("type", "ingredient")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .then(({ data }) => {
        const options = (data as IngredientOption[]) || [];
        setIngredientOptions(options);
        if (options.length) {
          setSelectedIngredientId(options[0].id);
          setUnitLabel(options[0].unit);
        }
      });
  }, []);

  const loadRecipe = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("product_ingredients")
      .select("id,ingredient_id,qty_per_unit,unit_label")
      .eq("product_id", id)
      .order("created_at", { ascending: true });

    if (error) return;

    const rows = (data as ProductIngredient[]) || [];
    const withNames = rows.map((row) => ({
      ...row,
      ingredient_name: ingredientOptions.find((opt) => opt.id === row.ingredient_id)?.name || "Unknown",
    }));
    setRecipeRows(withNames);
  };

  useEffect(() => {
    loadRecipe();
  }, [id, ingredientOptions.length]);

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
    showSuccess("Perubahan produk disimpan");
  };

  const addRecipeIngredient = async () => {
    if (!id) return;
    const qty = Number(qtyPerUnit);
    if (!selectedIngredientId) return showError("Pilih bahan baku dulu");
    if (!qty || qty <= 0) return showError("Qty per produk harus lebih dari 0");

    setIsAddingIngredient(true);
    const { error } = await supabase.from("product_ingredients").insert({
      product_id: id,
      ingredient_id: selectedIngredientId,
      qty_per_unit: qty,
      unit_label: unitLabel.trim() || null,
    });
    setIsAddingIngredient(false);

    if (error) return showError(error.message);
    showSuccess("Bahan baku ditambahkan ke produk");
    loadRecipe();
  };

  const removeRecipeIngredient = async (rowId: string) => {
    const { error } = await supabase.from("product_ingredients").delete().eq("id", rowId);
    if (error) return showError(error.message);
    showSuccess("Bahan baku dihapus dari produk");
    loadRecipe();
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
    showSuccess("Produk dihapus");
    navigate("/products/catalogue");
  };

  if (!product) {
    return (
      <AppLayout title="Product Detail">
        <p className="text-sm text-slate-500">Loading...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Product Detail">
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
        <p className="text-sm font-semibold text-slate-800">Komposisi Bahan Baku per 1 Produk</p>
        <div className="grid gap-2 sm:grid-cols-4">
          <select
            className="h-10 w-full rounded-md border px-3 text-sm sm:col-span-2"
            value={selectedIngredientId}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedIngredientId(value);
              const found = ingredientOptions.find((opt) => opt.id === value);
              if (found) setUnitLabel(found.unit);
            }}
          >
            <option value="">Pilih bahan baku</option>
            {ingredientOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
          <Input type="number" min={0.0001} step="0.0001" value={qtyPerUnit} onChange={(e) => setQtyPerUnit(e.target.value)} placeholder="Qty" />
          <Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="Satuan (contoh: buah, tbsp, ml)" />
        </div>
        <Button className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 sm:w-auto" onClick={addRecipeIngredient} disabled={isAddingIngredient}>
          {isAddingIngredient ? "Menambahkan..." : "Tambah Bahan ke Produk"}
        </Button>

        <div className="space-y-2">
          {recipeRows.length ? (
            recipeRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-slate-800">
                  {row.qty_per_unit} {row.unit_label || ""} {row.ingredient_name}
                </p>
                <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => removeRecipeIngredient(row.id)}>
                  Hapus
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Belum ada komposisi bahan baku untuk produk ini.</p>
          )}
        </div>
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