import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        // transforma o code (hash do link do e-mail) em sessão válida
        if (window.location.hash) {
          await supabase.auth.exchangeCodeForSession(window.location.hash);
        }
      } catch (err) {
        setMsg("Link inválido ou expirado. Peça um novo e-mail de recuperação.");
      } finally {
        setReady(true);
      }
    };
    run();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setMsg("");
    if (password.length < 6) return setMsg("A senha deve ter pelo menos 6 caracteres.");
    if (password !== confirm) return setMsg("As senhas não coincidem.");

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) setMsg(error.message);
    else setMsg("Senha alterada com sucesso! Você já pode fazer login.");
  }

  if (!ready) return <p className="p-4 text-center">Carregando…</p>;

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Definir nova senha</h1>
      <form onSubmit={handleSave} className="space-y-3">
        <input
          type="password"
          placeholder="Nova senha"
          className="w-full border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="Confirmar nova senha"
          className="w-full border rounded px-3 py-2"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded px-4 py-2 bg-red-600 text-white"
        >
          {saving ? "Salvando..." : "Salvar nova senha"}
        </button>
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </form>
    </div>
  );
}
