import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const { device_hash, user_agent } = await req.json();
    if (!device_hash || typeof device_hash !== "string") {
      return new Response(JSON.stringify({ error: "device_hash required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Check if device known
    const { data: existing } = await admin
      .from("user_known_devices")
      .select("id")
      .eq("user_id", user.id)
      .eq("device_hash", device_hash)
      .maybeSingle();

    if (existing) {
      await admin
        .from("user_known_devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", existing.id);
      return new Response(JSON.stringify({ known: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // New device — record + email
    await admin.from("user_known_devices").insert({
      user_id: user.id,
      device_hash,
      user_agent: user_agent || req.headers.get("user-agent") || null,
      ip,
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && user.email) {
      const when = new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" });
      const ua = user_agent || req.headers.get("user-agent") || "Unknown device";
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111">
          <h2 style="color:#f97316">New sign-in to your Jayee Express account</h2>
          <p>Hi${user.user_metadata?.full_name ? ` ${user.user_metadata.full_name}` : ""},</p>
          <p>We noticed a sign-in from a device we haven't seen before:</p>
          <div style="background:#f6f6f6;border-radius:8px;padding:14px;margin:16px 0;font-size:14px;line-height:1.5">
            <div><strong>Device:</strong> ${ua}</div>
            <div><strong>IP:</strong> ${ip}</div>
            <div><strong>When:</strong> ${when} (Accra time)</div>
          </div>
          <p>If this was you, no action is needed.</p>
          <p>If you don't recognise this activity, change your password immediately and review your account.</p>
          <p style="margin-top:24px;color:#666;font-size:12px">— Jayee Express Security</p>
        </div>`;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Jayee Express <noreply@jayeeexpress.com>",
            to: [user.email],
            subject: "New device signed into your Jayee Express account",
            html,
          }),
        });
      } catch (e) {
        console.error("resend error", e);
      }
    }

    return new Response(JSON.stringify({ known: false, notified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-new-device error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
