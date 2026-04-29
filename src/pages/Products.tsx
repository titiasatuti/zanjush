import { AppLayout } from "@/components/app-layout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package2 } from "lucide-react";

const Products = () => {
  return (
    <AppLayout title="Products">
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/products/catalogue">
          <Card className="rounded-3xl border-emerald-100 transition hover:border-emerald-300 hover:shadow-sm">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Package2 className="h-6 w-6" />
              </div>
              <CardTitle>Catalogue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">Open your product catalogue, pricing, sales, and stocks.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </AppLayout>
  );
};

export default Products;