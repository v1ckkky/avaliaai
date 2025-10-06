import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

/* Ícones simples */
function RefreshIcon({ className = "", size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}
function SearchIcon({ size = 18, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function Heart({ filled, size = 18, className = "" }) {
  // traço + preenchimento suave
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      fill={filled ? "currentColor" : "none"}
    >
      <path d="M20.8 4.6c-1.8-1.8-4.8-1.8-6.6 0L12 6.8l-2.2-2.2c-1.8-1.8-4.8-1.8-6.6 0-1.8 1.8-1.8 4.8 0 6.6L12 21l8.8-9.8c1.8-1.8 1.8-4.8 0-6.6Z" />
    </svg>
  );
}

/* Card */
function OccCard({ occ, onOpen, live, isFav, onToggleFav }) {
  const starts = occ.starts_at
    ? new Date(occ.starts_at).toLocaleString("pt-BR")
    : "Sem início";
  const ends = occ.ends_at ? new Date(occ.ends_at).toLocaleTimeString("pt-BR") : null;

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-white/5 hover:bg-white/10 transition">
      {occ.image_url && (
        <img
          src={occ.image_url}
          alt=""
          className="w-full h-36 object-cover cursor-pointer"
          onClick={() => onOpen(occ)}
        />
      )}
      <div className="p-4 flex items-start justify-between gap-3">
        <button className="min-w-0 text-left" onClick={() => onOpen(occ)}>
          <p className="font-semibold truncate">{occ.title}</p>
          <p className="text-sm opacity-80 truncate">{occ.venue || "Sem local"}</p>
          <p className="text-xs opacity-60 mt-1">
            {starts}
            {ends ? ` — ${ends}` : ""}
          </p>
        </button>

        <div className="flex flex-col items-end gap-2">
          {live && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-700/30 text-red-300">
              AO VIVO
            </span>
          )}
          <button
            title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            aria-label="Favorito"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav(occ.event_id, isFav);
            }}
            className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition ${
              isFav ? "text-pink-400" : "text-white/70 hover:text-white"
            }`}
          >
            <Heart filled={isFav} />
          </button>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "live", label: "Eventos ao vivo" },
  { id: "upcoming", label: "Eventos futuros" },
  { id: "past", label: "Eventos passados" },
];

export default function Home() {
  const nav = useNavigate();

  const [tab, setTab] = useState("live");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Busca
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");

  // Favoritos (user scope)
  const [favSet, setFavSet] = useState(new Set()); // event_id
  const [favEvents, setFavEvents] = useState([]);  // [{id,title,venue,image_url}]
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ display_name: "", role: "user" });
  const canCreate = profile.role === "owner" || profile.role === "admin";

  // Debounce busca
  useEffect(() => {
    const t = setTimeout(() => setQuery(typed.trim()), 300);
    return () => clearTimeout(t);
  }, [typed]);

  // Carregar favoritos (ids)
  async function loadFavorites() {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) {
      setFavSet(new Set());
      setFavEvents([]);
      return;
    }
    const { data } = await supabase
      .from("favorites")
      .select("event_id")
      .eq("user_id", uid);
    const ids = (data || []).map((r) => r.event_id);
    setFavSet(new Set(ids));

    // carrega dados dos eventos para mostrar no Perfil
    if (ids.length) {
      const { data: evs } = await supabase
        .from("events")
        .select("id,title,venue,image_url")
        .in("id", ids)
        .order("title", { ascending: true });
      setFavEvents(evs || []);
    } else {
      setFavEvents([]);
    }
  }

  // Carregar ocorrências
  async function load() {
    setLoading(true);
    const base =
      tab === "live" ? "v_occ_live" : tab === "upcoming" ? "v_occ_upcoming" : "v_occ_past";

    let q = supabase.from(base).select("*");

    if (tab === "live") q = q.order("starts_at", { ascending: false });
    else if (tab === "upcoming") q = q.order("starts_at", { ascending: true });
    else q = q.order("starts_at", { ascending: false });

    if (query) {
      const term = `%${query}%`;
      q = q.or(`title.ilike.${term},venue.ilike.${term}`);
    }

    const { data, error } = await q;
    setRows(error ? [] : data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, query]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUser(u?.user || null);
      if (u?.user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, role")
          .eq("id", u.user.id)
          .maybeSingle();
        if (prof) setProfile(prof);
      }
      await loadFavorites();
    })();
  }, []);

  // Alterna favorito
  async function toggleFavorite(eventId, isFav) {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return alert("Faça login para usar favoritos.");

    if (isFav) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", uid)
        .eq("event_id", eventId);
      if (!error) {
        const next = new Set(favSet);
        next.delete(eventId);
        setFavSet(next);
        setFavEvents((old) => old.filter((e) => e.id !== eventId));
      }
    } else {
      const { error } = await supabase
        .from("favorites")
        .upsert({ user_id: uid, event_id: eventId }); // PK evita duplicar
      if (!error) {
        const next = new Set(favSet);
        next.add(eventId);
        setFavSet(next);

        // fetch rápido desse evento para a lista do perfil
        const { data: ev } = await supabase
          .from("events")
          .select("id,title,venue,image_url")
          .eq("id", eventId)
          .maybeSingle();
        if (ev) {
          setFavEvents((old) => {
            const exists = old.some((e) => e.id === ev.id);
            return exists ? old : [...old, ev].sort((a, b) => a.title.localeCompare(b.title));
          });
        }
      }
    }
  }

  // Abrir ocorrência normalmente (cartão da lista)
  function openOccurrence(occ) {
    const qs = new URLSearchParams({
      event: occ.event_id,
      t: occ.starts_at || "",
    }).toString();
    nav(`/occ/${occ.id}?${qs}`);
  }

  // Abrir um favorito: tenta ao vivo -> futuro -> passado
  async function openFavoriteEvent(eventId) {
    const tryGet = async (view, asc) => {
      const { data } = await supabase
        .from(view)
        .select("id, event_id, starts_at")
        .eq("event_id", eventId)
        .order("starts_at", { ascending: asc })
        .limit(1)
        .maybeSingle();
      return data || null;
    };

    let occ =
      (await tryGet("v_occ_live", false)) ||
      (await tryGet("v_occ_upcoming", true)) ||
      (await tryGet("v_occ_past", false));

    if (!occ) return alert("Este evento não possui ocorrências no momento.");

    const qs = new URLSearchParams({
      event: occ.event_id,
      t: occ.starts_at || "",
    }).toString();
    nav(`/occ/${occ.id}?${qs}`);
  }

  const tabLabel = useMemo(
    () => TABS.find((t) => t.id === tab)?.label || "",
    [tab]
  );

  return (
    <div className="min-h-screen p-6">
      {/* HEADER */}
      <header className="max-w-4xl mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold">Avalia Aí</h1>

        <div className="flex gap-2">
          {canCreate && (
            <button
              onClick={() => nav("/create-event")}
              className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
            >
              Novo Evento
            </button>
          )}
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20 flex items-center gap-2"
            title="Perfil"
          >
            <span>👤</span>
            <span>Perfil</span>
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-4xl mx-auto mt-6 space-y-4">
        {/* Filtros/top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative inline-block">
            <label htmlFor="tabSelect" className="text-sm opacity-80 mr-2">
              Filtrar por:
            </label>
            <div className="relative inline-block">
              <select
                id="tabSelect"
                value={tab}
                onChange={(e) => setTab(e.target.value)}
                className="appearance-none rounded-xl bg-neutral-800/80 text-white px-3 py-2 pr-8 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="live">Eventos ao vivo</option>
                <option value="upcoming">Eventos futuros</option>
                <option value="past">Eventos passados</option>
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-70">
                ▾
              </span>
            </div>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Pesquisar por título"
              className="w-full rounded-xl bg-white/10 pl-10 pr-9 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            {typed && (
              <button
                onClick={() => setTyped("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm opacity-70 hover:opacity-100"
                title="Limpar"
                aria-label="Limpar pesquisa"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={async () => {
              await loadFavorites();
              await load();
            }}
            title="Atualizar"
            aria-label="Atualizar"
            className="rounded-full p-2 bg-white/10 hover:bg-white/20 transition ml-auto sm:ml-0"
          >
            <RefreshIcon className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <h2 className="text-lg font-semibold">{tabLabel}</h2>

        {loading && <p>Carregando…</p>}
        {!loading && rows.length === 0 && (
          <p className="opacity-80">
            {tab === "live"
              ? "Nenhuma ocorrência ao vivo no momento."
              : tab === "upcoming"
              ? "Sem ocorrências futuras."
              : "Sem ocorrências passadas."}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((occ) => {
            const isFav = favSet.has(occ.event_id);
            return (
              <OccCard
                key={occ.id}
                occ={occ}
                live={tab === "live"}
                isFav={isFav}
                onToggleFav={toggleFavorite}
                onOpen={openOccurrence}
              />
            );
          })}
        </div>
      </main>

      {/* DRAWER PERFIL */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-neutral-900 border-l border-white/10 p-5 overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">👤 Perfil</h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Perfil */}
            <div className="rounded-2xl p-4 bg-white/5 space-y-1 mb-6">
              <p className="text-sm opacity-80">Logada como</p>
              <p className="font-semibold truncate">
                {profile.display_name || user?.email || "Usuária"}
              </p>
              <p className="text-xs opacity-70">
                Papel:{" "}
                <span className="inline-block rounded-full px-2 py-0.5 bg-white/10">
                  {profile.role || "user"}
                </span>
              </p>
            </div>

            {/* Favoritos */}
            <div className="mb-6">
              <h4 className="font-semibold mb-3">Favoritos</h4>

              {favEvents.length === 0 && (
                <p className="text-sm opacity-70">Nenhum evento favorito ainda.</p>
              )}

              <div className="space-y-2">
                {favEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl p-3 bg-white/5 flex items-center gap-3"
                  >
                    {ev.image_url ? (
                      <img
                        src={ev.image_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-white/10 grid place-items-center text-sm">
                        🎟️
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{ev.title}</p>
                      <p className="text-xs opacity-70 truncate">{ev.venue || "—"}</p>
                    </div>

                    <button
                      onClick={() => openFavoriteEvent(ev.id)}
                      className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20 text-sm"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => toggleFavorite(ev.id, true)}
                      className="rounded-full p-2 bg-white/10 hover:bg-white/20 text-pink-400"
                      title="Remover dos favoritos"
                      aria-label="Remover dos favoritos"
                    >
                      <Heart filled />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Ações de conta */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  nav("/settings");
                }}
                className="w-full text-left rounded-xl px-3 py-3 bg-white/10 hover:bg-white/20 flex items-center gap-2"
              >
                Configurações
              </button>

              {profile.role === "admin" && (
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    nav("/admin/requests");
                  }}
                  className="w-full text-left rounded-xl px-3 py-3 bg-white/10 hover:bg-white/20 flex items-center gap-2"
                >
                  🛡️ Área do Admin
                </button>
              )}

              {canCreate && (
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    nav("/create-event");
                  }}
                  className="w-full text-left rounded-xl px-3 py-3 bg-white/10 hover:bg-white/20 flex items-center gap-2"
                >
                  Criar novo evento
                </button>
              )}

              <button
                onClick={async () => {
                  setDrawerOpen(false);
                  await supabase.auth.signOut();
                  nav("/");
                }}
                className="w-full text-left rounded-xl px-3 py-3 bg-white/10 hover:bg-white/20 flex items-center gap-2"
              >
                Sair
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
