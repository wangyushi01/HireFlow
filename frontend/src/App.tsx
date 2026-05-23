import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";

const AppLayout = lazy(() => import("./AppLayout"));

function InitialLoader() {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0c0f1d 0%, #1a1f3a 50%, #151b30 100%)",
    }}>
      <div style={{
        width: 36, height: 36,
        border: "3px solid rgba(102,126,234,0.2)",
        borderTopColor: "#667eea",
        borderRadius: "50%",
        animation: "loader-spin 0.8s linear infinite",
      }} />
      <div style={{ marginTop: 16, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
        加载中...
      </div>
    </div>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <InitialLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Suspense fallback={<InitialLoader />}>
      <AppLayout />
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
