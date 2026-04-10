import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Package, Calendar, Store, X, Clock, CheckCircle2, Truck, XCircle, MapPin } from "lucide-react";
import DeliveryTracker from "@/components/delivery/DeliveryTracker";
import DeliveryContactCard from "@/components/delivery/DeliveryContactCard";
import { format } from "date-fns";
import { toast } from "sonner";

const ConfirmReceivedButton = ({ orderId, onConfirmed }: { orderId: string; onConfirmed: () => void }) => {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Update order status
      const { error } = await supabase
        .from("orders")
        .update({ delivery_status: "confirmed", status: "completed" })
        .eq("id", orderId);
      if (error) throw error;

      // Trigger delivery person payout
      try {
        await supabase.functions.invoke('payout-delivery', {
          body: { order_id: orderId },
        });
      } catch (payoutErr) {
        console.error("Payout error (non-blocking):", payoutErr);
      }

      toast.success("Delivery confirmed! Payout sent to delivery person.");
      onConfirmed();
    } catch {
      toast.error("Failed to confirm. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
      <div className="text-sm">
        <p className="font-medium text-green-700 dark:text-green-400">Your order has been delivered!</p>
        <p className="text-muted-foreground text-xs">Confirm receipt to release delivery payout.</p>
      </div>
      <Button size="sm" onClick={handleConfirm} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
        {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
        Received
      </Button>
    </div>
  );
};
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CancelCountdown = ({ createdAt, orderId, cancellingOrderId, onCancel }: { 
  createdAt: string; orderId: string; cancellingOrderId: string | null; onCancel: (id: string) => void 
}) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const created = new Date(createdAt).getTime();
      const deadline = created + 15 * 60 * 1000;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setTimeLeft('');
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{timeLeft}</span>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
        onClick={() => onCancel(orderId)}
        disabled={cancellingOrderId === orderId}
      >
        {cancellingOrderId === orderId ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <X className="h-3 w-3 mr-1" />
            Cancel
          </>
        )}
      </Button>
    </div>
  );
};

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  product?: {
    name: string;
    image_url: string | null;
  };
}

interface Order {
  id: string;
  store_id: string;
  total_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  delivery_type?: string;
  delivery_fee?: number;
  delivery_status?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_person_id?: string | null;
  delivery_person?: {
    full_name: string | null;
    phone: string | null;
  } | null;
  store?: {
    name: string;
    logo_url: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  order_items: OrderItem[];
}

const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { 
    label: "Pending", 
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    icon: <Clock className="h-4 w-4" />
  },
  confirmed: { 
    label: "Confirmed", 
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: <CheckCircle2 className="h-4 w-4" />
  },
  preparing: { 
    label: "Preparing", 
    className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    icon: <Package className="h-4 w-4" />
  },
  completed: { 
    label: "Completed", 
    className: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: <Truck className="h-4 w-4" />
  },
  delivered: { 
    label: "Completed", 
    className: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: <Truck className="h-4 w-4" />
  },
  cancelled: { 
    label: "Cancelled", 
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: <XCircle className="h-4 w-4" />
  },
};

const statusSteps = ["pending", "confirmed", "preparing", "completed"];

const OrderStatusTracker = ({ status }: { status: string }) => {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-500/10 rounded-lg px-3 py-2">
        <XCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Order Cancelled</span>
      </div>
    );
  }

  const currentIndex = statusSteps.indexOf(status);
  
  return (
    <div className="flex items-center justify-between gap-1 mt-4 mb-2">
      {statusSteps.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const config = statusConfig[step];
        
        return (
          <div key={step} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  isCompleted 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                } ${isCurrent ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
              >
                {config.icon}
              </div>
              {index < statusSteps.length - 1 && (
                <div 
                  className={`flex-1 h-1 mx-1 rounded ${
                    index < currentIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
            <span className={`text-xs mt-1 ${isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {config.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const PurchaseHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Verify payment on redirect from Paystack
  useEffect(() => {
    const reference = searchParams.get("reference");
    if (!reference || !user) return;

    const verifyPayment = async () => {
      setVerifying(true);
      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { reference },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.verified) {
          toast.success(data.orders_created ? "Payment verified! Your orders have been placed." : "Payment verified! Orders are being processed.");
          fetchOrders();
        }
      } catch (err: any) {
        console.error("Payment verification error:", err);
        toast.error("Could not verify payment. Your order may still be processing.");
      } finally {
        setVerifying(false);
        // Clear query params
        setSearchParams({}, { replace: true });
      }
    };

    verifyPayment();
  }, [searchParams, user]);

  useEffect(() => {
    if (user) {
      fetchOrders();

      // Subscribe to real-time order updates
      const channel = supabase
        .channel("buyer-orders-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
          },
          (payload) => {
            console.log("Order update for buyer:", payload);
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          store_id,
          total_amount,
          status,
          notes,
          created_at,
          delivery_type,
          delivery_fee,
          delivery_status,
          delivery_latitude,
          delivery_longitude,
          delivery_person_id
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch store and order items for each order
      const ordersWithDetails = await Promise.all(
        (ordersData || []).map(async (order) => {
          // Fetch store
          const { data: storeData } = await supabase
            .from("stores")
            .select("name, logo_url, latitude, longitude")
            .eq("id", order.store_id)
            .maybeSingle();

          // Fetch order items with product details
          const { data: itemsData } = await supabase
            .from("order_items")
            .select("id, product_id, quantity, price")
            .eq("order_id", order.id);

          // Fetch product details for each item
          const itemsWithProducts = await Promise.all(
            (itemsData || []).map(async (item) => {
              const { data: productData } = await supabase
                .from("products")
                .select("name, image_url")
                .eq("id", item.product_id)
                .maybeSingle();

              return {
                ...item,
                product: productData,
              };
            })
          );

          // Fetch delivery person profile if applicable
          let deliveryPerson = null;
          const activeStatuses = ['accepted', 'picked_up', 'in_transit', 'delivered'];
          if (order.delivery_person_id && order.delivery_status && activeStatuses.includes(order.delivery_status)) {
            const { data: dpData } = await supabase
              .from('profiles')
              .select('full_name, phone')
              .eq('user_id', order.delivery_person_id)
              .maybeSingle();
            deliveryPerson = dpData;
          }

          return {
            ...order,
            store: storeData,
            order_items: itemsWithProducts,
            delivery_person: deliveryPerson,
          };
        })
      );

      setOrders(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    
    setCancellingOrderId(orderToCancel);
    setShowCancelDialog(false);
    
    try {
      const { data, error } = await supabase.functions.invoke("cancel-order-refund", {
        body: { order_id: orderToCancel },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setOrders(prev => 
        prev.map(order => 
          order.id === orderToCancel 
            ? { ...order, status: "cancelled" } 
            : order
        )
      );
      
      toast.success("Order cancelled. Your refund is being processed.");
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      toast.error(error.message || "Failed to cancel order. Please try again.");
    } finally {
      setCancellingOrderId(null);
      setOrderToCancel(null);
    }
  };

  const isWithinCancelWindow = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return now - created < 15 * 60 * 1000;
  };

  const getCancelTimeRemaining = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const deadline = created + 15 * 60 * 1000;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const openCancelDialog = (orderId: string) => {
    setOrderToCancel(orderId);
    setShowCancelDialog(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl mx-auto px-4 pt-28 pb-16">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-3xl font-bold mb-2">Purchase History</h1>
        <p className="text-muted-foreground mb-6">View all your past orders</p>

        {verifying && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Verifying your payment...</span>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No purchases yet</h2>
            <p className="text-muted-foreground mb-6">
              You haven't made any purchases. Start exploring products!
            </p>
            <Button variant="hero" onClick={() => navigate("/products")}>
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-card rounded-xl border border-border p-4 sm:p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {order.store?.logo_url ? (
                      <img
                        src={order.store.logo_url}
                        alt={order.store.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <Link 
                        to={`/store/${order.store_id}`}
                        className="font-semibold hover:text-primary transition-colors"
                      >
                        {order.store?.name || "Unknown Store"}
                      </Link>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(order.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusConfig[order.status]?.className || ""}>
                      {statusConfig[order.status]?.icon}
                      <span className="ml-1">{statusConfig[order.status]?.label || order.status}</span>
                    </Badge>
                    {order.status === "pending" && isWithinCancelWindow(order.created_at) && (
                      <CancelCountdown 
                        createdAt={order.created_at} 
                        orderId={order.id}
                        cancellingOrderId={cancellingOrderId}
                        onCancel={openCancelDialog}
                      />
                    )}
                  </div>
                </div>

                {/* Status Tracker */}
                <OrderStatusTracker status={order.status} />

                <div className="space-y-3 mb-4 mt-4">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      {item.product?.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/product/${item.product_id}`}
                          className="font-medium hover:text-primary transition-colors line-clamp-1"
                        >
                          {item.product?.name || "Unknown Product"}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity} × ₡{Number(item.price).toLocaleString()}
                        </p>
                      </div>
                      <p className="font-medium">
                        ₵{(item.quantity * Number(item.price)).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mb-4">
                    <strong>Notes:</strong> {order.notes}
                  </p>
                )}

                {/* Delivery Tracking */}
                {order.delivery_type === 'delivery' && order.delivery_status && order.delivery_status !== 'confirmed' && (
                  <div className="mb-4">
                    <DeliveryTracker
                      orderId={order.id}
                      storeLocation={order.store?.latitude && order.store?.longitude ? { latitude: order.store.latitude, longitude: order.store.longitude } : null}
                      buyerLocation={order.delivery_latitude && order.delivery_longitude ? { latitude: order.delivery_latitude, longitude: order.delivery_longitude } : null}
                      deliveryStatus={order.delivery_status}
                    />
                  </div>
                )}

                {/* Delivery Person Contact */}
                {order.delivery_person && order.delivery_person_id && (
                  <div className="mb-4">
                    <DeliveryContactCard
                      label="Delivery Person"
                      name={order.delivery_person.full_name}
                      phone={order.delivery_person.phone}
                      userId={order.delivery_person_id}
                    />
                  </div>
                )}

                {/* Buyer Confirm Received Button */}
                {order.delivery_type === 'delivery' && order.delivery_status === 'delivered' && (
                  <ConfirmReceivedButton orderId={order.id} onConfirmed={() => {
                    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, delivery_status: 'confirmed', status: 'completed' } : o));
                  }} />
                )}

                {order.delivery_type === 'delivery' && (
                  <div className="flex items-center gap-2 mb-4 text-sm">
                    <Truck className="h-4 w-4 text-primary" />
                    <span>Delivery</span>
                    {order.delivery_fee && order.delivery_fee > 0 && (
                      <span className="text-muted-foreground">Fee: ₵{Number(order.delivery_fee).toLocaleString()}</span>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">
                    ₵{Number(order.total_amount).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order & Request Refund?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? A full refund will be initiated to your payment method. The seller will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrderToCancel(null)}>Keep Order</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PurchaseHistory;
