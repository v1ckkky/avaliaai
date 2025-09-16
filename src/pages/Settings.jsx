import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [role, setRole] = useState("user");
  const [requestStatus, setRequestStatus] = useState(null); // pending/approved/rejected/null
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUser(u?.user || null);
      if (!u?.user) return;

      setEmail(u.user.email || "");

      // carrega/garante profile
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (!prof) {
        await supabase.from("profiles").insert({ id: u.user.id, display_name: "", role: "user" });
        setRole("user");
      } else {
        setDisplayName(prof.display_name || "");
        setRole(prof.role || "user");
      }

      // status de solicitação (se existir)
      const { data: req } = await supabase
        .from("owner_requests")
        .select("status").eq("user_id", u.user.id).order("created_at",{ascending:false}).limit(1);
      setRequestStatus(req?.[0]?.status ?? null);
    })();
  }, []);

async function saveProfile(e) {
  e.preventDefault();
  setErr("");
  setMsg("");

  // busca usuário logado
  const { data: u, error: userError } = await supabase.auth.getUser();
  if (userError || !u?.user) {
    return setErr("Usuário não autenticado.");
  }

  // faz o upsert no perfil
  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: u.user.id, // <- ID do usuário autenticado
      display_name: displayName,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return setErr(error.message);
  }

  setMsg("Nome atualizado!");
}


  async function changePassword(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!newPassword || newPassword.length < 6) return setErr("Senha mínima de 6 caracteres.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return setErr(error.message);
    setNewPassword("");
    setMsg("Senha alterada!");
  }

  async function changeEmail(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!email) return setErr("Informe um e-mail válido.");
    const { error } = await supabase.auth.updateUser({ email });
    if (error) return setErr(error.message);
    setMsg("E-mail atualizado! (pode exigir confirmação dependendo das configurações)");
  }

  async function requestOwner(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!user) return;
    const { error } = await supabase.from("owner_requests").insert({ user_id: user.id, note });
    if (error) return setErr(error.message);
    setRequestStatus("pending");
    setMsg("Solicitação enviada! Aguarde aprovação do administrador.");
  }

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      <button onClick={() => nav(-1)} className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20">← Voltar</button>

      <div className="rounded-2xl p-5 bg-white/5 space-y-4">
        <h1 className="text-xl font-bold">Configurações da Conta</h1>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {msg && <p className="text-green-400 text-sm">{msg}</p>}

        <form onSubmit={saveProfile} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Nome público</label>
            <input className="w-full rounded-xl px-3 py-3 bg-neutral-100 text-neutral-900 outline-none"
              value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Seu nome" />
          </div>
          <button className="rounded-full px-4 py-2 bg-white/10 hover:bg-white/20">Salvar nome</button>
        </form>

        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Nova senha</label>
            <input type="password" className="w-full rounded-xl px-3 py-3 bg-neutral-100 text-neutral-900 outline-none"
              value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="Mín. 6 caracteres" />
          </div>
          <button className="rounded-full px-4 py-2 bg-white/10 hover:bg-white/20">Alterar senha</button>
        </form>

        <form onSubmit={changeEmail} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">E-mail</label>
            <input type="email" className="w-full rounded-xl px-3 py-3 bg-neutral-100 text-neutral-900 outline-none"
              value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>
          <button className="rounded-full px-4 py-2 bg-white/10 hover:bg-white/20">Atualizar e-mail</button>
        </form>
      </div>

      <div className="rounded-2xl p-5 bg-white/5 space-y-3">
        <h2 className="font-semibold">Conta de Proprietário</h2>
        <p className="text-sm opacity-80">Status atual: <b>{role}</b>{role==='user' && (requestStatus ? ` • solicitação: ${requestStatus}` : "")}</p>

        {role === "user" && requestStatus !== "pending" && (
          <form onSubmit={requestOwner} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Por que você precisa ser proprietário?</label>
              <textarea className="w-full rounded-xl px-3 py-3 bg-neutral-100 text-neutral-900 outline-none"
                rows={3} value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Ex.: Sou responsável pelos eventos do Clube X..." />
            </div>
            <button className="rounded-full px-4 py-2 bg-white/10 hover:bg-white/20">Solicitar acesso</button>
          </form>
        )}

        {requestStatus === "pending" && <p className="text-sm">Sua solicitação está pendente de aprovação.</p>}
        {role !== "user" && <p className="text-sm">Você já pode criar eventos ao vivo.</p>}
      </div>
    </div>
  );
}
