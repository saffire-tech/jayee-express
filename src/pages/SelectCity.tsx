import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

const CITIES = [
  { id: "Tamale", description: "Northern Region" },
  { id: "Wa", description: "Upper West Region" },
  { id: "Accra", description: "Greater Accra Region" },
] as const;

const SelectCity = () => {
  const navigate = useNavigate();
  const { user, profile, updateProfile, loading } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile?.city) navigate("/", { replace: true });
  }, [profile?.city, navigate]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateProfile({ city: selected } as any);
      toast({ title: `Welcome to Jayee Express ${selected}!`, description: "You're all set." });
      navigate("/", { replace: true });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <SEO
        title="Choose Your City | Jayee Express"
        description="Pick your city on Jayee Express to see stores, products and delivery jobs near you in Accra, Tamale or Wa."
        canonicalPath="/select-city"
        noindex
      />
      <div className="max-w-xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Where are you shopping from?</h1>
          <p className="text-muted-foreground">
            Choose your city. You'll see stores, products, and delivery jobs from this location only.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {CITIES.map((c) => {
            const isActive = selected === c.id;
            return (
              <motion.button
                key={c.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelected(c.id)}
                className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
                  isActive
                    ? "border-primary bg-accent shadow-md"
                    : "border-border hover:border-primary/50 bg-card"
                }`}
              >
                {isActive && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                <div className="text-2xl font-bold mb-1">{c.id}</div>
                <div className="text-sm text-muted-foreground">{c.description}</div>
              </motion.button>
            );
          })}
        </div>

        <Button
          variant="hero"
          className="w-full"
          disabled={!selected || saving}
          onClick={handleConfirm}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Continue
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-4">
          You can change this anytime from your Profile.
        </p>
      </div>
    </div>
  );
};

export default SelectCity;
