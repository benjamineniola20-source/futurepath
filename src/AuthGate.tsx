import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { GraduationCap, LogIn, UserPlus } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Props = { children: ReactNode };

export default function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Your account has been created. Check your email for the confirmation link, then sign in.");
        } else {
          setMessage("Your account is ready. Welcome to FuturePath!");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (session) {
    return <div className="authenticated-app">
      <div className="account-strip">
        <span>Signed in as <strong>{session.user.email}</strong></span>
        <button onClick={() => supabase?.auth.signOut()}>Sign out</button>
      </div>
      {children}
    </div>;
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><div className="auth-brand-mark"><GraduationCap size={25}/></div><span>Future<span>Path</span></span></div>
      <div className="auth-eyebrow">YOUR LEARNING JOURNEY STARTS HERE</div>
      <h1>{mode === "signup" ? "Create your student account" : "Welcome back"}</h1>
      <p className="auth-intro">{mode === "signup" ? "Join FuturePath and prepare for your next big step." : "Sign in to continue your preparation."}</p>
      <div className="auth-tabs">
        <button className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}><UserPlus size={16}/> Create account</button>
        <button className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}><LogIn size={16}/> Sign in</button>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        {mode === "signup" && <label>Full name<input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" required /></label>}
        <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait..." : mode === "signup" ? "Create my account" : "Sign in to FuturePath"}</button>
      </form>
      <p className="auth-footnote">Your account is for your own learning progress. Keep your password private.</p>
    </section>
  </main>;
}
