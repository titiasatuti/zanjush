import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

const Scan = () => {
  const [payload, setPayload] = useState("");
  const [label, setLabel] = useState<any>(null);
  const [qty, setQty] = useState(1);

  const resolve = async () => {
    const token = payload.startsWith("v1:") ? payload.replace("v1:", "") : payload;
    const { data, error } = await supabase.from("stock_batches").select("*").eq("qr_payload", token).maybeSingle();
    if (error || !data) return showError("Token not found");
    setLabel(data);
    showSuccess("Label resolved");
  };

  const postMovement = async (type: "in" | "out" | "use" | "adjust" | "waste" | "return") => {
    if (!label) return;
    const { error } = await supabase.from("stock_movements").insert({
      product_id: label.product_id,
      batch_id: label.id,
      movement_type: type,
      quantity: qty,
      note: "Scan operation",
    });
    if (error) return showError(error.message);
    showSuccess("Movement recorded");
  };

  return (
    <AppLayout title="Scan QR">
      <div className="rounded-2xl border bg-white p-4">
        <p className="mb-2 text-sm text-slate-600">Use camera/scanner input. Payload must be opaque token only.</p>
        <div className="flex gap-2">
          <Input value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="v1:token..." />
          <Button onClick={resolve} className="rounded-xl bg-emerald-500 hover:bg-emerald-600">Resolve</Button>
        </div>
      </div>

      {label && (
        <div className="mt-4 rounded-2xl border bg-white p-4">
          <p className="font-medium">Batch: {label.batch_code}</p>
          <p className="text-sm text-slate-500">Expiry: {label.expiry_date}</p>
          <div className="mt-3 flex gap-2">
            <Input className="max-w-28" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            {(["in", "out", "use", "adjust", "waste", "return"] as const).map((t) => (
              <Button key={t} variant="secondary" className="rounded-xl" onClick={() => postMovement(t)}>{t}</Button>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Scan;