import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl p-4 bg-white/5">
      <p className="text-sm opacity-75">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs opacity-60 mt-1">{hint}</p>}
    </div>
  );
}

export default function OwnerDashboard() {
  const nav = useNavigate();
  const [uid, setUid] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  // carrega usuário + dados
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const id = u?.user?.id || null;
      setUid(id);
      if (!id) return;

      // meus eventos
      const { data: evs } = await supabase
        .from("events")
        .select("id, title, venue, image_url, recurring, starts_at, created_at")
        .eq("created_by", id)
        .order("created_at", { ascending: false });

      const eventList = evs || [];
      setEvents(eventList);

      // stats por evento
      const ids = eventList.map((e) => e.id);
      let agg = [];
      if (ids.length) {
        const { data: es } = await supabase
          .from("v_event_stats")
          .select("*")
          .in("event_id", ids);
        agg = es || [];
      }
      setStats(agg);

      // últimas avaliações (apenas dos meus eventos)
      let last = [];
      if (ids.length) {
        const { data: rr } = await supabase
          .from("v_recent_ratings")
          .select("*")
          .in("event_id", ids)
          .limit(12);
        last = rr || [];
      }
      setRecent(last);

      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    if (!stats.length) return { avg: 0, up: 0, down: 0, occ: 0 };
    const up = stats.reduce((a, s) => a + (s.upvotes || 0), 0);
    const down = stats.reduce((a, s) => a + (s.downvotes || 0), 0);
    const occ = stats.reduce((a, s) => a + (s.occurrences || 0), 0);
    const avg =
      stats.reduce((a, s) => a + (Number(s.avg_overall) || 0), 0) /
      stats.filter((s) => s.avg_overall != null).length || 0;
    return { up, down, occ, avg: Number(avg.toFixed(2)) };
  }, [stats]);

  function statFor(eventId) {
    return stats.find((s) => s.event_id === eventId) || {};
  }

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!uid)
    return (
      <div className="p-6">
        <p className="opacity-80">Faça login para acessar o Painel do Proprietário.</p>
      </div>
    );

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      {/* topo */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel do Proprietário</h1>
        <div className="flex gap-2">
          <button
            onClick={() => nav("/create-event")}
            className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
          >
            + Novo evento
          </button>
          <button
            onClick={() => nav("/home")}
            className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
          >
            Voltar à Home
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Eventos" value={events.length} />
        <StatCard label="Ocorrências (total)" value={totals.occ} />
        <StatCard label="👍 Upvotes" value={totals.up} />
        <StatCard label="Média geral" value={totals.avg.toFixed(2)} hint="Todas as notas" />
      </div>

      {/* Lista dos meus eventos */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Meus eventos</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {events.map((e) => {
            const s = statFor(e.id);
            return (
              <div key={e.id} className="rounded-2xl overflow-hidden bg-white/5">
                {e.image_url && (
                  <img src={e.image_url} alt="" className="w-full h-36 object-cover" />
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{e.title}</p>
                      <p className="text-sm opacity-75 truncate">{e.venue || "Sem local"}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/10">
                      {e.recurring ? "Recorrente" : "Único"}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div className="rounded-xl bg-white/5 p-2">
                      <p className="opacity-70">Média</p>
                      <p className="font-semibold">{s.avg_overall ?? "—"}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2">
                      <p className="opacity-70">👍</p>
                      <p className="font-semibold">{s.upvotes ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2">
                      <p className="opacity-70">👎</p>
                      <p className="font-semibold">{s.downvotes ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2">
                      <p className="opacity-70">Ocorr.</p>
                      <p className="font-semibold">{s.occurrences ?? 0}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => nav(`/event/${e.id}/edit`)}
                      className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => nav(`/occ/${e.id}?event=${e.id}`)}
                      className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20"
                      title="Abrir (usa Home/Occurrence)"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="opacity-80">Você ainda não criou eventos.</p>
          )}
        </div>
      </section>

      {/* Últimas avaliações */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Últimas avaliações</h2>
        <div className="grid gap-2">
          {recent.map((r) => (
            <div key={r.id} className="rounded-xl p-3 bg-white/5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {r.title} — <span className="opacity-80">{r.key}</span>
                </p>
                <p className="text-xs opacity-70">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                  {r.starts_at ? ` • ocorr.: ${new Date(r.starts_at).toLocaleString("pt-BR")}` : ""}
                </p>
              </div>
              <div className="text-lg"> {r.score}★ </div>
            </div>
          ))}
          {recent.length === 0 && <p className="opacity-80">Sem avaliações recentes.</p>}
        </div>
      </section>
    </div>
  );
}
