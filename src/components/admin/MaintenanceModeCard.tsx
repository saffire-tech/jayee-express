import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Loader2, Upload, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { compressImage } from "@/lib/imageCompression";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

export default function MaintenanceModeCard() {
  const remote = useMaintenanceMode();
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [eta, setEta] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!remote.loaded) return;
    setEnabled(remote.enabled);
    setMessage(remote.message);
    setEta(remote.eta ? remote.eta.slice(0, 16) : "");
    setImageUrl(remote.imageUrl);
  }, [remote.loaded, remote.enabled, remote.message, remote.eta, remote.imageUrl]);

  const persist = async (patch: {
    enabledOverride?: boolean;
    imageUrlOverride?: string | null;
  } = {}) => {
    const nextEnabled = patch.enabledOverride ?? enabled;
    const nextImageUrl = patch.imageUrlOverride !== undefined ? patch.imageUrlOverride : imageUrl;
    const value = JSON.stringify({
      enabled: nextEnabled,
      message: message.trim() || "We are performing scheduled maintenance. We'll be back shortly.",
      eta: eta ? new Date(eta).toISOString() : null,
      image_url: nextImageUrl,
    });
    const { error } = await supabase
      .from("platform_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", "maintenance_mode");
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const save = async (nextEnabled = enabled) => {
    setSaving(true);
    const ok = await persist({ enabledOverride: nextEnabled });
    setSaving(false);
    if (ok) toast.success(nextEnabled ? "Maintenance mode ON" : "Maintenance mode OFF");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    setUploading(true);
    try {
      const { blob, extension } = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1200,
      });
      const path = `${user.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("maintenance-assets")
        .upload(path, blob, {
          cacheControl: "31536000",
          upsert: false,
          contentType: blob.type,
        });
      if (uploadError) throw uploadError;

      const { data: signed, error: signErr } = await supabase.storage
        .from("maintenance-assets")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (signErr || !signed) throw signErr ?? new Error("Failed to sign URL");

      setImageUrl(signed.signedUrl);
      const ok = await persist({ imageUrlOverride: signed.signedUrl });
      if (ok) toast.success("Maintenance image updated");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = async () => {
    setImageUrl(null);
    const ok = await persist({ imageUrlOverride: null });
    if (ok) toast.success("Maintenance image removed");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Maintenance Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">
              {enabled ? "App is under maintenance" : "App is live"}
            </div>
            <div className="text-sm text-muted-foreground">
              When ON, only admins can access the app.
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              save(v);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Maintenance image (optional)</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          {imageUrl ? (
            <div className="relative">
              <img
                src={imageUrl}
                alt="Maintenance"
                className="w-full h-48 object-cover rounded-lg border border-border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={handleRemoveImage}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload (fallback: animated wrench)
                  </span>
                </>
              )}
            </button>
          )}
          {imageUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
              Replace image
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="mm-msg">Message shown to users</Label>
          <Textarea
            id="mm-msg"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="We'll be back shortly..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mm-eta">Expected back (optional)</Label>
          <Input
            id="mm-eta"
            type="datetime-local"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
        </div>

        <Button onClick={() => save()} disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}
