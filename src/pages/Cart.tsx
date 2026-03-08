import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import DeliveryOption from '@/components/checkout/DeliveryOption';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Loader2, History, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


interface StoreInfo {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

const Cart = () => {
  const { user } = useAuth();
  const { items, loading, removeFromCart, updateQuantity, clearCart, totalPrice } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [showPaymentNotice, setShowPaymentNotice] = useState(false);
  const [deliveryData, setDeliveryData] = useState<{
    deliveryType: 'pickup' | 'delivery';
    deliveryFee: number;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    deliveryAddress?: string;
  }>({ deliveryType: 'pickup', deliveryFee: 0 });
  const [cartStores, setCartStores] = useState<StoreInfo[]>([]);

  // Fetch ALL unique store coordinates and names from cart items
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

  const handleCheckoutClick = () => {
    if (!user || items.length === 0) return;
    setShowPaymentNotice(true);
  };

  const handleConfirmCheckout = async () => {
    setShowPaymentNotice(false);
    if (!user || items.length === 0) return;
    
    setCheckingOut(true);
    
    try {
      // Call initialize-payment edge function
      const { data, error } = await supabase.functions.invoke('initialize-payment', {
        body: {
          items: items.map(item => ({
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
        },
      });

      if (error) throw new Error(error.message || 'Payment initialization failed');
      if (data?.error) throw new Error(data.error);

      // Redirect to Paystack payment page
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error('No payment URL returned');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Failed to initialize payment. Please try again.');
    } finally {
      setCheckingOut(false);
    }
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
                  onClick={handleCheckoutClick}
                  disabled={checkingOut}
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

      <Footer />

      {/* Payment Notice Dialog */}
      <AlertDialog open={showPaymentNotice} onOpenChange={setShowPaymentNotice}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Important Payment Notice
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-3">
              <p>
                <strong>Do not make any payments until you have received the goods or service you ordered</strong>, unless otherwise agreed with the seller.
              </p>
              <p className="text-muted-foreground">
                Shodel will not be held responsible for any fraudulent acts. Always verify the product/service before completing payment.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCheckout}>
              I Understand, Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Cart;
