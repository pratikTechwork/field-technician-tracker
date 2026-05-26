import { useState } from "react";
import { Complaint } from "../types";

interface Props {
  complaint: Complaint;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteModal({ complaint, onClose, onConfirm }: Props) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">Delete Complaint</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ textAlign: "center", paddingTop: 24, paddingBottom: 24 }}>
          <div className="delete-confirm-icon">🗑️</div>
          <div className="delete-confirm-text">
            Are you sure you want to delete Zoho ticket{" "}
            <strong>{complaint.ticket_id}</strong>?
            <br />
            <span style={{ fontSize: 12, marginTop: 6, display: "block" }}>
              Client: {complaint.client_name} · Outlet: {complaint.outlet_name}
            </span>
            <br />
            <span style={{ color: "#ef4444", fontWeight: 500, fontSize: 13 }}>
              This action cannot be undone.
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? (
              <>
                <div className="loading-spinner"></div> Deleting…
              </>
            ) : (
              "Yes, Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
