import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function CreateEvent() {
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fileInputRef = useRef(null);

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
      // garante que o usuário está logado para criar evento
      const { data: u } = await supabase.auth.getUser();
      console.log("UID:", u?.user?.id);
      if (!u?.user?.id) throw new Error("Faça login para criar eventos.");

      // 1) cria evento
      const { data: ev, error: insertErr } = await supabase
        .from("events")
        .insert({
          title,
          venue,
          starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
          created_by: u?.user?.id,
          is_live: true,
        })
        .select("*")
        .single();
      if (insertErr) throw insertErr;

      // 2) se o usuário escolheu imagem, faz upload
      if (imageFile) {
        if (!imageFile.type.startsWith("image/")) {
          throw new Error("Selecione um arquivo de imagem.");
        }
        if (imageFile.size > 3 * 1024 * 1024) {
          throw new Error("Imagem muito grande. Máx: 3MB.");
        }

        const ext = imageFile.name.split(".").pop() || "jpg";
        const filename = `${crypto.randomUUID()}.${ext}`;
        const path = `${ev.id}/cover/${filename}`;

        const { error: upErr } = await supabase
          .storage.from("event-photos")
          .upload(path, imageFile, { cacheControl: "3600", upsert: false });
        if (upErr) throw new Error(`Falha no upload da imagem: ${upErr.message}`);

        // 3) URL pública (bucket público)
        const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(path);
        const image_url = pub.publicUrl;

        // 4) grava a URL no evento
        const { error: updErr } = await supabase
          .from("events")
          .update({ image_url })
          .eq("id", ev.id);
        if (updErr) throw new Error(`Falha ao salvar capa no evento: ${updErr.message}`);
      }

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

          <div className="space-y-2">
            <label className="text-sm opacity-80">Foto de capa (opcional)</label>
            {/* Botão estilizado que abre o input file oculto */}
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
