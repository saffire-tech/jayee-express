import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
  destinationLabel: string;
  destinationDetail: string;
  onSuccess: () => void;
}

const WithdrawDialog = ({ open, onOpenChange, balance, destinationLabel, destinationDetail, onSuccess }: WithdrawDialogProps) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const MIN_WITHDRAWAL = 20;

  const handleWithdraw = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (numAmount < MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal is ₵${MIN_WITHDRAWAL}`);
      return;
    }
    if (numAmount > balance) {
      toast.error("Amount exceeds your balance");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: { amount: numAmount },
      });
      // Try to extract a server-provided error message even on non-2xx
      let serverMessage: string | null = null;
      if (error) {
        const ctx: any = (error as any).context;
        if (ctx?.json) {
          try { serverMessage = (await ctx.json())?.error ?? null; } catch {}
        }
        if (!serverMessage && ctx?.text) {
          try {
            const t = await ctx.text();
            try { serverMessage = JSON.parse(t)?.error ?? t; } catch { serverMessage = t; }
          } catch {}
        }
        throw new Error(serverMessage || error.message || "Withdrawal failed");
      }
      if (data?.error) throw new Error(data.error);

      toast.success("Withdrawal request submitted! Admin will process your payout shortly.");
      onOpenChange(false);
      setAmount("");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Available Balance</Label>
            <p className="text-2xl font-bold text-primary">
              ₵{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <Label>Withdraw To</Label>
            <p className="text-sm text-muted-foreground">{destinationLabel} — {destinationDetail}</p>
          </div>
          <div>
            <Label htmlFor="amount">Amount (₵)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="1"
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleWithdraw} disabled={loading || !amount}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Withdraw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawDialog;
