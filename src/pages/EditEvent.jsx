import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function EditEvent() {
  const { id } = useParams();
  const nav = useNavigate();

  const [ev, setEv] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // básicos
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");

  // modo
  const [recurring, setRecurring] = useState(true);

  // único
  const [singleStart, setSingleStart] = useState("");
  const [singleEnd, setSingleEnd] = useState("");

  // recorrente
  const [days, setDays] = useState([]);
  const [recurStart, setRecurStart] = useState("");
  const [recurEnd, setRecurEnd] = useState("");
  const [activeFrom, setActiveFrom] = useState("");
  const [activeUntil, setActiveUntil] = useState("");

  // imagem
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");

  // perms/estado
  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState("user");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const fileRef = useRef(null);

  const canEdit = !!ev && (userId === ev.created_by || role === "admin");

  function toggleDay(idx) {
    setDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
    );
  }

  function pickFile(e) {
    const f = e.target.files?.[0] || null;
    setImageFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(ev?.image_url || "");
  }

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

        // modo
        const isRec = !!data.recurring;
        setRecurring(isRec);

        if (isRec) {
          setDays(Array.isArray(data.recur_days) ? data.recur_days : []);
          setRecurStart(data.recur_start || "");
          setRecurEnd(data.recur_end || "");
          setActiveFrom(data.active_from || "");
          setActiveUntil(data.active_until || "");
        } else {
          // Se já está no formato local, usa direto. Se não, converte para local.
          const formatLocal = (dt) => {
            if (!dt) return "";
            // Se já está no formato correto, retorna direto
            if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dt)) return dt.slice(0, 16);
            // Se não, converte para local
            const d = new Date(dt);
            const pad = (n) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          };
          setSingleStart(formatLocal(data.starts_at));
          setSingleEnd(formatLocal(data.ends_at));
        }

        setPreview(data.image_url || "");
      } else {
        setNotFound(true);
      }
    })();
  }, [id]);

  async function save(e) {
    e.preventDefault();
    setErr("");
    if (!canEdit) return setErr("Sem permissão para editar este evento.");

    setSaving(true);
    try {
      // patch comum
      let patch = {
        title,
        venue,
      };

      if (recurring) {
        if (days.length === 0) throw new Error("Selecione ao menos um dia da semana.");
        if (!recurStart || !recurEnd) throw new Error("Defina hora de início e de término.");

        patch = {
          ...patch,
          recurring: true,
          starts_at: null,
          ends_at: null,
          recur_days: days,
          recur_start: recurStart,
          recur_end: recurEnd,
          active_from: activeFrom || null,
          active_until: activeUntil || null,
        };
      } else {
        if (!singleStart) throw new Error("Defina o início do evento.");
        patch = {
          ...patch,
          recurring: false,
          starts_at: new Date(singleStart).toISOString(),
          ends_at: singleEnd ? new Date(singleEnd).toISOString() : null,
          recur_days: null,
          recur_start: null,
          recur_end: null,
          active_from: null,
          active_until: null,
        };
      }

      const { error: e1 } = await supabase.from("events").update(patch).eq("id", id);
      if (e1) throw new Error(`Falha ao salvar dados: ${e1.message}`);

      // imagem nova?
      if (imageFile) {
        if (!imageFile.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
        if (imageFile.size > 3 * 1024 * 1024) throw new Error("Imagem muito grande. Máx: 3MB.");

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

  if (notFound) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={() => nav("/home")} className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20">
          ← Voltar
        </button>
        <p className="mt-4 opacity-80">Evento-base não encontrado.</p>
      </div>
    );
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
      <button onClick={() => nav(`/event/${id}`)} className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20">
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

        {/* seletor de modo */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          <span>Evento recorrente (semanal)</span>
        </label>

        {recurring ? (
          <div className="rounded-2xl p-4 bg-white/5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {WEEK_LABELS.map((lbl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-2 rounded-xl ${
                    days.includes(i) ? "bg-white/20" : "bg-white/10 hover:bg-white/15"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Hora de início</label>
                <input
                  type="time"
                  className="w-full rounded-xl px-3 py-2 bg-white/10"
                  value={recurStart}
                  onChange={(e) => setRecurStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm opacity-80">Hora de término</label>
                <input
                  type="time"
                  className="w-full rounded-xl px-3 py-2 bg-white/10"
                  value={recurEnd}
                  onChange={(e) => setRecurEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Ativo a partir de</label>
                <input
                  type="date"
                  className="w-full rounded-xl px-3 py-2 bg-white/10"
                  value={activeFrom || ""}
                  onChange={(e) => setActiveFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm opacity-80">Ativo até</label>
                <input
                  type="date"
                  className="w-full rounded-xl px-3 py-2 bg-white/10"
                  value={activeUntil || ""}
                  onChange={(e) => setActiveUntil(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-4 bg-white/5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Início</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl px-3 py-2 bg-white/10"
                  value={singleStart}
                  onChange={(e) => setSingleStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm opacity-80">Fim (opcional)</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl px-3 py-2 bg-white/10"
                  value={singleEnd}
                  onChange={(e) => setSingleEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Imagem */}
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
