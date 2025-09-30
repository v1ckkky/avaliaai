import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function EditEvent() {
  const { id } = useParams();
  const nav = useNavigate();

  const [ev, setEv] = useState(null);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [isLive, setIsLive] = useState(true);

  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");

  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState("user");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const fileRef = useRef(null);

  const canEdit = !!ev && (userId === ev.created_by || role === "admin");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id || null;
      setUserId(uid);

      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (prof?.role) setRole(prof.role);
      }

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        setEv(data);
        setTitle(data.title || "");
        setVenue(data.venue || "");
        setStartsAt(
          data.starts_at
            ? new Date(data.starts_at).toISOString().slice(0, 16) // para input datetime-local
            : ""
        );
        setIsLive(!!data.is_live);
        setPreview(data.image_url || "");
      }
    })();
  }, [id]);

  function pickFile(e) {
    const f = e.target.files?.[0] || null;
    setImageFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(ev?.image_url || "");
  }

  async function save(e) {
    e.preventDefault();
    setErr("");
    if (!canEdit) return setErr("Sem permissão para editar este evento.");

    setSaving(true);
    try {
      // 1) Atualiza campos básicos
      const patch = {
        title,
        venue,
        is_live: isLive,
        starts_at: startsAt ? new Date(startsAt).toISOString() : ev.starts_at,
      };

      const { error: e1 } = await supabase.from("events").update(patch).eq("id", id);
      if (e1) throw new Error(`Falha ao salvar dados: ${e1.message}`);

      // 2) Se trocou a imagem, faz upload e atualiza image_url
      if (imageFile) {
        if (!imageFile.type.startsWith("image/")) {
          throw new Error("Selecione um arquivo de imagem.");
        }
        if (imageFile.size > 3 * 1024 * 1024) {
          throw new Error("Imagem muito grande. Máx: 3MB.");
        }

        const ext = imageFile.name.split(".").pop() || "jpg";
        const filename = `${crypto.randomUUID()}.${ext}`;
        const path = `${id}/cover/${filename}`;

        const { error: upErr } = await supabase
          .storage.from("event-photos")
          .upload(path, imageFile, { cacheControl: "3600", upsert: false });
        if (upErr) throw new Error(`Falha no upload da imagem: ${upErr.message}`);

        const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(path);
        const image_url = pub.publicUrl;

        const { error: e2 } = await supabase
          .from("events")
          .update({ image_url })
          .eq("id", id);
        if (e2) throw new Error(`Falha ao atualizar capa: ${e2.message}`);
      }

      nav(`/event/${id}`);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!ev) return <div className="p-6">Carregando…</div>;
  if (!canEdit)
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button onClick={() => nav(-1)} className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20">
          ← Voltar
        </button>
        <p className="mt-4 text-red-400">Você não tem permissão para editar este evento.</p>
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button onClick={() => nav(-1)} className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20">
        ← Voltar
      </button>
      <h1 className="text-xl font-bold mt-4 mb-4">Editar evento</h1>
      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

      <form onSubmit={save} className="space-y-4">
        <input
          className="w-full rounded-xl px-3 py-2 bg-white/10"
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <input
          className="w-full rounded-xl px-3 py-2 bg-white/10"
          placeholder="Local"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm opacity-80">Início</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl px-3 py-2 bg-white/10"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 mt-6 sm:mt-0">
            <input
              type="checkbox"
              checked={isLive}
              onChange={(e) => setIsLive(e.target.checked)}
            />
            <span>Evento ao vivo</span>
          </label>
        </div>

        <div className="space-y-2">
          <label className="text-sm opacity-80">Foto de capa</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20"
            >
              {imageFile ? "Trocar imagem" : "Selecionar imagem"}
            </button>
            <span className="text-sm opacity-70 truncate">
              {imageFile ? imageFile.name : "Nenhum arquivo selecionado"}
            </span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
        </div>

        {preview && (
          <img
            src={preview}
            alt="Pré-visualização"
            className="w-full h-48 object-cover rounded-xl border border-white/10"
          />
        )}

        <button
          disabled={saving}
          className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>
    </div>
  );
}
