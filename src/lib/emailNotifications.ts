import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface LowStockProduct {
  name: string;
  stock: number;
}

export const sendNewOrderEmailNotification = async (
  storeOwnerId: string,
  orderId: string,
  orderAmount: number,
  items: OrderItem[],
  buyerName?: string
) => {
  try {
    const { error } = await supabase.functions.invoke("send-email-notification", {
      body: {
        type: "new_order",
        recipientUserId: storeOwnerId,
        data: {
          orderId,
          orderAmount,
          items,
          buyerName: buyerName || "A customer",
        },
      },
    });

    if (error) {
      console.error("Error sending new order email:", error);
    } else {
      console.log("New order email sent successfully");
    }
  } catch (error) {
    console.error("Error sending new order email notification:", error);
  }
};

export const sendOrderStatusEmailNotification = async (
  _buyerId: string,
  orderId: string,
  status: string,
  _storeName: string
) => {
  try {
    const { error } = await supabase.functions.invoke("notify-app-email", {
      body: {
        templateName: "order-status-update",
        orderId,
        status,
      },
    });
    if (error) console.error("Error sending order status email:", error);
  } catch (error) {
    console.error("Error sending order status email notification:", error);
  }
};
// Retained signature args for backward compatibility (buyerId/storeName now derived server-side).
void ((_: unknown) => _);

export const sendMessageEmailNotification = async (
  receiverId: string,
  senderName: string,
  messagePreview: string
) => {
  try {
    const { error } = await supabase.functions.invoke("send-email-notification", {
      body: {
        type: "new_message",
        recipientUserId: receiverId,
        data: {
          senderName,
          messagePreview,
        },
      },
    });

    if (error) {
      console.error("Error sending message email:", error);
    } else {
      console.log("Message email sent successfully");
    }
  } catch (error) {
    console.error("Error sending message email notification:", error);
  }
};

export const sendLowStockEmailNotification = async (
  storeOwnerId: string,
  products: LowStockProduct[]
) => {
  try {
    const { error } = await supabase.functions.invoke("send-email-notification", {
      body: {
        type: "low_stock",
        recipientUserId: storeOwnerId,
        data: {
          products,
        },
      },
    });

    if (error) {
      console.error("Error sending low stock email:", error);
    } else {
      console.log("Low stock email sent successfully");
    }
  } catch (error) {
    console.error("Error sending low stock email notification:", error);
  }
};
