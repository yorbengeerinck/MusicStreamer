import React, { type JSX, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import SelectPage from "./components/SelectPage";
import LoginPage from "./components/LoginPage";
import "./spotify.css";
import { applyInitialTheme, listenSystemThemeChanges } from "./theme";
import { AuthProvider, useAuth } from "./auth";
import ErrorBoundary from "./components/ErrorBoundary";

applyInitialTheme();
listenSystemThemeChanges();

function RequireAuth({ user, children }: { user: "yorben" | "zus"; children: JSX.Element }) {
  const { token, user: authedUser } = useAuth();
  if (!token || authedUser !== user) return <Navigate to="/" replace />;
  return children;
}

function GlobalGuards() {
  useEffect(() => {
    const onCtx = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", onCtx);
    return () => window.removeEventListener("contextmenu", onCtx);
  }, []);
  return null;
}

function ConsoleSilencer() {
  useEffect(() => {
    if (import.meta.env.PROD) {
      const noop = () => {};
      console.log = noop;
      console.debug = noop;
      console.info = noop;
      console.warn = noop;
      console.trace = noop;
      // Laat console.error desgewenst aan of demp hem ook:
      // console.error = noop;
    }
  }, []);
  return null;
}

function DevtoolsBlocker() {
  useEffect(() => {
    if (import.meta.env.PROD && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      try {
        (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = () => {};
      } catch {}
    }
  }, []);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GlobalGuards />
        <ConsoleSilencer />
        <DevtoolsBlocker />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<SelectPage />} />
            <Route path="/login/:user" element={<LoginPage />} />
            <Route
              path="/yorben"
              element={
                <RequireAuth user="yorben">
                  <App />
                </RequireAuth>
              }
            />
            <Route
              path="/zus"
              element={
                <RequireAuth user="zus">
                  <App collection="yenthel" />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);