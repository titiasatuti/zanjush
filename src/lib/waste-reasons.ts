export const WASTE_REASON_OPTIONS = [
  { value: "spoiled", label: "Buah busuk" },
  { value: "expired", label: "Melewati estimasi expired" },
  { value: "damaged", label: "Rusak fisik / memar" },
  { value: "spilled", label: "Tumpah / terbuang" },
  { value: "stock_opname", label: "Koreksi stok opname" },
  { value: "other", label: "Lainnya" },
] as const;

export type WasteReasonCode = (typeof WASTE_REASON_OPTIONS)[number]["value"];

const REASON_LABEL_BY_CODE = new Map<WasteReasonCode, string>(
  WASTE_REASON_OPTIONS.map((option) => [option.value, option.label]),
);

const REASON_CODE_BY_LABEL = new Map(
  WASTE_REASON_OPTIONS.map((option) => [option.label.toLowerCase(), option.value]),
);

const getReasonCodeOrder = (code: WasteReasonCode) => {
  const index = WASTE_REASON_OPTIONS.findIndex((option) => option.value === code);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
};

export const getWasteReasonLabel = (code: WasteReasonCode) => {
  return REASON_LABEL_BY_CODE.get(code) || "Lainnya";
};

export const sortWasteReasonsByStandardOrder = <T extends { reasonCode: WasteReasonCode }>(rows: T[]) => {
  return rows.slice().sort((a, b) => getReasonCodeOrder(a.reasonCode) - getReasonCodeOrder(b.reasonCode));
};

export const buildWasteMovementNote = (params: {
  baseNote: string;
  reasonCode?: WasteReasonCode;
  detailNote?: string;
}) => {
  const parts: string[] = [params.baseNote];

  if (params.reasonCode) {
    parts.push(`ReasonCode: ${params.reasonCode}`);
    parts.push(`Alasan: ${getWasteReasonLabel(params.reasonCode)}`);
  }

  if (params.detailNote && params.detailNote.trim()) {
    parts.push(`Catatan: ${params.detailNote.trim()}`);
  }

  return parts.join(" | ");
};

export const parseWasteReasonFromNote = (note: string | null) => {
  if (!note) {
    return {
      reasonCode: null as WasteReasonCode | null,
      reasonLabel: null as string | null,
      detail: null as string | null,
      hasWasteReason: false,
    };
  }

  const reasonCodeMatch = note.match(/ReasonCode:\s*([a-z_]+)/i);
  const reasonLabelMatch = note.match(/Alasan:\s*([^|]+)/i);
  const detailMatch = note.match(/Catatan:\s*([^|]+)/i);

  const parsedCode = reasonCodeMatch?.[1]?.trim().toLowerCase() as WasteReasonCode | undefined;
  const reasonCode = REASON_LABEL_BY_CODE.has(parsedCode as WasteReasonCode)
    ? (parsedCode as WasteReasonCode)
    : null;

  const reasonLabelFromNote = reasonLabelMatch?.[1]?.trim() || null;
  const reasonCodeFromLabel = reasonLabelFromNote
    ? (REASON_CODE_BY_LABEL.get(reasonLabelFromNote.toLowerCase()) as WasteReasonCode | undefined)
    : undefined;

  const finalReasonCode = reasonCode || reasonCodeFromLabel || null;
  const finalReasonLabel = finalReasonCode
    ? getWasteReasonLabel(finalReasonCode)
    : reasonLabelFromNote;

  return {
    reasonCode: finalReasonCode,
    reasonLabel: finalReasonLabel,
    detail: detailMatch?.[1]?.trim() || null,
    hasWasteReason: Boolean(finalReasonCode || reasonLabelFromNote),
  };
};
