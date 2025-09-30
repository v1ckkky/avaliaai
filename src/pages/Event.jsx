import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl p-3 bg-white/5 text-center">
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

export default function EventRoom() {
  const { id } = useParams();
  const nav = useNavigate();

  const [ev, setEv] = useState(null);
  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [avg, setAvg] = useState({ dj: 0, fila: 0, preco: 0, seguranca: 0 });

  // para controle do botão Excluir
  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState("user"); // 'user' | 'owner' | 'admin'
  const canDelete = !!ev && (userId === ev?.created_by || role === "admin");
  const canEdit = canDelete;


  // -------- loads
  async function loadEvent() {
    const { data } = await supabase.from("events").select("*").eq("id", id).single();
    setEv(data);
  }

  async function loadVotes() {
    const { data, error } = await supabase
      .from("votes")
      .select("upvote")
      .eq("event_id", id);

    if (error) return;
    const list = data || [];
    const up = list.filter((v) => v.upvote === true).length;
    const down = list.filter((v) => v.upvote === false).length;
    setVotes({ up, down });
  }

  async function loadRatings() {
    const { data, error } = await supabase
      .from("ratings")
      .select("key, score")
      .eq("event_id", id);

    if (error) return;
    const acc = { dj: [], fila: [], preco: [], seguranca: [] };
    (data || []).forEach((r) => acc[r.key]?.push(Number(r.score)));
    const mean = (k) =>
      acc[k].length ? acc[k].reduce((a, b) => a + b, 0) / acc[k].length : 0;
    setAvg({
      dj: mean("dj"),
      fila: mean("fila"),
      preco: mean("preco"),
      seguranca: mean("seguranca"),
    });
  }

  // -------- actions
  async function sendVote(up) {
    await supabase.from("votes").insert({ event_id: id, upvote: up });
  }
  async function sendRating(key, score) {
    await supabase.from("ratings").insert({ event_id: id, key, score });
  }

  async function deleteEvent() {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    nav("/home");
  }

  // -------- init
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

      loadEvent();
      loadVotes();
      loadRatings();
    })();
  }, [id]);

  // -------- realtime
  useEffect(() => {
    const channel = supabase
      .channel(`room-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `event_id=eq.${id}` },
        loadVotes
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings", filter: `event_id=eq.${id}` },
        loadRatings
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  if (!ev) return <div className="p-6">Carregando…</div>;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-4">
      {/* Top bar: voltar + excluir (condicional) */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => nav(-1)}
          className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
        >
          ← Voltar
        </button>

    <div className="flex gap-2">
        {canEdit && (
      <button
        onClick={() => nav(`/event/${id}/edit`)}
        className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
      >
        Editar
      </button>
    )}
        {canDelete && (
          <button
            onClick={deleteEvent}
            className="rounded-full px-3 py-2 bg-red-700/70 hover:bg-red-700"
            title="Excluir evento"
          >
            Excluir evento
          </button>
        )}
        </div>
      </div>

      <div className="rounded-2xl p-4 bg-white/5 space-y-4">
        {/* Header do evento */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{ev.title}</h1>
            <p className="opacity-80">{ev.venue || "Sem local"}</p>
          </div>
          {ev.is_live && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-700/30 text-red-300">
              AO VIVO
            </span>
          )}
        </div>

        {/* Capa do evento (abaixo do header) */}
        {ev.image_url && (
          <img
            src={ev.image_url}
            alt="Capa do evento"
            className="w-full h-56 object-cover rounded-2xl"
          />
        )}

        {/* Votos */}
        <div className="mt-2 flex gap-2">
          <button
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20"
            onClick={() => sendVote(true)}
          >
            👍 Bom
          </button>
          <button
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20"
            onClick={() => sendVote(false)}
          >
            👎 Ruim
          </button>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat label="👍" value={votes.up} />
          <Stat label="👎" value={votes.down} />
          <Stat label="Total de avaliações" value={votes.up + votes.down} />
        </div>

        {/* Notas por critério */}
        <div className="space-y-3">
          <p className="font-semibold text-lg">Avalie conforme sua satisfação: </p>
        
        <div className="grid md:grid-cols-2 gap-3">
          {["dj", "fila", "preco", "seguranca"].map((k) => (
            <div key={k} className="rounded-2xl p-4 bg-white/5">
              <p className="font-semibold capitalize">{k}</p>
              <p className="text-sm opacity-80">
                Média: {avg[k] ? avg[k].toFixed(1) : "0.0"}
              </p>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20"
                    onClick={() => sendRating(k, s)}
                  >
                    {s}★
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
