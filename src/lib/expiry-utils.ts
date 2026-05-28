export type ExpiryStatus = "none" | "expired" | "today" | "near" | "safe";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
