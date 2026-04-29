import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/utils/toast";

const sku = (name: string, type: string) =>
  `${type.slice(0, 1).toUpperCase()}-${name.replace(/\s+/g, "-").toUpperCase().slice(0, 8)}-${Math.floor(Math.random() * 999)}`;

const Products = () => {
  const [type, setType] = useState<"product" | "ingredient">("product");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("bottle");
  const [minStock, setMinStock] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = async () => {
    const { data } = await supabase.from("items").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  };

  useEffect(() => {
    refresh();
  }, []);

  const uploadPhoto = async () => {
    if (!photoFile) return null;

    const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `items/${crypto.randomUUID()}.${ext}`;

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

  const create = async () => {
    if (!name) return showError("Name is required");
    setIsSaving(true);

    const finalSku = code || sku(name, type);
    const uploadedPhotoUrl = await uploadPhoto();

    if (photoFile && !uploadedPhotoUrl) {
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("items").insert({
      type,
      name,
      sku: finalSku,
      unit,
      min_stock: minStock,
      photo_url: uploadedPhotoUrl,
      is_active: true,
    });

    if (error) {
      setIsSaving(false);
      return showError(error.message);
    }

    showSuccess("Item created");
    setName("");
    setCode("");
    setMinStock(0);
    setPhotoFile(null);
    refresh();
    setIsSaving(false);
  };

  return (
    <AppLayout title="Products & Ingredients">
      <div className="grid gap-4 rounded-2xl border bg-white p-4">
        <div className="flex gap-2">
          <Button variant={type === "product" ? "default" : "secondary"} className="rounded-xl" onClick={() => setType("product")}>
            Product
          </Button>
          <Button variant={type === "ingredient" ? "default" : "secondary"} className="rounded-xl" onClick={() => setType("ingredient")}>
            Ingredient
          </Button>
        </div>
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>SKU</Label>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto-generated if empty" />
            <Button variant="secondary" className="rounded-xl" onClick={() => setCode(sku(name || "ITEM", type))}>
              Regenerate
            </Button>
          </div>
        </div>
        <div>
          <Label>Unit <span className="text-slate-500">(?)</span></Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Unit is how stock is measured, e.g., bottle, gram, kg, liter, piece.</p>
        </div>
        <div>
          <Label>Min stock</Label>
          <Input type="number" value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} />
        </div>
        <div>
          <Label>Upload photo</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            className="cursor-pointer"
          />
          {photoFile && <p className="mt-1 text-xs text-slate-500">Selected: {photoFile.name}</p>}
        </div>
        <Button className="rounded-xl bg-emerald-500 hover:bg-emerald-600" onClick={create} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        {items.map((i) => (
          <div key={i.id} className="rounded-2xl border bg-white p-3 text-sm">
            <p className="font-medium">{i.name}</p>
            <p className="text-slate-500">{i.type} • {i.sku} • min {i.min_stock}</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

export default Products;