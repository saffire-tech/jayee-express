import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paystackStatus, verifyPaystackSignature } from "../_shared/paystack.ts";
import { finalizeSuccessfulPayment, markAttemptFailed } from "../_shared/payment-finalize.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  try {
    const raw = await req.text();
    if (!(await verifyPaystackSignature(raw, req.headers.get("x-paystack-signature")))) {
      return json({ error: "Invalid signature" }, 401);
    }
    const event = JSON.parse(raw);
    const reference: string | undefined = event?.data?.reference;
    if (!reference || !String(event?.event || "").startsWith("charge.")) return json({ received: true });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: attempt } = await supabase.from("payment_attempts").select("*").eq("reference", reference).maybeSingle();
    if (!attempt || attempt.status === "success") return json({ received: true });

    // Re-check with Paystack rather than trusting the body.
    const result = await paystackStatus(reference);
    if (result.status === "success") {
      await finalizeSuccessfulPayment(supabase, attempt, result.amount ?? Number(attempt.amount));
    } else if (result.status === "failed") {
      await markAttemptFailed(supabase, attempt, "failed", result.message || "Payment failed");
    }
    return json({ received: true, status: result.status });
  } catch (e) {
    console.error("paystack webhook error:", e);
    return json({ received: true });
  }
});
