import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { Button, Input } from "../components/UI";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (pass !== confirm) {
      setErr("As senhas não conferem.");
      return;
    }
    if (!agree) {
      setErr("Você precisa aceitar os Termos de Serviço e a Política de Privacidade.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { display_name: name } },
    });
    setLoading(false);

    if (error) setErr(error.message);
    else {
      // Se confirmação por e-mail estiver ativa, ele pedirá verificação.
      nav("/login");
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Create Account</h2>
        </div>

        <div>
          <label className="block text-sm mb-2">Full Name</label>
          <Input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
          <label className="block text-sm mb-2">Password</label>
          <Input
            type="password"
            placeholder="Please Enter Your Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-2">Password</label>
          <Input
            type="password"
            placeholder="Please Enter Your Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <label className="flex gap-3 items-start text-sm">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I agree with the <b>Terms of Service</b> and <b>Privacy policy</b>
          </span>
        </label>

        <Button disabled={loading}>{loading ? "Criando..." : "Create Account"}</Button>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <p className="text-sm text-center opacity-80">
          Já tem conta?{" "}
          <Link to="/login" className="text-red-400 hover:text-red-300 underline-offset-2 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
