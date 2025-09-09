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
            <SubtleLink href="#" onClick={(e) => e.preventDefault()}>
              Forgot Password
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
