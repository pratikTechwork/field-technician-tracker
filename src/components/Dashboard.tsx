import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, TABLE_NAME } from "../supabase";
import {
  Complaint,
  COLUMN_LABELS,
  displayComplaintStatus,
  getComplaintStatusClass,
  normalizeComplaintStatus,
} from "../types";
import { getUserRole } from "../lib/auth";
import { downloadTableCsv } from "../lib/csvExport";
import { formatComplaintIdDisplay, toComplaintIdKey } from "../lib/reportUtils";
import AddEntryModal from "./AddEntryModal";
import BulkAssignModal from "./BulkAssignModal";
import EditModal from "./EditModal";
import UploadModal from "./UploadModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

interface AgentProfile {
  user_id: string;
  email?: string | null;
}

interface Props {
  user: User;
}

function getComplaintSelectionKey(complaint: Complaint): string {
  return String(complaint.complaint_id ?? complaint.ticket_id);
}

function isBulkAssignableComplaint(complaint: Complaint): boolean {
  return normalizeComplaintStatus(complaint.status) !== "Complete";
}

function getEmailLocalPart(email?: string | null): string {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) return "";

  const atIndex = normalizedEmail.indexOf("@");
  return atIndex > 0 ? normalizedEmail.slice(0, atIndex) : normalizedEmail;
}

export default function Dashboard({ user }: Props) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [agentEmails, setAgentEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusGroupFilter, setStatusGroupFilter] = useState<"" | "open" | "complete">("");
  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editItem, setEditItem] = useState<Complaint | null>(null);
  const [deleteItem, setDeleteItem] = useState<Complaint | null>(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [selectedComplaintKeys, setSelectedComplaintKeys] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const currentUserId = user.id;
  const shouldScopeToCurrentUser = getUserRole(user) === "user";

  const getAgentDisplayValue = useCallback(
    (complaint: Complaint): string => {
      const agentName = complaint.agent_name?.trim();
      if (agentName) return agentName;

      const profileEmail = complaint.agent_user_id
        ? agentEmails[complaint.agent_user_id]
        : undefined;
      if (profileEmail?.trim()) return getEmailLocalPart(profileEmail);

      if (complaint.agent_user_id === currentUserId) {
        return getEmailLocalPart(user.email) || "—";
      }

      return "—";
    },
    [agentEmails, currentUserId, user.email]
  );

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    if (shouldScopeToCurrentUser) {
      query = query.eq("agent_user_id", currentUserId);
    }

    const { data, error } = await query;
    if (error) {
      addToast("error", "Failed to load data: " + error.message);
    } else {
      const nextComplaints = data || [];
      setComplaints(nextComplaints);
      setSelectedComplaintKeys((prev) =>
        prev.filter((key) =>
          nextComplaints.some(
            (complaint) =>
              getComplaintSelectionKey(complaint) === key &&
              isBulkAssignableComplaint(complaint)
          )
        )
      );
    }
    setLoading(false);
  }, [addToast, currentUserId, shouldScopeToCurrentUser]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  useEffect(() => {
    supabase
      .from("field_emp_profiles")
      .select("user_id, email")
      .then(({ data, error }) => {
        if (error || !data) return;

        const emailMap = (data as AgentProfile[]).reduce<Record<string, string>>((acc, profile) => {
          if (profile.user_id && profile.email?.trim()) {
            acc[profile.user_id] = profile.email.trim();
          }
          return acc;
        }, {});

        setAgentEmails(emailMap);
      });
  }, []);

  const handleDelete = async (item: Complaint) => {
    if (normalizeComplaintStatus(item.status) === "Complete") {
      addToast("info", "Completed complaints cannot be deleted.");
      setDeleteItem(null);
      return;
    }

    let query = supabase.from(TABLE_NAME).delete().eq("complaint_id", item.complaint_id);

    if (shouldScopeToCurrentUser) {
      query = query.eq("agent_user_id", currentUserId);
    }

    const { error } = await query;
    if (error) {
      addToast("error", "Delete failed: " + error.message);
    } else {
      addToast("success", `Zoho ticket ${item.ticket_id} deleted successfully.`);
      setComplaints((prev) => prev.filter((c) => c.complaint_id !== item.complaint_id));
      setSelectedComplaintKeys((prev) =>
        prev.filter((key) => key !== getComplaintSelectionKey(item))
      );
    }
    setDeleteItem(null);
  };

  const filtered = complaints.filter((c) => {
    const normalizedStatus = normalizeComplaintStatus(c.status);

    if (statusGroupFilter === "open" && normalizedStatus === "Complete") {
      return false;
    }

    if (statusGroupFilter === "complete" && normalizedStatus !== "Complete") {
      return false;
    }

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

  const selectedComplaintSet = new Set(selectedComplaintKeys);
  const filteredSelectableComplaints = filtered.filter(isBulkAssignableComplaint);
  const filteredSelectionKeys = filteredSelectableComplaints.map((complaint) =>
    getComplaintSelectionKey(complaint)
  );
  const selectedComplaints = complaints.filter((complaint) =>
    selectedComplaintSet.has(getComplaintSelectionKey(complaint)) &&
    isBulkAssignableComplaint(complaint)
  );
  const allFilteredSelected =
    filteredSelectionKeys.length > 0 &&
    filteredSelectionKeys.every((key) => selectedComplaintSet.has(key));
  const someFilteredSelected =
    !allFilteredSelected && filteredSelectionKeys.some((key) => selectedComplaintSet.has(key));

  const toggleComplaintSelection = (complaint: Complaint) => {
    if (!isBulkAssignableComplaint(complaint)) return;

    const key = getComplaintSelectionKey(complaint);
    setSelectedComplaintKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const toggleAllFilteredComplaints = () => {
    if (!filteredSelectionKeys.length) return;

    setSelectedComplaintKeys((prev) => {
      const next = new Set(prev);

      if (allFilteredSelected) {
        filteredSelectionKeys.forEach((key) => next.delete(key));
      } else {
        filteredSelectionKeys.forEach((key) => next.add(key));
      }

      return Array.from(next);
    });
  };

  const clearSelectedComplaints = () => {
    setSelectedComplaintKeys([]);
  };

  const handleBulkAssign = async (technicianName: string, technicianUuid: string) => {
    if (!selectedComplaints.length) {
      throw new Error("Select at least one complaint before assigning a technician.");
    }

    if (selectedComplaints.some((complaint) => !isBulkAssignableComplaint(complaint))) {
      throw new Error("Completed complaints cannot be assigned to a technician.");
    }

    const complaintIds = selectedComplaints.flatMap((complaint) =>
      complaint.complaint_id != null ? [complaint.complaint_id] : []
    );

    if (complaintIds.length !== selectedComplaints.length) {
      throw new Error("Some selected complaints are missing complaint IDs.");
    }

    const updatedAt = new Date().toISOString();
    let query = supabase
      .from(TABLE_NAME)
      .update({
        technician_name: technicianName,
        technician_uuid: technicianUuid,
        updated_at: updatedAt,
      })
      .in("complaint_id", complaintIds);

    if (shouldScopeToCurrentUser) {
      query = query.eq("agent_user_id", currentUserId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Bulk assign failed: ${error.message}`);
    }

    setComplaints((prev) =>
      prev.map((complaint) =>
        selectedComplaintSet.has(getComplaintSelectionKey(complaint))
          ? {
              ...complaint,
              technician_name: technicianName,
              technician_uuid: technicianUuid,
              updated_at: updatedAt,
            }
          : complaint
      )
    );

    addToast(
      "success",
      `${selectedComplaints.length} complaint${selectedComplaints.length === 1 ? "" : "s"} assigned to ${technicianName}.`
    );
    clearSelectedComplaints();
    setShowBulkAssign(false);
  };

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

  const handleDownloadCsv = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);

    downloadTableCsv(
      `complaints-${dateStamp}.csv`,
      [
        "Complaint ID",
        "Zoho Ticket",
        "Date of Complaint",
        "Client Name",
        "Outlet Name",
        "Device ID",
        "Outlet Address",
        "Outlet POC Name",
        "Outlet POC Number",
        "Issue Type",
        "Agent Name",
        "Technician Name",
        "Visit Charge",
        "Status",
      ],
      filtered.map((complaint) => [
        toComplaintIdKey(complaint.complaint_id)
          ? formatComplaintIdDisplay(toComplaintIdKey(complaint.complaint_id)!)
          : "—",
        complaint.ticket_id,
        complaint.date_of_complaint,
        complaint.client_name,
        complaint.outlet_name,
        complaint.device_id || "—",
        complaint.outlet_address || "—",
        complaint.outlet_poc_name || "—",
        complaint.outlet_poc_number || "—",
        complaint.issue_type || "—",
        getAgentDisplayValue(complaint),
        complaint.technician_name || "—",
        complaint.visit_charge != null && complaint.visit_charge !== ""
          ? Number(complaint.visit_charge).toFixed(2)
          : "—",
        displayComplaintStatus(complaint.status),
      ])
    );
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
                className={`btn ${statusGroupFilter === "" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setStatusGroupFilter("")}
                title="Show all complaints"
              >
                All
              </button>
              <button
                className={`btn ${statusGroupFilter === "open" ? "btn-primary" : "btn-secondary"}`}
                onClick={() =>
                  setStatusGroupFilter((current) => (current === "open" ? "" : "open"))
                }
                title="Show pending and in progress complaints"
              >
                Pending / In Progress
              </button>
              <button
                className={`btn ${statusGroupFilter === "complete" ? "btn-primary" : "btn-secondary"}`}
                onClick={() =>
                  setStatusGroupFilter((current) => (current === "complete" ? "" : "complete"))
                }
                title="Show completed complaints"
              >
                Complete
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleDownloadCsv}
                disabled={!filtered.length}
                title="Download visible complaints as CSV"
              >
                Download CSV
              </button>
              <button
                className="btn btn-secondary"
                onClick={fetchComplaints}
                title="Refresh"
              >
                🔄
              </button>
            </div>
          </div>

          <div className="bulk-actions-bar">
            <div className="bulk-selection-summary">
              <span className="bulk-selection-count">
                {selectedComplaintKeys.length} complaint
                {selectedComplaintKeys.length === 1 ? "" : "s"} selected
              </span>
              <span className="bulk-selection-note">
                Select complaints one by one or select all visible rows at once.
              </span>
            </div>
            <div className="bulk-actions-buttons">
              <button
                className="btn btn-secondary"
                onClick={toggleAllFilteredComplaints}
                disabled={!filtered.length}
              >
                {allFilteredSelected ? "Unselect Visible" : "Select All Visible"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={clearSelectedComplaints}
                disabled={!selectedComplaintKeys.length}
              >
                Clear Selection
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowBulkAssign(true)}
                disabled={!selectedComplaintKeys.length}
              >
                Assign Technician
              </button>
            </div>
          </div>

          <div className="table-wrapper table-wrapper-fill">
            <table>
              <thead>
                <tr>
                  <th className="selection-col">
                    <input
                      type="checkbox"
                      className="table-select-input"
                      checked={allFilteredSelected}
                      onChange={toggleAllFilteredComplaints}
                      aria-label="Select all visible complaints"
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = someFilteredSelected;
                        }
                      }}
                    />
                  </th>
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
                  <th>{COLUMN_LABELS.agent_name}</th>
                  <th>{COLUMN_LABELS.technician_name}</th>
                  <th>{COLUMN_LABELS.visit_charge}</th>
                  <th>{COLUMN_LABELS.status}</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="loading-row">
                    <td colSpan={16}>
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
                    <td colSpan={16}>
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
                    const isSelectableComplaint = isBulkAssignableComplaint(c);

                    return (
                      <tr key={c.complaint_id}>
                        <td className="selection-col">
                          <input
                            type="checkbox"
                            className="table-select-input"
                            checked={selectedComplaintSet.has(getComplaintSelectionKey(c))}
                            onChange={() => toggleComplaintSelection(c)}
                            disabled={!isSelectableComplaint}
                            aria-label={`Select complaint ${c.ticket_id}`}
                            title={
                              isSelectableComplaint
                                ? "Select complaint"
                                : "Completed complaints cannot be assigned"
                            }
                          />
                        </td>
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
                        <td>{getAgentDisplayValue(c)}</td>
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
          user={user}
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
          currentUserId={currentUserId}
          shouldScopeToCurrentUser={shouldScopeToCurrentUser}
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
          user={user}
          onClose={() => setShowUpload(false)}
          onSuccess={(msg) => {
            addToast("success", msg);
            fetchComplaints();
          }}
          onError={(msg) => addToast("error", msg)}
        />
      )}

      {showBulkAssign && (
        <BulkAssignModal
          selectedCount={selectedComplaintKeys.length}
          onClose={() => setShowBulkAssign(false)}
          onAssign={handleBulkAssign}
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
