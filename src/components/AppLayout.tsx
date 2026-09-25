import { ReactNode } from "react";

export type AppPage = "complaints" | "reports" | "sales";

interface Props {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  availablePages?: AppPage[];
  headerActions?: ReactNode;
  children: ReactNode;
}

export default function AppLayout({
  page,
  onPageChange,
  availablePages = ["complaints", "reports"],
  headerActions,
  children,
}: Props) {
  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="header-icon">🔧</div>
          <div>
            <div className="header-title">Complaint Tracker</div>
            <div className="header-subtitle">Complaint Management System</div>
          </div>
        </div>

        {availablePages.length > 1 && (
          <nav className="header-nav">
            {availablePages.includes("complaints") && (
              <button
                type="button"
                className={`nav-tab ${page === "complaints" ? "nav-tab-active" : ""}`}
                onClick={() => onPageChange("complaints")}
              >
                Complaints
              </button>
            )}
            {availablePages.includes("reports") && (
              <button
                type="button"
                className={`nav-tab ${page === "reports" ? "nav-tab-active" : ""}`}
                onClick={() => onPageChange("reports")}
              >
                Reports
              </button>
            )}
            {availablePages.includes("sales") && (
              <button
                type="button"
                className={`nav-tab ${page === "sales" ? "nav-tab-active" : ""}`}
                onClick={() => onPageChange("sales")}
              >
                Sales
              </button>
            )}
          </nav>
        )}

        {headerActions && <div className="header-actions">{headerActions}</div>}
      </header>
      {children}
    </div>
  );
}
