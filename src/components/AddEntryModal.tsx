import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, TABLE_NAME } from "../supabase";
import {
  Complaint,
  COMPLAINT_STATUS_OPTIONS,
  normalizeComplaintStatus,
} from "../types";
import { getComplaintOwnerFields } from "../lib/auth";
import TechnicianSelect from "./TechnicianSelect";

interface Props {
  user: User;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const emptyForm = (): Partial<Complaint> => ({
  ticket_id: "",
  date_of_complaint: "",
  client_name: "",
  outlet_name: "",
  device_id: "",
  outlet_address: "",
  outlet_poc_name: "",
  outlet_poc_number: "",
  issue_type: "",
  technician_name: "",
  technician_uuid: "",
  visit_charge: "",
  status: "Pending",
});

export default function AddEntryModal({ user, onClose, onSuccess, onError }: Props) {
  const [form, setForm] = useState<Partial<Complaint>>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof Complaint, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.ticket_id?.trim()) errs.ticket_id = "Zoho Ticket is required";
    if (!form.date_of_complaint?.trim()) errs.date_of_complaint = "Date is required";
    if (!form.client_name?.trim()) errs.client_name = "Client Name is required";
    if (!form.outlet_name?.trim()) errs.outlet_name = "Outlet Name is required";
    if (!form.status?.trim()) errs.status = "Status is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const ownerFields = getComplaintOwnerFields(user);
    if (!ownerFields) {
      onError("Unable to identify the logged-in user.");
      return;
    }

    setSubmitting(true);

    const payload: Partial<Complaint> = {
      ticket_id: form.ticket_id!.trim(),
      date_of_complaint: form.date_of_complaint!,
      client_name: form.client_name!.trim(),
      outlet_name: form.outlet_name!.trim(),
      device_id: form.device_id?.trim() || null,
      outlet_address: form.outlet_address?.trim() || null,
      outlet_poc_name: form.outlet_poc_name?.trim() || null,
      outlet_poc_number: form.outlet_poc_number?.trim() || null,
      issue_type: form.issue_type?.trim() || null,
      technician_name: form.technician_name?.trim() || null,
      technician_uuid: form.technician_uuid?.trim() || null,
      visit_charge:
        form.visit_charge !== "" && form.visit_charge != null
          ? Number(form.visit_charge)
          : 0,
      status: normalizeComplaintStatus(form.status),
      agent_user_id: ownerFields.agent_user_id,
      agent_name: ownerFields.agent_name,
    };

    const { error } = await supabase.from(TABLE_NAME).insert([payload]);
    setSubmitting(false);

    if (error) {
      onError("Insert failed: " + error.message);
    } else {
      onSuccess(`Zoho ticket ${payload.ticket_id} added successfully!`);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Add New Complaint</div>
            <div className="modal-subtitle">Fill in the details below. * fields are required.</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            {/* Zoho Ticket */}
            <div className="form-group">
              <label className="form-label required">Zoho Ticket</label>
              <input
                className={`form-input ${errors.ticket_id ? "error" : ""}`}
                placeholder="e.g. TKT-2024-001"
                value={form.ticket_id || ""}
                onChange={(e) => set("ticket_id", e.target.value)}
              />
              {errors.ticket_id && <span className="form-error">{errors.ticket_id}</span>}
            </div>

            {/* Date of Complaint */}
            <div className="form-group">
              <label className="form-label required">Date of Complaint</label>
              <input
                type="date"
                className={`form-input ${errors.date_of_complaint ? "error" : ""}`}
                value={form.date_of_complaint || ""}
                onChange={(e) => set("date_of_complaint", e.target.value)}
              />
              {errors.date_of_complaint && (
                <span className="form-error">{errors.date_of_complaint}</span>
              )}
            </div>

            {/* Client Name */}
            <div className="form-group">
              <label className="form-label required">Client Name</label>
              <input
                className={`form-input ${errors.client_name ? "error" : ""}`}
                placeholder="e.g. ABC Corporation"
                value={form.client_name || ""}
                onChange={(e) => set("client_name", e.target.value)}
              />
              {errors.client_name && <span className="form-error">{errors.client_name}</span>}
            </div>

            {/* Outlet Name */}
            <div className="form-group">
              <label className="form-label required">Outlet Name</label>
              <input
                className={`form-input ${errors.outlet_name ? "error" : ""}`}
                placeholder="e.g. Main Branch"
                value={form.outlet_name || ""}
                onChange={(e) => set("outlet_name", e.target.value)}
              />
              {errors.outlet_name && <span className="form-error">{errors.outlet_name}</span>}
            </div>

            {/* Device ID */}
            <div className="form-group">
              <label className="form-label">Device ID</label>
              <input
                className="form-input"
                placeholder="e.g. DEV-001"
                value={form.device_id || ""}
                onChange={(e) => set("device_id", e.target.value)}
              />
            </div>

            {/* Issue Type */}
            <div className="form-group">
              <label className="form-label">Issue Type</label>
              <input
                className="form-input"
                placeholder="e.g. Hardware Failure"
                value={form.issue_type || ""}
                onChange={(e) => set("issue_type", e.target.value)}
              />
            </div>

            {/* Outlet Address */}
            <div className="form-group full-width">
              <label className="form-label">Outlet Address</label>
              <textarea
                className="form-textarea"
                placeholder="Full address of the outlet"
                value={form.outlet_address || ""}
                onChange={(e) => set("outlet_address", e.target.value)}
              />
            </div>

            {/* Outlet POC Name */}
            <div className="form-group">
              <label className="form-label">Outlet POC Name</label>
              <input
                className="form-input"
                placeholder="Point of contact name"
                value={form.outlet_poc_name || ""}
                onChange={(e) => set("outlet_poc_name", e.target.value)}
              />
            </div>

            {/* Outlet POC Number */}
            <div className="form-group">
              <label className="form-label">Outlet POC Number</label>
              <input
                className="form-input"
                placeholder="e.g. +91 9876543210"
                value={form.outlet_poc_number || ""}
                onChange={(e) => set("outlet_poc_number", e.target.value)}
              />
            </div>

            {/* Technician Name */}
            <div className="form-group">
              <label className="form-label">Technician Name</label>
              <TechnicianSelect
                value={form.technician_name || ""}
                onSelect={(name, userId) => {
                  setForm((f) => ({ ...f, technician_name: name, technician_uuid: userId }));
                }}
              />
            </div>

            {/* Visit Charge */}
            <div className="form-group">
              <label className="form-label">Visit Charge (₹)</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={form.visit_charge || ""}
                onChange={(e) => set("visit_charge", e.target.value)}
              />
            </div>

            {/* Status */}
            <div className="form-group full-width">
              <label className="form-label required">Status</label>
              <select
                className={`form-select ${errors.status ? "error" : ""}`}
                value={form.status || "Pending"}
                onChange={(e) => set("status", e.target.value)}
              >
                {COMPLAINT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.status && (
                <span className="form-error">{errors.status}</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <div className="loading-spinner"></div> Saving…
              </>
            ) : (
              "Save Complaint"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
