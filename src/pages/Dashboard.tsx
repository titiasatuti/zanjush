import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Beaker, Box, Clock3, ShieldAlert, ShoppingCart } from "lucide-react";
import { formatDateId, getExpiryBadgeClass, getExpiryMeta } from "@/lib/expiry-utils";
import {
  buildStockMapFromMovements,
  calculateProductStockFromRecipe,
  type ProductRecipeRow,
  type SimpleMovementRow,
} from "@/lib/stock-utils";

type InventoryItem = {
  id: string;
  name: string;
  type: "product" | "ingredient";
  min_stock: number;
  last_purchase_date: string | null;
  expiry_date: string | null;
};

type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  created_at?: string;
};

type RecipeRow = ProductRecipeRow;

type BatchSummary = {
  product_id: string;
  expiry_date: string | null;
  remaining_quantity: number;
};

const incomingTypes = ["in", "return", "adjust"];
const STOCK_PAGE_SIZE = 5;

const Dashboard = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [productStockPage, setProductStockPage] = useState(1);
  const [ingredientStockPage, setIngredientStockPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorText("");

      const [itemsRes, movementsRes, batchesRes, recipesRes] = await Promise.all([
        supabase
          .from("items")
          .select("id,name,type,min_stock,last_purchase_date,expiry_date")
          .eq("is_active", true),
        supabase.from("stock_movements").select("id,product_id,movement_type,quantity,created_at"),
        supabase.from("stock_batches").select("product_id,expiry_date,remaining_quantity"),
        supabase.from("product_ingredients").select("product_id,ingredient_id,qty_per_unit"),
      ]);

      if (itemsRes.error || movementsRes.error || batchesRes.error || recipesRes.error) {
        setErrorText(itemsRes.error?.message || movementsRes.error?.message || batchesRes.error?.message || recipesRes.error?.message || "Gagal memuat dashboard");
        setIsLoading(false);
        return;
      }

      setItems((itemsRes.data as InventoryItem[]) || []);
      setMovements((movementsRes.data as Movement[]) || []);
      setBatches((batchesRes.data as BatchSummary[]) || []);
      setRecipeRows((recipesRes.data as RecipeRow[]) || []);
      setIsLoading(false);
    };

    load();
  }, []);

  const stockMap = useMemo(() => {
    return buildStockMapFromMovements(movements as SimpleMovementRow[]);
  }, [movements]);

  const ingredientStockMap = useMemo(() => {
    const map = new Map<string, number>();
    items
      .filter((item) => item.type === "ingredient")
      .forEach((item) => {
        map.set(item.id, stockMap.get(item.id) || 0);
      });
    return map;
  }, [items, stockMap]);

  const productDerivedStockMap = useMemo(() => {
    const map = new Map<string, number>();
    items
      .filter((item) => item.type === "product")
      .forEach((item) => {
        map.set(item.id, calculateProductStockFromRecipe(item.id, recipeRows, ingredientStockMap));
      });
    return map;
  }, [items, recipeRows, ingredientStockMap]);

  const itemMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  const totalProducts = items.filter((item) => item.type === "product").length;
  const totalIngredients = items.filter((item) => item.type === "ingredient").length;

  const todayMovements = useMemo(() => {
    const today = new Date().toDateString();
    return movements.filter((movement) => {
      if (!movement.created_at) return false;
      return new Date(movement.created_at).toDateString() === today;
    });
  }, [movements]);

  const dailyFlow = useMemo(() => {
    let productIn = 0;
    let productOut = 0;
    let ingredientIn = 0;
    let ingredientOut = 0;

    todayMovements.forEach((movement) => {
      const item = itemMap.get(movement.product_id);
      if (!item) return;

      const isIncoming = incomingTypes.includes(movement.movement_type);
      if (item.type === "product") {
        if (isIncoming) productIn += movement.quantity;
        else productOut += movement.quantity;
      } else {
        if (isIncoming) ingredientIn += movement.quantity;
        else ingredientOut += movement.quantity;
      }
    });

    return { productIn, productOut, ingredientIn, ingredientOut };
  }, [todayMovements, itemMap]);

  const topSellingProducts = useMemo(() => {
    const map = new Map<string, { quantity: number; movementCount: number }>();

    movements.forEach((movement) => {
      const item = itemMap.get(movement.product_id);
      if (!item || item.type !== "product") return;
      if (incomingTypes.includes(movement.movement_type)) return;

      const current = map.get(movement.product_id) || { quantity: 0, movementCount: 0 };
      current.quantity += movement.quantity;
      current.movementCount += 1;
      map.set(movement.product_id, current);
    });

    return Array.from(map.entries())
      .map(([productId, stats]) => ({
        product: itemMap.get(productId),
        ...stats,
      }))
      .filter((row) => row.product)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [movements, itemMap]);

  const productStockSummary = useMemo(() => {
    return items
      .filter((item) => item.type === "product")
      .map((item) => ({
        ...item,
        stock: productDerivedStockMap.get(item.id) || 0,
      }))
      .sort((a, b) => b.stock - a.stock);
  }, [items, productDerivedStockMap]);

  const ingredientStockSummary = useMemo(() => {
    return items
      .filter((item) => item.type === "ingredient")
      .map((item) => ({
        ...item,
        stock: stockMap.get(item.id) || 0,
      }))
      .sort((a, b) => b.stock - a.stock);
  }, [items, stockMap]);

  const productStockTotalPages = Math.max(1, Math.ceil(productStockSummary.length / STOCK_PAGE_SIZE));
  const ingredientStockTotalPages = Math.max(1, Math.ceil(ingredientStockSummary.length / STOCK_PAGE_SIZE));

  useEffect(() => {
    if (productStockPage > productStockTotalPages) {
      setProductStockPage(productStockTotalPages);
    }
  }, [productStockPage, productStockTotalPages]);

  useEffect(() => {
    if (ingredientStockPage > ingredientStockTotalPages) {
      setIngredientStockPage(ingredientStockTotalPages);
    }
  }, [ingredientStockPage, ingredientStockTotalPages]);

  const paginatedProductStock = useMemo(() => {
    const start = (productStockPage - 1) * STOCK_PAGE_SIZE;
    return productStockSummary.slice(start, start + STOCK_PAGE_SIZE);
  }, [productStockPage, productStockSummary]);

  const paginatedIngredientStock = useMemo(() => {
    const start = (ingredientStockPage - 1) * STOCK_PAGE_SIZE;
    return ingredientStockSummary.slice(start, start + STOCK_PAGE_SIZE);
  }, [ingredientStockPage, ingredientStockSummary]);

  const lowStock = useMemo(() => {
    return items
      .map((item) => ({
        ...item,
        stock: item.type === "product" ? productDerivedStockMap.get(item.id) || 0 : stockMap.get(item.id) || 0,
        threshold: item.min_stock > 0 ? item.min_stock : 10,
      }))
      .filter((item) => item.stock < item.threshold)
      .sort((a, b) => a.stock - b.stock);
  }, [items, stockMap, productDerivedStockMap]);

  const expiringIngredients = useMemo(() => {
    const nearestExpiryByIngredient = new Map<string, string | null>();

    batches
      .filter((batch) => batch.remaining_quantity > 0)
      .forEach((batch) => {
        if (!batch.expiry_date) return;
        const current = nearestExpiryByIngredient.get(batch.product_id);
        if (!current || new Date(batch.expiry_date) < new Date(current)) {
          nearestExpiryByIngredient.set(batch.product_id, batch.expiry_date);
        }
      });

    return items
      .filter((item) => item.type === "ingredient")
      .map((item) => {
        const nearestBatchExpiry = nearestExpiryByIngredient.get(item.id) || item.expiry_date;
        const meta = getExpiryMeta(nearestBatchExpiry);
        return {
          ...item,
          resolved_expiry_date: nearestBatchExpiry,
          ...meta,
        };
      })
      .filter((item) => item.status === "expired" || item.status === "today" || item.status === "near")
      .sort((a, b) => {
        const aDays = a.daysRemaining ?? Number.MAX_SAFE_INTEGER;
        const bDays = b.daysRemaining ?? Number.MAX_SAFE_INTEGER;
        return aDays - bDays;
      })
      .slice(0, 8);
  }, [items, batches]);

  const batchCountByItem = useMemo(() => {
    const map = new Map<string, number>();
    batches
      .filter((batch) => batch.remaining_quantity > 0)
      .forEach((batch) => {
      map.set(batch.product_id, (map.get(batch.product_id) || 0) + 1);
      });
    return map;
  }, [batches]);

  const detailPath = (item: InventoryItem) =>
    item.type === "ingredient" ? `/products/ingredients/${item.id}` : `/products/catalogue/${item.id}`;

  const expiringSoonTotal = expiringIngredients.length;
  const criticalAlerts = expiringIngredients.length;

  return (
    <AppLayout title="Dasbor">
      {isLoading ? (
        <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">Memuat data operasional...</div>
      ) : errorText ? (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-sm font-medium text-rose-700 shadow-sm">{errorText}</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl border-rose-100 bg-rose-50/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-rose-700">
                  <ShieldAlert className="h-4 w-4" />
                  Alert Kritis
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <span className="text-3xl font-bold text-rose-700">{criticalAlerts}</span>
                <span className="text-xs text-rose-600">Bahan Mendekati Expire</span>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-amber-100 bg-amber-50/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Butuh Restock
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <span className="text-3xl font-bold text-amber-700">{lowStock.length}</span>
                <span className="text-xs text-amber-700">di bawah minimum</span>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-violet-100 bg-violet-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-violet-700">
                  <Clock3 className="h-4 w-4" />
                  Mendekati Expire
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <span className="text-3xl font-bold text-violet-700">{expiringSoonTotal}</span>
                <span className="text-xs text-violet-700">bahan baku</span>
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Box className="h-5 w-5 text-emerald-600" />
                  Stok Produk ({totalProducts})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {productStockSummary.length ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {paginatedProductStock.map((item) => (
                        <Link
                          key={item.id}
                          to={detailPath(item)}
                          className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm transition hover:bg-slate-100"
                        >
                          <div>
                            <span className="font-medium text-slate-800">{item.name}</span>
                            <p className="mt-0.5 text-xs text-slate-500">Stok virtual berbasis komposisi</p>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {item.stock}
                          </span>
                        </Link>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Halaman {productStockPage} dari {productStockTotalPages}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-lg"
                          onClick={() => setProductStockPage((prev) => Math.max(1, prev - 1))}
                          disabled={productStockPage === 1}
                        >
                          Sebelumnya
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-lg"
                          onClick={() => setProductStockPage((prev) => Math.min(productStockTotalPages, prev + 1))}
                          disabled={productStockPage === productStockTotalPages}
                        >
                          Berikutnya
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Belum ada data stok produk.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beaker className="h-5 w-5 text-amber-600" />
                  Stok Ingredients ({totalIngredients})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ingredientStockSummary.length ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {paginatedIngredientStock.map((item) => (
                        <Link
                          key={item.id}
                          to={detailPath(item)}
                          className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm transition hover:bg-slate-100"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">Batch: {batchCountByItem.get(item.id) || 0}</p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            {item.stock}
                          </span>
                        </Link>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Halaman {ingredientStockPage} dari {ingredientStockTotalPages}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-lg"
                          onClick={() => setIngredientStockPage((prev) => Math.max(1, prev - 1))}
                          disabled={ingredientStockPage === 1}
                        >
                          Sebelumnya
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-lg"
                          onClick={() => setIngredientStockPage((prev) => Math.min(ingredientStockTotalPages, prev + 1))}
                          disabled={ingredientStockPage === ingredientStockTotalPages}
                        >
                          Berikutnya
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Belum ada data stok ingredients.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <Card className="rounded-2xl border-amber-100">
              <CardHeader>
                <CardTitle className="text-base">Butuh Restock</CardTitle>
              </CardHeader>
              <CardContent>
                {lowStock.length ? (
                  <div className="space-y-2">
                    {lowStock.slice(0, 10).map((item) => (
                      <Link
                        key={item.id}
                        to={detailPath(item)}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm transition hover:bg-slate-100"
                      >
                        <div>
                          <span className="font-medium text-slate-800">{item.name}</span>
                          <p className="mt-0.5 text-xs capitalize text-slate-500">{item.type === "product" ? "produk" : "bahan baku"}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          {item.stock} / Min {item.threshold}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Tidak ada item yang perlu restock saat ini.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-violet-100 lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Mendekati Expire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ingredients</p>
                  {expiringIngredients.length ? (
                    <div className="space-y-2">
                      {expiringIngredients.slice(0, 5).map((item) => (
                        <Link
                          key={item.id}
                          to={`/products/ingredients/${item.id}`}
                          className="flex items-center justify-between gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm transition hover:bg-slate-100"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">Exp: {formatDateId(item.resolved_expiry_date)}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${getExpiryBadgeClass(item.status)}`}>
                            {item.label}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Tidak ada ingredients mendekati expired.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <Card className="rounded-2xl border-sky-100">
              <CardHeader>
                <CardTitle className="text-base">Arus Stok Hari Ini - Produk</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-medium text-sky-700">Stok Masuk</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-2xl font-bold text-sky-700">{dailyFlow.productIn}</p>
                    <ArrowUpCircle className="h-5 w-5 text-sky-600" />
                  </div>
                </div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <p className="text-xs font-medium text-orange-700">Stok Keluar</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-2xl font-bold text-orange-700">{dailyFlow.productOut}</p>
                    <ArrowDownCircle className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-cyan-100">
              <CardHeader>
                <CardTitle className="text-base">Arus Stok Hari Ini - Ingredients</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                  <p className="text-xs font-medium text-cyan-700">Stok Masuk</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-2xl font-bold text-cyan-700">{dailyFlow.ingredientIn}</p>
                    <ArrowUpCircle className="h-5 w-5 text-cyan-600" />
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs font-medium text-amber-700">Stok Keluar</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-2xl font-bold text-amber-700">{dailyFlow.ingredientOut}</p>
                    <ArrowDownCircle className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                Produk Paling Banyak Keluar
              </CardTitle>
              <p className="text-sm text-slate-500">Membantu melihat produk yang paling sering keluar atau paling laku.</p>
            </CardHeader>
            <CardContent>
              {topSellingProducts.length ? (
                <div className="space-y-2">
                  {topSellingProducts.map((row) => (
                    <Link
                      key={row.product!.id}
                      to={`/products/catalogue/${row.product!.id}`}
                      className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm transition hover:bg-slate-100"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{row.product!.name}</p>
                        <p className="text-xs text-slate-500">{row.movementCount} transaksi keluar</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Keluar: {row.quantity}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Belum ada data produk keluar.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
};

export default Dashboard;