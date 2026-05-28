import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getExpiryBadgeClass, getExpiryMeta, formatDateId } from "@/lib/expiry-utils";

type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string | null;
  sell_price: number | null;
  photo_url: string | null;
  production_date: string | null;
  expiry_date: string | null;
};

type Movement = {
  product_id: string;
  movement_type: string;
  quantity: number;
};

type BatchSummary = {
  product_id: string;
};

const isIngredientMirror = (sku: string) => sku.includes("[CAT:") || sku.includes("ING-");

const ProductsCatalogue = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [expiryFilter, setExpiryFilter] = useState<"all" | "near" | "expired">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorText("");

      const [productsRes, movementsRes, batchesRes] = await Promise.all([
        supabase
          .from("products")
          .select("id,name,sku,unit,category,sell_price,photo_url,production_date,expiry_date")
          .order("created_at", { ascending: false }),
        supabase.from("stock_movements").select("product_id,movement_type,quantity"),
        supabase.from("stock_batches").select("product_id"),
      ]);

      if (productsRes.error || movementsRes.error || batchesRes.error) {
        setErrorText(productsRes.error?.message || movementsRes.error?.message || batchesRes.error?.message || "Gagal memuat produk");
        setIsLoading(false);
        return;
      }

      const allProducts = (productsRes.data as Product[]) || [];
      const catalogueOnly = allProducts.filter((p) => !isIngredientMirror(p.sku) && p.category !== "Diarsipkan");

      setProducts(catalogueOnly);
      setMovements((movementsRes.data as Movement[]) || []);
      setBatches((batchesRes.data as BatchSummary[]) || []);
      setIsLoading(false);
    };
    load();
  }, []);

  const stockByProduct = useMemo(() => {
    const map = new Map<string, number>();
    movements.forEach((m) => {
      const sign = ["in", "return", "adjust"].includes(m.movement_type) ? 1 : -1;
      map.set(m.product_id, (map.get(m.product_id) || 0) + sign * m.quantity);
    });
    return map;
  }, [movements]);

  const filteredProducts = useMemo(() => {
    if (expiryFilter === "all") return products;

    return products.filter((product) => {
      const meta = getExpiryMeta(product.expiry_date);
      if (expiryFilter === "expired") {
        return meta.status === "expired" || meta.status === "today";
      }
      return meta.status === "near";
    });
  }, [products, expiryFilter]);

  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, Product[]>();
    filteredProducts.forEach((product) => {
      const category = product.category?.trim() || "Tanpa Kategori";
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(product);
    });
    return Array.from(grouped.entries());
  }, [filteredProducts]);

  const batchCountByItem = useMemo(() => {
    const map = new Map<string, number>();
    batches.forEach((batch) => {
      map.set(batch.product_id, (map.get(batch.product_id) || 0) + 1);
    });
    return map;
  }, [batches]);

  return (
    <AppLayout title="Produk" backTo="/products">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
          <Link to="/products/catalogue/new">Buat Produk Baru</Link>
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter Expired</span>
          <select
            className="h-10 rounded-xl border px-3 text-sm"
            value={expiryFilter}
            onChange={(event) => setExpiryFilter(event.target.value as "all" | "near" | "expired")}
          >
            <option value="all">Semua</option>
            <option value="near">Hampir expired (maks. 3 hari)</option>
            <option value="expired">Sudah expired</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">Memuat daftar produk...</div>
      ) : errorText ? (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-sm font-medium text-rose-700 shadow-sm">{errorText}</div>
      ) : (
        <div className="space-y-6">
          {productsByCategory.map(([category, categoryProducts]) => (
            <section key={category} className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{category}</p>
                <p className="text-xs text-emerald-700/80">{categoryProducts.length} item</p>
              </div>

              <div className="space-y-3">
                {categoryProducts.map((p) => {
                  const expiry = getExpiryMeta(p.expiry_date);
                  const stock = stockByProduct.get(p.id) || 0;
                  const batchCount = batchCountByItem.get(p.id) || 0;

                  return (
                    <Link key={p.id} to={`/products/catalogue/${p.id}`} className="block rounded-3xl border bg-white p-3 shadow-sm transition hover:shadow-md">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-28 sm:w-28">
                          {p.photo_url ? (
                            <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-400">
                              Tidak Ada Gambar
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">{p.name}</p>
                              <p className="mt-0.5 text-sm font-medium text-emerald-700">
                                {typeof p.sell_price === "number" ? `Rp ${p.sell_price.toLocaleString()}` : "Harga belum diatur"}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getExpiryBadgeClass(expiry.status)}`}>
                              {expiry.label}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-slate-500">Stok</p>
                              <p className="text-sm font-semibold text-slate-900">{stock}</p>
                            </div>
                            <div className="rounded-xl bg-indigo-50 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-indigo-500">Batch</p>
                              <p className="text-sm font-semibold text-indigo-700">{batchCount}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-slate-500">Expired</p>
                              <p className="truncate text-sm font-semibold text-slate-900">{formatDateId(p.expiry_date)}</p>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>SKU: {p.sku}</span>
                            <span>Unit: {p.unit}</span>
                            <span>Produksi: {formatDateId(p.production_date)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {!filteredProducts.length && <p className="text-sm text-slate-500">Tidak ada produk pada filter ini.</p>}
        </div>
      )}
    </AppLayout>
  );
};

export default ProductsCatalogue;