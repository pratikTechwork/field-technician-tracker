import type { SalesVisit } from "../../types/sales";
import { formatDateTime } from "../../lib/reportUtils";
import {
  formatCoordinate,
  formatDuration,
  mapsLinkForCoordinate,
  visitStatus,
} from "../../lib/salesUtils";

interface Props {
  visit: SalesVisit;
  onClose: () => void;
}

export default function SalesVisitDetailModal({ visit, onClose }: Props) {
  const status = visitStatus(visit);
  const punchInMapsLink = mapsLinkForCoordinate(visit.punch_in_coordinate);
  const punchOutMapsLink = mapsLinkForCoordinate(visit.punch_out_coordinate);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{visit.client_name || "Client Visit"}</div>
            <div className="modal-subtitle">
              {visit.type || "Visit"} ·{" "}
              <span
                className={
                  status === "complete" ? "badge badge-complete" : "badge badge-pending"
                }
              >
                {status === "complete" ? "Complete" : "Incomplete"}
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Client Email</label>
              <div>{visit.client_email || "—"}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Client Phone</label>
              <div>{visit.client_phone_number || "—"}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Punch In</label>
              <div>{formatDateTime(visit.punch_in_time)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Punch Out</label>
              <div>{formatDateTime(visit.punch_out_time)}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Punch In Location</label>
              <div title={visit.punch_in_location || undefined}>
                {visit.punch_in_location || "—"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {formatCoordinate(visit.punch_in_coordinate)}
                {punchInMapsLink && (
                  <>
                    {" · "}
                    <a href={punchInMapsLink} target="_blank" rel="noopener noreferrer">
                      Open in Maps
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Punch Out Location</label>
              <div title={visit.punch_out_location || undefined}>
                {visit.punch_out_location || "—"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {formatCoordinate(visit.punch_out_coordinate)}
                {punchOutMapsLink && (
                  <>
                    {" · "}
                    <a href={punchOutMapsLink} target="_blank" rel="noopener noreferrer">
                      Open in Maps
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Duration</label>
              <div>{formatDuration(visit.punch_in_time, visit.punch_out_time)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Logged</label>
              <div>{formatDateTime(visit.created_at)}</div>
            </div>

            <div className="form-group full-width">
              <label className="form-label">Description</label>
              <div style={{ whiteSpace: "pre-wrap" }}>{visit.description || "—"}</div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
