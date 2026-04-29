import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import {
  BrandingSettings,
  brandingIcons,
  defaultBranding,
  getBrandingIcon,
  loadBrandingSettings,
  saveBrandingSettings,
} from "@/lib/branding";
import { ImagePlus, Save, UserRound, X } from "lucide-react";

const SettingsPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const iconEntries = useMemo(() => Object.entries(brandingIcons), []);
  const PreviewIcon = getBrandingIcon(branding.icon_name);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const currentUser = data.user || null;
      setUser(currentUser);
      setDisplayName((currentUser?.user_metadata?.display_name as string) || "");
      setPhone((currentUser?.user_metadata?.phone as string) || "");
    });

    loadBrandingSettings().then(setBranding);
  }, []);

  const uploadLogo = async () => {
    if (!logoFile) return branding.logo_url;

    const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `branding/logo-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("item-photos").upload(filePath, logoFile, {
      upsert: false,
      contentType: logoFile.type || "image/png",
    });

    if (uploadError) {
      showError(uploadError.message);
      return "";
    }

    const { data } = supabase.storage.from("item-photos").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const saveUserDetails = async () => {
    setIsSavingUser(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: displayName.trim(),
        phone: phone.trim(),
      },
    });

    setIsSavingUser(false);

    if (error) {
      showError(error.message);
      return;
    }

    const { data } = await supabase.auth.getUser();
    setUser(data.user || null);
    showSuccess("Detail user berhasil disimpan");
  };

  const saveBranding = async () => {
    if (!branding.dashboard_name.trim() && !branding.logo_url && !logoFile) {
      showError("Nama dashboard wajib diisi jika tidak memakai logo");
      return;
    }

    setIsSavingBranding(true);

    const logoUrl = await uploadLogo();
    if (logoFile && !logoUrl) {
      setIsSavingBranding(false);
      return;
    }

    const result = await saveBrandingSettings({
      ...branding,
      logo_url: logoUrl || null,
    });

    setBranding(result.settings);
    setLogoFile(null);
    setIsSavingBranding(false);

    if (result.databaseError) {
      showError(`Branding tersimpan lokal, tetapi belum tersimpan ke database: ${result.databaseError}`);
      return;
    }

    showSuccess("Branding dashboard berhasil disimpan");
  };

  const removeLogo = () => {
    setLogoFile(null);
    setBranding((current) => ({ ...current, logo_url: null }));
  };

  return (
    <AppLayout title="Pengaturan">
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Detail User</h3>
                <p className="text-sm text-slate-500">Lihat dan ubah informasi akun yang sedang login.</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <Label className="text-sm font-semibold text-slate-700">Email</Label>
                <Input className="mt-1 h-12 rounded-2xl bg-slate-50 text-base" value={user?.email || ""} disabled />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Nama tampilan</Label>
                <Input
                  className="mt-1 h-12 rounded-2xl text-base"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Contoh: Admin Gudang"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Nomor telepon</Label>
                <Input
                  className="mt-1 h-12 rounded-2xl text-base"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Opsional"
                />
              </div>

              <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-700">User ID</p>
                  <p className="mt-1 break-all text-xs">{user?.id || "-"}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Terakhir login</p>
                  <p className="mt-1 text-xs">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "-"}</p>
                </div>
              </div>

              <Button
                onClick={saveUserDetails}
                disabled={isSavingUser}
                className="h-12 rounded-2xl bg-sky-500 text-base hover:bg-sky-600"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSavingUser ? "Menyimpan..." : "Simpan Detail User"}
              </Button>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <ImagePlus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Branding Halaman</h3>
                <p className="text-sm text-slate-500">Atur nama dashboard, icon, atau upload logo utama.</p>
              </div>
            </div>

            <div className="grid gap-5">
              <div>
                <Label className="text-sm font-semibold text-slate-700">Nama dashboard</Label>
                <Input
                  className="mt-1 h-12 rounded-2xl text-base"
                  value={branding.dashboard_name}
                  onChange={(event) => setBranding((current) => ({ ...current, dashboard_name: event.target.value }))}
                  placeholder="Contoh: Operasional Inventori Jus"
                />
                <p className="mt-2 text-xs text-slate-500">Nama ini disembunyikan otomatis jika logo diupload.</p>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">Pilih icon</Label>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {iconEntries.map(([iconName, Icon]) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setBranding((current) => ({ ...current, icon_name: iconName }))}
                      className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-xs font-semibold transition ${
                        branding.icon_name === iconName
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="max-w-full truncate">{iconName}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-dashed bg-slate-50 p-4">
                <Label className="mb-2 block text-sm font-semibold text-slate-700">Upload logo</Label>
                <Input
                  className="h-12 rounded-2xl bg-white text-base"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                />
                <p className="mt-2 text-xs text-slate-500">Jika logo tersedia, nama dashboard dan icon akan otomatis disembunyikan.</p>

                {(branding.logo_url || logoFile) && (
                  <Button type="button" variant="secondary" onClick={removeLogo} className="mt-3 rounded-2xl">
                    <X className="mr-2 h-4 w-4" />
                    Hapus Logo
                  </Button>
                )}
              </div>

              <Button
                onClick={saveBranding}
                disabled={isSavingBranding}
                className="h-12 rounded-2xl bg-emerald-500 text-base hover:bg-emerald-600"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSavingBranding ? "Menyimpan..." : "Simpan Branding"}
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="sticky top-6 rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Preview Branding</p>

            <div className="rounded-3xl bg-emerald-500 p-5 text-white">
              {logoFile ? (
                <img src={URL.createObjectURL(logoFile)} alt="Preview logo" className="h-24 w-full rounded-2xl object-contain" />
              ) : branding.logo_url ? (
                <img src={branding.logo_url} alt="Preview logo" className="h-24 w-full rounded-2xl object-contain" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                    <PreviewIcon className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-emerald-100">Operasional</p>
                    <h2 className="truncate text-2xl font-bold">{branding.dashboard_name || defaultBranding.dashboard_name}</h2>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Aturan tampilan:</p>
              <p className="mt-1">Logo upload akan menjadi prioritas. Jika logo kosong, aplikasi menampilkan nama dashboard dan icon pilihan.</p>
            </div>
          </section>
        </aside>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;