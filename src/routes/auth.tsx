import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, GraduationCap } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · Scholar — Student Assistance Chatbot" },
      { name: "description", content: "Sign in or create your Scholar account to chat with your AI student assistant." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/chat` },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
      navigate({ to: "/chat" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden md:flex relative overflow-hidden bg-gradient-hero text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <GraduationCap className="size-6" />
          Scholar
        </Link>
        <div className="relative z-10">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Your campus,<br /> one conversation away.
          </h1>
          <p className="mt-4 text-primary-foreground/85 max-w-md">
            Instant answers about courses, exams, attendance, fees, hostel life,
            placements and more — anytime you need them.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-primary-foreground/85">
            <li>• 24/7 study help & syllabus lookup</li>
            <li>• Attendance, results & fees guidance</li>
            <li>• Scholarships, placements & library info</li>
          </ul>
        </div>
        <div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-10 top-16 size-48 rounded-full bg-accent/30 blur-2xl animate-float" />
        <p className="relative z-10 text-xs text-primary-foreground/70">
          Built for students, by an AI that listens.
        </p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="md:hidden flex items-center gap-2 font-semibold mb-8">
            <img src={logo} alt="" width={32} height={32} className="size-8" />
            Scholar
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to continue your conversation."
              : "Join in seconds — no credit card, no fluff."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@campus.edu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 text-base shadow-glow">
              {loading ? <Loader2 className="size-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            {mode === "signin" ? "New to Scholar?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}