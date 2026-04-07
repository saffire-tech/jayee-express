import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Clock, CheckCircle, XCircle, Truck } from "lucide-react";
import type { Order } from "@/hooks/useStore";
import DeliveryTracker from "@/components/delivery/DeliveryTracker";
import OrderDetailDialog from "./OrderDetailDialog";

interface OrdersTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: string) => Promise<void>;
  storeLocation?: { latitude: number; longitude: number } | null;
}

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800", icon: Package },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: XCircle },
};

const OrdersTable = ({ orders, onUpdateStatus, storeLocation }: OrdersTableProps) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">No orders yet</h3>
        <p className="text-muted-foreground">
          Orders from customers will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const status = statusConfig[order.status];
        const StatusIcon = status.icon;

        return (
          <div
            key={order.id}
            className="bg-card border border-border rounded-xl p-4 md:p-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={status.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  ₡{order.total_amount.toFixed(2)}
                </p>
                
                {order.order_items && order.order_items.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {order.order_items.map((item) => (
                      <p key={item.id} className="text-sm text-muted-foreground">
                        {item.quantity}x {(item.product as any)?.name || "Product"} - ${item.price.toFixed(2)}
                      </p>
                    ))}
                  </div>
                )}
                
                {order.notes && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Note: {order.notes}
                  </p>
                )}
                
                {(order as any).delivery_type === 'delivery' && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Delivery</span>
                      {(order as any).delivery_status && (
                        <Badge variant="outline" className="text-xs">{(order as any).delivery_status}</Badge>
                      )}
                      {(order as any).delivery_fee > 0 && (
                        <span className="text-sm text-muted-foreground">Fee: ₵{Number((order as any).delivery_fee).toLocaleString()}</span>
                      )}
                    </div>
                    {(order as any).delivery_status && (order as any).delivery_status !== 'delivered' && (
                      <DeliveryTracker
                        orderId={order.id}
                        storeLocation={storeLocation || null}
                        buyerLocation={(order as any).delivery_latitude && (order as any).delivery_longitude ? { latitude: (order as any).delivery_latitude, longitude: (order as any).delivery_longitude } : null}
                        deliveryStatus={(order as any).delivery_status}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Select
                  value={order.status}
                  onValueChange={(value) => onUpdateStatus(order.id, value as Order["status"])}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrdersTable;
