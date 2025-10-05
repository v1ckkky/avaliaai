import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

/* Card de ocorrência */
function OccCard({ occ, onOpen, live }) {
  const starts =
    occ.starts_at ? new Date(occ.starts_at).toLocaleString("pt-BR") : "Sem início";
  const ends =
    occ.ends_at ? new Date(occ.ends_at).toLocaleTimeString("pt-BR") : null;

  return (
    <button
      onClick={() => onOpen(occ)}
      className="w-full text-left rounded-2xl overflow-hidden bg-white/5 hover:bg-white/10 transition"
    >
      {occ.image_url && (
        <img src={occ.image_url} alt="" className="w-full h-36 object-cover" />
      )}
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{occ.title}</p>
          <p className="text-sm opacity-80 truncate">{occ.venue || "Sem local"}</p>
          <p className="text-xs opacity-60 mt-1">
            {starts}
            {ends ? ` — ${ends}` : ""}
          </p>
        </div>
        {live && (
          <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-red-700/30 text-red-300">
            AO VIVO
          </span>
        )}
      </div>
    </button>
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

  // Drawer/perfil
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ display_name: "", role: "user" });
  const canCreate = profile.role === "owner" || profile.role === "admin";

  async function load() {
    setLoading(true);
    let q;
    if (tab === "live") {
      q = supabase.from("v_occ_live").select("*").order("starts_at", { ascending: false });
    } else if (tab === "upcoming") {
      q = supabase.from("v_occ_upcoming").select("*").order("starts_at", { ascending: true });
    } else {
      q = supabase.from("v_occ_past").select("*").order("starts_at", { ascending: false });
    }
    const { data, error } = await q;
    setRows(error ? [] : data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
    })();
  }, []);

  // abre ocorrência com querystring estável (event + starts_at)
  function openOccurrence(occ) {
    const qs = new URLSearchParams({
      event: occ.event_id,
      t: occ.starts_at || "",
    }).toString();
    nav(`/occ/${occ.id}?${qs}`);
  }

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
        {/* Abas */}
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-xl ${
                tab === t.id ? "bg-white/20" : "bg-white/10 hover:bg-white/15"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={load}
            className="ml-auto px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15"
            title="Atualizar"
          >
            Atualizar
          </button>
        </div>

        <h2 className="text-lg font-semibold">
          {TABS.find((t) => t.id === tab)?.label}
        </h2>

        {loading && <p>Carregando…</p>}
        {!loading && rows.length === 0 && (
          <p className="opacity-80">
            {tab === "live" && "Nenhuma ocorrência ao vivo no momento."}
            {tab === "upcoming" && "Sem ocorrências futuras."}
            {tab === "past" && "Sem ocorrências passadas."}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((occ) => (
            <OccCard
              key={occ.id}
              occ={occ}
              live={tab === "live"}
              onOpen={openOccurrence}
            />
          ))}
        </div>
      </main>

      {/* DRAWER PERFIL */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
          />
          {/* painel lateral */}
          <aside
            className="fixed right-0 top-0 h-full w-full sm:w-[380px] bg-neutral-900 border-l border-white/10 p-5 overflow-y-auto"
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

            <div className="rounded-2xl p-4 bg-white/5 space-y-1 mb-4">
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
