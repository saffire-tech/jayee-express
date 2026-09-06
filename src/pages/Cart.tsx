import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MoMoPaymentDialog from '@/components/payments/MoMoPaymentDialog';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SEO from '@/components/SEO';
import DeliveryOption from '@/components/checkout/DeliveryOption';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Loader2, History, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';


interface StoreInfo {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

const Cart = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { items, loading, removeFromCart, updateQuantity, clearCart, totalPrice } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [deliveryData, setDeliveryData] = useState<{
    deliveryType: 'pickup' | 'delivery';
    deliveryFee: number;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    deliveryAddress?: string;
    deliveryLandmark?: string;
  }>({ deliveryType: 'pickup', deliveryFee: 0 });
  const [cartStores, setCartStores] = useState<StoreInfo[]>([]);
  const [pendingAttempt, setPendingAttempt] = useState<{ reference: string; created_at: string } | null>(null);

  // Check for a recent in-flight payment attempt
  useEffect(() => {
    if (!user) return;
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    supabase
      .from('payment_attempts')
      .select('reference, created_at')
      .eq('buyer_id', user.id)
      .eq('status', 'initialized')
      .gte('created_at', fiveMinAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPendingAttempt(data || null));
  }, [user, items.length]);

  useEffect(() => {
    if (items.length === 0) {
      setCartStores([]);
      return;
    }

    const uniqueStoreIds = [...new Set(items.map((item) => item.product.store_id))];

    supabase
      .from('stores')
      .select('id, name, latitude, longitude')
      .in('id', uniqueStoreIds)
      .then(({ data }) => {
        if (data) {
          setCartStores(data as StoreInfo[]);
        }
      });
  }, [items]);

  const handleCheckout = () => {
    if (!user || items.length === 0) return;
    if (!online) {
      toast.error("You're offline. Please connect to the internet to complete your purchase.");
      return;
    }
    setPayOpen(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Your cart is waiting</h1>
          <p className="text-muted-foreground mb-6">Please login to view your cart</p>
          <Link to="/auth">
            <Button>Login to Continue</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">Start shopping to add items to your cart</p>
          <Link to="/">
            <Button>Browse Products</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Your Cart | Jayee Express"
        description="Review the items in your Jayee Express cart and check out."
        canonicalPath="/cart"
        noindex
      />
      <Navbar />
      
      
      <main className="container mx-auto px-4 pt-24 pb-8">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Shopping Cart</h1>
          <Link to="/purchases">
            <Button variant="outline" size="sm">
              <History className="mr-2 h-4 w-4" />
              View Purchases
            </Button>
          </Link>
        </div>

        {pendingAttempt && (
          <div className="mb-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm">
            <p className="font-medium text-yellow-700 dark:text-yellow-400">A recent payment is still being confirmed.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please wait a minute before trying again — if the payment succeeded, your cart will clear automatically and you will not be charged twice.
            </p>
          </div>
        )}

        {!online && (
          <div className="mb-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm flex items-start gap-2">
            <WifiOff className="h-4 w-4 mt-0.5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">You're offline</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can review your cart, but you'll need an internet connection to complete your purchase.
              </p>
            </div>
          </div>
        )}



        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex gap-3 md:gap-4">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {item.product.image_url ? (
                        <img 
                          src={item.product.image_url} 
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="h-6 w-6 md:h-8 md:w-8" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/product/${item.product_id}`}
                        className="font-semibold hover:text-primary truncate block text-sm md:text-base"
                      >
                        {item.product.name}
                      </Link>
                      <p className="text-base md:text-lg font-bold text-primary mt-1">
                        ₵{item.product.price.toLocaleString()}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2 md:mt-3">
                        <div className="flex items-center border rounded-md">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:text-destructive h-8 w-8"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-right hidden sm:block">
                      <p className="font-bold">
                        ₵{(item.product.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Delivery Option + Order Summary */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardContent className="p-4">
                <DeliveryOption
                  stores={cartStores}
                  onDeliveryChange={setDeliveryData}
                />
              </CardContent>
            </Card>

            <Card className="lg:sticky lg:top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg md:text-xl">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({items.length} items)</span>
                  <span>₵{totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  {deliveryData.deliveryFee > 0 ? (
                    <span>₵{deliveryData.deliveryFee.toLocaleString()}</span>
                  ) : (
                    <span className="text-primary">{deliveryData.deliveryType === 'pickup' ? 'Pickup' : 'Free'}</span>
                  )}
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base md:text-lg">
                  <span>Total</span>
                  <span className="text-primary">₵{(totalPrice + deliveryData.deliveryFee).toLocaleString()}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-2 md:gap-3">
                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={handleCheckout}
                  disabled={checkingOut || !!pendingAttempt || !online}
                >
                  {checkingOut ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Checkout
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <Link to="/purchases" className="w-full">
                  <Button variant="outline" className="w-full">
                    <History className="mr-2 h-4 w-4" />
                    View Purchases
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className="w-full text-destructive hover:text-destructive" 
                  onClick={clearCart}
                  disabled={checkingOut}
                >
                  Clear Cart
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>

      <MoMoPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        amount={totalPrice + deliveryData.deliveryFee}
        title="Pay with Mobile Money"
        description={`You are paying ₵${(totalPrice + deliveryData.deliveryFee).toLocaleString()} for your order.`}
        functionName="initialize-payment"
        body={{
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            product: {
              store_id: item.product.store_id,
              price: item.product.price,
              name: item.product.name,
            },
          })),
          deliveryData,
          email: user.email,
        }}
        onSuccess={() => {
          toast.success('Payment successful');
          navigate('/purchases');
        }}
      />

      <Footer />
    </div>
  );
};

export default Cart;
