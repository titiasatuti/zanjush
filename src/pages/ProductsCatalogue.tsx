import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  buildStockMapFromMovements,
  calculateProductStockFromRecipe,
  type ProductRecipeRow,
  type SimpleMovementRow,
} from "@/lib/stock-utils";

type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string | null;
  sell_price: number | null;
  photo_url: string | null;
};

type ItemRef = { id: string; type: "product" | "ingredient" };

const isIngredientMirror = (sku: string) => sku.includes("[CAT:") || sku.includes("ING-");

const ProductsCatalogue = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<SimpleMovementRow[]>([]);
  const [recipeRows, setRecipeRows] = useState<ProductRecipeRow[]>([]);
  const [items, setItems] = useState<ItemRef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorText("");

      const [productsRes, movementsRes, recipesRes, itemsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id,name,sku,unit,category,sell_price,photo_url")
          .order("created_at", { ascending: false }),
        supabase.from("stock_movements").select("product_id,movement_type,quantity"),
        supabase.from("product_ingredients").select("product_id,ingredient_id,qty_per_unit"),
        supabase.from("items").select("id,type").eq("is_active", true),
      ]);

      if (productsRes.error || movementsRes.error || recipesRes.error || itemsRes.error) {
        setErrorText(productsRes.error?.message || movementsRes.error?.message || recipesRes.error?.message || itemsRes.error?.message || "Gagal memuat produk");
        setIsLoading(false);
        return;
      }

      const allProducts = (productsRes.data as Product[]) || [];
      const catalogueOnly = allProducts.filter((p) => !isIngredientMirror(p.sku) && p.category !== "Diarsipkan");

      setProducts(catalogueOnly);
      setMovements((movementsRes.data as SimpleMovementRow[]) || []);
      setRecipeRows((recipesRes.data as ProductRecipeRow[]) || []);
      setItems((itemsRes.data as ItemRef[]) || []);
      setIsLoading(false);
    };
    load();
  }, []);

  const ingredientIds = useMemo(() => {
    return new Set(items.filter((item) => item.type === "ingredient").map((item) => item.id));
  }, [items]);

  const ingredientStockMap = useMemo(() => {
    const allStockMap = buildStockMapFromMovements(movements);
    const map = new Map<string, number>();
    ingredientIds.forEach((id) => {
      map.set(id, allStockMap.get(id) || 0);
    });
    return map;
  }, [movements, ingredientIds]);

  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, Product[]>();
    products.forEach((product) => {
      const category = product.category?.trim() || "Tanpa Kategori";
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(product);
    });
    return Array.from(grouped.entries());
  }, [products]);

  return (
    <AppLayout title="Produk" backTo="/products">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
          <Link to="/products/catalogue/new">Buat Produk Baru</Link>
        </Button>
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
                  const stock = calculateProductStockFromRecipe(p.id, recipeRows, ingredientStockMap);
                  const productRecipeRows = recipeRows.filter((row) => row.product_id === p.id);
                  const ingredientCount = productRecipeRows.length;
                  const totalQtyPerUnit = productRecipeRows.reduce((sum, row) => sum + row.qty_per_unit, 0);

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
                            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Siap dibuat: {stock}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-slate-500">Kebutuhan per Produk</p>
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {ingredientCount > 0 ? totalQtyPerUnit.toLocaleString() : "Belum ada resep"}
                              </p>
                            </div>
                            <div className="rounded-xl bg-indigo-50 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-indigo-500">Komposisi</p>
                              <p className="text-sm font-semibold text-indigo-700">{ingredientCount} bahan</p>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>SKU: {p.sku}</span>
                            <span>Unit: {p.unit}</span>
                            <span>Model: made-by-order</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {!products.length && <p className="text-sm text-slate-500">Tidak ada produk tersimpan.</p>}
        </div>
      )}
    </AppLayout>
  );
};

export default ProductsCatalogue;