import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import shodelLogo from "@/assets/shodel-logo.png";
import SEO from "@/components/SEO";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    (async () => {
      try {
        // PKCE flow: Supabase sends ?code=... to the redirect URL.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorDesc = url.searchParams.get("error_description") || url.hash.includes("error");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (error) {
            setInvalid(true);
          } else {
            url.searchParams.delete("code");
            url.searchParams.delete("type");
            window.history.replaceState({}, "", url.pathname + url.hash);
            setReady(true);
          }
          return;
        }

        if (errorDesc) {
          setInvalid(true);
          return;
        }

        // Legacy hash-based recovery token — Supabase parses it automatically.
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setReady(true);
        } else {
          // Give the client a brief moment to parse the hash before declaring invalid.
          setTimeout(async () => {
            if (cancelled) return;
            const { data: d2 } = await supabase.auth.getSession();
            if (!d2.session && !cancelled) setInvalid(true);
          }, 1500);
        }
      } catch {
        if (!cancelled) setInvalid(true);
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Please re-enter your new password.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated", description: "You're signed in with your new password." });
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Couldn't update password",
        description: err.message || "The reset link may have expired. Try requesting a new one.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-6 py-12">
      <SEO title="Reset Password | Jayee Express" description="Set a new password for your Jayee Express account." canonicalPath="/reset-password" noindex />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <button
          onClick={() => navigate("/auth")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </button>

        <img src={shodelLogo} alt="Jayee Express" className="h-12 w-auto mb-8" />

        <h2 className="text-3xl font-bold text-foreground mb-2">Set a new password</h2>
        <p className="text-muted-foreground mb-8">Choose a strong password you haven't used before.</p>

        {invalid && !ready ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              This reset link is invalid or has expired. Open the link in the same browser you requested it from, or request a new one.
            </div>

            <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/auth")}>
              Request a new link
            </Button>
          </div>
        ) : !ready ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying reset link...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="password">New password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
