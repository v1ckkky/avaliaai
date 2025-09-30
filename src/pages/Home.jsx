import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";


function EventCard({ ev, onOpen }) {
  return (
    <button
      onClick={() => onOpen(ev)}
      className="w-full text-left rounded-2xl overflow-hidden bg-white/5 hover:bg-white/10 transition"
    >
      {ev.image_url && (
        <img src={ev.image_url} alt="" className="w-full h-36 object-cover" />
      )}

      <div className="p-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-semibold truncate">{ev.title}</p>
          <p className="text-sm opacity-80 truncate">{ev.venue || "Sem local"}</p>
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

  // drawer (perfil)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ display_name: "", role: "user" });
  const canCreate = profile.role === "owner" || profile.role === "admin";


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

  return (
    <div className="min-h-screen p-6">
      {/* HEADER */}
      <header className="max-w-4xl mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold">Avalia Aí</h1>

        <div className="flex gap-2">
          {/* Mostra só para proprietários/admin */}
          {canCreate && (
            <button
              onClick={() => nav("/create-event")}
              className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
            >
              Novo Evento
            </button>
          )}

          {/* Perfil sempre visível */}
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

      {/* DRAWER + OVERLAY */}
      {drawerOpen && (
        <>
          {/* overlay */}
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
              <h3 className="text-lg font-semibold flex items-center gap-2">
                👤 Perfil
              </h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-full px-3 py-2 bg-white/10 hover:bg-white/20"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* bloco do usuário */}
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

            {/* ações do perfil */}
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

              {/* Mostra só se for owner/admin */}
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

              {/* 👉 só admin vê este atalho */}
              {profile.role === "admin" && (
                <button
                  onClick={() => { setDrawerOpen(false); nav("/admin/requests"); }}
                  className="w-full text-left rounded-xl px-3 py-3 bg-white/10 hover:bg-white/20 flex items-center gap-2"
                >
                  🛡️ Área do Admin
                </button>
              )}

              <button
                onClick={() => {
                  setDrawerOpen(false);
                  supabase.auth.signOut();
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

