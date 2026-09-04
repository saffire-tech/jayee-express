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

  // 1. Status endpoint (harmless, tells us if auth works)
  await probe("status", "https://api.moolre.com/open/transact/status", {
    type: 1,
    accountnumber: acct,
    externalref: "probe-" + Date.now(),
  });

  // 2. Payin / direct MoMo debit — deliberately invalid payer so nothing is charged
  await probe("payin", "https://api.moolre.com/open/transact/payment", {
    type: 1,
    channel: 13,
    currency: "GHS",
    payer: "0000000000",
    amount: "0.01",
    accountnumber: acct,
    reference: "probe",
    externalref: "probe-" + Date.now(),
  });

  // 3. Hosted checkout / payment link variants
  await probe("checkout", "https://api.moolre.com/open/transact/checkout", {
    type: 1,
    currency: "GHS",
    amount: "0.01",
    accountnumber: acct,
    reference: "probe",
    externalref: "probe-" + Date.now(),
    redirecturl: "https://jayeeexpress.com/purchases",
  });

  await probe("paymentlink", "https://api.moolre.com/open/transact/paymentlink", {
    type: 1,
    currency: "GHS",
    amount: "0.01",
    accountnumber: acct,
    externalref: "probe-" + Date.now(),
  });

  return new Response(
    JSON.stringify({ configured: { user: !!user, pub: !!pub, priv: !!priv, acct: !!acct }, results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
