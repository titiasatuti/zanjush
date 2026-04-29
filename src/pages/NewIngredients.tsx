import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useNavigate } from "react-router-dom";

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
        min_stock: 0,
        photo_url: uploadedPhotoUrl,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertItemError || !insertedItem) {
      setIsSaving(false);
      return showError(insertItemError?.message || "Gagal menyimpan bahan baku");
    }

    if (stockNumber > 0 || priceNumber > 0 || notes.trim()) {
      const movementNote = [
        notes.trim() ? notes.trim() : null,
        priceNumber > 0 ? `Harga total beli: ${priceNumber}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const { error: movementError } = await supabase.from("stock_movements").insert({
        product_id: insertedItem.id,
        movement_type: "in",
        quantity: stockNumber > 0 ? stockNumber : 0,
        note: movementNote || null,
      });

      if (movementError) {
        setIsSaving(false);
        return showError(movementError.message);
      }
    }

    showSuccess("Bahan baku berhasil dibuat");
    navigate("/products/ingredients");
  };

  return (
    <AppLayout title="New Ingredient" backTo="/products/ingredients">
      <div className="grid gap-3 rounded-2xl border bg-white p-4">
        <div>
          <Label>Foto</Label>
          <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
        </div>

        <div>
          <Label>Nama bahan baku</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <Label>Kategori bahan baku</Label>
          <Input
            list="ingredient-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ketik kategori baru atau pilih yang sudah ada"
          />
          <datalist id="ingredient-categories">
            {existingCategories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>

        <div>
          <Label>Satuan bahan baku</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Stok saat ini</Label>
          <Input type="number" min={0} value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} />
        </div>

        <div>
          <Label>Harga total beli bahan baku</Label>
          <Input type="number" min={0} value={totalBuyPrice} onChange={(e) => setTotalBuyPrice(e.target.value)} />
        </div>

        <div>
          <Label>Catatan Bahan Baku (Optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div>
          <Label>Kode Bahan Baku</Label>
          <div className="flex gap-2">
            <Input value={itemCode} onChange={(e) => setItemCode(e.target.value)} placeholder="Masukkan kode atau generate" />
            <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setItemCode(generateCode(name || "INGREDIENT"))}>
              Generate
            </Button>
          </div>
        </div>

        <Button className="rounded-xl bg-emerald-500 hover:bg-emerald-600" onClick={save} disabled={isSaving}>
          {isSaving ? "Saving..." : "Simpan Bahan Baku"}
        </Button>
      </div>
    </AppLayout>
  );
};

export default NewIngredients;