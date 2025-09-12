import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function CreateEvent() {
  const nav = useNavigate();

  const [userId, setUserId] = useState(null);
  const [title, setTitle]   = useState("");
  const [venue, setVenue]   = useState("");
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // ajusta fuso p/ input
    return d.toISOString().slice(0,16); // YYYY-MM-DDTHH:mm
  });
  const [endsAt, setEndsAt] = useState("");
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!userId) return setErr("Usuário não autenticado.");

    if (!title.trim()) return setErr("Informe o título.");
    if (!startsAt) return setErr("Informe a data/hora de início.");

    setLoading(true);
    const { error } = await supabase.from("events").insert({
      title,
      venue: venue || null,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      is_live: isLive,
      created_by: userId, // IMPORTANTE para passar na policy de insert
    });
    setLoading(false);

    if (error) setErr(error.message);
    else nav("/home");
  }

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-3xl mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold">Novo Evento</h1>
        <button onClick={() => nav(-1)} className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20">← Voltar</button>
      </header>

      <main className="max-w-3xl mx-auto mt-6">
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl p-5 bg-white/5">
          <div>
            <label className="block text-sm mb-2">Título *</label>
            <input
              className="w-full rounded-xl px-3 py-3 bg-neutral-100 text-neutral-900 outline-none"
              value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Ex.: Baile do Centro"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Local</label>
            <input
              className="w-full rounded-xl px-3 py-3 bg-neutral-100 text-neutral-900 outline-none"
              value={venue} onChange={(e)=>setVenue(e.target.value)} placeholder="Ex.: Clube Central"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2">Início *</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl px-3 py-3 bg-neutral-100 text-neutral-900 outline-none"
                value={startsAt} onChange={(e)=>setStartsAt(e.target.value)} required
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Término</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl px-3 py-3 bg-neutral-100 text-neutral-900 outline-none"
                value={endsAt} onChange={(e)=>setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={isLive} onChange={(e)=>setIsLive(e.target.checked)} />
            <span>Marcar como <b>ao vivo</b> (aparece na Home)</span>
          </label>

          {err && <p className="text-sm text-red-400">{err}</p>}

          <button
            disabled={loading}
            className="w-full rounded-full py-3 font-semibold bg-red-700 hover:bg-red-600 disabled:opacity-60"
          >
            {loading ? "Criando..." : "Criar evento"}
          </button>
        </form>
      </main>
    </div>
  );
}
