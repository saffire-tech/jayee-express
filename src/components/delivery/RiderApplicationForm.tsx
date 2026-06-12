import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

interface Props {
  onSubmitted?: () => void;
}

const RiderApplicationForm = ({ onSubmitted }: Props) => {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [ghanaCardNumber, setGhanaCardNumber] = useState("");
  const [houseAddress, setHouseAddress] = useState("");
  const [motorReg, setMotorReg] = useState("");
  const [ghanaCard, setGhanaCard] = useState<File | null>(null);
  const [photoId, setPhotoId] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const uploadFile = async (file: File, kind: string) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("rider-documents").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!ghanaCard || !photoId) {
      toast.error("Please upload both Ghana Card and Photo ID");
      return;
    }
    setSubmitting(true);
    try {
      const ghanaCardUrl = await uploadFile(ghanaCard, "ghana-card");
      const photoIdUrl = await uploadFile(photoId, "photo-id");

      const { error } = await supabase.from("rider_applications").insert({
        user_id: user.id,
        city: profile.city,
        full_name: fullName,
        phone,
        ghana_card_number: ghanaCardNumber,
        ghana_card_url: ghanaCardUrl,
        photo_id_url: photoIdUrl,
        house_address: houseAddress,
        motor_registration: motorReg,
        status: "pending",
      } as any);
      if (error) throw error;

      toast.success("Application submitted! Admin will review shortly.");
      onSubmitted?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Full Name</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div>
        <Label>Phone Number</Label>
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </div>
      <div>
        <Label>Ghana Card Number</Label>
        <Input
          value={ghanaCardNumber}
          onChange={(e) => setGhanaCardNumber(e.target.value.toUpperCase())}
          placeholder="GHA-XXXXXXXXX-X"
          required
        />
      </div>
      <div>
        <Label>House Address</Label>
        <Textarea value={houseAddress} onChange={(e) => setHouseAddress(e.target.value)} required />
      </div>
      <div>
        <Label>Motorbike Registration Number</Label>
        <Input value={motorReg} onChange={(e) => setMotorReg(e.target.value.toUpperCase())} required />
      </div>
      <div>
        <Label className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> Ghana Card Photo
        </Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setGhanaCard(e.target.files?.[0] || null)}
          required
        />
      </div>
      <div>
        <Label className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> Photo ID / Selfie
        </Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setPhotoId(e.target.files?.[0] || null)}
          required
        />
      </div>
      <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Submit Application
      </Button>
    </form>
  );
};

export default RiderApplicationForm;
