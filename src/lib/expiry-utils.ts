export type ExpiryStatus = "none" | "expired" | "today" | "near" | "safe";
export type FreshnessPriority = "unknown" | "expired" | "critical" | "priority" | "watch" | "fresh";
export type ExpirySource = "unknown" | "manual" | "estimated";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const SHELF_LIFE_RULES: Array<{ keywords: string[]; days: number }> = [
  { keywords: ["pisang", "strawberry", "stroberi", "beri", "berry"], days: 2 },
  { keywords: ["nanas", "semangka", "melon", "pepaya", "mangga", "jambu", "kiwi"], days: 3 },
  { keywords: ["alpukat", "avocado"], days: 4 },
  { keywords: ["jeruk", "lemon", "limau", "lime", "anggur", "grape"], days: 7 },
  { keywords: ["apel", "pir", "pear", "delima", "pomegranate"], days: 10 },
  { keywords: ["wortel", "jahe", "kunyit", "bit", "beet"], days: 14 },
  { keywords: ["sirup", "gula", "madu", "powder"], days: 180 },
];

const NON_PERISHABLE_KEYWORDS = [
  "botol",
  "tutup",
  "sticker",
  "label",
  "sedotan",
  "cup",
  "gelas",
  "kemasan",
  "packaging",
];

const NON_PERISHABLE_FALLBACK_DAYS = 3650;

const toStartOfDay = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const parseDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toStartOfDay(parsed);
};

export const inferShelfLifeDays = (ingredientName: string) => {
  const normalized = ingredientName.toLowerCase();
  const matched = SHELF_LIFE_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword)),
  );
  return matched?.days ?? 5;
};

export const isLikelyNonPerishableIngredient = (ingredientName: string) => {
  const normalized = ingredientName.toLowerCase();
  return NON_PERISHABLE_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const estimateExpiryFromPurchase = (params: {
  ingredientName: string;
  purchaseDate: string | null;
}) => {
  if (isLikelyNonPerishableIngredient(params.ingredientName)) return null;

  const purchase = parseDateOnly(params.purchaseDate);
  if (!purchase) return null;

  const result = new Date(purchase);
  result.setDate(result.getDate() + inferShelfLifeDays(params.ingredientName));
  return result.toISOString().slice(0, 10);
};

export const resolveBatchExpiryDateForWrite = (params: {
  ingredientName: string;
  purchaseDate: string | null;
  manualExpiryDate: string | null;
}) => {
  if (params.manualExpiryDate) return params.manualExpiryDate;

  const estimated = estimateExpiryFromPurchase({
    ingredientName: params.ingredientName,
    purchaseDate: params.purchaseDate,
  });
  if (estimated) return estimated;

  const baseDate = parseDateOnly(params.purchaseDate) || toStartOfDay(new Date());
  const fallback = new Date(baseDate);
  fallback.setDate(fallback.getDate() + NON_PERISHABLE_FALLBACK_DAYS);
  return fallback.toISOString().slice(0, 10);
};

export const resolveEffectiveExpiryDate = (params: {
  ingredientName: string;
  manualExpiryDate: string | null;
  purchaseDate: string | null;
}) => {
  if (params.manualExpiryDate) return params.manualExpiryDate;
  return estimateExpiryFromPurchase({
    ingredientName: params.ingredientName,
    purchaseDate: params.purchaseDate,
  });
};

export const inferExpirySource = (params: {
  ingredientName: string;
  purchaseDate: string | null;
  expiryDate: string | null;
}) => {
  if (!params.expiryDate) return "unknown" as ExpirySource;

  const estimated = estimateExpiryFromPurchase({
    ingredientName: params.ingredientName,
    purchaseDate: params.purchaseDate,
  });

  if (estimated && estimated === params.expiryDate) {
    return "estimated" as ExpirySource;
  }

  return "manual" as ExpirySource;
};

export const getExpirySourceLabel = (source: ExpirySource) => {
  if (source === "manual") return "Manual";
  if (source === "estimated") return "Estimasi";
  return "Belum ditentukan";
};

export const getFreshnessPriorityMeta = (effectiveExpiryDate: string | null) => {
  const expiry = parseDateOnly(effectiveExpiryDate);
  if (!expiry) {
    return {
      priority: "unknown" as FreshnessPriority,
      label: "Belum ada estimasi umur simpan",
      daysRemaining: null as number | null,
    };
  }

  const today = toStartOfDay(new Date());
  const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / MS_PER_DAY);

  if (daysRemaining < 0) {
    return {
      priority: "expired" as FreshnessPriority,
      label: `Lewat estimasi ${Math.abs(daysRemaining)} hari`,
      daysRemaining,
    };
  }

  if (daysRemaining <= 1) {
    return {
      priority: "critical" as FreshnessPriority,
      label: daysRemaining === 0 ? "Prioritas pakai hari ini" : "Prioritas pakai besok",
      daysRemaining,
    };
  }

  if (daysRemaining <= 3) {
    return {
      priority: "priority" as FreshnessPriority,
      label: `Prioritas pakai ${daysRemaining} hari lagi`,
      daysRemaining,
    };
  }

  if (daysRemaining <= 7) {
    return {
      priority: "watch" as FreshnessPriority,
      label: `Perlu dipantau (${daysRemaining} hari lagi)`,
      daysRemaining,
    };
  }

  return {
    priority: "fresh" as FreshnessPriority,
    label: `Masih segar (${daysRemaining} hari lagi)`,
    daysRemaining,
  };
};

export const getFreshnessPriorityClass = (priority: FreshnessPriority) => {
  if (priority === "expired" || priority === "critical") return "bg-rose-100 text-rose-800";
  if (priority === "priority") return "bg-amber-100 text-amber-800";
  if (priority === "watch") return "bg-violet-100 text-violet-800";
  if (priority === "fresh") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-600";
};

export const formatDateId = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID");
};

export const getExpiryMeta = (expiryDate: string | null) => {
  if (!expiryDate) {
    return {
      status: "none" as ExpiryStatus,
      daysRemaining: null as number | null,
      label: "Tanggal expired belum diatur",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) {
    return {
      status: "none" as ExpiryStatus,
      daysRemaining: null as number | null,
      label: "Tanggal expired belum diatur",
    };
  }

  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / MS_PER_DAY);

  if (diffDays < 0) {
    return {
      status: "expired" as ExpiryStatus,
      daysRemaining: diffDays,
      label: `Expired ${Math.abs(diffDays)} hari lalu`,
    };
  }

  if (diffDays === 0) {
    return {
      status: "today" as ExpiryStatus,
      daysRemaining: diffDays,
      label: "Expired hari ini",
    };
  }

  if (diffDays <= 3) {
    return {
      status: "near" as ExpiryStatus,
      daysRemaining: diffDays,
      label: `Expired ${diffDays} hari lagi`,
    };
  }

  return {
    status: "safe" as ExpiryStatus,
    daysRemaining: diffDays,
    label: `Expired ${diffDays} hari lagi`,
  };
};

export const getExpiryBadgeClass = (status: ExpiryStatus) => {
  if (status === "expired" || status === "today") {
    return "bg-rose-100 text-rose-800";
  }

  if (status === "near") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "safe") {
    return "bg-emerald-100 text-emerald-800";
  }

  return "bg-slate-100 text-slate-600";
};
