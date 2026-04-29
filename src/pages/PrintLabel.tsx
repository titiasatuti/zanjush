import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

const PrintLabel = () => {
  const [searchParams] = useSearchParams();

  const name = searchParams.get("name") || "Label Item";
  const payload = searchParams.get("payload") || "";
  const type = searchParams.get("type") || "Item";
  const qrUrl = payload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(payload)}`
    : "";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between gap-3 print:hidden">
        <Button asChild variant="secondary" className="rounded-2xl">
          <Link to="/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="rounded-2xl bg-violet-500 hover:bg-violet-600">
          <Printer className="mr-2 h-4 w-4" />
          Cetak Label
        </Button>
      </div>

      <main className="mx-auto max-w-3xl rounded-[2rem] bg-white p-6 shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <section className="mx-auto flex aspect-square w-full max-w-[640px] flex-col items-center justify-center rounded-[2rem] border-2 border-slate-200 bg-white p-8 text-center print:h-[95mm] print:w-[95mm] print:border print:p-4">
          <div className="mb-4 rounded-full bg-violet-100 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-violet-700">
            {type}
          </div>

          {qrUrl ? (
            <img src={qrUrl} alt={`QR ${name}`} className="h-72 w-72 rounded-3xl border object-contain print:h-[58mm] print:w-[58mm]" />
          ) : (
            <div className="flex h-72 w-72 items-center justify-center rounded-3xl border bg-slate-50 text-sm text-slate-500 print:h-[58mm] print:w-[58mm]">
              Payload QR tidak tersedia
            </div>
          )}

          <h1 className="mt-5 max-w-full text-2xl font-extrabold text-slate-950 print:mt-3 print:text-base">
            {name}
          </h1>
          <p className="mt-2 max-w-md break-all text-xs font-medium text-slate-500 print:text-[8px]">
            {payload || "Tidak ada payload"}
          </p>
        </section>
      </main>
    </div>
  );
};

export default PrintLabel;