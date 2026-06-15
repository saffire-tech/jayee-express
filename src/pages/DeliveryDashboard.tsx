import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDeliveryRole } from '@/hooks/useDeliveryRole';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import AvailableOrders from '@/components/delivery/AvailableOrders';
import ActiveDelivery from '@/components/delivery/ActiveDelivery';
import RiderSubscriptionCard from '@/components/delivery/RiderSubscriptionCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Truck, Package, History, Wallet, Banknote, Radio } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import WalletCard from '@/components/wallet/WalletCard';
import { Button } from '@/components/ui/button';
import PayoutMethodForm from '@/components/wallet/PayoutMethodForm';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DeliveryDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isDeliveryPerson, hasActiveSubscription, loading: roleLoading } = useDeliveryRole();
  const navigate = useNavigate();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [momoNumber, setMomoNumber] = useState('');
  const [momoProvider, setMomoProvider] = useState('');
  const [savingMomo, setSavingMomo] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  // Verify rider subscription payment on Paystack callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) return;
    (async () => {
      try {
        await supabase.functions.invoke('verify-payment', { body: { reference } });
        toast.success('Subscription activated!');
      } catch (e: any) {
        toast.error(e.message || 'Could not verify payment');
      } finally {
        window.history.replaceState({}, '', '/delivery');
        window.location.reload();
      }
    })();
  }, []);

  // Load existing MoMo details + online status
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('is_online')
        .eq('user_id', user.id)
        .maybeSingle();
      if (prof) setIsOnline(!!(prof as any).is_online);

      const { data: momo } = await supabase.rpc('get_my_momo');
      const row = Array.isArray(momo) ? momo[0] : momo;
      if (row) {
        setMomoNumber(row.momo_number || '');
        setMomoProvider(row.momo_provider || '');
      }
    };
    load();
  }, [user]);

  const toggleOnline = async (next: boolean) => {
    if (!user) return;
    if (next && !hasActiveSubscription) {
      toast.error('Pay your monthly rider subscription before going online.');
      return;
    }
    setTogglingOnline(true);
    const prev = isOnline;
    setIsOnline(next);
    const { error } = await supabase
      .from('profiles')
      .update({ is_online: next } as any)
      .eq('user_id', user.id);
    setTogglingOnline(false);
    if (error) {
      setIsOnline(prev);
      toast.error('Failed to update status');
    } else {
      toast.success(next ? "You're online — receiving deliveries" : "You're offline");
    }
  };

  const handleSaveMomo = async () => {
    if (!momoNumber || !momoProvider || !user) return;
    setSavingMomo(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ momo_number: momoNumber, momo_provider: momoProvider } as any)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('MoMo details saved for withdrawals!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save MoMo');
    } finally {
      setSavingMomo(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading && !roleLoading && !isDeliveryPerson) {
      navigate('/');
    }
  }, [isDeliveryPerson, roleLoading, authLoading]);

  // Check for existing active delivery
  useEffect(() => {
    if (!user) return;
    const checkActive = async () => {
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('delivery_person_id', user.id)
        .in('delivery_status', ['accepted', 'picked_up', 'in_transit', 'delivered'])
        .limit(1)
        .maybeSingle();
      if (data) setActiveOrderId(data.id);
    };
    checkActive();
  }, [user]);

  // Fetch delivery history
  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      const { data } = await supabase
        .from('orders')
        .select('id, total_amount, delivery_fee, delivery_status, created_at, store_id')
        .eq('delivery_person_id', user.id)
        .eq('delivery_status', 'confirmed')
        .order('created_at', { ascending: false });

      if (data) {
        const withStores = await Promise.all(
          data.map(async (o) => {
            const { data: store } = await supabase.from('stores').select('name').eq('id', o.store_id).maybeSingle();
            return { ...o, store_name: store?.name || 'Unknown' };
          })
        );
        setHistory(withStores);
      }
      setLoadingHistory(false);
    };
    fetchHistory();
  }, [user, activeOrderId]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-3xl mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Truck className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">Delivery Dashboard</h1>
          </div>
          {!activeOrderId && (
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${isOnline ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/40'}`}>
              <Radio className={`h-4 w-4 ${isOnline ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
              <Switch checked={isOnline} disabled={togglingOnline} onCheckedChange={toggleOnline} />
            </div>
          )}
        </div>

        {activeOrderId ? (
          <ActiveDelivery
            orderId={activeOrderId}
            onComplete={() => setActiveOrderId(null)}
          />
        ) : (
          <Tabs defaultValue="available">
            <TabsList className="w-full">
              <TabsTrigger value="available" className="flex-1 gap-2">
                <Package className="h-4 w-4" />
                Available
              </TabsTrigger>
              <TabsTrigger value="wallet" className="flex-1 gap-2">
                <Wallet className="h-4 w-4" />
                Wallet
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="mt-4 space-y-4">
              <RiderSubscriptionCard />
              {hasActiveSubscription ? (
                <AvailableOrders onAccept={(id) => setActiveOrderId(id)} isOnline={isOnline} />
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    Pay your monthly subscription above to start receiving delivery orders.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="wallet" className="mt-4">
              <WalletCard role="delivery" />
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Payout Method
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose how you want to receive withdrawals from your wallet — mobile money or bank account. Once saved, your details are locked.
                  </p>
                  {user && <PayoutMethodForm target={{ kind: "profile", userId: user.id }} />}
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="history" className="mt-4">
              {loadingHistory ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No completed deliveries yet</div>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <Card key={h.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{h.store_name}</p>
                          <p className="text-sm text-muted-foreground">{format(new Date(h.created_at), 'MMM d, yyyy')}</p>
                        </div>
                        <Badge variant="outline" className="text-primary border-primary">
                          ₵{Number(h.delivery_fee).toLocaleString()}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default DeliveryDashboard;
