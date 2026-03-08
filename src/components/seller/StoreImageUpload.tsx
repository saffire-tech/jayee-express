import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, ImageIcon, Store } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";

interface StoreImageUploadProps {
  type: 'logo' | 'cover';
  currentImageUrl?: string | null;
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
}

const StoreImageUpload = ({ type, currentImageUrl, onImageUploaded, onImageRemoved }: StoreImageUploadProps) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Compress with appropriate dimensions for type
      const maxDim = type === 'logo' ? 512 : 1200;
      const { blob, extension } = await compressImage(file, {
        maxWidth: type === 'cover' ? 1600 : maxDim,
        maxHeight: maxDim,
      });
      const fileName = `${user.id}/${type}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('store-images')
        .upload(fileName, blob, {
          cacheControl: '31536000',
          upsert: false,
          contentType: blob.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('store-images')
        .getPublicUrl(fileName);

      setPreviewUrl(publicUrl);
      onImageUploaded(publicUrl);
      toast.success(`${type === 'logo' ? 'Logo' : 'Cover'} uploaded successfully`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onImageRemoved();
  };

  const isLogo = type === 'logo';

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {previewUrl ? (
        <div className="relative">
          <div className={isLogo 
            ? "w-32 h-32 rounded-xl overflow-hidden border border-border" 
            : "w-full h-40 rounded-xl overflow-hidden border border-border"
          }>
            <img
              src={previewUrl}
              alt={`Store ${type}`}
              className="w-full h-full object-cover"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isLogo ? 'w-32 h-32' : 'w-full h-40'
          }`}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <>
              <div className="p-2 rounded-full bg-muted">
                {isLogo ? (
                  <Store className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {isLogo ? 'Upload Logo' : 'Upload Cover'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isLogo ? '1:1 ratio' : '16:9 ratio'}
                </p>
              </div>
            </>
          )}
        </button>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="h-4 w-4" />
        {uploading ? 'Uploading...' : previewUrl ? 'Change Image' : 'Choose Image'}
      </Button>
    </div>
  );
};

export default StoreImageUpload;
