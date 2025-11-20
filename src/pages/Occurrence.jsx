import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl p-3 bg-white/5 text-center">
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function isLiveNow(startsAt, endsAt) {
  const now = new Date();
  const s = startsAt ? new Date(startsAt) : null;
  const e = endsAt ? new Date(endsAt) : null;
  return (!s || s <= now) && (!e || now <= e);
}

export default function Occurrence() {
  const { id } = useParams(); // occurrence_id
  const location = useLocation();
  const nav = useNavigate();

  const [occ, setOcc] = useState(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [avg, setAvg] = useState({ dj: 0, fila: 0, preco: 0, seguranca: 0 });

  const [selectedVote, setSelectedVote] = useState(null);
  const [selectedScores, setSelectedScores] = useState({
    dj: null,
    fila: null,
    preco: null,
    seguranca: null,
  });

  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState("user");
  const [canEdit, setCanEdit] = useState(false);

  async function loadOccurrence() {
    setLoading(true);

    const { data, error } = await supabase
      .from("v_occ_with_event")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    let row = data || null;
    if (error) console.error(error);

    if (!row) {
      const qs = new URLSearchParams(location.search);
      const eventId = qs.get("event");
      const t = qs.get("t");

      if (eventId && t) {
        const { data: occs } = await supabase
          .from("v_occ_with_event")
          .select("*")
          .eq("event_id", eventId)
          .order("starts_at", { ascending: true });

        if (occs?.length) {
          const base = new Date(t);
          const nearest = occs.reduce((a, b) => {
            const da = Math.abs(new Date(a.starts_at) - base);
            const db = Math.abs(new Date(b.starts_at) - base);
            return da < db ? a : b;
          });
          row = nearest;
        }
      }
    }

    if (!row) {
      nav("/home", { replace: true });
      return;
    }

    setOcc(row);
    setLive(isLiveNow(row.starts_at, row.ends_at));

    if (row.id !== id) {
      const qs = new URLSearchParams(location.search);
      nav(`/occ/${row.id}?${qs.toString()}`, { replace: true });
    }

    setLoading(false);
  }

  async function loadVotes() {
    const { data, error } = await supabase
      .from("votes")
      .select("upvote")
      .eq("occurrence_id", id);
    if (error) return;
    const list = data || [];
    setVotes({
      up: list.filter((v) => v.upvote === true).length,
      down: list.filter((v) => v.upvote === false).length,
    });
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

    const { data: vData } = await supabase
      .from("votes")
      .select("upvote")
      .eq("occurrence_id", id)
      .eq("user_id", uid)
      .maybeSingle();

    if (vData) {
      setSelectedVote(vData.upvote ? "up" : "down");
    }

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
    if (!live) return alert("Esta ocorrência não está aberta para votos.");
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return alert("Faça login para votar.");

    const { error } = await supabase
      .from("votes")
      .upsert(
        { occurrence_id: id, user_id: uid, upvote: up },
        { onConflict: "occurrence_id,user_id" }
      );
    if (error) return alert(error.message);
    setSelectedVote(up ? "up" : "down");
    loadVotes();
  }

  async function sendRating(key, score) {
    if (!live) return alert("Esta ocorrência não está aberta para avaliações.");
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return alert("Faça login para avaliar.");

    const { error } = await supabase
      .from("ratings")
      .upsert(
        { occurrence_id: id, user_id: uid, key, score },
        { onConflict: "occurrence_id,user_id,key" }
      );
    if (error) return alert(error.message);
    setSelectedScores((prev) => ({
      ...prev,
      [key]: score,
    }));
    loadRatings();
  }

  async function deleteOccurrence() {
    if (!confirm("Tem certeza que deseja excluir esta ocorrência?")) return;
    const { error } = await supabase
      .from("event_occurrences")
      .delete()
      .eq("id", id);
    if (error) return alert(error.message);
    nav("/home", { replace: true });
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id || null;
      setUserId(uid);

      let r = "user";
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (prof?.role) r = prof.role;
      }
      setRole(r);

      await loadOccurrence();
      await loadVotes();
      await loadRatings();
      if (uid) await loadUserSelections(uid); // pré-marca aqui também
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.search]);

  useEffect(() => {
    if (!occ || !userId) return;
    (async () => {
      const { data: ev } = await supabase
        .from("events")
        .select("created_by")
        .eq("id", occ.event_id)
        .maybeSingle();
      setCanEdit(!!userId && (userId === ev?.created_by || role === "admin"));
    })();
  }, [occ, userId, role]);

  if (loading) return null;

  const when =
    (occ.starts_at
      ? new Date(occ.starts_at).toLocaleString("pt-BR")
      : "Sem início") +
    (occ.ends_at
      ? ` — ${new Date(occ.ends_at).toLocaleTimeString("pt-BR")}`
      : "");

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => nav("/home")}
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
              Editar evento-base
            </button>
          )}
          {canEdit && (
            <button
              onClick={deleteOccurrence}
              className="rounded-full px-3 py-2 bg-red-700/70 hover:bg-red-700"
            >
              Excluir ocorrência
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-4 bg-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{occ.title}</h1>
            <p className="opacity-80">{occ.venue || "Sem local"}</p>
            <p className="text-xs opacity-70 mt-1">{when}</p>
            {occ.description && (
              <p className="text-sm opacity-80 mt-1">{occ.description}</p>
            )}
          </div>
          {live && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-700/30 text-red-300">
              AO VIVO
            </span>
          )}
        </div>

        {occ.image_url && (
          <img
            src={occ.image_url}
            alt="Capa"
            className="w-full h-56 object-cover rounded-2xl"
          />
        )}

        <div className="mt-2 flex gap-2">
          <button
            disabled={!live}
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
            disabled={!live}
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
          <p className="font-semibold text-lg">Avalie conforme sua satisfação:</p>

          <div className="grid md:grid-cols-2 gap-3">
            {["dj", "fila", "preco", "seguranca"].map((k) => (
              <div key={k} className="rounded-2xl p-4 bg-white/5">
                <p className="font-semibold.capitalize">{k}</p>
                <p className="text-sm opacity-80">
                  Média: {avg[k] ? avg[k].toFixed(1) : "0.0"}
                </p>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      disabled={!live}
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

        {!live && (
          <p className="text-sm opacity-70">
            Interações desativadas: esta ocorrência não está ao vivo.
          </p>
        )}
      </div>
    </div>
  );
}
