import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const MOMO_NETWORKS = [
  { value: "13", label: "MTN Mobile Money" },
  { value: "6", label: "Telecel Cash" },
  { value: "7", label: "AirtelTigo Money" },
];

type Stage = "form" | "paying" | "waiting" | "success" | "failed";

let paystackLoader: Promise<void> | null = null;
const loadPaystack = () => {
  if ((window as any).PaystackPop) return Promise.resolve();
  paystackLoader ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://js.paystack.co/v2/inline.js";
    el.onload = () => resolve();
    el.onerror = () => { paystackLoader = null; reject(new Error("Could not load Paystack. Check your connection.")); };
    document.body.appendChild(el);
  });
  return paystackLoader;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Amount in cedis, shown to the payer. */
  amount: number;
  title?: string;
  description?: string;
  /** Edge function that starts the charge. */
  functionName: string;
  /** Extra fields the edge function needs (items, store_id, months...). */
  body?: Record<string, unknown>;
  onSuccess?: () => void;
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 45; // ~3 minutes

const MoMoPaymentDialog = ({
  open,
  onOpenChange,
  amount,
  title = "Complete payment",
  description,
  functionName,
  body,
  onSuccess,
}: Props) => {
  const [stage, setStage] = useState<Stage>("form");
  const [reference, setReference] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);
  const pollCount = useRef(0);

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setStage("form");
      setReference(null);
      setStatusMessage("");
      setBusy(false);
      pollCount.current = 0;
    }
  }, [open]);

  const startPolling = (ref: string) => {
    pollCount.current = 0;
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        stopPolling();
        setStage("failed");
        setStatusMessage(
          "We didn't get a confirmation in time. If money left your account, it will be confirmed automatically within a few minutes."
        );
        return;
      }
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { reference: ref },
      });
      if (error) return; // transient — keep polling
      if (data?.verified) {
        stopPolling();
        setStage("success");
        setStatusMessage("Payment received.");
        onSuccess?.();
      } else if (data?.status && data.status !== "pending") {
        stopPolling();
        setStage("failed");
        setStatusMessage(data.message || "Payment was not completed. You were not charged.");
      }
    }, POLL_INTERVAL_MS);
  };

  const startPayment = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body: body || {} });
      if (error) throw new Error(error.message || "Could not start the payment");
      if (data?.error) throw new Error(data.error);
      const ref = data.reference as string;
      setReference(ref);
      await loadPaystack();
      const popup = new (window as any).PaystackPop();
      // Hide our dialog while Paystack's window is on screen.
      setStage("paying");
      popup.resumeTransaction(data.access_code, {
        onSuccess: () => {
          setStage("waiting");
          setStatusMessage("Confirming your payment...");
          startPolling(ref);
        },
        onCancel: () => {
          setStage("form");
          toast.message("Payment cancelled. You were not charged.");
        },
        onError: (err: any) => {
          setStage("failed");
          setStatusMessage(err?.message || "Payment could not be completed.");
        },
      });
    } catch (e: any) {
      toast.error(e.message || "Payment could not be started");
      setStage("form");
      setReference(null);
    } finally {
      setBusy(false);
    }
  };


  return (
    <Dialog open={open && stage !== "paying"} onOpenChange={(v) => (stage === "waiting" ? null : onOpenChange(v))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description || `You are paying ₵${Number(amount || 0).toFixed(2)}.`}
          </DialogDescription>
        </DialogHeader>

        {stage === "form" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pay securely with Mobile Money or card through Paystack.
            </p>
            <Button className="w-full" variant="hero" disabled={busy} onClick={() => startPayment()}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pay ₵{Number(amount || 0).toFixed(2)}
            </Button>
          </div>
        )}

        {stage === "waiting" && (
          <div className="py-6 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="font-medium">Confirming payment</p>
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
            <p className="text-xs text-muted-foreground">
              Keep this window open until the payment is confirmed.
            </p>
          </div>
        )}


        {stage === "success" && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
            <p className="font-medium">Payment received</p>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        )}

        {stage === "failed" && (
          <div className="py-6 text-center space-y-3">
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
            <Button className="w-full" variant="outline" onClick={() => setStage("form")}>
              Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MoMoPaymentDialog;
