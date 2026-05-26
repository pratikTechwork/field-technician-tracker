import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AppLayout, { AppPage } from "./components/AppLayout";
import AccessDeniedPage from "./components/AccessDeniedPage";
import Dashboard from "./components/Dashboard";
import LoginPage from "./components/LoginPage";
import ReportsPage from "./components/reports/ReportsPage";
import { formatUserRole, getUserDisplayName, getUserRole } from "./lib/auth";
import { supabase } from "./supabase";

export default function App() {
  const [page, setPage] = useState<AppPage>("complaints");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      setSession(error ? null : data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const role = getUserRole(user);
  const canViewReports = role === "admin";
  const canAccessApp = role === "admin" || role === "user";

  const availablePages = useMemo<AppPage[]>(
    () => (canViewReports ? ["complaints", "reports"] : ["complaints"]),
    [canViewReports]
  );

  useEffect(() => {
    if (!availablePages.includes(page)) {
      setPage("complaints");
    }
  }, [availablePages, page]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-compact auth-loading-card">
          <div className="loading-spinner dark"></div>
          <p>Checking your session...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!canAccessApp) {
    return (
      <AccessDeniedPage
        user={user}
        role={role === "technician" ? "technician" : "unknown"}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <AppLayout
      page={page}
      onPageChange={setPage}
      availablePages={availablePages}
      headerActions={
        <>
          <div className="header-user">
            <div className="header-user-name">{getUserDisplayName(user)}</div>
            <div className="header-user-role">{formatUserRole(role)}</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
            Sign out
          </button>
        </>
      }
    >
      {page === "complaints" ? <Dashboard user={user} /> : <ReportsPage />}
    </AppLayout>
  );
}
