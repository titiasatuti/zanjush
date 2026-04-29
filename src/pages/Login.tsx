import { Navigate } from "react-router-dom";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";

type LoginProps = {
  isAuthenticated: boolean;
};

const Login = ({ isAuthenticated }: LoginProps) => {
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 rounded-3xl bg-emerald-500 p-6 text-white">
          <p className="text-xs uppercase tracking-wider text-emerald-100">Welcome Back</p>
          <h1 className="mt-1 text-2xl font-semibold">Juice Inventory Login</h1>
          <p className="mt-2 text-sm text-emerald-50">Sign in to record stock movements and manage operations securely.</p>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              style: {
                button: {
                  borderRadius: "12px",
                },
                input: {
                  borderRadius: "12px",
                },
                anchor: {
                  color: "#047857",
                },
              },
            }}
            theme="light"
          />
        </div>
      </div>
    </div>
  );
};

export default Login;