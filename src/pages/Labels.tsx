import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";

const token = () => crypto.randomUUID().replaceAll("-", "");

const Labels = () => {
  const [items, setItems] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [createdPayload, setCreatedPayload] = useState("");

  useEffect(() => {
    supabase.from("items").select("id,name,type").eq("is_active", true).then(({ data }) => setItems(data || []));
  }, []);

  const create = async () => {
    if (!productId || !batchCode || !productionDate || !expiryDate) return showError("Fill required fields");
    if (new Date(expiryDate) < new Date(productionDate)) return showError("Expiry must be after production/purchase date");
    const secure = token();
    const { error } = await supabase.from("stock_batches").insert({
      product_id: productId,
      batch_code: batchCode,
      production_date: productionDate,
      expiry_date: expiryDate,
      qr_payload: secure,
    });
    if (error) return showError(error.message);
    setCreatedPayload(`v1:${secure}`);
    showSuccess("Label created");
  };

  return (
    <AppLayout title="Labels">
      <div className="grid gap-3 rounded-2xl border bg-white p-4">
        <div>
          <Label>Target Item</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select item</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type})</option>)}
          </select>
        </div>
        <div><Label>Batch code</Label><Input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} /></div>
        <div><Label>Production/Purchase date</Label><Input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} /></div>
        <div><Label>Expiry date</Label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
        <Button className="rounded-xl bg-emerald-500 hover:bg-emerald-600" onClick={create}>Generate Secure QR Label</Button>
      </div>

      {createdPayload && (
        <div className="mt-4 rounded-2xl border bg-emerald-50 p-4">
          <p className="font-medium">Label payload (print in QR):</p>
          <p className="mt-1 break-all text-sm text-emerald-800">{createdPayload}</p>
        </div>
      )}
    </AppLayout>
  );
};

export default Labels;