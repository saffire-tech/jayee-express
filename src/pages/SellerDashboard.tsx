import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/hooks/useStore";
import { useWebServices } from "@/hooks/useWebServices";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import Navbar from "@/components/layout/Navbar";
import StoreSetupWizard from "@/components/seller/StoreSetupWizard";
import Analytics from "@/components/seller/Analytics";
import ProductsList from "@/components/seller/ProductsList";
import OrdersTable from "@/components/seller/OrdersTable";
import StoreImageUpload from "@/components/seller/StoreImageUpload";
import MapPicker from "@/components/maps/MapPicker";
import WebServicesManager from "@/components/seller/WebServicesManager";
import LocationSelector from "@/components/ui/LocationSelector";
import { Loader2, Store as StoreIcon, Package, ShoppingBag, Settings, Globe, Wallet, Banknote } from "lucide-react";
import WalletCard from "@/components/wallet/WalletCard";
import SubscriptionCard from "@/components/seller/SubscriptionCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShareButton from "@/components/ui/ShareButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PayoutMethodForm from "@/components/wallet/PayoutMethodForm";

const SellerDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { 
    store, 
    products, 
    orders, 
    loading, 
    createStore, 
    createProduct,
    updateProduct,
    deleteProduct,
    updateOrderStatus,
    updateStore,
    refetch,
  } = useStore();

  const {
    webServices,
    createWebService,
    updateWebService,
    deleteWebService,
  } = useWebServices(store?.id || null);

  // Real-time order notifications
  const handleNewOrder = useCallback(() => {
    refetch();
  }, [refetch]);
  
  useOrderNotifications(store?.id || null, store?.user_id || null, handleNewOrder);

  // Count pending orders
  const pendingOrdersCount = useMemo(() => {
    return orders.filter(order => order.status === "pending").length;
  }, [orders]);

  const [storeSettings, setStoreSettings] = useState({
    name: "",
    description: "",
    location: "",
    campus: "",
    phone: "",
    logo_url: "",
    cover_url: "",
    latitude: null as number | null,
    longitude: null as number | null,
    momo_number: "",
    momo_provider: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingMomo, setSavingMomo] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (store) {
      setStoreSettings({
        name: store.name || "",
        description: store.description || "",
        location: store.location || "",
        campus: store.campus || "",
        phone: store.phone || "",
        logo_url: store.logo_url || "",
        cover_url: store.cover_url || "",
        latitude: (store as any).latitude || null,
        longitude: (store as any).longitude || null,
        momo_number: "",
        momo_provider: "",
      });
      // Fetch payout details via secure RPC (owner-only)
      supabase.rpc('get_my_store_payout', { _store_id: store.id }).then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setStoreSettings(prev => ({
            ...prev,
            momo_number: (row as any).momo_number || "",
            momo_provider: (row as any).momo_provider || "",
          }));
        }
      });
    }
  }, [store]);


  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const { momo_number, momo_provider, ...rest } = storeSettings;
      await updateStore(rest);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveMomo = async () => {
    if (!store || !storeSettings.momo_number || !storeSettings.momo_provider) {
      return;
    }
    setSavingMomo(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          momo_number: storeSettings.momo_number,
          momo_provider: storeSettings.momo_provider,
        })
        .eq('id', store.id);
      if (error) throw error;
      toast.success("MoMo details saved. Withdrawals will be sent here after admin approval.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save MoMo details");
    } finally {
      setSavingMomo(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show setup wizard if no store exists
  if (!store) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-2xl mx-auto px-4 pt-28 pb-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent mb-6">
              <StoreIcon className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Create Your Store</h1>
            <p className="text-muted-foreground">
              Set up your store in just a few steps and start selling
            </p>
          </div>
          <StoreSetupWizard onComplete={createStore} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{store.name}</h1>
            <p className="text-muted-foreground">Manage your store, products, and orders</p>
          </div>
          <div className="flex gap-2">
            <ShareButton 
              url={`/store/${(store as any).slug || store.id}`}
              title={store.name}
              description={store.description || "Check out my store!"}
            />
            <Button variant="outline" onClick={() => navigate(`/store/${(store as any).slug || store.id}`)}>
              View Store
            </Button>
          </div>
        </div>

        {/* Subscription */}
        <div className="mb-6">
          <SubscriptionCard storeId={store.id} productCount={products.length} onUpdated={refetch} />
        </div>

        {/* Analytics */}
        <div className="mb-8">
          <Analytics store={store} products={products} orders={orders} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-lg w-full md:w-auto overflow-x-auto flex">
            <TabsTrigger value="products" className="gap-2 flex-1 md:flex-initial min-w-fit">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 flex-1 md:flex-initial min-w-fit">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
              {pendingOrdersCount > 0 && (
                <Badge className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-destructive">
                  {pendingOrdersCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2 flex-1 md:flex-initial min-w-fit">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="gap-2 flex-1 md:flex-initial min-w-fit">
              <Wallet className="h-4 w-4" />
              <span className="hidden xs:inline text-xs sm:text-sm">Wallet</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 flex-1 md:flex-initial min-w-fit">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <ProductsList
              products={products}
              onAdd={createProduct}
              onUpdate={updateProduct}
              onDelete={deleteProduct}
            />
          </TabsContent>

          <TabsContent value="orders">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold mb-6">Orders</h2>
              <OrdersTable orders={orders} onUpdateStatus={updateOrderStatus} storeLocation={store?.latitude && store?.longitude ? { latitude: store.latitude, longitude: store.longitude } : null} />
            </div>
          </TabsContent>

          <TabsContent value="services">
            <div className="bg-card border border-border rounded-xl p-6">
              <WebServicesManager
                webServices={webServices}
                onAdd={createWebService}
                onUpdate={updateWebService}
                onDelete={deleteWebService}
              />
            </div>
          </TabsContent>

          <TabsContent value="wallet">
            <WalletCard role="seller" storeId={store.id} />
          </TabsContent>

          <TabsContent value="settings">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold mb-6">Store Settings</h2>
              <div className="space-y-6">
                {/* Store Images Section */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-3 block">Store Logo</Label>
                    <StoreImageUpload
                      type="logo"
                      currentImageUrl={storeSettings.logo_url}
                      onImageUploaded={(url) => setStoreSettings({ ...storeSettings, logo_url: url })}
                      onImageRemoved={() => setStoreSettings({ ...storeSettings, logo_url: "" })}
                    />
                  </div>
                  <div>
                    <Label className="mb-3 block">Cover Image</Label>
                    <StoreImageUpload
                      type="cover"
                      currentImageUrl={storeSettings.cover_url}
                      onImageUploaded={(url) => setStoreSettings({ ...storeSettings, cover_url: url })}
                      onImageRemoved={() => setStoreSettings({ ...storeSettings, cover_url: "" })}
                    />
                  </div>
                </div>

                {/* Store Details */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="storeName">Store Name</Label>
                    <Input
                      id="storeName"
                      value={storeSettings.name}
                      onChange={(e) => setStoreSettings({ ...storeSettings, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="storeDescription">Description</Label>
                    <Textarea
                      id="storeDescription"
                      value={storeSettings.description}
                      onChange={(e) => setStoreSettings({ ...storeSettings, description: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="storeLocation">Address</Label>
                    <Input
                      id="storeLocation"
                      value={storeSettings.location}
                      onChange={(e) => setStoreSettings({ ...storeSettings, location: e.target.value })}
                      className="mt-1"
                      placeholder="e.g., 24 Oxford St, Osu"
                    />
                  </div>
                  <div>
                    <Label htmlFor="storeCampus">Area</Label>
                    <LocationSelector
                      value={storeSettings.campus}
                      onChange={(value) => setStoreSettings({ ...storeSettings, campus: value })}
                      placeholder="Select area"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="storePhone">Phone</Label>
                    <Input
                      id="storePhone"
                      value={storeSettings.phone}
                      onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Map Location */}
                <div>
                  <Label className="mb-3 block">Store Map Location</Label>
                  <MapPicker
                    latitude={storeSettings.latitude}
                    longitude={storeSettings.longitude}
                    onLocationSelect={(lat, lng) => setStoreSettings({ ...storeSettings, latitude: lat, longitude: lng })}
                  />
                  {storeSettings.latitude && storeSettings.longitude && (
                    <p className="text-sm text-muted-foreground mt-2">
                      📍 {storeSettings.latitude.toFixed(5)}, {storeSettings.longitude.toFixed(5)}
                    </p>
                  )}
                </div>

                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>

                {/* MoMo Payout Settings */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    MoMo Payout Settings
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set up your mobile money to receive instant payments when buyers purchase from your store.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>MoMo Provider</Label>
                      <Select 
                        value={storeSettings.momo_provider} 
                        onValueChange={(value) => setStoreSettings({ ...storeSettings, momo_provider: value })}
                      >
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
                      <Label>MoMo Number</Label>
                      <Input
                        value={storeSettings.momo_number}
                        onChange={(e) => setStoreSettings({ ...storeSettings, momo_number: e.target.value })}
                        placeholder="e.g., 0241234567"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleSaveMomo} 
                    disabled={savingMomo || !storeSettings.momo_number || !storeSettings.momo_provider}
                    className="mt-4"
                  >
                    {savingMomo && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save MoMo Details
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SellerDashboard;
