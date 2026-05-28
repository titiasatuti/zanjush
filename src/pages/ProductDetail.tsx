import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { Boxes, PackageCheck, QrCode, Save, Trash2, Utensils, X, Printer } from "lucide-react";
import { canReduceStock } from "@/lib/stock-utils";
import { logActivity } from "@/lib/activity-log";
import { DetailPhotoUploadButton } from "@/components/detail-photo-upload-button";
import { formatDateId } from "@/lib/expiry-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  production_date: string | null;
  expiry_date: string | null;
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
  const [productionDate, setProductionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [adjustQty, setAdjustQty] = useState("1");
  const [stockInProductionDate, setStockInProductionDate] = useState("");
  const [stockInExpiryDate, setStockInExpiryDate] = useState("");
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [stockActionLoading, setStockActionLoading] = useState<"in" | "out" | null>(null);

  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [recipeRows, setRecipeRows] = useState<ProductIngredient[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [qtyPerUnit, setQtyPerUnit] = useState("1");
  const [unitLabel, setUnitLabel] = useState("");
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);

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
    supabase
      .from("products")
      .select("id,name,sku,unit,min_stock,category,sell_price,cost_price,photo_url,production_date,expiry_date")
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
        setProductionDate(data.production_date || "");
        setExpiryDate(data.expiry_date || "");
      });

    loadMovements();
    loadBatches();
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

  const updateProductPhoto = (photoUrl: string) => {
    setProduct((current) => (current ? { ...current, photo_url: photoUrl } : current));
  };

  const saveChanges = async () => {
    if (!id || !product) return;
    if (!name.trim()) return showError("Nama produk wajib diisi");
    if (!sku.trim()) return showError("SKU wajib diisi");
    if (!unit.trim()) return showError("Satuan wajib diisi");

    const minStockNumber = Number(minStock || 0);
    if (Number.isNaN(minStockNumber) || minStockNumber < 0) {
      return showError("Minimum stok tidak valid");
    }

    if (productionDate && expiryDate && expiryDate < productionDate) {
      return showError("Tanggal expired tidak boleh lebih awal dari tanggal pembuatan");
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
        production_date: productionDate || null,
        expiry_date: expiryDate || null,
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
    if (!product) return;

    setIsPreparingBatchLabelId(batch.id);

    try {
      const token = await ensureBatchToken(batch);
      const payload = `v1:${token}`;
      setLabelPayload(payload);
      setLabelTitle(`${product.name} - ${batch.batch_code}`);
      setIsQrDialogOpen(true);
      await logActivity("create_label", `Membuka label QR batch ${batch.batch_code} untuk produk ${product.name}`);
      showSuccess("QR batch ditampilkan");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyiapkan label batch";
      showError(message);
    }

    setIsPreparingBatchLabelId(null);
  };

  const deleteBatch = async (batch: BatchRow) => {
    if (!product) return;
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

    await logActivity("delete_batch", `Menghapus batch ${batch.batch_code} pada produk ${product.name}`);
    showSuccess("Batch berhasil dihapus");
    setBatches((current) => current.filter((row) => row.id !== batch.id));
    await loadBatches();
  };

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
    if (stockActionLoading) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Qty harus lebih dari 0");

    if (!stockInProductionDate) return showError("Tanggal pembuatan batch wajib diisi");
    if (!stockInExpiryDate) return showError("Tanggal expired batch wajib diisi");
    if (stockInExpiryDate < stockInProductionDate) {
      return showError("Tanggal expired batch tidak boleh lebih awal dari tanggal pembuatan");
    }

    setStockActionLoading("in");

    const { data: insertedBatch, error: batchError } = await supabase
      .from("stock_batches")
      .insert({
        product_id: id,
        batch_code: `PROD-${Date.now()}`,
        production_date: stockInProductionDate,
        expiry_date: stockInExpiryDate,
        initial_quantity: qty,
        remaining_quantity: qty,
        note: "Batch produksi produk",
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
      note: "Manual stock adjustment from detail page",
    });

    if (error) {
      setStockActionLoading(null);
      return showError(error.message);
    }

    setStockActionLoading(null);

    await logActivity("stock_in", `Menambah stok produk ${name} sebanyak ${qty}`);
    showSuccess("Stok berhasil ditambah");
    setStockInProductionDate("");
    setStockInExpiryDate("");
    loadMovements();
    loadBatches();
  };

  const removeStock = async () => {
    if (!id) return;
    if (stockActionLoading) return;
    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Qty harus lebih dari 0");

    setStockActionLoading("out");

    const stockCheck = await canReduceStock(id, qty);
    if (!stockCheck.allowed) {
      setStockActionLoading(null);
      await logActivity("blocked_negative_stock", `Pengurangan produk ${name} ditolak: stok ${stockCheck.currentStock}, diminta ${qty}`);
      return showError(`Stok tidak cukup. Stok tersedia: ${stockCheck.currentStock}`);
    }

    const { error } = await supabase.from("stock_movements").insert({
      product_id: id,
      movement_type: "out",
      quantity: qty,
      note: "Manual stock adjustment from detail page",
    });

    if (error) {
      setStockActionLoading(null);
      return showError(error.message);
    }

    setStockActionLoading(null);

    await logActivity("stock_out", `Mengurangi stok produk ${name} sebanyak ${qty}`);
    showSuccess("Stok berhasil dikurangi");
    loadMovements();
    loadBatches();
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

  if (!product || !id) {
    return (
      <AppLayout title="Detail Produk" backTo="/products/catalogue">
        <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">Memuat data produk...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Detail Produk" backTo="/products/catalogue">
      <div className="space-y-4">
        <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ringkasan Produk</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{product.name}</h2>
              <p className="text-sm text-slate-500">SKU: {product.sku || "-"}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-right">
              <p className="text-xs font-medium text-emerald-700">Stok Tersisa</p>
              <p className="text-2xl font-bold text-emerald-800">{stockLeft}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tanggal Buat</p>
              <p className="font-semibold text-slate-900">{productionDate ? formatDateId(productionDate) : "Belum diisi"}</p>
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
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="master" className="rounded-xl">Data Produk</TabsTrigger>
            <TabsTrigger value="stock" className="rounded-xl">Stok & Batch</TabsTrigger>
            <TabsTrigger value="recipe" className="rounded-xl">Komposisi</TabsTrigger>
          </TabsList>

          <TabsContent value="master" className="space-y-4">
          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Informasi Produk</h3>
                <p className="text-sm text-slate-500">Khusus edit data master produk.</p>
              </div>
            </div>

            {product.photo_url ? (
              <div className="relative mb-5 w-fit">
                <img src={product.photo_url} alt={product.name} className="h-36 w-36 rounded-3xl object-cover sm:h-40 sm:w-40" />
                <DetailPhotoUploadButton
                  itemId={id}
                  itemType="product"
                  title={product.name}
                  onUploaded={updateProductPhoto}
                  className="absolute bottom-2 right-2"
                />
              </div>
            ) : (
              <div className="mb-5">
                <DetailPhotoUploadButton
                  itemId={id}
                  itemType="product"
                  title={name || "produk"}
                  variant="full"
                  onUploaded={updateProductPhoto}
                />
              </div>
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

              <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking umur produk</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Tanggal pembuatan</Label>
                    <Input className="mt-1 h-12 rounded-2xl bg-white text-base" type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Tanggal expired</Label>
                    <Input className="mt-1 h-12 rounded-2xl bg-white text-base" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                  </div>
                </div>
              </div>

              <Button className="h-12 rounded-2xl bg-emerald-500 text-base hover:bg-emerald-600 sm:col-span-2" onClick={saveChanges} disabled={isSaving}>
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
                  <Label className="text-sm font-semibold text-slate-700">Tanggal pembuatan batch</Label>
                  <Input
                    className="mt-1 h-12 rounded-2xl bg-white text-base"
                    type="date"
                    value={stockInProductionDate}
                    onChange={(e) => setStockInProductionDate(e.target.value)}
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

            <Button variant="destructive" className="mt-4 h-11 rounded-2xl" onClick={archiveItem}>
              <Trash2 className="mr-2 h-4 w-4" />
              Arsipkan Produk
            </Button>
          </section>

          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Riwayat Batch Produk</h3>
            <p className="mt-1 text-sm text-slate-500">Fokus pada tanggal produksi, expired, dan qty tersisa tiap batch.</p>

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
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Pembuatan</p>
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

          <TabsContent value="recipe" className="space-y-4">
          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Komposisi Bahan Baku</h3>
                <p className="text-sm text-slate-500">Khusus pengaturan resep per 1 produk.</p>
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
                    name: labelTitle || product.name,
                    payload: labelPayload,
                    type: "Produk",
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

export default ProductDetail;