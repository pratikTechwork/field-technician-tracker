import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, PUNCHOUT_TABLE, TABLE_NAME } from "../../supabase";
import type { PunchOutRecord } from "../../types/reports";
import {
  formatDateInput,
  formatDateTime,
  formatMonthInput,
  getRecordDate,
  getWeekKey,
  formatComplaintIdDisplay,
  matchesSearch,
  parseMoney,
  startOfDay,
  endOfDay,
  toComplaintIdKey,
} from "../../lib/reportUtils";
import { downloadTablesCsv } from "../../lib/csvExport";

type PeriodMode = "weekly" | "monthly";
type ComplaintChargeRecord = {
  complaint_id?: string | number | null;
  visit_charge?: string | number | null;
  visit_charges?: string | number | null;
};

export default function ExpenseReport() {
  const today = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("weekly");
  const [weekStart, setWeekStart] = useState(formatDateInput(today));
  const [month, setMonth] = useState(formatMonthInput(today));
  const [search, setSearch] = useState("");
  const [technician, setTechnician] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PunchOutRecord[]>([]);
  const [visitChargesByComplaint, setVisitChargesByComplaint] = useState<
    Record<string, number>
  >({});
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let rangeStart: Date;
    let rangeEnd: Date;

    if (periodMode === "weekly") {
      rangeStart = startOfDay(new Date(weekStart));
      const end = new Date(rangeStart);
      end.setDate(end.getDate() + 6);
      rangeEnd = endOfDay(end);
    } else {
      const [y, m] = month.split("-").map(Number);
      rangeStart = new Date(y, m - 1, 1);
      rangeEnd = new Date(y, m, 0, 23, 59, 59, 999);
    }

    const { data, error: err } = await supabase
      .from(PUNCHOUT_TABLE)
      .select("*")
      .gte("created_at", rangeStart.toISOString())
      .lte("created_at", rangeEnd.toISOString())
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      const punchoutRows = (data || []) as PunchOutRecord[];
      setRows(punchoutRows);

      const complaintIds = [
        ...new Set(
          punchoutRows
            .map((row) => toComplaintIdKey(row.complaint_id))
            .filter((id): id is string => !!id)
        ),
      ];

      if (complaintIds.length === 0) {
        setVisitChargesByComplaint({});
      } else {
        const { data: complaintData, error: complaintErr } = await supabase
          .from(TABLE_NAME)
          .select("*")
          .in("complaint_id", complaintIds);

        if (complaintErr) {
          setError(complaintErr.message);
          setVisitChargesByComplaint({});
          setLoading(false);
          return;
        }

        const visitChargeMap = ((complaintData || []) as ComplaintChargeRecord[]).reduce<
          Record<string, number>
        >((acc, complaint) => {
          const key = toComplaintIdKey(complaint.complaint_id);
          if (!key) return acc;
          acc[key] = parseMoney(complaint.visit_charges ?? complaint.visit_charge);
          return acc;
        }, {});

        setVisitChargesByComplaint(visitChargeMap);
      }
    }
    setLoading(false);
  }, [periodMode, weekStart, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const expenses = useMemo(() => {
    return rows.map((r) => {
      const complaintId = toComplaintIdKey(r.complaint_id) || "—";
      const visitCharge =
        complaintId === "—" ? 0 : visitChargesByComplaint[complaintId] || 0;

      return {
        id: r.id,
        complaintId,
        technicianName: r.name || "—",
        zohoTicketId: r.zoho_ticket_id || "—",
        charges: parseMoney(r.charges),
        total: parseMoney(r.total) + visitCharge,
        issue: r.issue || "—",
        remarks: r.remarks || "—",
        punchOutAt: r.created_at || r.timestamp || "",
        visitDate: getRecordDate(r),
        periodKey:
          periodMode === "weekly"
            ? getWeekKey(getRecordDate(r))
            : formatMonthInput(getRecordDate(r)),
      };
    });
  }, [rows, periodMode, visitChargesByComplaint]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (
        technician &&
        !e.technicianName.toLowerCase().includes(technician.toLowerCase())
      ) {
        return false;
      }
      return matchesSearch(search, [
        e.complaintId,
        e.technicianName,
        e.zohoTicketId,
        e.issue,
        e.remarks,
      ]);
    });
  }, [expenses, search, technician]);

  const stats = useMemo(
    () => ({
      count: filtered.length,
      totalCharges: filtered.reduce((s, e) => s + e.charges, 0),
      totalAmount: filtered.reduce((s, e) => s + e.total, 0),
    }),
    [filtered]
  );

  const byTechnician = useMemo(() => {
    const map = new Map<string, { count: number; charges: number; total: number }>();
    for (const e of filtered) {
      const key = e.technicianName;
      const cur = map.get(key) ?? { count: 0, charges: 0, total: 0 };
      cur.count += 1;
      cur.charges += e.charges;
      cur.total += e.total;
      map.set(key, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

  const handleDownloadCsv = () => {
    const dateStamp = formatDateInput(new Date());
    const tables: { headers: string[]; rows: unknown[][] }[] = [];

    if (byTechnician.length > 0) {
      tables.push({
        headers: ["Technician", "Visits", "Charges", "Total"],
        rows: byTechnician.map(([name, agg]) => [
          name,
          agg.count,
          agg.charges.toFixed(2),
          agg.total.toFixed(2),
        ]),
      });
    }

    tables.push({
      headers: [
        "Complaint ID",
        "Zoho Ticket",
        "Technician",
        "Punch Out",
        "Issue",
        "Charges",
        "Total",
        "Remarks",
      ],
      rows: filtered.map((e) => [
        e.complaintId,
        e.zohoTicketId,
        e.technicianName,
        formatDateTime(e.punchOutAt),
        e.issue,
        e.charges.toFixed(2),
        e.total.toFixed(2),
        e.remarks,
      ]),
    });

    downloadTablesCsv(`${periodMode}-expense-report-${dateStamp}.csv`, tables);
  };

  return (
    <div>
      <div className="report-filters">
        <div className="filter-group">
          <label className="form-label">Period</label>
          <select
            className="form-select"
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        {periodMode === "weekly" ? (
          <div className="filter-group">
            <label className="form-label">Week Starting</label>
            <input
              type="date"
              className="form-input"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>
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
        <div className="filter-group filter-group-search">
          <label className="form-label">Search</label>
          <div className="table-search" style={{ width: "100%" }}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Ticket, complaint, issue…"
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
          Failed to load expenses: {error}
        </div>
      )}

      <div className="stats-grid stats-grid-3">
        <div className="stat-card">
          <div className="stat-icon blue">🧾</div>
          <div className="stat-info">
            <div className="stat-value">{stats.count}</div>
            <div className="stat-label">Punch-out Records</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">💰</div>
          <div className="stat-info">
            <div className="stat-value">₹{stats.totalCharges.toFixed(2)}</div>
            <div className="stat-label">Total Charges</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📊</div>
          <div className="stat-info">
            <div className="stat-value">₹{stats.totalAmount.toFixed(2)}</div>
            <div className="stat-label">Grand Total</div>
          </div>
        </div>
      </div>

      {byTechnician.length > 0 && (
        <div className="table-card" style={{ marginBottom: 24 }}>
          <div className="table-card-header">
            <span className="table-card-title">
              Summary by Technician ({periodMode})
            </span>
          </div>
          <div className="table-wrapper report-table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Visits</th>
                  <th>Charges</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {byTechnician.map(([name, agg]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{agg.count}</td>
                    <td>₹{agg.charges.toFixed(2)}</td>
                    <td>₹{agg.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-card-header">
          <div>
            <span className="table-card-title">
              {periodMode === "weekly" ? "Weekly" : "Monthly"} Expense Detail
            </span>
            <span className="table-card-count">{filtered.length} records</span>
          </div>
        </div>
        <div className="table-wrapper report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Complaint ID</th>
                <th>Zoho Ticket</th>
                <th>Technician</th>
                <th>Punch Out</th>
                <th>Issue</th>
                <th>Charges</th>
                <th>Total</th>
                <th>Remarks</th>
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
                      Loading expenses…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <div className="empty-state-title">No expense records</div>
                      <div className="empty-state-text">
                        Adjust period or filters and try again
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((e, i) => (
                  <tr key={e.id}>
                    <td className="sn-col">{i + 1}</td>
                    <td title={e.complaintId}>
                      {formatComplaintIdDisplay(e.complaintId)}
                    </td>
                    <td>{e.zohoTicketId}</td>
                    <td>{e.technicianName}</td>
                    <td>{formatDateTime(e.punchOutAt)}</td>
                    <td title={e.issue}>{e.issue}</td>
                    <td>₹{e.charges.toFixed(2)}</td>
                    <td>₹{e.total.toFixed(2)}</td>
                    <td title={e.remarks}>{e.remarks}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
