import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Phone, ArrowLeft, Loader2, Store, ShoppingBag, Bell, BellOff, History, Smartphone, MapPin, Truck } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import LocationSelector from "@/components/ui/LocationSelector";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import RiderApplicationForm from "@/components/delivery/RiderApplicationForm";
import { Badge } from "@/components/ui/badge";

const Profile = () => {
  const { user, profile, updateProfile, switchMode, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [campus, setCampus] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoProvider, setMomoProvider] = useState("");
  const [saving, setSaving] = useState(false);

  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    isLoading: notificationLoading,
    subscribe,
    unsubscribe 
  } = usePushNotifications();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setCampus(profile.campus || "");
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_momo").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setMomoNumber(row.momo_number || "");
        setMomoProvider(row.momo_provider || "");
      }
    });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName,
        phone,
        campus,
        momo_number: momoNumber || null,
        momo_provider: momoProvider || null,
      } as any);
    } finally {
      setSaving(false);
    }
  };

  const handleModeSwitch = async (mode: "buyer" | "seller") => {
    await switchMode(mode);
  };

  const handleNotificationToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-2xl mx-auto px-4 pt-28 pb-16">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>

        <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
        <p className="text-muted-foreground mb-8">Manage your account and preferences</p>

        {/* Quick Links */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-8">
          <h2 className="font-semibold mb-4">Quick Links</h2>
          <Link to="/purchases">
            <Button variant="outline" className="w-full justify-start gap-3">
              <History className="h-5 w-5" />
              View Purchase History
            </Button>
          </Link>
        </div>

        {/* Mode Switcher */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-8">
          <h2 className="font-semibold mb-4">Current Mode</h2>
          <div className="flex gap-4">
            <button
              onClick={() => handleModeSwitch("buyer")}
              className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                profile?.current_mode === "buyer"
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <ShoppingBag className={`h-5 w-5 ${profile?.current_mode === "buyer" ? "text-primary" : ""}`} />
              <span className="font-medium">Buyer</span>
            </button>
            <button
              onClick={() => handleModeSwitch("seller")}
              className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                profile?.current_mode === "seller"
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <Store className={`h-5 w-5 ${profile?.current_mode === "seller" ? "text-primary" : ""}`} />
              <span className="font-medium">Seller</span>
            </button>
          </div>
        </div>

        {/* City Selector */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-8">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Your City
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            You'll only see stores, products, and deliveries from this city.
          </p>
          <div className="flex gap-4">
            {(["Tamale", "Wa"] as const).map((c) => (
              <button
                key={c}
                onClick={async () => {
                  if (profile?.city === c) return;
                  await updateProfile({ city: c } as any);
                }}
                className={`flex-1 p-4 rounded-xl border-2 transition-all font-medium ${
                  profile?.city === c
                    ? "border-primary bg-accent text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>


        {/* Notification Settings */}
        {isSupported && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-8">
            <h2 className="font-semibold mb-4">Notifications</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isSubscribed ? (
                  <Bell className="h-5 w-5 text-primary" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {isSubscribed 
                      ? "You'll receive notifications for new messages and orders"
                      : "Enable to get notified about new messages and orders"}
                  </p>
                </div>
              </div>
              <Switch
                checked={isSubscribed}
                onCheckedChange={handleNotificationToggle}
                disabled={notificationLoading || permission === 'denied'}
              />
            </div>
            {permission === 'denied' && (
              <p className="text-sm text-destructive mt-3">
                Notifications are blocked. Please enable them in your browser settings.
              </p>
            )}
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSave} className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-semibold mb-6">Personal Information</h2>
          
          <div className="space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="mt-1 bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your phone number"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="campus">Area</Label>
              <LocationSelector
                value={campus}
                onChange={setCampus}
                placeholder="Select your area"
                className="mt-1"
              />
            </div>

            {/* MoMo Payout Settings */}
            <div className="pt-4 border-t border-border">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile Money (Payout)
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set up your MoMo details to receive delivery payouts and seller payments.
              </p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="momoProvider">MoMo Provider</Label>
                  <Select value={momoProvider} onValueChange={setMomoProvider}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                      <SelectItem value="Vodafone">Vodafone Cash</SelectItem>
                      <SelectItem value="AirtelTigo">AirtelTigo Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="momoNumber">MoMo Number</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="momoNumber"
                      type="tel"
                      value={momoNumber}
                      onChange={(e) => setMomoNumber(e.target.value)}
                      placeholder="e.g., 0241234567"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
