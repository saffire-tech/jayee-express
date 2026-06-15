import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Wallet, ArrowDownToLine } from "lucide-react";
import WithdrawDialog from "./WithdrawDialog";
import TransactionHistory from "./TransactionHistory";

interface WalletCardProps {
  /** 'seller' reads MoMo from stores, 'delivery' reads from profiles */
  role: "seller" | "delivery";
  storeId?: string;
}

const WalletCard = ({ role, storeId }: WalletCardProps) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [cleared, setCleared] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [destination, setDestination] = useState<{ label: string; detail: string } | null>(null);

  const fetchWallet = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: walletData }, { data: clearedData }] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("wallet_cleared_balance", { _user_id: user.id }),
    ]);
    setBalance(walletData?.balance ?? 0);
    setCleared(Number(clearedData) || 0);
    setLoading(false);
  };

  const fetchDestination = async () => {
    if (!user) return;
    let row: any = null;
    if (role === "seller" && storeId) {
      const { data } = await supabase.rpc("get_my_store_payout", { _store_id: storeId });
      row = Array.isArray(data) ? data[0] : data;
    } else {
      const { data } = await supabase.rpc("get_my_momo");
      row = Array.isArray(data) ? data[0] : data;
    }
    if (!row) return;
    if (row.payout_method === "momo" && row.momo_number && row.momo_provider) {
      setDestination({ label: row.momo_provider, detail: row.momo_number });
    } else if (row.payout_method === "bank" && row.bank_account_number && row.bank_name) {
      setDestination({ label: row.bank_name, detail: `${row.bank_account_number} (${row.bank_account_name || ""})` });
    } else if (row.momo_number && row.momo_provider) {
      // legacy: MoMo saved before payout_method existed
      setDestination({ label: row.momo_provider, detail: row.momo_number });
    }
  };

  useEffect(() => {
    fetchWallet();
    fetchDestination();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, storeId]);

  const total = Number(balance || 0);
  const available = Number(cleared || 0);
  const pending = Math.max(total - available, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Wallet Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Available to withdraw</p>
                  <p className="text-3xl font-bold text-primary">
                    ₵{available.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Button
                  onClick={() => setShowWithdraw(true)}
                  disabled={available <= 0 || !destination}
                  className="gap-2"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Withdraw
                </Button>
              </div>
              {pending > 0 && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">₵{pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="text-muted-foreground"> pending — released when the buyer confirms delivery.</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Total balance: ₵{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
          {!destination && !loading && (
            <p className="text-sm text-destructive mt-2">
              Set up your payout method in Settings to enable withdrawals.
            </p>
          )}
        </CardContent>
      </Card>

      <TransactionHistory />

      {showWithdraw && destination && (
        <WithdrawDialog
          open={showWithdraw}
          onOpenChange={setShowWithdraw}
          balance={available}
          destinationLabel={destination.label}
          destinationDetail={destination.detail}
          onSuccess={fetchWallet}
        />
      )}
    </div>
  );
};

export default WalletCard;

