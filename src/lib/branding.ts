import { supabase } from "@/integrations/supabase/client";
import {
  Apple,
  BadgeCheck,
  Boxes,
  Citrus,
  ClipboardList,
  Factory,
  Grape,
  LayoutDashboard,
  Leaf,
  Package2,
  Settings,
  Sparkles,
  Store,
  Warehouse,
} from "lucide-react";

export type BrandingSettings = {
  dashboard_name: string;
  icon_name: string;
  logo_url: string | null;
};

export const defaultBranding: BrandingSettings = {
  dashboard_name: "Operasional Inventori Jus",
  icon_name: "Citrus",
  logo_url: null,
};

export const brandingIcons = {
  Citrus,
  Apple,
  Grape,
  Leaf,
  Store,
  Warehouse,
  Factory,
  Package2,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  BadgeCheck,
  Sparkles,
  Settings,
};

export type BrandingIconName = keyof typeof brandingIcons;

const fallbackStorageKey = "app-branding-settings";

export const getBrandingIcon = (iconName: string) => {
  return brandingIcons[iconName as BrandingIconName] || Citrus;
};

export const loadBrandingSettings = async (): Promise<BrandingSettings> => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("dashboard_name,icon_name,logo_url")
    .eq("id", "default")
    .maybeSingle();

  if (!error && data) {
    const settings = {
      dashboard_name: data.dashboard_name || defaultBranding.dashboard_name,
      icon_name: data.icon_name || defaultBranding.icon_name,
      logo_url: data.logo_url || null,
    };

    localStorage.setItem(fallbackStorageKey, JSON.stringify(settings));
    return settings;
  }

  const fallback = localStorage.getItem(fallbackStorageKey);
  if (fallback) {
    return JSON.parse(fallback) as BrandingSettings;
  }

  return defaultBranding;
};

export const saveBrandingSettings = async (settings: BrandingSettings) => {
  const normalizedSettings = {
    dashboard_name: settings.dashboard_name.trim() || defaultBranding.dashboard_name,
    icon_name: settings.icon_name || defaultBranding.icon_name,
    logo_url: settings.logo_url || null,
  };

  localStorage.setItem(fallbackStorageKey, JSON.stringify(normalizedSettings));

  const { error } = await supabase.from("app_settings").upsert({
    id: "default",
    ...normalizedSettings,
    updated_at: new Date().toISOString(),
  });

  window.dispatchEvent(new CustomEvent("branding-updated", { detail: normalizedSettings }));

  return {
    settings: normalizedSettings,
    databaseError: error?.message || "",
  };
};