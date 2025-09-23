import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import EmailVerification from "@/components/EmailVerification";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import CookieConsent from "@/components/CookieConsent";
import { updateSessionPersistence } from "@/lib/auth-persistence";
import { track } from "@/lib/analytics";
import { Seo } from "@/components/Seo";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      // Check if user needs email verification
      const isGoogleUser = user.app_metadata?.provider === "google";
      const isEmailVerified = user.email_confirmed_at !== null;

      if (!isGoogleUser && !isEmailVerified) {
        setShowVerification(true);
      } else {
        navigate("/feed");
      }
    }
  }, [user, navigate]);

  // Initialize remember me from stored preference
  useEffect(() => {
    const storedRememberMe =
      localStorage.getItem("auth-remember-me") === "true";
    setRememberMe(storedRememberMe);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        setError(error.message);
      } else {
        // Store remember me preference if enabled
        if (rememberMe) {
          updateSessionPersistence(true);
        } else {
          updateSessionPersistence(false);
        }

        // Track successful login
        const provider = user?.app_metadata?.provider;
        if (provider === "google" || provider === "linkedin") {
          track("signup_complete", { method: provider });
        }

        toast({
          title: "Welcome back 👋",
          description: "You've been signed in successfully.",
        });
        navigate("/feed");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email: registerEmail,
        password: registerPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: registerName,
          },
        },
      });

      if (error) {
        setError(error.message);
      } else {
        // Track successful email signup
        track("signup_complete", { method: "email" });

        toast({
          title: "Account created successfully",
          description: "Please check your email to verify your account.",
        });
        setShowVerification(true);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Register error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        toast({
          title: "Check your inbox",
          description: "We've sent you a password reset link.",
        });
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Reset password error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/feed`,
        },
      });

      if (error) {
        if (error.message.includes("provider is not enabled")) {
          setError(
            "Il login con Google non è attualmente disponibile. Prova con LinkedIn o registrati via email.",
          );
        } else {
          setError(error.message);
        }
      } else {
        // Track successful OAuth signup
        track("signup_complete", { method: "google" });
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Google auth error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkedInAuth = async () => {
    setError("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "linkedin_oidc",
        options: {
          scopes: "openid profile email",
          redirectTo: `${window.location.origin}/feed`,
        },
      });

      if (error) {
        if (error.message.includes("provider is not enabled")) {
          setError(
            "Il login con LinkedIn non è attualmente disponibile. Prova con Google o registrati via email.",
          );
        } else {
          setError(error.message);
        }
      } else {
        // Track successful OAuth signup
        track("signup_complete", { method: "linkedin" });
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("LinkedIn auth error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Show verification screen if needed
  if (showVerification) {
    return (
      <EmailVerification
        onVerified={() => {
          setShowVerification(false);
          navigate("/feed");
        }}
      />
    );
  }

  return (
    <>
      <Seo
        title="Sign In to DailyDrops - Personalized Content Discovery"
        description="Join DailyDrops to discover personalized content curated by AI. Sign up with Google, LinkedIn, or email to start your content discovery journey."
        canonical="https://dailydrops.cloud/auth"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "DailyDrops Authentication",
          "description":
            "Sign in or create an account to access personalized content curation",
          "isPartOf": {
            "@type": "WebSite",
            "name": "DailyDrops",
            "url": "https://dailydrops.cloud",
          },
        }}
      />
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">
              Welcome to DailyDrops
            </h1>
            <p className="text-muted-foreground mt-2">
              Your personalized content discovery platform
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="register">Register</TabsTrigger>
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="reset">Reset</TabsTrigger>
            </TabsList>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Create your account</CardTitle>
                  <CardDescription>
                    Get started with DailyDrops today
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <SocialAuthButtons
                    isLoading={isLoading}
                    onGoogleAuth={handleGoogleAuth}
                    onLinkedInAuth={handleLinkedInAuth}
                  />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        or continue with email
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">{error}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="register-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-name"
                          placeholder="John Doe"
                          className="pl-10"
                          value={registerName}
                          onChange={(e) => setRegisterName(e.target.value)}
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="john@example.com"
                          className="pl-10"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type={showRegisterPassword ? "text" : "password"}
                          className="pl-10 pr-10"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          disabled={isLoading}
                          required
                          minLength={6}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-8 w-8"
                          onClick={() =>
                            setShowRegisterPassword(!showRegisterPassword)}
                        >
                          {showRegisterPassword
                            ? <EyeOff className="h-4 w-4" />
                            : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create account
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Sign in to your account</CardTitle>
                  <CardDescription>
                    Enter your email and password to continue
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <SocialAuthButtons
                    isLoading={isLoading}
                    onGoogleAuth={handleGoogleAuth}
                    onLinkedInAuth={handleLinkedInAuth}
                  />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        or continue with email
                      </span>
                    </div>
                  </div>
 <div className="text-center">
                      <p className="text-base text-muted-foreground">
                        Don't have an account?{" "}
                        <Button
                          variant="link"
                          className="p-0 h-auto text-base font-medium text-accent-foreground hover:text-accent-foreground/80"
                          onClick={() => {
                            const tabs = document.querySelector(
                              '[role="tablist"]',
                            );
                            const registerTab = tabs?.querySelector(
                              '[value="register"]',
                            ) as HTMLElement;
                            registerTab?.click();
                          }}
                        >
                          Create one here
                        </Button>
                      </p>
                    </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">{error}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="john@example.com"
                          className="pl-10"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showLoginPassword ? "text" : "password"}
                          className="pl-10 pr-10"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          disabled={isLoading}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-8 w-8"
                          onClick={() =>
                            setShowLoginPassword(!showLoginPassword)}
                        >
                          {showLoginPassword
                            ? <EyeOff className="h-4 w-4" />
                            : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(!!checked)}
                      />
                      <Label
                        htmlFor="remember-me"
                        className="text-sm text-muted-foreground"
                      >
                        Remember me
                      </Label>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Sign in
                    </Button>

                   
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="reset">
              <Card>
                <CardHeader>
                  <CardTitle>Reset your password</CardTitle>
                  <CardDescription>
                    Enter your email to receive a reset link
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleReset} className="space-y-4">
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">{error}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="john@example.com"
                          className="pl-10"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Send reset link
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <CookieConsent />
      </div>
    </>
  );
};

export default Auth;
