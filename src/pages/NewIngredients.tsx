import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useNavigate } from "react-router-dom";
import { ImagePlus, PackagePlus, Save } from "lucide-react";
import { logActivity } from "@/lib/activity-log";

const units = [
  "Batang",
  "boks",
  "botol",
  "bungkus",
  "butir",
  "centimeter",
  "cup",
  "ekor",
  "kilogram",
  "gram",
  "kwintal",
  "kaleng",
  "lusin",
  "miligram",
  "ons",
  "potong",
  "ton",
  "sachet",
  "milimiter",
  "pcs",
  "liter",
];

const generateCode = (name: string) =>
  `ING-${name.replace(/\s+/g, "-").toUpperCase().slice(0, 8)}-${Math.floor(Math.random() * 999)}`;

const NewIngredients = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [currentStock, setCurrentStock] = useState("");
  const [minStock, setMinStock] = useState("10");
  const [lastPurchaseDate, setLastPurchaseDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [totalBuyPrice, setTotalBuyPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("items")
      .select("sku")
      .eq("type", "ingredient")
      .then(({ data }) => {
        const categories = Array.from(
          new Set(
            (data || [])
              .map((row) => (row.sku?.match(/\[CAT:(.*?)\]/)?.[1] || "").trim())
              .filter(Boolean),
          ),
        );
        setExistingCategories(categories);
        if (categories.length) setCategory(categories[0]);
      });
  }, []);

  const uploadPhoto = async () => {
    if (!photoFile) return null;
    const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `ingredients/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("item-photos").upload(filePath, photoFile, {
      upsert: false,
      contentType: photoFile.type || "image/jpeg",
    });
    if (uploadError) {
      showError(uploadError.message);
      return null;
    }
    const { data } = supabase.storage.from("item-photos").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const save = async () => {
    if (!name.trim()) return showError("Nama bahan baku wajib diisi");

    const cleanCategory = category.trim();
    if (!cleanCategory) return showError("Kategori bahan baku wajib diisi");
    if (!unit) return showError("Satuan bahan baku wajib dipilih");

    const stockNumber = Number(currentStock || 0);
    if (Number.isNaN(stockNumber) || stockNumber < 0) return showError("Stok saat ini tidak valid");

    const minStockNumber = Number(minStock || 0);
    if (Number.isNaN(minStockNumber) || minStockNumber < 0) return showError("Minimum stok tidak valid");

    if (lastPurchaseDate && expiryDate && expiryDate < lastPurchaseDate) {
      return showError("Tanggal expired tidak boleh lebih awal dari tanggal pembelian");
    }

    const priceNumber = Number(totalBuyPrice || 0);
    if (Number.isNaN(priceNumber) || priceNumber < 0) return showError("Harga total beli tidak valid");

    setIsSaving(true);

    const uploadedPhotoUrl = await uploadPhoto();
    if (photoFile && !uploadedPhotoUrl) {
      setIsSaving(false);
      return;
    }

    const finalCode = itemCode.trim() || generateCode(name);
    const skuWithCategory = `[CAT:${cleanCategory}] ${finalCode}`;

    const { data: insertedItem, error: insertItemError } = await supabase
      .from("items")
      .insert({
        type: "ingredient",
        name: name.trim(),
        sku: skuWithCategory,
        unit: unit.toLowerCase(),
        min_stock: minStockNumber,
        last_purchase_date: lastPurchaseDate || null,
        expiry_date: expiryDate || null,
        photo_url: uploadedPhotoUrl,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertItemError || !insertedItem) {
      setIsSaving(false);
      return showError(insertItemError?.message || "Gagal menyimpan bahan baku");
    }

    if (stockNumber > 0) {
      const purchaseDate = lastPurchaseDate || new Date().toISOString().slice(0, 10);
      const resolvedExpiryDate = expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const { data: insertedBatch, error: batchError } = await supabase
        .from("stock_batches")
        .insert({
          product_id: insertedItem.id,
          batch_code: `ING-${Date.now()}`,
          production_date: purchaseDate,
          expiry_date: resolvedExpiryDate,
          initial_quantity: stockNumber,
          remaining_quantity: stockNumber,
          note: notes.trim() || null,
          qr_payload: crypto.randomUUID().replace(/-/g, ""),
        })
        .select("id")
        .single();

      if (batchError || !insertedBatch) {
        setIsSaving(false);
        return showError(batchError?.message || "Gagal membuat batch awal bahan baku");
      }

      const movementNote = [
        notes.trim() ? notes.trim() : null,
        priceNumber > 0 ? `Harga total beli: ${priceNumber}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const { error: movementError } = await supabase.from("stock_movements").insert({
        product_id: insertedItem.id,
        batch_id: insertedBatch.id,
        movement_type: "in",
        quantity: stockNumber,
        note: movementNote || null,
      });

      if (movementError) {
        setIsSaving(false);
        return showError(movementError.message);
      }
    }

    await logActivity("create_ingredient", `Membuat bahan baku: ${name.trim()} (${finalCode})`);
    showSuccess("Bahan baku berhasil dibuat");
    navigate("/products/ingredients");
  };

  return (
    <AppLayout title="New Ingredient" backTo="/products/ingredients">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <PackagePlus className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Tambah Bahan Baku</h3>
              <p className="text-sm text-slate-500">Isi data utama bahan baku agar mudah dicari dan dihitung stoknya.</p>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-3xl border border-dashed bg-slate-50 p-4">
              <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ImagePlus className="h-4 w-4" />
                Foto bahan baku
              </Label>
              <Input className="h-12 rounded-2xl bg-white text-base" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              <p className="mt-2 text-xs text-slate-500">Opsional, tetapi membantu pengguna mengenali bahan lebih cepat.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-sm font-semibold text-slate-700">Nama bahan baku</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Gula pasir" />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Kategori</Label>
                <Input
                  className="mt-1 h-12 rounded-2xl text-base"
                  list="ingredient-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Contoh: Bahan kering"
                />
                <datalist id="ingredient-categories">
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Satuan</Label>
                <select className="mt-1 h-12 w-full rounded-2xl border px-4 text-base" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Stok saat ini</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" type="number" min={0} value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} placeholder="0" />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Minimum stok</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="10" />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Harga total beli</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" type="number" min={0} value={totalBuyPrice} onChange={(e) => setTotalBuyPrice(e.target.value)} placeholder="0" />
              </div>

              <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-3">
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

              <div className="sm:col-span-2">
                <Label className="text-sm font-semibold text-slate-700">Catatan bahan baku</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional, contoh: Supplier atau kualitas bahan" />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-sm font-semibold text-slate-700">Kode bahan baku</Label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <Input className="h-12 rounded-2xl text-base" value={itemCode} onChange={(e) => setItemCode(e.target.value)} placeholder="Kosongkan untuk generate otomatis" />
                  <Button type="button" variant="secondary" className="h-12 rounded-2xl px-5" onClick={() => setItemCode(generateCode(name || "INGREDIENT"))}>
                    Generate
                  </Button>
                </div>
              </div>
            </div>

            <Button className="h-13 rounded-2xl bg-emerald-500 py-6 text-base font-semibold hover:bg-emerald-600" onClick={save} disabled={isSaving}>
              <Save className="mr-2 h-5 w-5" />
              {isSaving ? "Menyimpan..." : "Simpan Bahan Baku"}
            </Button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default NewIngredients;