import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { Button, Input, SubtleLink } from "../components/UI";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    setLoading(false);
    if (error) setErr(error.message);
    else nav("/home");
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setForgotMsg("");
    setErr("");

    if (!email) {
      setForgotMsg("Informe seu e-mail acima para enviar o link de recuperação.");
      return;
    }

    try {
      setSending(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSending(false);

      if (error) setForgotMsg(error.message);
      else setForgotMsg("Enviamos um link de recuperação para o seu e-mail.");
    } catch (ex) {
      setSending(false);
      setForgotMsg("Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Login</h2>
        </div>

        <div>
          <label className="block text-sm mb-2">Email Address</label>
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm">Password</label>
            <SubtleLink href="#" onClick={handleForgotPassword}>
              {sending ? "Enviando..." : "Forgot Password"}
            </SubtleLink>
          </div>
          <Input
            type="password"
            placeholder="Please Enter Your Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
          />
        </div>

        <Button disabled={loading}>{loading ? "Entrando..." : "Login"}</Button>

        {err && <p className="text-sm text-red-400">{err}</p>}
        {forgotMsg && <p className="text-sm mt-1 opacity-90">{forgotMsg}</p>}

        <p className="text-sm text-center opacity-80">
          Don’t have an account?{" "}
          <Link to="/signup" className="text-red-400 hover:text-red-300 underline-offset-2 hover:underline">
            Sign Up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
