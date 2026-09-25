import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, SALES_TABLE } from "../../supabase";
import type { SalesVisit } from "../../types/sales";
import { formatDateInput, formatDateTime, matchesSearch } from "../../lib/reportUtils";
import { formatDuration, mapsLinkForCoordinate, visitStatus } from "../../lib/salesUtils";
import { downloadTablesCsv } from "../../lib/csvExport";
import SalesVisitDetailModal from "./SalesVisitDetailModal";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function visitDateKey(v: SalesVisit): string {
  return v.punch_in_time || v.created_at || "";
}

export default function SalesDashboard() {
  const now = new Date();
  const [yearFilter, setYearFilter] = useState(String(now.getFullYear()));
  const [monthFilter, setMonthFilter] = useState(
    String(now.getMonth() + 1).padStart(2, "0")
  );
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "complete" | "incomplete">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<SalesVisit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detailVisit, setDetailVisit] = useState<SalesVisit | null>(null);
  const tableCardRef = useRef<HTMLDivElement | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from(SALES_TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setVisits((data || []) as SalesVisit[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const scrollToTable = useCallback(() => {
    tableCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const v of visits) {
      const t = v.type?.trim();
      if (t) types.add(t);
    }
    return Array.from(types).sort();
  }, [visits]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    years.add(now.getFullYear());
    for (const v of visits) {
      const y = parseInt(visitDateKey(v).slice(0, 4), 10);
      if (!isNaN(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [visits]);

  const filtered = useMemo(() => {
    return visits.filter((v) => {
      const datePart = visitDateKey(v);
      if (yearFilter && datePart.slice(0, 4) !== yearFilter) return false;
      if (monthFilter && datePart.slice(5, 7) !== monthFilter) return false;

      if (statusFilter && visitStatus(v) !== statusFilter) return false;
      if (typeFilter && (v.type?.trim() || "") !== typeFilter) return false;
      return matchesSearch(search, [
        v.client_name,
        v.client_email,
        v.client_phone_number,
        v.description,
        v.punch_in_location,
        v.punch_out_location,
        v.type,
      ]);
    });
  }, [visits, statusFilter, typeFilter, search, yearFilter, monthFilter]);

  const stats = useMemo(() => {
    const complete = filtered.filter((v) => visitStatus(v) === "complete").length;
    const uniqueClients = new Set(
      filtered.map((v) =>
        (v.client_email || v.client_phone_number || v.client_name || v.id).toLowerCase()
      )
    ).size;
    return {
      total: filtered.length,
      complete,
      incomplete: filtered.length - complete,
      uniqueClients,
    };
  }, [filtered]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of filtered) {
      const key = v.type?.trim() || "Unspecified";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const applyStatusFilter = (value: "" | "complete" | "incomplete") => {
    setStatusFilter(value);
    scrollToTable();
  };

  const handleDownloadCsv = () => {
    const dateStamp = formatDateInput(new Date());
    downloadTablesCsv(`sales-visit-report-${dateStamp}.csv`, [
      {
        headers: ["Type", "Visits"],
        rows: byType.map(([type, count]) => [type, count]),
      },
      {
        headers: [
          "Client Name",
          "Client Email",
          "Client Phone",
          "Type",
          "Punch In",
          "Punch In Location",
          "Punch Out",
          "Punch Out Location",
          "Duration",
          "Description",
          "Status",
        ],
        rows: filtered.map((v) => [
          v.client_name || "—",
          v.client_email || "—",
          v.client_phone_number || "—",
          v.type || "—",
          formatDateTime(v.punch_in_time),
          v.punch_in_location || "—",
          formatDateTime(v.punch_out_time),
          v.punch_out_location || "—",
          formatDuration(v.punch_in_time, v.punch_out_time),
          v.description || "—",
          visitStatus(v) === "complete" ? "Complete" : "Incomplete",
        ]),
      },
    ]);
  };

  return (
    <div>
      <div className="report-filters">
        <div className="filter-group">
          <label className="form-label">Year</label>
          <select
            className="form-select"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="">All Years</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="form-label">Month</label>
          <select
            className="form-select"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">All Months</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="form-label">Visit Type</label>
          <select
            className="form-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="form-label">Status</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "" | "complete" | "incomplete")
            }
          >
            <option value="">All</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </div>
        <div className="filter-group filter-group-search">
          <label className="form-label">Search</label>
          <div className="table-search" style={{ width: "100%" }}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Client name, email, phone, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </div>
        <div className="filter-group filter-group-actions">
          <button
            className="btn btn-secondary"
            onClick={handleDownloadCsv}
            type="button"
            disabled={loading}
          >
            📥 Download CSV
          </button>
          <button className="btn btn-secondary" onClick={fetchData} type="button">
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          Failed to load sales visits: {error}
        </div>
      )}

      <div className="stats-grid">
        <div
          className={`stat-card stat-card-clickable ${statusFilter === "" ? "stat-card-active" : ""}`}
          onClick={() => applyStatusFilter("")}
          title="Show all visits"
        >
          <div className="stat-icon blue">🧑‍💼</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Client Visits</div>
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${statusFilter === "complete" ? "stat-card-active" : ""}`}
          onClick={() => applyStatusFilter("complete")}
          title="Show complete visits"
        >
          <div className="stat-icon green">✅</div>
          <div className="stat-info">
            <div className="stat-value">{stats.complete}</div>
            <div className="stat-label">Complete</div>
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${statusFilter === "incomplete" ? "stat-card-active" : ""}`}
          onClick={() => applyStatusFilter("incomplete")}
          title="Show incomplete visits (no punch-out)"
        >
          <div className="stat-icon yellow">⚠️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.incomplete}</div>
            <div className="stat-label">Incomplete (no punch-out)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">👥</div>
          <div className="stat-info">
            <div className="stat-value">{stats.uniqueClients}</div>
            <div className="stat-label">Unique Clients</div>
          </div>
        </div>
      </div>

      {byType.length > 0 && (
        <div className="table-card" style={{ marginBottom: 24 }}>
          <div className="table-card-header">
            <span className="table-card-title">Visits by Type</span>
          </div>
          <div className="table-wrapper report-table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {byType.map(([type, count]) => (
                  <tr key={type}>
                    <td>{type}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="table-card" ref={tableCardRef}>
        <div className="table-card-header">
          <div>
            <span className="table-card-title">Client Visit Log</span>
            <span className="table-card-count">{filtered.length} records</span>
          </div>
        </div>
        <div className="table-wrapper report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Client</th>
                <th>Type</th>
                <th>Punch In</th>
                <th>Punch Out</th>
                <th>Duration</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="loading-row">
                  <td colSpan={9}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      <div className="loading-spinner dark"></div>
                      Loading sales visits…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <div className="empty-state-title">No client visits found</div>
                      <div className="empty-state-text">
                        Adjust the year, month, or filters and try again
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((v, i) => {
                  const status = visitStatus(v);
                  const punchInMapsLink = mapsLinkForCoordinate(v.punch_in_coordinate);

                  return (
                    <tr key={v.id}>
                      <td className="sn-col">{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{v.client_name || "—"}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          {v.client_phone_number || v.client_email || "—"}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-default">{v.type || "—"}</span>
                      </td>
                      <td>{formatDateTime(v.punch_in_time)}</td>
                      <td>{formatDateTime(v.punch_out_time)}</td>
                      <td>{formatDuration(v.punch_in_time, v.punch_out_time)}</td>
                      <td title={v.punch_in_location || undefined}>
                        {v.punch_in_location || "—"}
                        {punchInMapsLink && (
                          <>
                            {" "}
                            <a
                              href={punchInMapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              🗺️
                            </a>
                          </>
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            status === "complete"
                              ? "badge badge-complete"
                              : "badge badge-pending"
                          }
                        >
                          {status === "complete" ? "Complete" : "Incomplete"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost-edit"
                          onClick={() => setDetailVisit(v)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailVisit && (
        <SalesVisitDetailModal visit={detailVisit} onClose={() => setDetailVisit(null)} />
      )}
    </div>
  );
}
