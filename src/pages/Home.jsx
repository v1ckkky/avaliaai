import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

function EventCard({ ev, onOpen }) {
  return (
    <button
      onClick={() => onOpen(ev)}
      className="w-full text-left rounded-2xl p-4 bg-white/5 hover:bg-white/10 transition"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{ev.title}</p>
          <p className="text-sm opacity-80">{ev.venue || "Sem local"}</p>
        </div>
        {ev.is_live && (
          <span className="text-xs px-2 py-1 rounded-full bg-red-700/30 text-red-300">
            AO VIVO
          </span>
        )}
      </div>
    </button>
  );
}

export default function Home() {
  const nav = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: true });
    if (!error) setEvents((data || []).filter((e) => e.is_live));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-4xl mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold">Avalia Aí</h1>
        <div className="flex gap-2">
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
        >
          Sair
        </button>
        <button
          onClick={() => nav("/create-event")}
          className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
        >
          Novo Evento
        </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Eventos ao vivo</h2>

        {loading && <p>Carregando…</p>}
        {!loading && events.length === 0 && (
          <p className="opacity-80">Nenhum evento ao vivo agora.</p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              onOpen={() => nav(`/event/${ev.id}`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
