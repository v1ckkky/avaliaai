import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

import Start from "./pages/Start";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import EventRoom from "./pages/Event";
import CreateEvent from "./pages/CreateEvent";
import Settings from "./pages/Settings";
import AdminRequests from "./pages/AdminRequests";
import EditEvent from "./pages/EditEvent";

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) return null;

  return (
    <BrowserRouter>
  <Routes>
    <Route path="/" element={<Start />} />
    <Route path="/login" element={session ? <Navigate to="/home" /> : <Login />} />
    <Route path="/signup" element={session ? <Navigate to="/home" /> : <Signup />} />

    <Route path="/home" element={session ? <Home /> : <Navigate to="/login" />} />
    <Route path="/create-event" element={session ? <CreateEvent /> : <Navigate to="/login" />} />
    <Route path="/settings" element={session ? <Settings /> : <Navigate to="/login" />} />
    <Route path="/admin/requests" element={session ? <AdminRequests /> : <Navigate to="/login" />} />

    <Route path="/event/:id" element={session ? <EventRoom /> : <Navigate to="/login" />} />
    <Route path="/event/:id/edit" element={session ? <EditEvent /> : <Navigate to="/login" />} />

    {/* sempre por último */}
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>
</BrowserRouter>
  );
}



