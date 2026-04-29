import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useNavigate } from "react-router-dom";

const generateCode = (name: string) =>
  `BRG-${name.replace(/\s+/g, "-").toUpperCase().slice(0, 8)}-${Math.floor(Math.random() * 999)}`;

const NewProductsCatalogue = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [unit, setUnit] = useState("Pcs");
  const [costPrice, setCostPrice] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    if (!name) return showError("Name is required");
    setIsSaving(true);

    const uploadedPhotoUrl = await uploadPhoto();
    if (photoFile && !uploadedPhotoUrl) {
      setIsSaving(false);
      return;
    }

    const finalCode = itemCode || generateCode(name);

    const { error } = await supabase.from("products").insert({
      name,
      sku: finalCode,
      unit: unit.toLowerCase(),
      min_stock: 0,
      category,
      sell_price: sellPrice ? Number(sellPrice) : null,
      cost_price: costPrice ? Number(costPrice) : null,
      photo_url: uploadedPhotoUrl,
    });

    if (error) {
      setIsSaving(false);
      return showError(error.message);
    }

    showSuccess("Catalogue saved");
    navigate("/products/catalogue");
  };

  return (
    <AppLayout title="New Catalogue">
      <div className="grid gap-3 rounded-2xl border bg-white p-4">
        <div>
          <Label>Image</Label>
          <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
        </div>

        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <Label>Harga Jual</Label>
          <Input placeholder="Masukkan Harga" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
        </div>

        <div>
          <Label>Katetori</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Uncategorized" />
        </div>

        <div>
          <Label>Satuan Jual</Label>
          <select
            className="h-10 w-full rounded-md border px-3 text-sm"
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

        <div>
          <Label>Harga Modal</Label>
          <Input placeholder="Masukkan Harga" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
        </div>

        <div>
          <Label>Kode Barang</Label>
          <div className="flex gap-2">
            <Input
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              placeholder="Masukkan Kode Barang atau generate"
            />
            <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setItemCode(generateCode(name || "ITEM"))}>
              Generate
            </Button>
          </div>
        </div>

        <Button className="rounded-xl bg-emerald-500 hover:bg-emerald-600" onClick={saveCatalogue} disabled={isSaving}>
          {isSaving ? "Saving..." : "Simpan Katalog"}
        </Button>
      </div>
    </AppLayout>
  );
};

export default NewProductsCatalogue;