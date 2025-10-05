import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CreateEvent() {
  const nav = useNavigate();

  // básicos
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");

  // modo: único ou recorrente
  const [recurring, setRecurring] = useState(true);

  // único
  const [singleStart, setSingleStart] = useState(""); // datetime-local
  const [singleEnd, setSingleEnd] = useState("");     // datetime-local

  // recorrente
  const [days, setDays] = useState([]);               // smallint[] 0..6
  const [recurStart, setRecurStart] = useState("");   // time
  const [recurEnd, setRecurEnd] = useState("");       // time
  const [activeFrom, setActiveFrom] = useState("");   // date
  const [activeUntil, setActiveUntil] = useState(""); // date

  // imagem
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");

  // estado
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fileInputRef = useRef(null);

  function toggleDay(idx) {
    setDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
    );
  }

  function handlePickFile(e) {
    const f = e.target.files?.[0] || null;
    setImageFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);

    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Faça login para criar eventos.");

      // monta payload
      let payload = {
        title,
        venue,
        created_by: uid,
      };

      if (recurring) {
        if (days.length === 0) throw new Error("Selecione ao menos um dia da semana.");
        if (!recurStart || !recurEnd) throw new Error("Defina hora de início e de término.");

        payload = {
          ...payload,
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
        payload = {
          ...payload,
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

      // cria evento
      const { data: ev, error: insertErr } = await supabase
        .from("events")
        .insert(payload)
        .select("*")
        .single();
      if (insertErr) throw insertErr;

      // upload de imagem (opcional)
      if (imageFile) {
        if (!imageFile.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
        if (imageFile.size > 3 * 1024 * 1024) throw new Error("Imagem muito grande. Máx: 3MB.");

        const ext = imageFile.name.split(".").pop() || "jpg";
        const filename = `${crypto.randomUUID()}.${ext}`;
        const path = `${ev.id}/cover/${filename}`;

        const { error: upErr } = await supabase
          .storage.from("event-photos")
          .upload(path, imageFile, { cacheControl: "3600", upsert: false });
        if (upErr) throw new Error(`Falha no upload da imagem: ${upErr.message}`);

        const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(path);
        const image_url = pub.publicUrl;

        const { error: updErr } = await supabase
          .from("events")
          .update({ image_url })
          .eq("id", ev.id);
        if (updErr) throw new Error(`Falha ao salvar capa no evento: ${updErr.message}`);
      }

      // redireciona (pode ser /home ou /event/:id)
      nav(`/event/${ev.id}`);

    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button onClick={() => nav(-1)} className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20">
        ← Voltar
      </button>

      <h1 className="text-xl font-bold mt-4 mb-4">Novo evento</h1>
      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

      <form onSubmit={handleCreate} className="space-y-4">
        <input
          className="w-full rounded-xl px-3 py-2 bg-white/10"
          placeholder="Título do evento"
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
                  value={activeFrom}
                  onChange={(e) => setActiveFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm opacity-80">Ativo até</label>
                <input
                  type="date"
                  className="w-full rounded-xl px-3 py-2 bg-white/10"
                  value={activeUntil}
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
          <label className="text-sm opacity-80">Foto de capa (opcional)</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20"
            >
              Adicionar imagem
            </button>
            <span className="text-sm opacity-70 truncate">
              {imageFile ? imageFile.name : "Nenhum arquivo selecionado"}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickFile}
            className="hidden"
          />
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
          {saving ? "Salvando..." : "Criar evento"}
        </button>
      </form>
    </div>
  );
}
