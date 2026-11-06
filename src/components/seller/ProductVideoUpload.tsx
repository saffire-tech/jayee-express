import { useRef, useState } from "react";
import { Loader2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { uploadVideoToR2 } from "@/lib/r2Upload";
import { getCdnImageUrl } from "@/lib/cdn";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SECONDS = 60;

const readDuration = (file: File) =>
  new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
}

const ProductVideoUpload = ({ value, onChange }: Props) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      toast.error("Please choose an MP4, WEBM or MOV video");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Video must be 20MB or less");
      return;
    }
    const duration = await readDuration(file);
    if (duration > MAX_SECONDS) {
      toast.error(`Video must be ${MAX_SECONDS} seconds or shorter`);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadVideoToR2(file);
      onChange(url);
      toast.success("Video uploaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload video");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-full max-w-xs aspect-square rounded-lg overflow-hidden bg-muted">
          <video src={getCdnImageUrl(value)} className="w-full h-full object-contain" muted loop autoPlay playsInline controls />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove video"
            className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary transition-colors"
        >
          {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Video className="h-8 w-8 text-muted-foreground" />}
          <span className="text-sm font-medium text-foreground">{uploading ? "Uploading video..." : "Add a short video"}</span>
          <span className="text-xs text-muted-foreground">Optional • MP4, WEBM or MOV • up to 60s and 20MB • plays in place of the main image</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleFile} />
    </div>
  );
};

export default ProductVideoUpload;
