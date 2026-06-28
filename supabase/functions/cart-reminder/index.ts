import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reminds users with cart items older than 2 days. Sends a reminder at most once every 24h per user.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Require shared secret for cron invocation
    const cronSecret = Deno.env.get('CRON_SECRET');
    const provided = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    if (!isServiceRole && (!cronSecret || provided !== cronSecret)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find old cart items
    const { data: oldItems, error } = await supabase
      .from('cart_items')
      .select('user_id, product:products(name)')
      .lt('created_at', twoDaysAgo);

    if (error) throw error;

    // Group by user
    const byUser = new Map<string, { count: number; firstName: string }>();
    for (const item of oldItems || []) {
      const u = item.user_id as string;
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      const existing = byUser.get(u);
      if (existing) {
        existing.count += 1;
      } else {
        byUser.set(u, { count: 1, firstName: product?.name || 'an item' });
      }
    }

    let sent = 0;
    let skipped = 0;

    for (const [userId, info] of byUser) {
      // Skip if reminded in last 24h
      const { data: recent } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'cart_reminder')
        .gte('created_at', oneDayAgo)
        .limit(1);

      if (recent && recent.length > 0) {
        skipped++;
        continue;
      }

      const title = '🛒 Items waiting in your cart';
      const body = info.count === 1
        ? `Don't forget about "${info.firstName}" in your cart!`
        : `You have ${info.count} items waiting in your cart. Complete your order now!`;

      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: userId,
            notification: {
              title,
              body,
              tag: 'cart-reminder',
              data: { type: 'cart_reminder', url: '/cart' },
            },
          },
        });
        sent++;
      } catch (e) {
        console.error('Failed to send to', userId, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, skipped, total_users: byUser.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('cart-reminder error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
