import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function AdminRequests() {
  const nav = useNavigate();
  const [role, setRole] = useState(null); // 'admin' | outro
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) { nav("/login"); return; }
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      const r = prof?.role ?? "user";
      setRole(r);
      if (r !== "admin") { nav("/home"); return; }

      await load();
    })();
  }, [nav]);

  async function load() {
    setErr(""); setMsg("");
    const { data, error } = await supabase
      .from("owner_requests")
      .select("id, user_id, note, status, created_at")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setList(data || []);
  }

  async function approve(req) {
    setErr(""); setMsg("");
    // 1) marca approved
    const { error: e1 } = await supabase
      .from("owner_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", req.id);
    if (e1) return setErr(e1.message);

    // 2) (se não usou o trigger) promove perfil
    const { error: e2 } = await supabase
      .from("profiles")
      .update({ role: "owner", updated_at: new Date().toISOString() })
      .eq("id", req.user_id);
    if (e2) return setErr(e2.message);

    setMsg("Solicitação aprovada!");
    load();
  }

  async function reject(req) {
    setErr(""); setMsg("");
    const { error } = await supabase
      .from("owner_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", req.id);
    if (error) return setErr(error.message);
    setMsg("Solicitação rejeitada.");
    load();
  }

  if (role === null) return null;

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <button onClick={() => nav(-1)} className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20">← Voltar</button>
      <h1 className="text-xl font-bold mt-4 mb-2">Solicitações de Proprietário</h1>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {msg && <p className="text-green-400 text-sm">{msg}</p>}

      <div className="space-y-3 mt-4">
        {list.length === 0 && <p className="opacity-80">Nenhuma solicitação.</p>}
        {list.map((r) => (
          <div key={r.id} className="rounded-2xl p-4 bg-white/5">
            <p className="text-sm opacity-70">Criado em: {new Date(r.created_at).toLocaleString()}</p>
            <p className="mt-1"><b>Usuário:</b> {r.user_id}</p>
            <p className="mt-1"><b>Status:</b> {r.status}</p>
            {r.note && <p className="mt-2 text-sm opacity-90"><b>Nota:</b> {r.note}</p>}

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => approve(r)}
                className="rounded-full px-3 py-2 bg-green-600/80 hover:bg-green-600 disabled:opacity-50"
                disabled={r.status !== "pending"}
              >
                Aprovar
              </button>
              <button
                onClick={() => reject(r)}
                className="rounded-full px-3 py-2 bg-red-600/80 hover:bg-red-600 disabled:opacity-50"
                disabled={r.status !== "pending"}
              >
                Rejeitar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
