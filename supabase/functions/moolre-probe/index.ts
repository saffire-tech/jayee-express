// Temporary diagnostic function: probes which Moolre endpoints this account supports.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = Deno.env.get("MOOLRE_API_USER") ?? "";
  const pub = Deno.env.get("MOOLRE_PUBLIC_KEY") ?? "";
  const priv = Deno.env.get("MOOLRE_PRIVATE_KEY") ?? "";
  const acct = Deno.env.get("MOOLRE_ACCOUNT_NUMBER") ?? "";

  const headers = {
    "Content-Type": "application/json",
    "X-API-USER": user,
    "X-API-PUBKEY": pub,
    "X-API-KEY": priv,
  };

  const results: any[] = [];

  const probe = async (name: string, url: string, body: any, hdrs = headers) => {
    try {
      const res = await fetch(url, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const text = await res.text();
      results.push({ name, url, http: res.status, body: text.slice(0, 600) });
    } catch (e) {
      results.push({ name, url, error: (e as Error).message });
    }
  };

  for (const ch of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]) {
    await probe("channel_" + ch, "https://api.moolre.com/open/transact/payment", {
      type: 1, channel: ch, currency: "GHS", payer: "0200000000",
      accountnumber: acct, reference: "probe", externalref: "probe-" + Date.now(),
    });
  }

  return new Response(
    JSON.stringify({ configured: { user: !!user, pub: !!pub, priv: !!priv, acct: !!acct }, results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
