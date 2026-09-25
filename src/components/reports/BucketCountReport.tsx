import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, TABLE_NAME, PUNCHIN_TABLE, PUNCHOUT_TABLE } from "../../supabase";
import { Complaint } from "../../types";
import type { PunchOutRecord, PunchRecord, VisitRow } from "../../types/reports";
import { matchesSearch } from "../../lib/reportUtils";
import {
  COMPLAINT_STATUS_OPTIONS,
  displayComplaintStatus,
  getComplaintStatusClass,
  isPendingComplaintStatus,
} from "../../types";
import { downloadTablesCsv } from "../../lib/csvExport";
import {
  formatComplaintDateDisplay,
  formatDateInput,
  joinVisits,
  toComplaintIdKey,
} from "../../lib/reportUtils";
import ImagePreviewModal from "../ImagePreviewModal";

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

interface Bucket {
  technicianName: string;
  technicianUuid: string;
  totalCount: number;
  pendingCount: number;
  completeCount: number;
  complaints: Complaint[];
}

export default function BucketCountReport() {
  const now = new Date();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [punchins, setPunchins] = useState<PunchRecord[]>([]);
  const [punchouts, setPunchouts] = useState<PunchOutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [technician, setTechnician] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(now.getFullYear()));
  const [monthFilter, setMonthFilter] = useState(
    String(now.getMonth() + 1).padStart(2, "0")
  );
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; alt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tableCardRef = useRef<HTMLDivElement | null>(null);

  const scrollToTable = useCallback(() => {
    tableCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyStatusFilter = useCallback(
    (value: string) => {
      setStatusFilter(value);
      scrollToTable();
    },
    [scrollToTable]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [complaintRes, punchinRes, punchoutRes] = await Promise.all([
      supabase.from(TABLE_NAME).select("*").order("created_at", { ascending: false }),
      supabase.from(PUNCHIN_TABLE).select("*"),
      supabase.from(PUNCHOUT_TABLE).select("*"),
    ]);

    if (complaintRes.error) {
      setError(complaintRes.error.message);
    } else if (punchinRes.error) {
      setError(punchinRes.error.message);
    } else if (punchoutRes.error) {
      setError(punchoutRes.error.message);
    } else {
      setComplaints((complaintRes.data || []) as Complaint[]);
      setPunchins((punchinRes.data || []) as PunchRecord[]);
      setPunchouts((punchoutRes.data || []) as PunchOutRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const visitByComplaintId = useMemo(() => {
    const visits = joinVisits(punchins, punchouts);
    const map = new Map<string, VisitRow>();
    for (const v of visits) {
      if (!map.has(v.complaintId)) map.set(v.complaintId, v);
    }
    return map;
  }, [punchins, punchouts]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    years.add(now.getFullYear());
    for (const c of complaints) {
      const y = parseInt(c.date_of_complaint?.slice(0, 4) || "", 10);
      if (!isNaN(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const datePart = c.date_of_complaint || "";
      if (yearFilter && datePart.slice(0, 4) !== yearFilter) return false;
      if (monthFilter && datePart.slice(5, 7) !== monthFilter) return false;

      if (statusFilter === "PendingProgress") {
        if (!isPendingComplaintStatus(c.status)) return false;
      } else if (statusFilter && displayComplaintStatus(c.status) !== statusFilter) {
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
  }, [complaints, search, technician, statusFilter, yearFilter, monthFilter]);

  const buckets = useMemo(() => {
    const map = new Map<string, Bucket>();

    for (const c of filteredComplaints) {
      const name = c.technician_name?.trim() || "Unassigned";
      const key = c.technician_uuid || name;
      const cur = map.get(key) ?? {
        technicianName: name,
        technicianUuid: c.technician_uuid || "",
        totalCount: 0,
        pendingCount: 0,
        completeCount: 0,
        complaints: [],
      };
      cur.totalCount += 1;
      if (isPendingComplaintStatus(c.status)) {
        cur.pendingCount += 1;
      } else {
        cur.completeCount += 1;
      }
      cur.complaints.push(c);
      map.set(key, cur);
    }

    return [...map.values()].sort((a, b) => b.totalCount - a.totalCount);
  }, [filteredComplaints]);

  const totalComplaints = filteredComplaints.length;
  const totalPending = filteredComplaints.filter((c) => isPendingComplaintStatus(c.status)).length;
  const totalComplete = totalComplaints - totalPending;

  const handleDownloadCsv = () => {
    const dateStamp = formatDateInput(new Date());
    downloadTablesCsv(`bucket-count-report-${dateStamp}.csv`, [
      {
        headers: ["Technician", "Total", "Pending", "Complete"],
        rows: buckets.map((b) => [
          b.technicianName,
          b.totalCount,
          b.pendingCount,
          b.completeCount,
        ]),
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
          "Punch In Location",
          "Punch Out Location",
        ],
        rows: buckets.flatMap((b) =>
          b.complaints.map((c) => {
            const visit = visitByComplaintId.get(toComplaintIdKey(c.complaint_id) || "");
            return [
              b.technicianName,
              c.ticket_id,
              toComplaintIdKey(c.complaint_id) || "—",
              c.client_name,
              c.outlet_name,
              c.issue_type || "—",
              formatComplaintDateDisplay(c.date_of_complaint),
              displayComplaintStatus(c.status),
              visit?.punchInLocation || "—",
              visit?.punchOutLocation || "—",
            ];
          })
        ),
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
            <option value="">All (Pending + In Progress + Complete)</option>
            <option value="PendingProgress">Pending + In Progress</option>
            {COMPLAINT_STATUS_OPTIONS.map((s) => (
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

      <div className="stats-grid">
        <div
          className={`stat-card stat-card-clickable ${statusFilter === "" ? "stat-card-active" : ""}`}
          onClick={() => applyStatusFilter("")}
          title="Show all technicians and complaints"
        >
          <div className="stat-icon yellow">🪣</div>
          <div className="stat-info">
            <div className="stat-value">{buckets.length}</div>
            <div className="stat-label">Technicians with Complaints</div>
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${statusFilter === "" ? "stat-card-active" : ""}`}
          onClick={() => applyStatusFilter("")}
          title="Show all complaints"
        >
          <div className="stat-icon blue">📋</div>
          <div className="stat-info">
            <div className="stat-value">{totalComplaints}</div>
            <div className="stat-label">Total Complaints</div>
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${statusFilter === "PendingProgress" ? "stat-card-active" : ""}`}
          onClick={() => applyStatusFilter("PendingProgress")}
          title="Show pending and in-progress complaints"
        >
          <div className="stat-icon purple">⏳</div>
          <div className="stat-info">
            <div className="stat-value">{totalPending}</div>
            <div className="stat-label">Pending / In Progress</div>
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${statusFilter === "Complete" ? "stat-card-active" : ""}`}
          onClick={() => applyStatusFilter("Complete")}
          title="Show complete complaints"
        >
          <div className="stat-icon green">✅</div>
          <div className="stat-info">
            <div className="stat-value">{totalComplete}</div>
            <div className="stat-label">Complete</div>
          </div>
        </div>
      </div>

      <div className="table-card" ref={tableCardRef}>
        <div className="table-card-header">
          <div>
            <span className="table-card-title">Technician Bucket Count</span>
            <span className="table-card-count">
              Pending and Complete complaints, filtered by month/year
            </span>
          </div>
        </div>
        <div className="table-wrapper report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Technician</th>
                <th>Total</th>
                <th>Pending</th>
                <th>Complete</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="loading-row">
                  <td colSpan={6}>
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
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <div className="empty-state-title">No complaints found</div>
                      <div className="empty-state-text">
                        Try a different month, year, or filter
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
                        <span className="badge">{b.totalCount}</span>
                      </td>
                      <td>
                        <span className="badge badge-pending">{b.pendingCount}</span>
                      </td>
                      <td>
                        <span className="badge badge-complete">{b.completeCount}</span>
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
                        <td colSpan={6} style={{ padding: 0, background: "#f8fafc" }}>
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
                                  <th>Punch In Location</th>
                                  <th>Punch In Photo</th>
                                  <th>Punch Out Location</th>
                                  <th>Punch Out Photo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {b.complaints.map((c) => {
                                  const visit = visitByComplaintId.get(
                                    toComplaintIdKey(c.complaint_id) || ""
                                  );
                                  return (
                                    <tr key={c.complaint_id ?? c.ticket_id}>
                                      <td>
                                        <span className="ticket-id">{c.ticket_id}</span>
                                      </td>
                                      <td title={c.client_name}>{c.client_name}</td>
                                      <td title={c.outlet_name}>{c.outlet_name}</td>
                                      <td title={c.issue_type}>{c.issue_type || "—"}</td>
                                      <td>{formatComplaintDateDisplay(c.date_of_complaint)}</td>
                                      <td>
                                        <span
                                          className={getComplaintStatusClass(
                                            c.status
                                          )}
                                        >
                                          {displayComplaintStatus(c.status)}
                                        </span>
                                      </td>
                                      <td title={visit?.punchInLocation}>
                                        {visit?.punchInLocation || "—"}
                                      </td>
                                      <td>
                                        {visit?.punchInImageUrl ? (
                                          <img
                                            src={visit.punchInImageUrl}
                                            alt="Punch In"
                                            className="report-thumb"
                                            width={40}
                                            height={40}
                                            loading="lazy"
                                            draggable={false}
                                            onClick={() =>
                                              setImagePreview({
                                                url: visit.punchInImageUrl!,
                                                alt: `Punch In - ${b.technicianName}`,
                                              })
                                            }
                                          />
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                      <td title={visit?.punchOutLocation}>
                                        {visit?.punchOutLocation || "—"}
                                      </td>
                                      <td>
                                        {visit?.punchOutImageUrl ? (
                                          <img
                                            src={visit.punchOutImageUrl}
                                            alt="Punch Out"
                                            className="report-thumb"
                                            width={40}
                                            height={40}
                                            loading="lazy"
                                            draggable={false}
                                            onClick={() =>
                                              setImagePreview({
                                                url: visit.punchOutImageUrl!,
                                                alt: `Punch Out - ${b.technicianName}`,
                                              })
                                            }
                                          />
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
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

      {imagePreview && (
        <ImagePreviewModal
          imageUrl={imagePreview.url}
          alt={imagePreview.alt}
          onClose={() => setImagePreview(null)}
        />
      )}
    </div>
  );
}
