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

  // Status endpoint shape discovery
  await probe("status_idtype1", "https://api.moolre.com/open/transact/status", {
    type: 1, idtype: 1, id: "probe-nonexistent-123", accountnumber: acct,
  });
  await probe("status_idtype2", "https://api.moolre.com/open/transact/status", {
    type: 1, idtype: 2, id: "probe-nonexistent-123", accountnumber: acct,
  });

  // Channel enumeration (invalid channel -> expect list of options)
  await probe("payin_badchannel", "https://api.moolre.com/open/transact/payment", {
    type: 1, channel: 999, currency: "GHS", payer: "0200000000", amount: "1",
    accountnumber: acct, reference: "probe", externalref: "probe-" + Date.now(),
  });

  // Missing-field discovery with a valid amount but no channel
  await probe("payin_nochannel", "https://api.moolre.com/open/transact/payment", {
    type: 1, currency: "GHS", payer: "0200000000", amount: "1",
    accountnumber: acct, reference: "probe", externalref: "probe-" + Date.now(),
  });

  return new Response(
    JSON.stringify({ configured: { user: !!user, pub: !!pub, priv: !!priv, acct: !!acct }, results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
