import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Package, User, MapPin, Truck, Phone, Clock, CreditCard } from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@/hooks/useStore";

interface OrderDetailDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

const OrderDetailDialog = ({ order, open, onOpenChange }: OrderDetailDialogProps) => {
  const [buyer, setBuyer] = useState<{ full_name: string | null; phone: string | null; campus: string | null } | null>(null);

  useEffect(() => {
    if (!order || !open) return;
    const fetchBuyer = async () => {
      const { data } = await supabase.rpc("get_order_contact", { _order_id: order.id });
      const row = Array.isArray(data) ? data[0] : null;
      setBuyer(row ? { full_name: row.buyer_name, phone: row.buyer_phone, campus: null } : null);
    };
    fetchBuyer();
  }, [order?.id, open]);

  if (!order) return null;

  const status = statusConfig[order.status] || statusConfig.pending;
  const orderData = order as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Order #{order.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status & Date */}
          <div className="flex items-center justify-between">
            <Badge className={status.color}>{status.label}</Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(order.created_at), "MMM d, yyyy h:mm a")}
            </span>
          </div>

          <Separator />

          {/* Buyer Info */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Buyer
            </h4>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <p className="font-medium">{buyer?.full_name || "Unknown"}</p>
              {buyer?.phone && (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" /> {buyer.phone}
                </p>
              )}
              {buyer?.campus && (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {buyer.campus}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Delivery Info */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Delivery
            </h4>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Type: </span>
                <Badge variant="outline" className="ml-1">
                  {orderData.delivery_type === "delivery" ? "Delivery" : "Pickup"}
                </Badge>
              </p>
              {orderData.delivery_address && (
                <p>
                  <span className="text-muted-foreground">Address: </span>
                  {orderData.delivery_address}
                </p>
              )}
              {orderData.delivery_landmark && (
                <p>
                  <span className="text-muted-foreground">Landmark: </span>
                  {orderData.delivery_landmark}
                </p>
              )}
              {orderData.delivery_status && (
                <p>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge variant="secondary" className="ml-1">{orderData.delivery_status}</Badge>
                </p>
              )}
              {orderData.delivery_fee > 0 && (
                <p>
                  <span className="text-muted-foreground">Delivery Fee: </span>
                  ₵{Number(orderData.delivery_fee).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Order Items */}
          {order.order_items && order.order_items.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Items</h4>
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-3">
                      {(item.product as any)?.image_url && (
                        <img
                          src={(item.product as any).image_url}
                          alt={(item.product as any)?.name}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium">{(item.product as any)?.name || "Product"}</p>
                        <p className="text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-semibold">₵{Number(item.price).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Payment Summary */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Payment
            </h4>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Status</span>
                <Badge variant={orderData.payment_status === "paid" ? "default" : "secondary"}>
                  {orderData.payment_status || "unpaid"}
                </Badge>
              </div>
              {orderData.delivery_fee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>₵{Number(orderData.delivery_fee).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-1 border-t border-border">
                <span>Total</span>
                <span className="text-primary">₵{Number(order.total_amount).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-1">Notes</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{order.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailDialog;
