import type { User } from "@supabase/supabase-js";
import { formatUserRole, getUserDisplayName } from "../lib/auth";

interface Props {
  user: User;
  role: "technician" | "unknown";
  onSignOut: () => Promise<void> | void;
}

export default function AccessDeniedPage({ user, role, onSignOut }: Props) {
  const roleMessage =
    role === "technician"
      ? "You do not have any access to this application."
      : "Your account does not have a valid role configured.";
  const detailMessage =
    role === "technician"
      ? "Technicians cannot open complaints or reports from this frontend."
      : "Ask an admin to set your metadata role to admin or user.";

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-compact">
        <div className="auth-brand">
          <div className="auth-brand-icon">FT</div>
          <div>
            <h1 className="auth-title">Access Restricted</h1>
            <p className="auth-subtitle">{roleMessage}</p>
          </div>
        </div>

        <div className="access-denied-summary">
          <div className="access-denied-label">Signed in as</div>
          <div className="access-denied-user">{getUserDisplayName(user)}</div>
          <div className="access-denied-role">Role: {formatUserRole(role)}</div>
        </div>

        <div className="alert alert-warning">{detailMessage}</div>

        <button type="button" className="btn btn-secondary" onClick={onSignOut}>
          Sign out
        </button>
      </section>
    </main>
  );
}
