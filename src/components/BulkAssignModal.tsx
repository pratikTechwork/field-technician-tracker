import { useState } from "react";
import TechnicianSelect from "./TechnicianSelect";

interface Props {
  selectedCount: number;
  onClose: () => void;
  onAssign: (technicianName: string, technicianUuid: string) => Promise<void>;
}

export default function BulkAssignModal({ selectedCount, onClose, onAssign }: Props) {
  const [technicianName, setTechnicianName] = useState("");
  const [technicianUuid, setTechnicianUuid] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!technicianName.trim() || !technicianUuid.trim()) {
      setError("Please select a technician from the dropdown list.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onAssign(technicianName.trim(), technicianUuid.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign technician.");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Bulk Assign Technician</div>
            <div className="modal-subtitle">
              Assign one technician to {selectedCount} selected complaint
              {selectedCount === 1 ? "" : "s"}.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={submitting}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="alert alert-info">
            <span>ℹ</span>
            <div>
              The technician you choose here will be assigned to every selected complaint.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Technician</label>
            <TechnicianSelect
              value={technicianName}
              onSelect={(name, userId) => {
                setTechnicianName(name);
                setTechnicianUuid(userId);
                if (error) setError("");
              }}
            />
            {error && <span className="form-error">{error}</span>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <div className="loading-spinner"></div> Assigning...
              </>
            ) : (
              "Assign Technician"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
