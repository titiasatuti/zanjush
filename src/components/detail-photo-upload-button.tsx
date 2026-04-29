import { ChangeEvent, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

type DetailPhotoUploadButtonProps = {
  title: string;
};

export const DetailPhotoUploadButton = ({ title }: DetailPhotoUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const location = useLocation();
  const params = useParams();
  const [isUploading, setIsUploading] = useState(false);

  const isProductDetail = location.pathname.startsWith("/products/catalogue/") && params.id !== "new";
  const isIngredientDetail = location.pathname.startsWith("/products/ingredients/") && params.id !== "new";
  const shouldShow = Boolean(params.id) && (isProductDetail || isIngredientDetail);

  if (!shouldShow) {
    return null;
  }

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !params.id) return;

    setIsUploading(true);

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const folder = isProductDetail ? "catalogue" : "ingredients";
    const filePath = `${folder}/${params.id}-${crypto.randomUUID()}.${ext}`;

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

    if (isProductDetail) {
      const [productResult, itemResult] = await Promise.all([
        supabase.from("products").update({ photo_url: photoUrl }).eq("id", params.id),
        supabase.from("items").update({ photo_url: photoUrl }).eq("id", params.id).eq("type", "product"),
      ]);

      if (productResult.error || itemResult.error) {
        setIsUploading(false);
        showError(productResult.error?.message || itemResult.error?.message || "Gagal menyimpan foto produk");
        event.target.value = "";
        return;
      }
    }

    if (isIngredientDetail) {
      const { error } = await supabase.from("items").update({ photo_url: photoUrl }).eq("id", params.id).eq("type", "ingredient");

      if (error) {
        setIsUploading(false);
        showError(error.message);
        event.target.value = "";
        return;
      }
    }

    setIsUploading(false);
    showSuccess("Foto berhasil diperbarui");
    event.target.value = "";
    window.location.reload();
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
      <Button
        type="button"
        variant="secondary"
        size="icon"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl"
        aria-label={`Upload foto ${title}`}
        title={`Upload foto ${title}`}
      >
        <ImagePlus className="h-4 w-4" />
      </Button>
    </>
  );
};