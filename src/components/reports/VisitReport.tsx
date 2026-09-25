import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  supabase,
  PUNCHIN_TABLE,
  PUNCHOUT_TABLE,
} from "../../supabase";
import type { PunchOutRecord, PunchRecord } from "../../types/reports";
import {
  endOfDay,
  formatDateInput,
  formatDateTime,
  formatMonthInput,
  formatComplaintIdDisplay,
  joinVisits,
  matchesSearch,
  startOfDay,
  toComplaintIdKey,
} from "../../lib/reportUtils";
import { downloadTableCsv } from "../../lib/csvExport";
import ImagePreviewModal from "../ImagePreviewModal";

type Mode = "daily" | "monthly";

interface Props {
  mode: Mode;
}

export default function VisitReport({ mode }: Props) {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(formatDateInput(today));
  const [dateTo, setDateTo] = useState(formatDateInput(today));
  const [month, setMonth] = useState(formatMonthInput(today));
  const [search, setSearch] = useState("");
  const [technician, setTechnician] = useState("");
  const [visitStatus, setVisitStatus] = useState<"" | "complete" | "incomplete">(
    ""
  );
  const [loading, setLoading] = useState(true);
  const [punchins, setPunchins] = useState<PunchRecord[]>([]);
  const [punchouts, setPunchouts] = useState<PunchOutRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; alt: string } | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let rangeStart: Date;
    let rangeEnd: Date;

    if (mode === "daily") {
      rangeStart = startOfDay(new Date(dateFrom));
      rangeEnd = endOfDay(new Date(dateTo));
    } else {
      const [y, m] = month.split("-").map(Number);
      rangeStart = new Date(y, m - 1, 1);
      rangeEnd = new Date(y, m, 0, 23, 59, 59, 999);
    }

    const { data: piData, error: piErr } = await supabase
      .from(PUNCHIN_TABLE)
      .select("*")
      .gte("created_at", rangeStart.toISOString())
      .lte("created_at", rangeEnd.toISOString())
      .order("created_at", { ascending: false });

    if (piErr) {
      setError(piErr.message);
      setLoading(false);
      return;
    }

    const ins = (piData || []) as PunchRecord[];
    const complaintIds = [
      ...new Set(
        ins.map((p) => toComplaintIdKey(p.complaint_id)).filter((id): id is string => !!id)
      ),
    ];

    let outs: PunchOutRecord[] = [];
    if (complaintIds.length > 0) {
      const { data: poData, error: poErr } = await supabase
        .from(PUNCHOUT_TABLE)
        .select("*")
        .in("complaint_id", complaintIds);

      if (poErr) {
        setError(poErr.message);
        setLoading(false);
        return;
      }
      outs = (poData || []) as PunchOutRecord[];
    }

    setPunchins(ins);
    setPunchouts(outs);
    setLoading(false);
  }, [mode, dateFrom, dateTo, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const visits = useMemo(() => joinVisits(punchins, punchouts), [punchins, punchouts]);

  const filtered = useMemo(() => {
    return visits.filter((v) => {
      if (visitStatus && v.visitStatus !== visitStatus) return false;
      if (
        technician &&
        !v.technicianName.toLowerCase().includes(technician.toLowerCase())
      ) {
        return false;
      }
      return matchesSearch(search, [
        v.complaintId,
        v.technicianName,
        v.zohoTicketId,
        v.punchInLocation,
        v.punchOutLocation,
      ]);
    });
  }, [visits, search, technician, visitStatus]);

  useEffect(() => {
    setVisibleCount(20);
  }, [filtered]);

  const visibleRows = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const hasMore = visibleCount < filtered.length;

  const scrollToTable = useCallback(() => {
    tableWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = tableWrapperRef.current;
    if (!el || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setVisibleCount((prev) => prev + 20);
    }
  }, [hasMore]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      complete: filtered.filter((v) => v.visitStatus === "complete").length,
      incomplete: filtered.filter((v) => v.visitStatus === "incomplete").length,
    }),
    [filtered]
  );

  const handleDownloadCsv = () => {
    const dateStamp = formatDateInput(new Date());
    downloadTableCsv(
      `${mode}-visit-report-${dateStamp}.csv`,
      [
        "Complaint ID",
        "Zoho Ticket",
        "Technician",
        "Punch In",
        "Punch Out",
        "Punch In Location",
        "Punch Out Location",
        "Status",
      ],
      filtered.map((v) => [
        v.complaintId,
        v.zohoTicketId,
        v.technicianName,
        formatDateTime(v.punchInAt),
        formatDateTime(v.punchOutAt),
        v.punchInLocation,
        v.punchOutLocation,
        v.visitStatus === "complete" ? "Complete" : "Incomplete",
      ])
    );
  };

  return (
    <div>
      <div className="report-filters">
        {mode === "daily" ? (
          <>
            <div className="filter-group">
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="form-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="form-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="filter-group">
            <label className="form-label">Month</label>
            <input
              type="month"
              className="form-input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        )}
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
          <label className="form-label">Visit Status</label>
          <select
            className="form-select"
            value={visitStatus}
            onChange={(e) =>
              setVisitStatus(e.target.value as "" | "complete" | "incomplete")
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
              placeholder="Complaint ID, ticket, technician…"
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
          Failed to load visits: {error}
        </div>
      )}

      <div className="stats-grid stats-grid-3">
        <div
          className={`stat-card stat-card-clickable ${visitStatus === "" ? "stat-card-active" : ""}`}
          onClick={() => {
            setVisitStatus("");
            scrollToTable();
          }}
          title="Show all visits"
        >
          <div className="stat-icon blue">📍</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Visits</div>
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${visitStatus === "complete" ? "stat-card-active" : ""}`}
          onClick={() => {
            setVisitStatus("complete");
            scrollToTable();
          }}
          title="Show complete visits"
        >
          <div className="stat-icon green">✅</div>
          <div className="stat-info">
            <div className="stat-value">{stats.complete}</div>
            <div className="stat-label">Complete</div>
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${visitStatus === "incomplete" ? "stat-card-active" : ""}`}
          onClick={() => {
            setVisitStatus("incomplete");
            scrollToTable();
          }}
          title="Show incomplete visits (no punch-out)"
        >
          <div className="stat-icon yellow">⚠️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.incomplete}</div>
            <div className="stat-label">Incomplete (no punch-out)</div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-card-header">
          <div>
            <span className="table-card-title">
              {mode === "daily" ? "Daily Visit Count" : "Monthly Visit Count"}
            </span>
            <span className="table-card-count">
              {visibleRows.length} of {filtered.length} records
            </span>
          </div>
        </div>
        <div ref={tableWrapperRef} onScroll={handleScroll} className="table-wrapper report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Complaint ID</th>
                <th>Zoho Ticket</th>
                <th>Technician</th>
                <th>Punch In</th>
                <th>Punch Out</th>
                <th>Punch In Location</th>
                <th>Punch Out Location</th>
                <th>Punch In Image</th>
                <th>Punch Out Image</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="loading-row">
                  <td colSpan={11}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      <div className="loading-spinner dark"></div>
                      Loading visits…
                    </div>
                  </td>
                </tr>
              ) :                 filtered.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <div className="empty-state-title">No visits found</div>
                      <div className="empty-state-text">
                        Adjust date range or filters and try again
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRows.map((v, i) => (
                  <tr key={v.punchinId}>
                    <td className="sn-col">{i + 1}</td>
                    <td title={v.complaintId}>
                      <span className="ticket-id">
                        {formatComplaintIdDisplay(v.complaintId)}
                      </span>
                    </td>
                    <td>{v.zohoTicketId}</td>
                    <td>{v.technicianName}</td>
                    <td>{formatDateTime(v.punchInAt)}</td>
                    <td>{formatDateTime(v.punchOutAt)}</td>
                    <td title={v.punchInLocation}>{v.punchInLocation}</td>
                    <td title={v.punchOutLocation}>{v.punchOutLocation}</td>
                    <td>
                      {v.punchInImageUrl ? (
                        <img
                          src={v.punchInImageUrl}
                          alt="Punch In"
                          className="report-thumb"
                          width={40}
                          height={40}
                          loading="lazy"
                          draggable={false}
                          onClick={() =>
                            setImagePreview({
                              url: v.punchInImageUrl!,
                              alt: `Punch In - ${v.technicianName}`,
                            })
                          }
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {v.punchOutImageUrl ? (
                        <img
                          src={v.punchOutImageUrl}
                          alt="Punch Out"
                          className="report-thumb"
                          width={40}
                          height={40}
                          loading="lazy"
                          draggable={false}
                          onClick={() =>
                            setImagePreview({
                              url: v.punchOutImageUrl!,
                              alt: `Punch Out - ${v.technicianName}`,
                            })
                          }
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          v.visitStatus === "complete"
                            ? "badge badge-complete"
                            : "badge badge-pending"
                        }
                      >
                        {v.visitStatus === "complete" ? "Complete" : "Incomplete"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
              {hasMore && (
                <tr>
                  <td colSpan={11}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px 0",
                        gap: 12,
                      }}
                    >
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + 20)}
                      >
                        Load more ({visibleRows.length} of {filtered.length})
                      </button>
                    </div>
                  </td>
                </tr>
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
