import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LocationSelector from "@/components/ui/LocationSelector";
import MapPicker from "@/components/maps/MapPicker";
import { Store, MapPin, Phone, Loader2, ArrowRight, Check, Navigation } from "lucide-react";

interface StoreSetupWizardProps {
  onComplete: (data: { name: string; description: string; location: string; phone: string; campus: string; latitude?: number; longitude?: number }) => Promise<unknown>;
}

const StoreSetupWizard = ({ onComplete }: StoreSetupWizardProps) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    phone: "",
    campus: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  const totalSteps = 5;

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onComplete(formData);
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return formData.name.trim().length > 0;
      case 2: return formData.description.trim().length > 0;
      case 3: return formData.campus.length > 0;
      case 4: return formData.location.trim().length > 0;
      case 5: return true; // Map step is optional
      default: return false;
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                s < step
                  ? "bg-primary text-primary-foreground"
                  : s === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-5 w-5" /> : s}
            </div>
            {s < totalSteps && (
              <div className={`w-8 h-1 mx-1 ${s < step ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Store Name */}
      {step === 1 && (
        <div className="text-center animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-6">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Name Your Store</h2>
          <p className="text-muted-foreground mb-8">Choose a memorable name that represents your brand</p>
          <div className="text-left">
            <Label htmlFor="name">Store Name</Label>
            <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Fresh Cuts Barber" className="mt-2" />
          </div>
        </div>
      )}

      {/* Step 2: Description */}
      {step === 2 && (
        <div className="text-center animate-fade-up">
          <h2 className="text-2xl font-bold mb-2">Describe Your Store</h2>
          <p className="text-muted-foreground mb-8">Tell customers what you offer and why they should choose you</p>
          <div className="text-left">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe your products or services..." className="mt-2 min-h-[120px]" />
          </div>
        </div>
      )}

      {/* Step 3: Campus Selection */}
      {step === 3 && (
        <div className="text-center animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-6">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Select Your Area</h2>
          <p className="text-muted-foreground mb-8">Choose the area where your store is located</p>
          <div className="text-left">
            <Label htmlFor="campus">Area</Label>
            <LocationSelector value={formData.campus} onChange={(value) => setFormData({ ...formData, campus: value })} placeholder="Select your area" className="mt-2" />
          </div>
        </div>
      )}

      {/* Step 4: Location & Contact */}
      {step === 4 && (
        <div className="text-center animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-6">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Location & Contact</h2>
          <p className="text-muted-foreground mb-8">Help customers find and reach you</p>
          <div className="space-y-4 text-left">
            <div>
              <Label htmlFor="location">Address</Label>
              <div className="relative mt-2">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., 24 Oxford St, Osu" className="pl-10" />
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <div className="relative mt-2">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Your contact number" className="pl-10" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Map Location */}
      {step === 5 && (
        <div className="text-center animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-6">
            <Navigation className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Pin Your Location</h2>
          <p className="text-muted-foreground mb-6">Set your store's exact map location for delivery services</p>
          <div className="text-left">
            <MapPicker
              latitude={formData.latitude}
              longitude={formData.longitude}
              onLocationSelect={(lat, lng) => setFormData({ ...formData, latitude: lat, longitude: lng })}
            />
            {formData.latitude && formData.longitude && (
              <p className="text-sm text-muted-foreground mt-2">
                📍 {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-4 mt-8">
        {step > 1 && (
          <Button variant="outline" onClick={handleBack} className="flex-1">Back</Button>
        )}
        {step < totalSteps ? (
          <Button variant="hero" onClick={handleNext} disabled={!isStepValid()} className="flex-1 gap-2">
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="hero" onClick={handleSubmit} disabled={loading} className="flex-1 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create Store
          </Button>
        )}
      </div>
    </div>
  );
};

export default StoreSetupWizard;
