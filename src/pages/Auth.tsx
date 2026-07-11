import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock, User, ArrowLeft, Loader2 } from "lucide-react";
import shodelLogo from "@/assets/shodel-logo-white.png";
import SEO from "@/components/SEO";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

const AppleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M16.365 1.43c0 1.14-.49 2.27-1.27 3.08-.85.88-2.24 1.56-3.39 1.47-.13-1.12.41-2.29 1.18-3.09.86-.9 2.35-1.58 3.48-1.46zM20.5 17.27c-.57 1.32-.85 1.91-1.59 3.07-1.04 1.62-2.5 3.64-4.31 3.66-1.61.01-2.02-1.04-4.2-1.03-2.18.01-2.63 1.05-4.24 1.04-1.81-.02-3.2-1.84-4.24-3.46-2.9-4.52-3.2-9.83-1.41-12.66 1.27-2.01 3.27-3.19 5.15-3.19 1.91 0 3.11 1.05 4.69 1.05 1.53 0 2.46-1.05 4.67-1.05 1.67 0 3.45.91 4.71 2.48-4.14 2.27-3.46 8.18.77 10.09z" />
  </svg>
);

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Support ?next=/some/path so OAuth consent (and other guarded flows) can
  // send the user back to the original URL after sign-in / sign-up.
  const nextParam = (() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("next");
      if (!raw) return null;
      // Only accept same-origin relative paths.
      if (!raw.startsWith("/") || raw.startsWith("//")) return null;
      return raw;
    } catch {
      return null;
    }
  })();
  const goNext = () => navigate(nextParam ?? "/");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName);
      }
      goNext();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setError("");
    setOauthLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: nextParam
          ? `${window.location.origin}/auth?next=${encodeURIComponent(nextParam)}`
          : window.location.origin,
      });
      if (result.error) {
        setError(result.error.message || `Could not sign in with ${provider}`);
        setOauthLoading(null);
        return;
      }
      if (result.redirected) return;
      goNext();
    } catch (err: any) {
      setError(err.message || `Could not sign in with ${provider}`);
      setOauthLoading(null);
    }
  };


  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "Check your email",
        description: "If an account exists, we've sent a password reset link.",
      });
      setShowForgot(false);
      setForgotEmail("");
    } catch (err: any) {
      toast({
        title: "Couldn't send reset email",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <SEO
        title="Sign In or Create Account | Jayee Express"
        description="Sign in or create your free Jayee Express account to shop with local sellers and set up your store."
        canonicalPath="/auth"
        noindex
      />
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </button>

          <img src={shodelLogo} alt="Jayee Express" className="h-12 w-auto mb-8" />

          {showForgot ? (
            <>
              <h2 className="text-3xl font-bold text-foreground mb-2">Reset your password</h2>
              <p className="text-muted-foreground mb-8">
                Enter your email and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <Label htmlFor="forgotEmail">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="forgotEmail"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={forgotLoading}>
                  {forgotLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Send reset link
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to sign in
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-muted-foreground mb-8">
                {isLogin
                  ? "Sign in to access your account and continue shopping"
                  : "Join Jayee Express and start buying or selling in your community"}
              </p>

              {error && (
                <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Social sign-in */}
              <div className="space-y-3 mb-6">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => handleOAuth("google")}
                  disabled={oauthLoading !== null || loading}
                >
                  {oauthLoading === "google" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <span className="mr-2"><GoogleIcon /></span>
                  )}
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => handleOAuth("apple")}
                  disabled={oauthLoading !== null || loading}
                >
                  {oauthLoading === "apple" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <span className="mr-2"><AppleIcon /></span>
                  )}
                  Continue with Apple
                </Button>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="pl-10"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setShowForgot(true);
                        }}
                        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground leading-relaxed">
                By continuing, you agree to our{" "}
                <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
              </p>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>

            </>
          )}
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden lg:flex flex-1 gradient-primary items-center justify-center p-12">
        <div className="max-w-md text-center text-primary-foreground">
          <h3 className="text-3xl font-bold mb-4">Connect to Commerce</h3>
          <p className="text-lg opacity-90">
            Join thousands of students buying and selling on campus. Your next customer or your next purchase is just a click away.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
