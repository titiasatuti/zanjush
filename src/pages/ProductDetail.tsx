import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { PackageCheck, Save, Trash2, Utensils, X } from "lucide-react";
import {
  buildStockMapFromMovements,
  calculateProductStockFromRecipe,
  type ProductRecipeRow,
  type SimpleMovementRow,
} from "@/lib/stock-utils";
import { logActivity } from "@/lib/activity-log";
import { DetailPhotoUploadButton } from "@/components/detail-photo-upload-button";
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
};

type IngredientOption = {
  id: string;
  name: string;
  unit: string;
};

type ProductIngredient = ProductRecipeRow & {
  id: string;
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
  const [minStock, setMinStock] = useState("10");
  const [category, setCategory] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [adjustQty, setAdjustQty] = useState("1");
  const [isSaving, setIsSaving] = useState(false);
  const [isFulfillingOrder, setIsFulfillingOrder] = useState(false);

  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [recipeRows, setRecipeRows] = useState<ProductIngredient[]>([]);
  const [ingredientStockMap, setIngredientStockMap] = useState<Map<string, number>>(new Map());
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [qtyPerUnit, setQtyPerUnit] = useState("1");
  const [unitLabel, setUnitLabel] = useState("");
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);

  const [totalSold, setTotalSold] = useState(0);

  const virtualStock = useMemo(() => {
    if (!id) return 0;
    return calculateProductStockFromRecipe(id, recipeRows, ingredientStockMap);
  }, [id, recipeRows, ingredientStockMap]);

  const bottleneck = useMemo(() => {
    if (!recipeRows.length) return null;

    let minValue = Number.POSITIVE_INFINITY;
    let minName = "";

    recipeRows.forEach((row) => {
      if (row.qty_per_unit <= 0) return;
      const ingredientStock = ingredientStockMap.get(row.ingredient_id) || 0;
      const possible = Math.floor(ingredientStock / row.qty_per_unit);
      if (possible < minValue) {
        minValue = possible;
        minName = row.ingredient_name || "Bahan baku";
      }
    });

    if (!Number.isFinite(minValue)) return null;
    return { name: minName, possible: Math.max(0, minValue) };
  }, [recipeRows, ingredientStockMap]);

  const refreshIngredientStocks = async (rows: ProductIngredient[]) => {
    const ingredientIds = Array.from(new Set(rows.map((row) => row.ingredient_id)));
    if (!ingredientIds.length) {
      setIngredientStockMap(new Map());
      return;
    }

    const { data, error } = await supabase
      .from("stock_movements")
      .select("product_id,movement_type,quantity")
      .in("product_id", ingredientIds);

    if (error) return;

    const stockMap = buildStockMapFromMovements((data as SimpleMovementRow[]) || []);
    const nextMap = new Map<string, number>();
    ingredientIds.forEach((ingredientId) => {
      nextMap.set(ingredientId, stockMap.get(ingredientId) || 0);
    });
    setIngredientStockMap(nextMap);
  };

  const loadProductOutSummary = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("stock_movements")
      .select("movement_type,quantity")
      .eq("product_id", id)
      .eq("movement_type", "out");

    if (error) return;

    const total = ((data as Array<{ movement_type: string; quantity: number }>) || []).reduce(
      (sum, row) => sum + row.quantity,
      0,
    );
    setTotalSold(total);
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

    loadProductOutSummary();
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
      .select("id,product_id,ingredient_id,qty_per_unit,unit_label")
      .eq("product_id", id)
      .order("created_at", { ascending: true });

    if (error) return;

    const rows = (data as ProductIngredient[]) || [];
    const withNames = rows.map((row) => ({
      ...row,
      ingredient_name: ingredientOptions.find((opt) => opt.id === row.ingredient_id)?.name || "Unknown",
    }));

    setRecipeRows(withNames);
    await refreshIngredientStocks(withNames);
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
        production_date: null,
        expiry_date: null,
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

  const fulfillOrder = async () => {
    if (!id) return;
    if (isFulfillingOrder) return;

    const qty = Number(adjustQty);
    if (!qty || qty < 1) return showError("Qty harus lebih dari 0");
    if (!recipeRows.length) return showError("Produk belum punya komposisi bahan baku");

    setIsFulfillingOrder(true);

    const requirements = recipeRows
      .map((row) => ({
        ingredientId: row.ingredient_id,
        ingredientName: row.ingredient_name || "Bahan baku",
        requiredQty: row.qty_per_unit * qty,
      }))
      .filter((row) => row.requiredQty > 0);

    const ingredientIds = requirements.map((row) => row.ingredientId);
    const { data: batchRows, error: batchLoadError } = await supabase
      .from("stock_batches")
      .select("id,product_id,batch_code,expiry_date,production_date,remaining_quantity,created_at")
      .in("product_id", ingredientIds)
      .gt("remaining_quantity", 0);

    if (batchLoadError) {
      setIsFulfillingOrder(false);
      return showError(`Gagal memuat batch bahan baku: ${batchLoadError.message}`);
    }

    type IngredientBatch = {
      id: string;
      product_id: string;
      batch_code: string;
      expiry_date: string | null;
      production_date: string | null;
      remaining_quantity: number;
      created_at: string;
    };

    const batchesByIngredient = new Map<string, IngredientBatch[]>();
    ((batchRows as IngredientBatch[]) || []).forEach((batch) => {
      if (!batchesByIngredient.has(batch.product_id)) {
        batchesByIngredient.set(batch.product_id, []);
      }
      batchesByIngredient.get(batch.product_id)!.push(batch);
    });

    const checks = requirements.map((requirement) => {
      const ingredientBatches = (batchesByIngredient.get(requirement.ingredientId) || []).slice().sort((a, b) => {
        const aExpiry = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bExpiry = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;

        const aProd = a.production_date ? new Date(a.production_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bProd = b.production_date ? new Date(b.production_date).getTime() : Number.MAX_SAFE_INTEGER;
        if (aProd !== bProd) return aProd - bProd;

        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      let remainingNeed = requirement.requiredQty;
      const allocations: Array<{ batchId: string; batchCode: string; quantity: number; previousRemaining: number; nextRemaining: number }> = [];

      for (const batch of ingredientBatches) {
        if (remainingNeed <= 0) break;

        const takeQty = Math.min(batch.remaining_quantity, remainingNeed);
        if (takeQty <= 0) continue;

        allocations.push({
          batchId: batch.id,
          batchCode: batch.batch_code,
          quantity: takeQty,
          previousRemaining: batch.remaining_quantity,
          nextRemaining: batch.remaining_quantity - takeQty,
        });

        remainingNeed -= takeQty;
      }

      const available = ingredientBatches.reduce((sum, batch) => sum + batch.remaining_quantity, 0);
      return {
        ...requirement,
        available,
        allowed: remainingNeed <= 0,
        allocations,
      };
    });

    const blocked = checks.filter((row) => !row.allowed);
    if (blocked.length > 0) {
      const reasonText = blocked
        .map((row) => `${row.ingredientName} (stok ${row.available}, butuh ${row.requiredQty})`)
        .join(", ");
      await logActivity(
        "blocked_negative_stock",
        `Pesanan ${name} ditolak karena stok bahan baku tidak cukup: ${reasonText}`,
      );
      setIsFulfillingOrder(false);
      return showError(`Stok bahan baku tidak cukup: ${reasonText}`);
    }

    const batchUpdates = checks.flatMap((row) =>
      row.allocations.map((allocation) => ({
        ingredientId: row.ingredientId,
        ingredientName: row.ingredientName,
        ...allocation,
      })),
    );

    const appliedBatchUpdates: Array<{ batchId: string; previousRemaining: number }> = [];

    for (const update of batchUpdates) {
      const { data: updatedBatch, error: updateBatchError } = await supabase
        .from("stock_batches")
        .update({ remaining_quantity: update.nextRemaining })
        .eq("id", update.batchId)
        .eq("remaining_quantity", update.previousRemaining)
        .select("id")
        .single();

      if (updateBatchError || !updatedBatch) {
        for (const rollback of appliedBatchUpdates) {
          await supabase
            .from("stock_batches")
            .update({ remaining_quantity: rollback.previousRemaining })
            .eq("id", rollback.batchId);
        }

        setIsFulfillingOrder(false);
        return showError("Batch bahan baku berubah saat diproses. Silakan coba lagi.");
      }

      appliedBatchUpdates.push({
        batchId: update.batchId,
        previousRemaining: update.previousRemaining,
      });
    }

    const { data: productMovement, error: productMovementError } = await supabase
      .from("stock_movements")
      .insert({
        product_id: id,
        movement_type: "out",
        quantity: qty,
        note: "Pesanan produk (stok virtual berbasis komposisi)",
      })
      .select("id")
      .single();

    if (productMovementError) {
      for (const rollback of appliedBatchUpdates) {
        await supabase
          .from("stock_batches")
          .update({ remaining_quantity: rollback.previousRemaining })
          .eq("id", rollback.batchId);
      }
      setIsFulfillingOrder(false);
      return showError(productMovementError.message);
    }

    const ingredientMovements = checks.flatMap((row) =>
      row.allocations.map((allocation) => ({
        product_id: row.ingredientId,
        batch_id: allocation.batchId,
        movement_type: "out",
        quantity: allocation.quantity,
        note: `Pemakaian bahan baku (FEFO) batch ${allocation.batchCode} untuk pesanan ${name} sebanyak ${qty}`,
      })),
    );

    const { error: ingredientMovementError } = await supabase
      .from("stock_movements")
      .insert(ingredientMovements);

    if (ingredientMovementError) {
      if (productMovement?.id) {
        await supabase.from("stock_movements").delete().eq("id", productMovement.id);
      }
      for (const rollback of appliedBatchUpdates) {
        await supabase
          .from("stock_batches")
          .update({ remaining_quantity: rollback.previousRemaining })
          .eq("id", rollback.batchId);
      }
      setIsFulfillingOrder(false);
      return showError(`Gagal mengurangi stok bahan baku: ${ingredientMovementError.message}`);
    }

    setIsFulfillingOrder(false);

    await logActivity("stock_out", `Pesanan ${name} sebanyak ${qty} diproses, bahan baku otomatis terpakai (FEFO)`);
    showSuccess("Pesanan diproses, stok bahan baku otomatis dikurangi");
    await loadRecipe();
    await loadProductOutSummary();
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
              <p className="text-xs font-medium text-emerald-700">Stok Virtual (Siap Dibuat)</p>
              <p className="text-2xl font-bold text-emerald-800">{virtualStock}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Bottleneck</p>
              <p className="font-semibold text-slate-900">{bottleneck ? bottleneck.name : "Belum ada resep"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Produk Terjual (Catatan)</p>
              <p className="font-semibold text-slate-900">{totalSold}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Minimum Stok Virtual</p>
              <p className="font-semibold text-slate-900">{minStock || "0"}</p>
            </div>
          </div>
        </section>

        <Tabs defaultValue="master" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="master" className="rounded-xl">Data Produk</TabsTrigger>
            <TabsTrigger value="stock" className="rounded-xl">Pesanan</TabsTrigger>
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
                  <p className="text-sm text-slate-500">Produk dibuat saat dipesan, tanpa stok batch dan tanpa expired.</p>
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
                  <Label className="text-sm font-semibold text-slate-700">Minimum stok virtual</Label>
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

                <Button variant="destructive" className="h-11 rounded-2xl sm:col-span-2" onClick={archiveItem}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Arsipkan Produk
                </Button>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="stock" className="space-y-4">
            <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Proses Pesanan</h3>
              <p className="mt-1 text-sm text-slate-500">Saat pesanan diproses, stok bahan baku berkurang otomatis sesuai komposisi.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">Jumlah pesanan</Label>
                  <Input
                    className="mt-1 h-12 rounded-2xl text-base"
                    type="number"
                    min={1}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    disabled={isFulfillingOrder}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    className="h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600"
                    onClick={fulfillOrder}
                    disabled={isFulfillingOrder}
                  >
                    {isFulfillingOrder ? "Memproses..." : "Kurangi Bahan Sesuai Pesanan"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                Tidak perlu tambah stok produk manual. Ketersediaan produk dihitung otomatis dari stok bahan baku.
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
                  <p className="text-sm text-slate-500">Stok produk virtual dihitung dari komposisi ini.</p>
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
                  recipeRows.map((row) => {
                    const ingredientStock = ingredientStockMap.get(row.ingredient_id) || 0;
                    const possible = row.qty_per_unit > 0 ? Math.floor(ingredientStock / row.qty_per_unit) : 0;

                    return (
                      <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-slate-50 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{row.ingredient_name}</p>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {row.qty_per_unit} {row.unit_label || ""} per produk
                          </p>
                          <p className="mt-1 text-xs text-slate-500">Stok bahan: {ingredientStock} - Maks produk dari bahan ini: {possible}</p>
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
                    );
                  })
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada komposisi bahan baku untuk produk ini.</p>
                )}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ProductDetail;
