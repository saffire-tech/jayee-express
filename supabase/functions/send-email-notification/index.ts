import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailNotificationRequest {
  type: "new_order" | "order_status" | "new_message" | "low_stock";
  recipientUserId: string;
  data: {
    // For new_order
    orderId?: string;
    orderAmount?: number;
    items?: Array<{ name: string; quantity: number; price: number }>;
    buyerName?: string;
    // For order_status
    status?: string;
    storeName?: string;
    // For new_message
    senderName?: string;
    messagePreview?: string;
    // For low_stock
    products?: Array<{ name: string; stock: number }>;
  };
}

const getEmailContent = (type: string, data: EmailNotificationRequest["data"]) => {
  switch (type) {
    case "new_order":
      const itemsList = data.items?.map(i => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${i.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${i.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₵${i.price.toLocaleString()}</td>
        </tr>
      `).join('') || '';
      
      return {
        subject: `🎉 New Order Received! - Order #${data.orderId?.slice(0, 8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #f97316; margin: 0;">Shodel</h1>
              <p style="color: #666; margin-top: 5px;">Community Marketplace</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 10px 0;">🎉 New Order Received!</h2>
              <p style="margin: 0; opacity: 0.9;">You have a new order from ${data.buyerName || 'a customer'}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; color: #333;">Order Details</h3>
              <p style="margin: 5px 0;"><strong>Order ID:</strong> ${data.orderId?.slice(0, 8)}</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                  <tr style="background: #eee;">
                    <th style="padding: 10px; text-align: left;">Item</th>
                    <th style="padding: 10px; text-align: center;">Qty</th>
                    <th style="padding: 10px; text-align: right;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding: 10px; font-weight: bold;">Total</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #f97316;">₵${data.orderAmount?.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <p style="color: #666; text-align: center;">Please check your seller dashboard to manage this order.</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">Shodel - Your Community Marketplace</p>
            </div>
          </div>
        `
      };

    case "order_status":
      const statusColors: Record<string, string> = {
        confirmed: "#22c55e",
        processing: "#3b82f6",
        completed: "#8b5cf6",
        cancelled: "#ef4444"
      };
      const statusEmoji: Record<string, string> = {
        confirmed: "✅",
        processing: "🔄",
        completed: "🎉",
        cancelled: "❌"
      };
      
      return {
        subject: `Order Update - Your order is ${data.status}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #f97316; margin: 0;">Shodel</h1>
              <p style="color: #666; margin-top: 5px;">Community Marketplace</p>
            </div>
            
            <div style="background: ${statusColors[data.status || ''] || '#666'}; color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
              <h2 style="margin: 0 0 10px 0;">${statusEmoji[data.status || ''] || '📦'} Order ${data.status?.charAt(0).toUpperCase()}${data.status?.slice(1)}</h2>
              <p style="margin: 0; opacity: 0.9;">Order #${data.orderId?.slice(0, 8)}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>Store:</strong> ${data.storeName}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${statusColors[data.status || ''] || '#666'};">${data.status}</span></p>
            </div>
            
            <p style="color: #666; text-align: center;">Check your purchase history for more details.</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">UniPlug - Your Community Marketplace</p>
            </div>
          </div>
        `
      };

    case "new_message":
      return {
        subject: `New message from ${data.senderName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #f97316; margin: 0;">UniPlug</h1>
              <p style="color: #666; margin-top: 5px;">Community Marketplace</p>
            </div>
            
            <div style="background: #3b82f6; color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 10px 0;">💬 New Message</h2>
              <p style="margin: 0; opacity: 0.9;">You have a new message from ${data.senderName}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <p style="margin: 0; color: #333; font-style: italic;">"${data.messagePreview?.slice(0, 150)}${(data.messagePreview?.length || 0) > 150 ? '...' : ''}"</p>
            </div>
            
            <p style="color: #666; text-align: center;">Log in to UniPlug to reply to this message.</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">UniPlug - Your Community Marketplace</p>
            </div>
          </div>
        `
      };

    case "low_stock":
      const productsList = data.products?.map(p => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${p.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; color: ${p.stock === 0 ? '#ef4444' : '#f97316'}; font-weight: bold;">
            ${p.stock === 0 ? 'Out of Stock' : `${p.stock} left`}
          </td>
        </tr>
      `).join('') || '';
      
      return {
        subject: `⚠️ Low Stock Alert for your products`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #f97316; margin: 0;">UniPlug</h1>
              <p style="color: #666; margin-top: 5px;">Community Marketplace</p>
            </div>
            
            <div style="background: #f97316; color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 10px 0;">⚠️ Low Stock Alert</h2>
              <p style="margin: 0; opacity: 0.9;">Some of your products are running low on stock</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #eee;">
                    <th style="padding: 10px; text-align: left;">Product</th>
                    <th style="padding: 10px; text-align: center;">Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsList}
                </tbody>
              </table>
            </div>
            
            <p style="color: #666; text-align: center;">Please restock these products to avoid missing sales.</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">UniPlug - Your Community Marketplace</p>
            </div>
          </div>
        `
      };

    default:
      return { subject: "Notification from UniPlug", html: "<p>You have a new notification.</p>" };
  }
};

const getPlainTextBody = (type: string, data: EmailNotificationRequest["data"]): string => {
  switch (type) {
    case "new_order":
      return `New order from ${data.buyerName || 'a customer'} - ₵${data.orderAmount?.toLocaleString()}`;
    case "order_status":
      return `Your order #${data.orderId?.slice(0, 8)} from ${data.storeName} is now ${data.status}`;
    case "new_message":
      return `${data.senderName}: ${data.messagePreview?.slice(0, 100)}`;
    case "low_stock":
      return `${data.products?.length || 0} products are running low on stock`;
    default:
      return "You have a new notification";
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, recipientUserId, data }: EmailNotificationRequest = await req.json();

    console.log(`Processing ${type} email notification for user ${recipientUserId}`);

    // Create Supabase client with service role to access auth.users
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get user email from auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(recipientUserId);

    if (userError || !userData?.user?.email) {
      console.error("Error fetching user email:", userError);
      return new Response(
        JSON.stringify({ error: "Could not fetch user email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recipientEmail = userData.user.email;
    const emailContent = getEmailContent(type, data);

    console.log(`Sending ${type} email to ${recipientEmail}`);

    const emailResponse = await resend.emails.send({
      from: "UniPlug <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log notification to database
    const { error: logError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: recipientUserId,
        type: type,
        channel: "email",
        title: emailContent.subject,
        body: getPlainTextBody(type, data),
        data: { ...data, emailId: emailResponse?.data?.id },
        is_read: false,
      });

    if (logError) {
      console.error("Error logging notification:", logError);
    }

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-email-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
