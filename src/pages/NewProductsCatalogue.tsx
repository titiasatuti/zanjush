import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useNavigate } from "react-router-dom";
import { logActivity } from "@/lib/activity-log";
import { ImagePlus, PackagePlus, Save } from "lucide-react";

const generateCode = (name: string) =>
  `BRG-${name.replace(/\s+/g, "-").toUpperCase().slice(0, 8)}-${Math.floor(Math.random() * 999)}`;

const NewProductsCatalogue = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [category, setCategory] = useState("Tanpa Kategori");
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [unit, setUnit] = useState("Pcs");
  const [costPrice, setCostPrice] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("products")
      .select("category")
      .not("category", "is", null)
      .then(({ data }) => {
        const categories = Array.from(new Set((data || []).map((row) => (row.category || "").trim()).filter(Boolean)));
        setExistingCategories(categories);
      });
  }, []);

  const uploadPhoto = async () => {
    if (!photoFile) return null;
    const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `catalogue/${crypto.randomUUID()}.${ext}`;
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

  const saveCatalogue = async () => {
    if (!name.trim()) return showError("Nama wajib diisi");

    setIsSaving(true);

    const uploadedPhotoUrl = await uploadPhoto();
    if (photoFile && !uploadedPhotoUrl) {
      setIsSaving(false);
      return;
    }

    const finalCode = itemCode.trim() || generateCode(name);
    const cleanUnit = unit.toLowerCase();
    const cleanCategory = category.trim() || "Tanpa Kategori";

    const { data: insertedProduct, error } = await supabase
      .from("products")
      .insert({
        name: name.trim(),
        sku: finalCode,
        unit: cleanUnit,
        min_stock: 0,
        category: cleanCategory,
        sell_price: sellPrice ? Number(sellPrice) : null,
        cost_price: costPrice ? Number(costPrice) : null,
        photo_url: uploadedPhotoUrl,
      })
      .select("id")
      .single();

    if (error || !insertedProduct) {
      setIsSaving(false);
      return showError(error?.message || "Gagal menyimpan produk");
    }

    const { error: itemError } = await supabase.from("items").insert({
      id: insertedProduct.id,
      type: "product",
      name: name.trim(),
      sku: finalCode,
      unit: cleanUnit,
      min_stock: 0,
      photo_url: uploadedPhotoUrl,
      is_active: true,
    });

    if (itemError) {
      setIsSaving(false);
      return showError(itemError.message);
    }

    await logActivity("create_product", `Membuat produk: ${name} (${finalCode})`);
    showSuccess("Produk berhasil disimpan");
    navigate("/products/catalogue");
  };

  return (
    <AppLayout title="Produk Baru" backTo="/products/catalogue">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <PackagePlus className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Tambah Produk</h3>
              <p className="text-sm text-slate-500">Masukkan informasi produk yang akan dijual dan dikelola stoknya.</p>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-3xl border border-dashed bg-slate-50 p-4">
              <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ImagePlus className="h-4 w-4" />
                Gambar produk
              </Label>
              <Input className="h-12 rounded-2xl bg-white text-base" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              <p className="mt-2 text-xs text-slate-500">Opsional, gunakan foto yang jelas agar produk mudah dikenali.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-sm font-semibold text-slate-700">Nama produk</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Jus Alpukat" />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Harga jual</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" type="number" placeholder="Contoh: 15000" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Harga modal</Label>
                <Input className="mt-1 h-12 rounded-2xl text-base" type="number" placeholder="Contoh: 9000" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Kategori</Label>
                <Input
                  className="mt-1 h-12 rounded-2xl text-base"
                  list="catalogue-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Contoh: Minuman"
                />
                <datalist id="catalogue-categories">
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Satuan jual</Label>
                <select
                  className="mt-1 h-12 w-full rounded-2xl border px-4 text-base"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  {["Pcs", "Porsi", "Boks", "Liter", "Gram", "KG"].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-sm font-semibold text-slate-700">Kode barang</Label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <Input
                    className="h-12 rounded-2xl text-base"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="Kosongkan untuk generate otomatis"
                  />
                  <Button type="button" variant="secondary" className="h-12 rounded-2xl px-5" onClick={() => setItemCode(generateCode(name || "ITEM"))}>
                    Generate
                  </Button>
                </div>
              </div>
            </div>

            <Button className="h-13 rounded-2xl bg-emerald-500 py-6 text-base font-semibold hover:bg-emerald-600" onClick={saveCatalogue} disabled={isSaving}>
              <Save className="mr-2 h-5 w-5" />
              {isSaving ? "Menyimpan..." : "Simpan Produk"}
            </Button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default NewProductsCatalogue;