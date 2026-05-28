import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { BrandingSettings, defaultBranding, getBrandingIcon, loadBrandingSettings } from "@/lib/branding";

type LoginProps = {
  isAuthenticated: boolean;
};

const Login = ({ isAuthenticated }: LoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);

  useEffect(() => {
    loadBrandingSettings().then(setBranding);
  }, []);

  const BrandIcon = getBrandingIcon(branding.icon_name);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      showError("Email dan password wajib diisi");
      return;
    }

    setIsSubmitting(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      setIsSubmitting(false);

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess("Berhasil login");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      showError(error.message);
      return;
    }

    showSuccess("Akun dibuat, silakan cek email untuk verifikasi jika diminta");
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="Logo Zanjus" className="h-44 w-full object-cover object-center" />
          ) : (
            <div className="flex h-44 items-center justify-center bg-gradient-to-br from-emerald-500 via-lime-500 to-orange-400 px-6 text-center text-white">
              <div>
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                  <BrandIcon className="h-8 w-8" />
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-100">Welcome Back</p>
                <h1 className="mt-1 text-2xl font-semibold">{branding.dashboard_name}</h1>
                <p className="mt-2 text-sm text-emerald-50">Masuk untuk mengelola stok dan operasional dengan cepat.</p>
              </div>
            </div>
          )}
          {branding.logo_url && (
            <div className="space-y-1 px-6 py-4 text-slate-900">
              <p className="text-xs uppercase tracking-wider text-slate-500">Welcome Back</p>
              <h1 className="text-2xl font-semibold">{branding.dashboard_name}</h1>
              <p className="text-sm text-slate-500">Masuk untuk mengelola stok dan operasional dengan cepat.</p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              onClick={() => setMode("signin")}
              variant={mode === "signin" ? "default" : "secondary"}
              className="flex-1 rounded-xl"
            >
              Sign In
            </Button>
            <Button
              type="button"
              onClick={() => setMode("signup")}
              variant={mode === "signup" ? "default" : "secondary"}
              className="flex-1 rounded-xl"
            >
              Sign Up
            </Button>
          </div>

          <div className="grid gap-3">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div>
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <Button
              type="button"
              onClick={submit}
              disabled={isSubmitting}
              className="mt-1 rounded-xl bg-emerald-500 hover:bg-emerald-600"
            >
              {isSubmitting ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;