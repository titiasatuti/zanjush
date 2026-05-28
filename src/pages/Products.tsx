import { AppLayout } from "@/components/app-layout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package2, Plus, CookingPot, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

const Products = () => {
  return (
    <AppLayout title="Produk">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-3xl border-emerald-100 transition hover:border-emerald-300 hover:shadow-sm">
          <CardHeader>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Package2 className="h-6 w-6" />
              </div>
              <Button asChild size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
                <Link to="/products/catalogue/new">
                  <Plus className="mr-1 h-4 w-4" />
                  Produk Baru
                </Link>
              </Button>
            </div>
            <CardTitle>Produk</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Kelola daftar produk, harga jual, dan stok barang.</p>
            <Button asChild variant="secondary" className="mt-3 rounded-xl">
              <Link to="/products/catalogue">Buka Produk</Link>
            </Button>
          </CardContent>
        </Card>

        <Link to="/products/ingredients">
          <Card className="h-full rounded-3xl border-emerald-100 transition hover:border-emerald-300 hover:shadow-sm">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <CookingPot className="h-6 w-6" />
              </div>
              <CardTitle>Atur Bahan Baku</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">Kelola data bahan baku, stok awal, harga beli, dan catatan.</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/stock" className="sm:hidden">
          <Card className="h-full rounded-3xl border-violet-200 transition hover:border-violet-300 hover:shadow-sm">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <ClipboardList className="h-6 w-6" />
              </div>
              <CardTitle>Histori Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">Halaman gabungan untuk pergerakan stok dan aktivitas sistem secara detail.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </AppLayout>
  );
};

export default Products;