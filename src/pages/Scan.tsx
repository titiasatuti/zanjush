import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { QrCameraScanner } from "@/components/qr-camera-scanner";

const Scan = () => {
  const [payload, setPayload] = useState("");
  const [label, setLabel] = useState<any>(null);
  const [qty, setQty] = useState(1);

  const resolveToken = async (rawPayload: string) => {
    const token = rawPayload.startsWith("v1:") ? rawPayload.replace("v1:", "") : rawPayload;
    const { data, error } = await supabase
      .from("stock_batches")
      .select("*")
      .eq("qr_payload", token)
      .maybeSingle();

    if (error || !data) {
      showError("Token not found");
      return;
    }

    setPayload(rawPayload);
    setLabel(data);
    showSuccess("Label resolved");
  };

  const resolve = async () => {
    if (!payload.trim()) {
      showError("Please scan or enter a payload");
      return;
    }
    await resolveToken(payload.trim());
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
      <div className="grid gap-4">
        <QrCameraScanner onDetected={resolveToken} />

        <div className="rounded-3xl border bg-white p-4">
          <p className="mb-2 text-sm text-slate-600">
            Manual / USB scanner input fallback (opaque token only).
          </p>
          <div className="flex gap-2">
            <Input
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="v1:token..."
              className="rounded-xl"
            />
            <Button onClick={resolve} className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
              Resolve
            </Button>
          </div>
        </div>
      </div>

      {label && (
        <div className="mt-4 rounded-3xl border bg-white p-4">
          <p className="font-medium">Batch: {label.batch_code}</p>
          <p className="text-sm text-slate-500">Expiry: {label.expiry_date || "—"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              className="max-w-28 rounded-xl"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
            {(["in", "out", "use", "adjust", "waste", "return"] as const).map((t) => (
              <Button key={t} variant="secondary" className="rounded-xl" onClick={() => postMovement(t)}>
                {t}
              </Button>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Scan;