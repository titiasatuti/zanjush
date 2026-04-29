import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { PackageCheck, QrCode, Save, Trash2, Utensils, X } from "lucide-react";
import { canReduceStock } from "@/lib/stock-utils";
import { logActivity } from "@/lib/activity-log";

type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  min_stock: number;
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

type Movement = {
  movement_type: string;
  quantity: number;
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [minStock, setMinStock] = useState("10");
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
    supabase
      .from("products")
      .select("id,name,sku,unit,min_stock,category,sell_price,cost_price,photo_url")
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
        setMinStock(data.min_stock?.toString() || "10");
        setCategory(data.category || "");
        setSellPrice(data.sell_price?.toString() || "");
        setCostPrice(data.cost_price?.toString() || "");
      });

    loadMovements();
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
    if (!id || !product) return;
    if (!name.trim()) return showError("Nama produk wajib diisi");
    if (!sku.trim()) return showError("SKU wajib diisi");
    if (!unit.trim()) return showError("Satuan wajib diisi");

    const minStockNumber = Number(minStock || 0);
    if (Number.isNaN(minStockNumber) || minStockNumber < 0) {
      return showError("Minimum stok tidak valid");
    }

    setIsSaving(true);

    const cleanName = name.trim();
    const cleanSku = sku.trim();
    const cleanUnit = unit.trim().toLowerCase();

    const { error } = await supabase
      .from("products")
      .update({
        name: cleanName,
        sku: cleanSku,
        unit: cleanUnit,
        min_stock: minStockNumber,
        category: category.trim() || null,
        sell_price: sellPrice ? Number(sellPrice) : null,
        cost_price: costPrice ? Number(costPrice) : null,
      })
      .eq("id", id);

    if (error) {
      setIsSaving(false);
      return showError(error.message);
    }

    const { error: itemError } = await supabase
      .from("items")
      .update({
        name: cleanName,
        sku: cleanSku,
        unit: cleanUnit,
        min_stock: minStockNumber,
        photo_url: product.photo_url,
      })
      .eq("id", id)
      .eq("type", "product");

    setIsSaving(false);

    if (itemError) return showError(itemError.message);

    await logActivity("update_product", `Mengubah produk: ${cleanName}`);
    showSuccess("Perubahan produk disimpan");
  };

  const generateLabel = async () => {
    if (!id || !product) return;
    setIsGeneratingLabel(true);

    const token = crypto.randomUUID().replace(/-/g, "");
    const securePayload = `v1:${token}`;
    const today = new Date().toISOString().slice(0, 10);
    const farFuture = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { error } = await supabase.from("stock_batches").insert({
      product_id: id,
      batch_code: `LBL-PROD-${Date.now()}`,
      production_date: today,
      expiry_date: farFuture,
      qr_payload: token,
    });

    setIsGeneratingLabel(false);

    if (error) return showError(error.message);
    setLabelPayload(securePayload);
    await logActivity("create_label", `Membuat label QR produk: ${product.name}`);
    showSuccess("Label produk berhasil dibuat");
  };

  const printLabel = () => window.print();

  const addRecipeIngredient = async () => {
    if (!id) return;
    const qty = Number(qtyPerUnit);
    if (!selectedIngredientId) return showError("Pilih bahan baku dulu");
    if (!qty || qty <= 0) return showError("Qty per produk harus lebih dari 0");

    const ingredientName = ingredientOptions.find((opt) => opt.id === selectedIngredientId)?.name || "Bahan baku";

    setIsAddingIngredient(true);
    const { error } = await supabase.from("product_ingredients").insert({
      product_id: id,
      ingredient_id: selectedIngredientId,
      qty_per_unit: qty,
      unit_label: unitLabel.trim() || null,
    });
    setIsAddingIngredient(false);

    if (error) return showError(error.message);

    await logActivity("add_recipe_ingredient", `Menambahkan ${ingredientName} ke komposisi produk ${name}`);
    showSuccess("Bahan baku ditambahkan ke produk");
    loadRecipe();
  };

  const removeRecipeIngredient = async (row: ProductIngredient) => {
    const { error } = await supabase.from("product_ingredients").delete().eq("id", row.id);
    if (error) return showError(error.message);

    await logActivity("remove_recipe_ingredient", `Menghapus ${row.ingredient_name || "bahan baku"} dari komposisi produk ${name}`);
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

    await logActivity("stock_in", `Menambah stok produk ${name} sebanyak ${qty}`);
    showSuccess("Stok berhasil ditambah");
    loadMovements();
  };

  const removeStock = async () => {
    if (!id) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Qty harus lebih dari 0");

    const stockCheck = await canReduceStock(id, qty);
    if (!stockCheck.allowed) {
      await logActivity("blocked_negative_stock", `Pengurangan produk ${name} ditolak: stok ${stockCheck.currentStock}, diminta ${qty}`);
      return showError(`Stok tidak cukup. Stok tersedia: ${stockCheck.currentStock}`);
    }

    const { error } = await supabase.from("stock_movements").insert({
      product_id: id,
      movement_type: "out",
      quantity: qty,
      note: "Manual stock adjustment from detail page",
    });

    if (error) return showError(error.message);

    await logActivity("stock_out", `Mengurangi stok produk ${name} sebanyak ${qty}`);
    showSuccess("Stok berhasil dikurangi");
    loadMovements();
  };

  const archiveItem = async () => {
    if (!id) return;

    const { error: itemError } = await supabase.from("items").update({ is_active: false }).eq("id", id);
    if (itemError) return showError(itemError.message);

    const { error: productError } = await supabase
      .from("products")
      .update({
        sku: `${sku.trim()}-ARCHIVED-${Date.now()}`,
        category: "Diarsipkan",
      })
      .eq("id", id);

    if (productError) return showError(productError.message);

    await logActivity("delete_product", `Mengarsipkan produk: ${name}`);
    showSuccess("Produk diarsipkan");
    navigate("/products/catalogue");
  };

  if (!product) {
    return (
      <AppLayout title="Product Detail" backTo="/products/catalogue">
        <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Product Detail" backTo="/products/catalogue">
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Informasi Produk</h3>
                <p className="text-sm text-slate-500">Ubah data utama, harga, kategori, kode produk, dan minimum stok.</p>
              </div>
            </div>

            {product.photo_url && (
              <img src={product.photo_url} alt={product.name} className="mb-5 h-56 w-full rounded-3xl object-cover" />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-sm font-semibold text-slate-700">Nama produk</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">SKU</Label>
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

              <div>
                <Label className="text-sm font-semibold text-slate-700">Kategori</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Harga jual</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Harga modal</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
              </div>

              <Button className="h-12 rounded-2xl bg-emerald-500 text-base hover:bg-emerald-600 sm:col-span-2" onClick={saveChanges} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Adjust Stok</h3>
                <p className="text-sm text-slate-500">Tambah atau kurangi stok produk.</p>
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

            <Button variant="destructive" className="mt-4 h-11 rounded-2xl" onClick={archiveItem}>
              <Trash2 className="mr-2 h-4 w-4" />
              Arsipkan Produk
            </Button>
          </section>

          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Komposisi Bahan Baku</h3>
                <p className="text-sm text-slate-500">Atur bahan yang dipakai untuk membuat 1 produk.</p>
              </div>
            </div>

            <div className="grid gap-3">
              <div>
                <Label className="text-sm font-semibold text-slate-700">Pilih bahan baku</Label>
                <select
                  className="mt-1 h-12 w-full rounded-2xl border px-4 text-base"
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
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Jumlah per produk</Label>
                <div className="mt-1 flex overflow-hidden rounded-2xl border bg-white">
                  <Input
                    className="h-12 rounded-none border-0 text-base focus-visible:ring-0"
                    type="number"
                    min={0.0001}
                    step="0.0001"
                    value={qtyPerUnit}
                    onChange={(e) => setQtyPerUnit(e.target.value)}
                    placeholder="Qty"
                  />
                  <Input
                    className="h-12 w-28 rounded-none border-0 border-l bg-slate-50 text-base focus-visible:ring-0 sm:w-36"
                    value={unitLabel}
                    onChange={(e) => setUnitLabel(e.target.value)}
                    placeholder="Satuan"
                  />
                </div>
              </div>
            </div>

            <Button className="mt-3 h-12 w-full rounded-2xl bg-emerald-500 hover:bg-emerald-600 sm:w-auto" onClick={addRecipeIngredient} disabled={isAddingIngredient}>
              {isAddingIngredient ? "Menambahkan..." : "Tambah Bahan ke Produk"}
            </Button>

            <div className="mt-4 space-y-2">
              {recipeRows.length ? (
                recipeRows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-slate-50 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{row.ingredient_name}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {row.qty_per_unit} {row.unit_label || ""} per produk
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => removeRecipeIngredient(row)}
                      aria-label={`Hapus ${row.ingredient_name}`}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada komposisi bahan baku untuk produk ini.</p>
              )}
            </div>
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
                  <p className="text-center text-lg font-bold text-slate-900">{product.name}</p>
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

export default ProductDetail;