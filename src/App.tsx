import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { Session } from "@supabase/supabase-js";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Products from "./pages/Products";
import Scan from "./pages/Scan";
import ProductsCatalogue from "./pages/ProductsCatalogue";
import NewProductsCatalogue from "./pages/NewProductsCatalogue";
import Ingredients from "./pages/Ingredients";
import NewIngredients from "./pages/NewIngredients";
import Login from "./pages/Login";
import ProductDetail from "./pages/ProductDetail";
import IngredientDetail from "./pages/IngredientDetail";
import History from "./pages/History";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (event === "INITIAL_SESSION") {
        setIsSessionReady(true);
      }

      if (event === "SIGNED_OUT") {
        setSession(null);
      }
    });

    supabase.auth.getSession().then(({ data: sessionData }) => {
      setSession(sessionData.session);
      setIsSessionReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">Loading session...</div>
      </div>
    );
  }

  const isAuthenticated = !!session;

  const protectedElement = (element: ReactElement) => (isAuthenticated ? element : <Navigate to="/login" replace />);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login isAuthenticated={isAuthenticated} />} />
            <Route path="/" element={protectedElement(<Index />)} />
            <Route path="/products" element={protectedElement(<Products />)} />
            <Route path="/products/catalogue" element={protectedElement(<ProductsCatalogue />)} />
            <Route path="/products/catalogue/:id" element={protectedElement(<ProductDetail />)} />
            <Route path="/products/catalogue/new" element={protectedElement(<NewProductsCatalogue />)} />
            <Route path="/products/catalougue/new" element={<Navigate to="/products/catalogue/new" replace />} />
            <Route path="/products/ingredients" element={protectedElement(<Ingredients />)} />
            <Route path="/products/ingredients/:id" element={protectedElement(<IngredientDetail />)} />
            <Route path="/products/ingredients/new" element={protectedElement(<NewIngredients />)} />
            <Route path="/scan" element={protectedElement(<Scan />)} />
            <Route path="/labels" element={<Navigate to="/products" replace />} />
            <Route path="/history" element={protectedElement(<History />)} />
            <Route path="/stock" element={<Navigate to="/products/catalogue" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;