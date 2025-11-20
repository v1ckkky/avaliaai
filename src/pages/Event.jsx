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
  const { id } = useParams(); // occurrence_id
  const nav = useNavigate();

  const [occ, setOcc] = useState(null);
  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [avg, setAvg] = useState({ dj: 0, fila: 0, preco: 0, seguranca: 0 });

  const [selectedVote, setSelectedVote] = useState(null); // "up" | "down" | null
  const [selectedScores, setSelectedScores] = useState({
    dj: null,
    fila: null,
    preco: null,
    seguranca: null,
  });

  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState("user");
  const canDelete = !!occ && (userId === occ?.created_by || role === "admin");
  const canEdit = canDelete;

  const [isLive, setIsLive] = useState(false);

  async function loadOccurrence() {
    const { data, error } = await supabase
      .from("v_occ_with_event")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) {
      setOcc(data);

      const now = new Date();
      const starts = data.starts_at ? new Date(data.starts_at) : null;
      const ends = data.ends_at ? new Date(data.ends_at) : null;
      setIsLive(starts && ends ? now >= starts && now <= ends : true);
    }
  }

  async function loadVotes() {
    const { data, error } = await supabase
      .from("votes")
      .select("upvote")
      .eq("occurrence_id", id);
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
      .eq("occurrence_id", id);
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

  // novo: carregar voto e notas da usuária
  async function loadUserSelections(uid) {
    if (!uid) return;

    // voto bom/ruim
    const { data: vData } = await supabase
      .from("votes")
      .select("upvote")
      .eq("occurrence_id", id)
      .eq("user_id", uid)
      .maybeSingle();

    if (vData) {
      setSelectedVote(vData.upvote ? "up" : "down");
    }

    // notas por categoria
    const { data: rData } = await supabase
      .from("ratings")
      .select("key, score")
      .eq("occurrence_id", id)
      .eq("user_id", uid);

    if (rData && rData.length) {
      const base = { dj: null, fila: null, preco: null, seguranca: null };
      rData.forEach((r) => {
        if (base.hasOwnProperty(r.key)) {
          base[r.key] = Number(r.score);
        }
      });
      setSelectedScores((prev) => ({ ...prev, ...base }));
    }
  }

  async function sendVote(up) {
    if (!isLive) {
      alert("Este evento não está aberto para votos no momento.");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return alert("É necessário estar logada para votar.");

    const { error } = await supabase
      .from("votes")
      .upsert(
        { occurrence_id: id, user_id: uid, upvote: up },
        { onConflict: "occurrence_id,user_id" }
      );
    if (error) alert(error.message);
    else {
      setSelectedVote(up ? "up" : "down");
      loadVotes();
    }
  }

  async function sendRating(key, score) {
    if (!isLive) {
      alert("Este evento não está aberto para avaliações no momento.");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return alert("É necessário estar logada para avaliar.");

    const { error } = await supabase
      .from("ratings")
      .upsert(
        { occurrence_id: id, user_id: uid, key, score },
        { onConflict: "occurrence_id,user_id,key" }
      );
    if (error) alert(error.message);
    else {
      setSelectedScores((prev) => ({
        ...prev,
        [key]: score,
      }));
      loadRatings();
    }
  }

  async function deleteEvent() {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", occ.event_id);
    if (error) alert(error.message);
    else nav("/home", { replace: true });
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

      await loadOccurrence();
      await loadVotes();
      await loadRatings();
      if (uid) await loadUserSelections(uid); // aqui que ele pré-marca
    })();
  }, [id]);

  useEffect(() => {
    const channel = supabase
      .channel(`occ-room-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `occurrence_id=eq.${id}` },
        loadVotes
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings", filter: `occurrence_id=eq.${id}` },
        loadRatings
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  if (!occ) return <div className="p-6">Carregando…</div>;

  const goBackToHome = () => nav("/home");

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={goBackToHome}
          className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
        >
          ← Voltar
        </button>

        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={() => nav(`/event/${occ.event_id}/edit`)}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{occ.title}</h1>
            <p className="opacity-80">{occ.venue || "Sem local"}</p>
            {occ.description && (
              <p className="text-sm opacity-80 mt-1">{occ.description}</p>
            )}
          </div>
          {isLive && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-700/30 text-red-300">
              AO VIVO
            </span>
          )}
        </div>

        {occ.image_url && (
          <img
            src={occ.image_url}
            alt="Capa do evento"
            className="w-full h-56 object-cover rounded-2xl"
          />
        )}

        <div className="mt-2 flex gap-2">
          <button
            disabled={!isLive}
            className={`rounded-xl px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedVote === "up"
                ? "bg-red-600 text-white"
                : "bg-white/10 hover:bg-white/20"
            }`}
            onClick={() => sendVote(true)}
          >
            👍 Bom
          </button>
          <button
            disabled={!isLive}
            className={`rounded-xl px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedVote === "down"
                ? "bg-red-600 text-white"
                : "bg-white/10 hover:bg-white/20"
            }`}
            onClick={() => sendVote(false)}
          >
            👎 Ruim
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat label="👍" value={votes.up} />
          <Stat label="👎" value={votes.down} />
          <Stat label="Total de avaliações" value={votes.up + votes.down} />
        </div>

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
                      disabled={!isLive}
                      className={`rounded-xl px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                        selectedScores[k] === s
                          ? "bg-red-600 text-white"
                          : "bg-white/10 hover:bg-white/20"
                      }`}
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

        {!isLive && (
          <p className="text-sm opacity-70">
            Interações desativadas: esta ocorrência não está ao vivo no momento.
          </p>
        )}
      </div>
    </div>
  );
}
