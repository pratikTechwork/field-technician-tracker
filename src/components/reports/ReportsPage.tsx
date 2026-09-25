import { useState } from "react";
import type { ReportTab } from "../../types/reports";
import VisitReport from "./VisitReport";
import ExpenseReport from "./ExpenseReport";
import BucketCountReport from "./BucketCountReport";

const TABS: { id: ReportTab; label: string; description: string }[] = [
  {
    id: "daily-visit",
    label: "Daily Visit Count",
    description: "Punch-in / punch-out visits by day",
  },
  {
    id: "monthly-visit",
    label: "Monthly Visit Count",
    description: "Punch-in / punch-out visits by month",
  },
  {
    id: "expense",
    label: "Weekly & Monthly Expense",
    description: "Charges and totals from punch-out",
  },
  {
    id: "bucket",
    label: "Technician Bucket Count",
    description: "Pending and complete complaints per technician, by month/year",
  },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("daily-visit");
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <main className="main">
      <div className="reports-intro">
        <h1 className="reports-page-title">Admin Reports</h1>
        <p className="reports-page-desc">
          Visit, expense, and technician workload reports with search and filters.
        </p>
      </div>

      <div className="report-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`report-tab ${tab === t.id ? "report-tab-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="report-panel">
        <div className="report-panel-header">
          <h2 className="report-panel-title">{active.label}</h2>
          <p className="report-panel-desc">{active.description}</p>
        </div>

        {tab === "daily-visit" && <VisitReport mode="daily" />}
        {tab === "monthly-visit" && <VisitReport mode="monthly" />}
        {tab === "expense" && <ExpenseReport />}
        {tab === "bucket" && <BucketCountReport />}
      </div>
    </main>
  );
}
