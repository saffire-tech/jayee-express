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
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [momoDetails, setMomoDetails] = useState<{ momo_number: string; momo_provider: string } | null>(null);

  const fetchWallet = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    setBalance(data?.balance ?? 0);
    setLoading(false);
  };

  const fetchMomoDetails = async () => {
    if (!user) return;
    if (role === "seller" && storeId) {
      const { data } = await supabase.rpc("get_my_store_payout", { _store_id: storeId });
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.momo_number && row?.momo_provider) {
        setMomoDetails({ momo_number: row.momo_number, momo_provider: row.momo_provider });
      }
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("momo_number, momo_provider")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.momo_number && data?.momo_provider) {
        setMomoDetails({ momo_number: data.momo_number, momo_provider: data.momo_provider });
      }
    }
  };


  useEffect(() => {
    fetchWallet();
    fetchMomoDetails();
  }, [user, storeId]);

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
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold text-primary">
                ₵{Number(balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <Button
                onClick={() => setShowWithdraw(true)}
                disabled={!balance || balance <= 0 || !momoDetails}
                className="gap-2"
              >
                <ArrowDownToLine className="h-4 w-4" />
                Withdraw
              </Button>
            </div>
          )}
          {!momoDetails && !loading && (
            <p className="text-sm text-destructive mt-2">
              Set up your MoMo details in Settings to enable withdrawals.
            </p>
          )}
        </CardContent>
      </Card>

      <TransactionHistory />

      {showWithdraw && momoDetails && (
        <WithdrawDialog
          open={showWithdraw}
          onOpenChange={setShowWithdraw}
          balance={balance || 0}
          momoNumber={momoDetails.momo_number}
          momoProvider={momoDetails.momo_provider}
          onSuccess={fetchWallet}
        />
      )}
    </div>
  );
};

export default WalletCard;
