import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, ImageIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";

interface MultiImageUploadProps {
  currentImages: string[];
  onImagesChanged: (urls: string[]) => void;
  maxImages?: number;
}

const MultiImageUpload = ({ 
  currentImages, 
  onImagesChanged, 
  maxImages = 5 
}: MultiImageUploadProps) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>(currentImages || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);

    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select only image files');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Each image must be less than 5MB');
        return;
      }
    }

    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        // Compress each image before upload
        const { blob, extension } = await compressImage(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          targetAspectRatio: 16 / 9,
          fit: 'cover',
        });
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, blob, {
            cacheControl: '31536000',
            upsert: false,
            contentType: blob.type,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      const newImages = [...images, ...uploadedUrls];
      setImages(newImages);
      onImagesChanged(newImages);
      toast.success(`${uploadedUrls.length} image${uploadedUrls.length > 1 ? 's' : ''} uploaded`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChanged(newImages);
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading || !canAddMore}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {images.map((url, index) => (
          <div key={url} className="relative aspect-square group">
            <img
              src={url}
              alt={`Product image ${index + 1}`}
              loading="lazy"
              className="w-full h-full object-cover rounded-lg border border-border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemove(index)}
            >
              <X className="h-3 w-3" />
            </Button>
            {index === 0 && (
              <span className="absolute bottom-1 left-1 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                Main
              </span>
            )}
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            ) : (
              <>
                <Plus className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Add</span>
              </>
            )}
          </button>
        )}
      </div>

      {images.length === 0 && !uploading && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors"
        >
          <div className="p-2 rounded-full bg-muted">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Click to upload images</p>
            <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB each (max {maxImages})</p>
          </div>
        </button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {images.length}/{maxImages} images • First image will be the main product image
      </p>
    </div>
  );
};

export default MultiImageUpload;
