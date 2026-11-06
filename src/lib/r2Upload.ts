import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

/** Upload a public image to Cloudflare R2; returns its CDN URL. */
export async function uploadImageToR2(blob: Blob, folder: "products" | "stores"): Promise<string> {
  const form = new FormData();
  form.append("file", blob, blob.type.startsWith("video/") ? "video" : "image");
  form.append("folder", folder);
  const { data, error } = await supabase.functions.invoke("r2-upload", { body: form });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try { msg = (await error.context.json()).error || msg; } catch { /* ignore */ }
    }
    throw new Error(msg);
  }
  if (!data?.url) throw new Error("Upload failed");
  return data.url as string;
}

/** Upload a short product video to Cloudflare R2; returns its CDN URL. */
export const uploadVideoToR2 = (file: File) => uploadImageToR2(file, "products");
