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
  buyerId: string,
  orderId: string,
  status: string,
  storeName: string
) => {
  try {
    // Look up buyer's name for a friendlier email
    let buyerName = "";
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", buyerId)
        .maybeSingle();
      buyerName = (prof as any)?.full_name || "";
    } catch {}

    const origin = typeof window !== "undefined" ? window.location.origin : "https://jayeeexpress.com";
    const { error } = await supabase.functions.invoke("notify-app-email", {
      body: {
        templateName: "order-status-update",
        recipientUserId: buyerId,
        idempotencyKey: `order-status-${orderId}-${status}`,
        templateData: {
          buyerName,
          orderId,
          status,
          storeName,
          orderUrl: `${origin}/purchases`,
        },
      },
    });
    if (error) console.error("Error sending order status email:", error);
  } catch (error) {
    console.error("Error sending order status email notification:", error);
  }
};

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
