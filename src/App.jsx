import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

import Start from "./pages/Start";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Occurrence from "./pages/Occurrence"; // <== importante
import CreateEvent from "./pages/CreateEvent";
import Settings from "./pages/Settings";
import AdminRequests from "./pages/AdminRequests";
import EditEvent from "./pages/EditEvent";
import OwnerDashboard from "./pages/OwnerDashboard";
import OwnerApply from "./pages/OwnerApply";

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
        {/* Rotas públicas */}
        <Route path="/" element={<Start />} />
        <Route path="/login" element={session ? <Navigate to="/home" /> : <Login />} />
        <Route path="/signup" element={session ? <Navigate to="/home" /> : <Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* 🔓 As ocorrências agora são públicas */}
        <Route path="/occ/:id" element={<Occurrence />} />
        <Route path="/event/:id" element={<Occurrence />} />

        {/* Rotas protegidas (somente logadas) */}
        <Route path="/home" element={session ? <Home /> : <Navigate to="/login" />} />
        <Route path="/create-event" element={session ? <CreateEvent /> : <Navigate to="/login" />} />
        <Route path="/settings" element={session ? <Settings /> : <Navigate to="/login" />} />
        <Route path="/admin/requests" element={session ? <AdminRequests /> : <Navigate to="/login" />} />
        <Route path="/event/:id/edit" element={session ? <EditEvent /> : <Navigate to="/login" />} />
        <Route path="/owner" element={session ? <OwnerDashboard /> : <Navigate to="/login" />} />
        <Route path="/owner/apply" element={session ? <OwnerApply /> : <Navigate to="/login" />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
