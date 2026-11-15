import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { GraduationCap, LogIn, UserPlus } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { clearOfflineAccount, getOfflineAccount, saveOfflineAccount, type OfflineAccount } from "./lib/offline";

type Props = { children: ReactNode };

export default function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [offlineAccount, setOfflineAccount] = useState<OfflineAccount | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const loadSession = async () => {
      try {
        const { data } = await client.auth.getSession();
        if (!active) return;
        if (data.session) {
          setSession(data.session);
          const account = { id: data.session.user.id, email: data.session.user.email || "", full_name: String(data.session.user.user_metadata?.full_name || "") };
          setOfflineAccount(account); await saveOfflineAccount(account);
        } else if (!navigator.onLine) {
          setOfflineAccount(await getOfflineAccount());
        }
      } catch {
        if (active) setOfflineAccount(await getOfflineAccount());
      } finally {
        if (active) setCheckingSession(false);
      }
    };
    loadSession();
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        const account = { id: nextSession.user.id, email: nextSession.user.email || "", full_name: String(nextSession.user.user_metadata?.full_name || "") };
        setOfflineAccount(account);
        saveOfflineAccount(account).catch(() => {});
      } else if (navigator.onLine) {
        setOfflineAccount(null);
      }
      setCheckingSession(false);
    });
    const offline = () => {
      if (!session) getOfflineAccount().then(setOfflineAccount).catch(() => {});
    };
    window.addEventListener("offline", offline);
    return () => { active = false; window.removeEventListener("offline", offline); data.subscription.unsubscribe(); };
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
          const account = { id: data.session.user.id, email: data.session.user.email || "", full_name: fullName.trim() };
          setOfflineAccount(account); await saveOfflineAccount(account);
          setMessage("Your account is ready. Welcome to FuturePath!");
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        if (data.session) {
          const account = { id: data.session.user.id, email: data.session.user.email || "", full_name: String(data.session.user.user_metadata?.full_name || "") };
          setOfflineAccount(account); await saveOfflineAccount(account);
        }
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

  if (checkingSession && isSupabaseConfigured) {
    return <main className="auth-screen"><div className="auth-loading">Preparing your learning space...</div></main>;
  }

  if (session || !navigator.onLine) {
    return <div className="authenticated-app">
      <div className="account-strip">
        <span>{session ? "Signed in as" : "Offline access for"} <strong>{session?.user.email || offlineAccount?.email}</strong></span>
        <button onClick={async () => { await clearOfflineAccount(); setOfflineAccount(null); await supabase?.auth.signOut(); }}>Sign out</button>
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
