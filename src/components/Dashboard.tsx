import { useEffect, useState, useCallback } from "react";
import { supabase, TABLE_NAME } from "../supabase";
import {
  Complaint,
  COLUMN_LABELS,
  displayComplaintStatus,
  getComplaintStatusClass,
  normalizeComplaintStatus,
} from "../types";
import { formatComplaintIdDisplay, toComplaintIdKey } from "../lib/reportUtils";
import AddEntryModal from "./AddEntryModal";
import EditModal from "./EditModal";
import UploadModal from "./UploadModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

export default function Dashboard() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editItem, setEditItem] = useState<Complaint | null>(null);
  const [deleteItem, setDeleteItem] = useState<Complaint | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      addToast("error", "Failed to load data: " + error.message);
    } else {
      setComplaints(data || []);
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleDelete = async (item: Complaint) => {
    if (normalizeComplaintStatus(item.status) === "Complete") {
      addToast("info", "Completed complaints cannot be deleted.");
      setDeleteItem(null);
      return;
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("complaint_id", item.complaint_id);
    if (error) {
      addToast("error", "Delete failed: " + error.message);
    } else {
      addToast("success", `Zoho ticket ${item.ticket_id} deleted successfully.`);
      setComplaints((prev) => prev.filter((c) => c.complaint_id !== item.complaint_id));
    }
    setDeleteItem(null);
  };

  const filtered = complaints.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      toComplaintIdKey(c.complaint_id)?.toLowerCase().includes(q) ||
      c.ticket_id?.toLowerCase().includes(q) ||
      c.client_name?.toLowerCase().includes(q) ||
      c.outlet_name?.toLowerCase().includes(q) ||
      c.technician_name?.toLowerCase().includes(q) ||
      c.issue_type?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: complaints.length,
    pending: complaints.filter(
      (c) => normalizeComplaintStatus(c.status) === "Pending"
    ).length,
    inProgress: complaints.filter(
      (c) => normalizeComplaintStatus(c.status) === "In Progress"
    ).length,
    complete: complaints.filter(
      (c) => normalizeComplaintStatus(c.status) === "Complete"
    ).length,
  };

  return (
    <main className="main main-fill">
      <div className="page-toolbar">
        <button className="btn btn-secondary" onClick={() => setShowUpload(true)}>
          <span>📤</span> Upload CSV / Excel
        </button>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <span>＋</span> Add Entry
        </button>
      </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">📋</div>
            <div className="stat-info">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Complaints</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow">⏳</div>
            <div className="stat-info">
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">Pending</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">🔄</div>
            <div className="stat-info">
              <div className="stat-value">{stats.inProgress}</div>
              <div className="stat-label">In Progress</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">✅</div>
            <div className="stat-info">
              <div className="stat-value">{stats.complete}</div>
              <div className="stat-label">Complete</div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="table-card table-card-fill">
          <div className="table-card-header">
            <div>
              <span className="table-card-title">All Complaints</span>
              <span className="table-card-count">
                {filtered.length} of {complaints.length} records
              </span>
            </div>
            <div className="table-card-actions">
              <div className="table-search">
                <span>🔍</span>
                <input
                  type="text"
                  placeholder="Search by complaint ID, zoho ticket, client…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#6b7280",
                      fontSize: 14,
                    }}
                    onClick={() => setSearch("")}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                className="btn btn-secondary"
                onClick={fetchComplaints}
                title="Refresh"
              >
                🔄
              </button>
            </div>
          </div>

          <div className="table-wrapper table-wrapper-fill">
            <table>
              <thead>
                <tr>
                  <th>{COLUMN_LABELS.complaint_id}</th>
                  <th>{COLUMN_LABELS.ticket_id}</th>
                  <th>{COLUMN_LABELS.date_of_complaint}</th>
                  <th>{COLUMN_LABELS.client_name}</th>
                  <th>{COLUMN_LABELS.outlet_name}</th>
                  <th>{COLUMN_LABELS.device_id}</th>
                  <th>{COLUMN_LABELS.outlet_address}</th>
                  <th>{COLUMN_LABELS.outlet_poc_name}</th>
                  <th>{COLUMN_LABELS.outlet_poc_number}</th>
                  <th>{COLUMN_LABELS.issue_type}</th>
                  <th>{COLUMN_LABELS.technician_name}</th>
                  <th>{COLUMN_LABELS.visit_charge}</th>
                  <th>{COLUMN_LABELS.status}</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="loading-row">
                    <td colSpan={14}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                        }}
                      >
                        <div className="loading-spinner dark"></div>
                        Loading complaints…
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={14}>
                      <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <div className="empty-state-title">
                          {search ? "No results found" : "No complaints yet"}
                        </div>
                        <div className="empty-state-text">
                          {search
                            ? "Try a different search term"
                            : "Click 'Add Entry' or upload a CSV/Excel file to get started"}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const isCompleteComplaint =
                      normalizeComplaintStatus(c.status) === "Complete";

                    return (
                      <tr key={c.complaint_id}>
                        <td title={toComplaintIdKey(c.complaint_id) ?? undefined}>
                          {toComplaintIdKey(c.complaint_id)
                            ? formatComplaintIdDisplay(toComplaintIdKey(c.complaint_id)!)
                            : "—"}
                        </td>
                        <td>
                          <span className="ticket-id">{c.ticket_id}</span>
                        </td>
                        <td>{c.date_of_complaint}</td>
                        <td title={c.client_name}>{c.client_name}</td>
                        <td title={c.outlet_name}>{c.outlet_name}</td>
                        <td>{c.device_id || "—"}</td>
                        <td title={c.outlet_address}>{c.outlet_address || "—"}</td>
                        <td>{c.outlet_poc_name || "—"}</td>
                        <td>{c.outlet_poc_number || "—"}</td>
                        <td title={c.issue_type}>{c.issue_type || "—"}</td>
                        <td>{c.technician_name || "—"}</td>
                        <td>
                          {c.visit_charge != null && c.visit_charge !== ""
                            ? `₹${Number(c.visit_charge).toFixed(2)}`
                            : "—"}
                        </td>
                        <td>
                          <span className={getComplaintStatusClass(c.status)}>
                            {displayComplaintStatus(c.status)}
                          </span>
                        </td>
                        <td className="actions-td">
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              justifyContent: "center",
                            }}
                          >
                            <button
                              className="btn btn-ghost-edit"
                              onClick={() => setEditItem(c)}
                              title="Edit"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn btn-ghost-delete"
                              onClick={() => {
                                if (!isCompleteComplaint) {
                                  setDeleteItem(c);
                                }
                              }}
                              title={
                                isCompleteComplaint
                                  ? "Completed complaints cannot be deleted"
                                  : "Delete"
                              }
                              disabled={isCompleteComplaint}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      {/* Modals */}
      {showAdd && (
        <AddEntryModal
          onClose={() => setShowAdd(false)}
          onSuccess={(msg) => {
            addToast("success", msg);
            fetchComplaints();
          }}
          onError={(msg) => addToast("error", msg)}
        />
      )}

      {editItem && (
        <EditModal
          complaint={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={(msg) => {
            addToast("success", msg);
            fetchComplaints();
          }}
          onError={(msg) => addToast("error", msg)}
        />
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={(msg) => {
            addToast("success", msg);
            fetchComplaints();
          }}
          onError={(msg) => addToast("error", msg)}
        />
      )}

      {deleteItem && (
        <ConfirmDeleteModal
          complaint={deleteItem}
          onClose={() => setDeleteItem(null)}
          onConfirm={() => handleDelete(deleteItem)}
        />
      )}

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>
              {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </main>
  );
}
