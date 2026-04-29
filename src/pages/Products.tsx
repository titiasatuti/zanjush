import { AppLayout } from "@/components/app-layout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package2, Plus, CookingPot, FileBarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const Products = () => {
  return (
    <AppLayout title="Products">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-3xl border-emerald-100 transition hover:border-emerald-300 hover:shadow-sm">
          <CardHeader>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Package2 className="h-6 w-6" />
              </div>
              <Button asChild size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
                <Link to="/products/catalougue/new">
                  <Plus className="mr-1 h-4 w-4" />
                  New Catalogue
                </Link>
              </Button>
            </div>
            <CardTitle>Catalogue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Open your product catalogue, pricing, sales, and stocks.</p>
            <Button asChild variant="secondary" className="mt-3 rounded-xl">
              <Link to="/products/catalogue">Open Catalogue</Link>
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

        <Card className="rounded-3xl border-slate-200 opacity-90">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <FileBarChart2 className="h-6 w-6" />
            </div>
            <CardTitle>Lihat Laporan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Ringkasan dan laporan akan kita kerjakan setelah bahan baku selesai.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Products;