import { ChangeEvent, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { cn } from "@/lib/utils";

type DetailPhotoUploadButtonProps = {
  itemId: string;
  itemType: "product" | "ingredient";
  title: string;
  className?: string;
  variant?: "icon" | "full";
  onUploaded: (photoUrl: string) => void;
};

export const DetailPhotoUploadButton = ({
  itemId,
  itemType,
  title,
  className,
  variant = "icon",
  onUploaded,
}: DetailPhotoUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const folder = itemType === "product" ? "catalogue" : "ingredients";
    const filePath = `${folder}/${itemId}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("item-photos").upload(filePath, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

    if (uploadError) {
      setIsUploading(false);
      showError(uploadError.message);
      event.target.value = "";
      return;
    }

    const { data } = supabase.storage.from("item-photos").getPublicUrl(filePath);
    const photoUrl = data.publicUrl;

    if (itemType === "product") {
      const [productResult, itemResult] = await Promise.all([
        supabase.from("products").update({ photo_url: photoUrl }).eq("id", itemId),
        supabase.from("items").update({ photo_url: photoUrl }).eq("id", itemId).eq("type", "product"),
      ]);

      if (productResult.error || itemResult.error) {
        setIsUploading(false);
        showError(productResult.error?.message || itemResult.error?.message || "Gagal menyimpan foto produk");
        event.target.value = "";
        return;
      }
    }

    if (itemType === "ingredient") {
      const { error } = await supabase.from("items").update({ photo_url: photoUrl }).eq("id", itemId).eq("type", "ingredient");

      if (error) {
        setIsUploading(false);
        showError(error.message);
        event.target.value = "";
        return;
      }
    }

    onUploaded(photoUrl);
    setIsUploading(false);
    showSuccess("Foto berhasil diperbarui");
    event.target.value = "";
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
      <Button
        type="button"
        variant={variant === "icon" ? "secondary" : "default"}
        size={variant === "icon" ? "icon" : "default"}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          variant === "icon"
            ? "rounded-full bg-white/95 text-slate-700 shadow-lg backdrop-blur hover:bg-white"
            : "h-12 rounded-2xl bg-emerald-500 text-base font-semibold hover:bg-emerald-600",
          className,
        )}
        aria-label={`Upload foto ${title}`}
        title={`Upload foto ${title}`}
      >
        <ImagePlus className={cn("h-4 w-4", variant === "full" && "mr-2")} />
        {variant === "full" && (isUploading ? "Mengupload foto..." : "Upload Foto")}
      </Button>
    </>
  );
};