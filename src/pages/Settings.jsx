// src/pages/Settings.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const nav = useNavigate();

  // auth/profile
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ display_name: "", role: "user" });
  const [loading, setLoading] = useState(true);

  // feedback global
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // display name
  const [displayName, setDisplayName] = useState("");

  // password & email
  const [newPass, setNewPass] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // owner request (dados extras)
  const [businessName, setBusinessName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [reason, setReason] = useState("");

  // estado da última solicitação
  const [latestReq, setLatestReq] = useState(null); // {id,status,created_at,note}

  // Danger Zone – excluir conta
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const confirmPhrase = "EXCLUIR";

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");
      setErr("");

      const { data: u } = await supabase.auth.getUser();
      const me = u?.user || null;
      setUser(me);

      if (me?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, role")
          .eq("id", me.id)
          .maybeSingle();

        if (prof) {
          setProfile(prof);
          setDisplayName(prof.display_name || "");
        }

        const { data: req } = await supabase
          .from("owner_requests")
          .select("id,status,created_at,note")
          .eq("user_id", me.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (req) setLatestReq(req);
      }

      setLoading(false);
    })();
  }, []);

  // Helpers de mensagem
  function flashOk(t) {
    setMsg(t);
    setErr("");
    setTimeout(() => setMsg(""), 3000);
  }
  function flashErr(t) {
    setErr(t);
    setMsg("");
    setTimeout(() => setErr(""), 4000);
  }

  // Atualiza nome de exibição
  async function saveDisplayName() {
    try {
      if (!user?.id) throw new Error("Faça login.");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: displayName });
      if (error) throw error;
      flashOk("Nome atualizado!");
    } catch (e) {
      flashErr(e.message || String(e));
    }
  }

  // Atualiza senha
  async function changePassword() {
    try {
      if (!newPass || newPass.length < 6) {
        throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      }
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      setNewPass("");
      flashOk("Senha alterada com sucesso.");
    } catch (e) {
      flashErr(e.message || String(e));
    }
  }

  // Atualiza e-mail
  async function changeEmail() {
    try {
      if (!newEmail) throw new Error("Informe o e-mail.");
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      flashOk("E-mail atualizado (confirme no link enviado).");
    } catch (e) {
      flashErr(e.message || String(e));
    }
  }

  // Monta nota “formatada” para salvar nos pedidos
  function buildOwnerNote() {
    const lines = [
      `Empresa/Nome: ${businessName}`,
      `Documento: ${documentId}`,
      phone ? `Telefone: ${phone}` : null,
      instagram ? `Instagram: ${instagram}` : null,
      website ? `Site: ${website}` : null,
      "",
      `Motivo: ${reason}`,
    ].filter(Boolean);
    return lines.join("\n");
  }

  // Cria/atualiza a solicitação de proprietário
  async function submitOwnerRequest() {
    try {
      if (!user?.id) throw new Error("Faça login.");
      if (!businessName.trim()) throw new Error("Informe a Razão Social / Nome.");
      if (!documentId.trim()) throw new Error("Informe o documento (CNPJ/CPF).");
      if (!reason.trim() || reason.trim().length < 8)
        throw new Error("Descreva o motivo (mín. 8 caracteres).");

      const note = buildOwnerNote();

      // Se existe pendente, atualiza; senão, cria
      if (latestReq?.status === "pending") {
        const { error } = await supabase
          .from("owner_requests")
          .update({ note })
          .eq("id", latestReq.id);
        if (error) throw error;
        flashOk("Solicitação atualizada. Aguarde revisão.");
      } else {
        const { error } = await supabase
          .from("owner_requests")
          .insert({ user_id: user.id, note }); // status = 'pending' por padrão
        if (error) throw error;
        flashOk("Solicitação enviada. Aguarde revisão.");
      }

      // refetch último pedido
      const { data: req } = await supabase
        .from("owner_requests")
        .select("id,status,created_at,note")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (req) setLatestReq(req);
    } catch (e) {
      flashErr(e.message || String(e));
    }
  }

  // ========== DANGER ZONE: excluir conta ==========
  async function hardDeleteViaEdge() {
    const token = (await supabase.auth.getSession())?.data?.session?.access_token;
    const res = await fetch("/functions/v1/delete-user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Falha ao chamar função de exclusão.");
    }
  }

  async function softDeleteViaRPC(uid) {
    const { error } = await supabase.rpc("purge_user_data", { p_user_id: uid });
    if (error) throw new Error(error.message);
  }

  async function handleDeleteAccount() {
    try {
      if (!user?.id) throw new Error("Faça login.");
      if (confirmText !== confirmPhrase) {
        throw new Error(`Digite exatamente ${confirmPhrase} para confirmar.`);
      }
      setDeleting(true);

      // 1) tenta apagar dados + auth pela Edge Function
      try {
        await hardDeleteViaEdge();
      } catch {
        // 2) fallback: apaga somente dados no Postgres e mantém auth
        await softDeleteViaRPC(user.id);
      }

      await supabase.auth.signOut();
      alert("Conta excluída. Sentiremos sua falta!");
      nav("/", { replace: true });
    } catch (e) {
      flashErr(e.message || String(e));
    } finally {
      setDeleting(false);
    }
  }
  // ================================================

  if (loading) return <div className="p-6">Carregando…</div>;

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => nav(-1)}
        className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
      >
        ← Voltar
      </button>

      <h1 className="text-xl font-bold mt-2">Configurações</h1>

      {msg && <p className="text-green-400 text-sm">{msg}</p>}
      {err && <p className="text-red-400 text-sm">{err}</p>}

      {/* Perfil básico */}
      <section className="rounded-2xl p-5 bg-white/5 space-y-4">
        <h2 className="font-semibold">Perfil</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-80">Nome de exibição</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={saveDisplayName}
              className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 w-full sm:w-auto"
            >
              Salvar nome
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-80">Nova senha</label>
            <input
              type="password"
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              placeholder="Mín. 6 caracteres"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={changePassword}
              className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 w-full sm:w-auto"
            >
              Alterar senha
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-80">E-mail</label>
            <input
              type="email"
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              placeholder={user?.email || "seu@email.com"}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={changeEmail}
              className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 w-full sm:w-auto"
            >
              Atualizar e-mail
            </button>
          </div>
        </div>

        <p className="text-xs opacity-70">
          Papel atual:{" "}
          <span className="inline-block rounded-full px-2 py-0.5 bg-white/10">
            {profile.role || "user"}
          </span>
        </p>
      </section>

      {/* Solicitação para proprietário */}
      <section className="rounded-2xl p-5 bg-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Conta de Proprietário</h2>
          {latestReq && (
            <span className="text-xs px-2 py-1 rounded-full bg-white/10">
              Último status:{" "}
              <strong>
                {latestReq.status === "pending"
                  ? "pendente"
                  : latestReq.status === "approved"
                  ? "aprovado"
                  : latestReq.status === "rejected"
                  ? "rejeitado"
                  : latestReq.status}
              </strong>
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-80">Razão Social / Nome</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ex.: Clube X Produções LTDA"
            />
          </div>
          <div>
            <label className="text-sm opacity-80">Documento (CNPJ/CPF)</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="Ex.: 12.345.678/0001-90"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm opacity-80">Telefone/WhatsApp</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 9 9999-9999"
            />
          </div>
          <div>
            <label className="text-sm opacity-80">Instagram</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@sua_pagina"
            />
          </div>
          <div>
            <label className="text-sm opacity-80">Site</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://seusite.com"
            />
          </div>
        </div>

        <div>
          <label className="text-sm opacity-80">Por que você precisa ser proprietário?</label>
          <textarea
            rows={4}
            className="w-full rounded-xl px-3 py-2 bg-white/10"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Sou responsável pelos eventos do Clube X e preciso gerenciar as publicações…"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={submitOwnerRequest}
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20"
          >
            {latestReq?.status === "pending"
              ? "Atualizar solicitação"
              : "Solicitar acesso"}
          </button>

          <button
            onClick={() => nav("/home")}
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20"
          >
            Voltar à Home
          </button>
        </div>

        {latestReq?.note && (
          <details className="mt-2">
            <summary className="cursor-pointer opacity-80 text-sm">
              Ver resumo da última solicitação
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-sm opacity-80 bg-white/5 rounded-xl p-3">
              {latestReq.note}
            </pre>
          </details>
        )}
      </section>

      {/* DANGER ZONE – Excluir conta */}
      <section className="rounded-2xl p-5 border border-red-700/40 bg-red-900/20 space-y-3">
        <h2 className="font-semibold text-red-300">Excluir conta</h2>
        <p className="text-sm opacity-90">
          Esta ação é permanente. Seus eventos, ocorrências, votos, avaliações, favoritos
          e pedidos de proprietário serão removidos. Para confirmar, digite{" "}
          <b>{confirmPhrase}</b> abaixo.
        </p>

        <div className="flex items-center gap-2">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmPhrase}
            className="rounded-xl px-3 py-2 bg-white/10 w-40"
          />
          <button
            disabled={deleting || confirmText !== confirmPhrase}
            onClick={handleDeleteAccount}
            className="rounded-xl px-3 py-2 bg-red-600/80 hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? "Excluindo…" : "Excluir minha conta"}
          </button>
        </div>
      </section>
    </div>
  );
}
