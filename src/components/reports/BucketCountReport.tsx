import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase, TABLE_NAME } from "../../supabase";
import { Complaint } from "../../types";
import { matchesSearch } from "../../lib/reportUtils";
import {
  COMPLAINT_STATUS_OPTIONS,
  displayComplaintStatus,
  getComplaintStatusClass,
  isPendingComplaintStatus,
} from "../../types";
import { downloadTablesCsv } from "../../lib/csvExport";
import { formatDateInput, toComplaintIdKey } from "../../lib/reportUtils";

export default function BucketCountReport() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [technician, setTechnician] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setComplaints((data || []) as Complaint[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pending = useMemo(
    () => complaints.filter((c) => isPendingComplaintStatus(c.status)),
    [complaints]
  );

  const filteredPending = useMemo(() => {
    return pending.filter((c) => {
      if (
        statusFilter &&
        displayComplaintStatus(c.status) !== statusFilter
      ) {
        return false;
      }
      if (
        technician &&
        !c.technician_name?.toLowerCase().includes(technician.toLowerCase())
      ) {
        return false;
      }
      return matchesSearch(search, [
        c.ticket_id,
        c.client_name,
        c.outlet_name,
        c.technician_name,
        c.issue_type,
        c.status,
      ]);
    });
  }, [pending, search, technician, statusFilter]);

  const buckets = useMemo(() => {
    const map = new Map<
      string,
      {
        technicianName: string;
        technicianUuid: string;
        pendingCount: number;
        complaints: Complaint[];
      }
    >();

    for (const c of filteredPending) {
      const name = c.technician_name?.trim() || "Unassigned";
      const key = c.technician_uuid || name;
      const cur = map.get(key) ?? {
        technicianName: name,
        technicianUuid: c.technician_uuid || "",
        pendingCount: 0,
        complaints: [],
      };
      cur.pendingCount += 1;
      cur.complaints.push(c);
      map.set(key, cur);
    }

    return [...map.values()].sort((a, b) => b.pendingCount - a.pendingCount);
  }, [filteredPending]);

  const statusOptions = useMemo(
    () => COMPLAINT_STATUS_OPTIONS.filter((s) => s !== "Complete"),
    []
  );

  const totalPending = filteredPending.length;

  const handleDownloadCsv = () => {
    const dateStamp = formatDateInput(new Date());
    downloadTablesCsv(`bucket-count-report-${dateStamp}.csv`, [
      {
        headers: ["Technician", "Pending Count"],
        rows: buckets.map((b) => [b.technicianName, b.pendingCount]),
      },
      {
        headers: [
          "Technician",
          "Zoho Ticket",
          "Complaint ID",
          "Client",
          "Outlet",
          "Issue",
          "Date",
          "Status",
        ],
        rows: buckets.flatMap((b) =>
          b.complaints.map((c) => [
            b.technicianName,
            c.ticket_id,
            toComplaintIdKey(c.complaint_id) || "—",
            c.client_name,
            c.outlet_name,
            c.issue_type || "—",
            c.date_of_complaint,
            displayComplaintStatus(c.status),
          ])
        ),
      },
    ]);
  };

  return (
    <div>
      <div className="report-filters">
        <div className="filter-group">
          <label className="form-label">Technician</label>
          <input
            type="text"
            className="form-input"
            placeholder="Filter by name"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="form-label">Status</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All (Pending + In Progress)</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group filter-group-search">
          <label className="form-label">Search</label>
          <div className="table-search" style={{ width: "100%" }}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Ticket, client, outlet…"
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
          Failed to load complaints: {error}
        </div>
      )}

      <div className="stats-grid stats-grid-2">
        <div className="stat-card">
          <div className="stat-icon yellow">🪣</div>
          <div className="stat-info">
            <div className="stat-value">{buckets.length}</div>
            <div className="stat-label">Technicians with Pending Work</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">📋</div>
          <div className="stat-info">
            <div className="stat-value">{totalPending}</div>
            <div className="stat-label">Total Pending Complaints</div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-card-header">
          <div>
            <span className="table-card-title">Technician Bucket Count</span>
            <span className="table-card-count">
              Pending and In Progress complaints only
            </span>
          </div>
        </div>
        <div className="table-wrapper report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Technician</th>
                <th>Pending Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="loading-row">
                  <td colSpan={4}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      <div className="loading-spinner dark"></div>
                      Loading bucket counts…
                    </div>
                  </td>
                </tr>
              ) : buckets.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <div className="empty-state-icon">✅</div>
                      <div className="empty-state-title">No pending buckets</div>
                      <div className="empty-state-text">
                        All assigned complaints appear completed
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                buckets.map((b, i) => (
                  <Fragment key={b.technicianUuid || b.technicianName}>
                    <tr>
                      <td className="sn-col">{i + 1}</td>
                      <td>{b.technicianName}</td>
                      <td>
                        <span className="badge badge-pending">{b.pendingCount}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost-edit"
                          onClick={() =>
                            setExpandedTech(
                              expandedTech === b.technicianName
                                ? null
                                : b.technicianName
                            )
                          }
                        >
                          {expandedTech === b.technicianName
                            ? "Hide"
                            : "View"} Details
                        </button>
                      </td>
                    </tr>
                    {expandedTech === b.technicianName && (
                      <tr key={`${b.technicianName}-detail`}>
                        <td colSpan={4} style={{ padding: 0, background: "#f8fafc" }}>
                          <div className="bucket-detail">
                            <table className="report-table nested-table">
                              <thead>
                                <tr>
                                  <th>Ticket ID</th>
                                  <th>Client</th>
                                  <th>Outlet</th>
                                  <th>Issue</th>
                                  <th>Date</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {b.complaints.map((c) => (
                                  <tr key={c.complaint_id ?? c.ticket_id}>
                                    <td>
                                      <span className="ticket-id">{c.ticket_id}</span>
                                    </td>
                                    <td title={c.client_name}>{c.client_name}</td>
                                    <td title={c.outlet_name}>{c.outlet_name}</td>
                                    <td title={c.issue_type}>{c.issue_type || "—"}</td>
                                    <td>{c.date_of_complaint}</td>
                                    <td>
                                      <span
                                        className={getComplaintStatusClass(
                                          c.status
                                        )}
                                      >
                                        {displayComplaintStatus(c.status)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
