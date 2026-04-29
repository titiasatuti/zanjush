import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";

type LoginProps = {
  isAuthenticated: boolean;
};

const Login = ({ isAuthenticated }: LoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        <div className="mb-6 rounded-3xl bg-emerald-500 p-6 text-white">
          <p className="text-xs uppercase tracking-wider text-emerald-100">Welcome Back</p>
          <h1 className="mt-1 text-2xl font-semibold">Juice Inventory Login</h1>
          <p className="mt-2 text-sm text-emerald-50">Sign in to record stock movements and manage operations securely.</p>
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