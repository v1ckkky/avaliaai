import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function OwnerApply() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [existing, setExisting] = useState(null); // último pedido do user

  // Campos do formulário
  const [venueName, setVenueName]       = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueCity, setVenueCity]       = useState("");
  const [venueState, setVenueState]     = useState("");
  const [phone, setPhone]               = useState("");
  const [instagram, setInstagram]       = useState("");
  const [website, setWebsite]           = useState("");
  const [cnpj, setCnpj]                 = useState("");
  const [note, setNote]                 = useState("");
  const [heardFrom, setHeardFrom]       = useState("");
  const [terms, setTerms]               = useState(false);

  // Comprovante (upload opcional)
  const [file, setFile] = useState(null);
  const [proofUrl, setProofUrl] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const me = u?.user || null;
      setUser(me);

      if (me?.id) {
        // Traz o último pedido do user (se houver)
        const { data: reqs } = await supabase
          .from("owner_requests")
          .select("*")
          .eq("user_id", me.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const last = reqs?.[0] || null;
        setExisting(last);

        // Se existir e estiver pendente, preenche para edição rápida
        if (last && last.status === "pending") {
          setVenueName(last.venue_name || "");
          setVenueAddress(last.venue_address || "");
          setVenueCity(last.venue_city || "");
          setVenueState(last.venue_state || "");
          setPhone(last.phone || "");
          setInstagram(last.instagram || "");
          setWebsite(last.website || "");
          setCnpj(last.cnpj || "");
          setNote(last.note || "");
          setHeardFrom(last.heard_from || "");
          setTerms(!!last.terms_accepted);
          setProofUrl(last.proof_url || "");
        }
      }

      setLoading(false);
    })();
  }, []);

  async function handleUploadProof(userId, fileObj) {
    if (!fileObj) return "";
    if (fileObj.size > 5 * 1024 * 1024) throw new Error("Arquivo muito grande (máx 5MB).");

    const ext = (fileObj.name.split(".").pop() || "dat").toLowerCase();
    const filename = `${crypto.randomUUID()}.${ext}`;
    const path = `${userId}/${filename}`;

    const { error: upErr } = await supabase
      .storage
      .from("owner-proofs")
      .upload(path, fileObj, { upsert: false, cacheControl: "3600" });
    if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

    const { data: pub } = supabase.storage.from("owner-proofs").getPublicUrl(path);
    return pub.publicUrl;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!user?.id) return setErr("Faça login para enviar a solicitação.");
    if (!terms)   return setErr("Você precisa aceitar os termos.");

    // validações simples
    if (!venueName.trim()) return setErr("Informe o nome do estabelecimento/evento.");
    if (!phone.trim() && !instagram.trim() && !website.trim()) {
      return setErr("Informe ao menos um contato: telefone, Instagram ou site.");
    }

    setSaving(true);
    try {
      // upload opcional
      let proof = proofUrl;
      if (file) {
        proof = await handleUploadProof(user.id, file);
      }

      const payload = {
        user_id: user.id,
        venue_name: venueName || null,
        venue_address: venueAddress || null,
        venue_city: venueCity || null,
        venue_state: venueState || null,
        phone: phone || null,
        instagram: instagram || null,
        website: website || null,
        cnpj: cnpj || null,
        note: note || null,
        heard_from: heardFrom || null,
        proof_url: proof || null,
        terms_accepted: terms,
      };

      if (existing && existing.status === "pending") {
        // Atualiza o pedido pendente do próprio usuário
        const { error: updErr } = await supabase
          .from("owner_requests")
          .update(payload)
          .eq("id", existing.id);
        if (updErr) throw new Error(updErr.message);
      } else {
        // Cria novo (a unique index impede 2 pendentes)
        const { error: insErr } = await supabase
          .from("owner_requests")
          .insert(payload);
        if (insErr) throw new Error(insErr.message);
      }

      alert("Solicitação enviada com sucesso!");
      nav("/home");
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Carregando…</div>;

  // Se já for owner/admin, não precisa solicitar
  // (opcional: pode mostrar instruções ou atalho pro painel)
  // Você pode remover esse bloco se quiser permitir re-envio.
  // Aqui eu bloqueio apenas se já for owner/admin.
  // Caso queira permitir edição mesmo assim, remova o return.
  // Verifique o role atual:
  // (Quer buscar o role? Você pode trazer de profiles na Home e passar via contexto/prop;
  // ou aqui buscar rapidamente.)
  // Para simplicidade, deixo aberto — quem já é owner pode ignorar a página.

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => nav(-1)} className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20">
        ← Voltar
      </button>

      <h1 className="text-xl font-bold mt-4 mb-2">Solicitar perfil de Proprietário</h1>
      <p className="opacity-80 mb-4">
        Preencha os dados abaixo para analisarmos sua solicitação. Você poderá editar enquanto o status estiver <b>pendente</b>.
      </p>

      {existing && (
        <div className="rounded-xl p-3 mb-4 bg-white/5">
          <p className="text-sm">
            Status atual:{" "}
            <span className={`px-2 py-0.5 rounded-full ${
              existing.status === "pending" ? "bg-yellow-500/20 text-yellow-300" :
              existing.status === "approved" ? "bg-green-500/20 text-green-300" :
              "bg-red-500/20 text-red-300"
            }`}>
              {existing.status}
            </span>
            {existing.reviewed_at && (
              <span className="opacity-70 ml-2 text-xs">
                (Revisado em {new Date(existing.reviewed_at).toLocaleString("pt-BR")})
              </span>
            )}
          </p>
          {existing.status !== "pending" && (
            <p className="text-xs opacity-70 mt-1">
              Seu último pedido não está pendente. Você pode enviar um novo, se necessário.
            </p>
          )}
        </div>
      )}

      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-80">Nome do estabelecimento / evento *</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm opacity-80">CNPJ (opcional)</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-80">Cidade</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={venueCity}
              onChange={(e) => setVenueCity(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-80">Estado</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={venueState}
              onChange={(e) => setVenueState(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm opacity-80">Endereço completo</label>
          <input
            className="w-full rounded-xl px-3 py-2 bg-white/10"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm opacity-80">Telefone</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <label className="text-sm opacity-80">Instagram</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@perfil"
            />
          </div>
          <div>
            <label className="text-sm opacity-80">Site</label>
            <input
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <label className="text-sm opacity-80">Como nos conheceu? (opcional)</label>
          <input
            className="w-full rounded-xl px-3 py-2 bg-white/10"
            value={heardFrom}
            onChange={(e) => setHeardFrom(e.target.value)}
            placeholder="Indicação, Instagram, Google, etc."
          />
        </div>

        <div>
          <label className="text-sm opacity-80">Mensagem/Observações (opcional)</label>
          <textarea
            className="w-full rounded-xl px-3 py-2 bg-white/10 min-h-[90px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Conte um pouco sobre seus eventos..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm opacity-80">Comprovante (opcional)</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20"
            >
              {file ? "Trocar arquivo" : "Selecionar arquivo"}
            </button>
            <span className="text-sm opacity-70 truncate">
              {file ? file.name : proofUrl ? "Arquivo já enviado" : "Nenhum arquivo selecionado"}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span className="text-sm">
            Confirmo que as informações são verdadeiras e aceito os termos de avaliação da plataforma.
          </span>
        </label>

        <div className="flex gap-2">
          <button
            disabled={saving}
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50"
          >
            {saving ? "Enviando…" : (existing && existing.status === "pending" ? "Salvar alterações" : "Enviar solicitação")}
          </button>
          <button
            type="button"
            onClick={() => nav("/home")}
            className="rounded-xl px-4 py-2 bg-white/5 hover:bg-white/15"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
