import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "confirm" | "already" | "invalid" | "done" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_ANON },
        });
        const data = await res.json();
        if (!res.ok) { setState("invalid"); return; }
        if (data.valid) setState("confirm");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      if ((data as any)?.success) setState("done");
      else if ((data as any)?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch { setState("error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md rounded-2xl border p-8 shadow-sm bg-card">
        <h1 className="text-2xl font-bold mb-3">Unsubscribe from emails</h1>
        {state === "loading" && (
          <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin h-4 w-4" /> Verifying your request…</p>
        )}
        {state === "confirm" && (
          <>
            <p className="text-muted-foreground mb-6">Click below to stop receiving app emails from Jayee Express. You'll still see important account and order updates in the app.</p>
            <Button onClick={confirm} disabled={submitting} className="w-full">
              {submitting ? "Unsubscribing…" : "Confirm Unsubscribe"}
            </Button>
          </>
        )}
        {state === "already" && <p className="text-muted-foreground">This email is already unsubscribed. No further action needed.</p>}
        {state === "done" && <p className="text-green-600 font-medium">You've been unsubscribed. Sorry to see you go!</p>}
        {state === "invalid" && <p className="text-destructive">This unsubscribe link is invalid or has expired.</p>}
        {state === "error" && <p className="text-destructive">Something went wrong. Please try again later.</p>}
      </div>
    </div>
  );
}
