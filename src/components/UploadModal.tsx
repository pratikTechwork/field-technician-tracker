import { useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase, TABLE_NAME } from "../supabase";
import {
  Complaint,
  REQUIRED_COLUMNS,
  COLUMN_LABELS,
  HEADER_ALIASES,
  normalizeComplaintStatus,
} from "../types";

interface Props {
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

interface ParsedResult {
  rows: Partial<Complaint>[];
  rawHeaders: string[];
  mappedHeaders: (keyof Complaint | null)[];
  missingColumns: (keyof Complaint)[];
  foundColumns: (keyof Complaint)[];
  fileName: string;
  fileSize: string;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function UploadModal({ onClose, onSuccess, onError }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    setParseError(null);
    setParsed(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      setParseError("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        if (rawData.length < 1) {
          setParseError("The file appears to be empty.");
          return;
        }

        const headerRow: string[] = (rawData[0] || []).map(String);
        const dataRows = rawData.slice(1).filter((row) =>
          row.some((cell) => String(cell).trim() !== "")
        );

        // Map each raw header to a known Complaint field
        const mappedHeaders: (keyof Complaint | null)[] = headerRow.map((h) => {
          const norm = normalizeHeader(h);
          return HEADER_ALIASES[norm] || null;
        });

        const foundSet = new Set<keyof Complaint>();
        mappedHeaders.forEach((m) => { if (m) foundSet.add(m); });

        const foundColumns = Array.from(foundSet);
        const missingColumns = REQUIRED_COLUMNS.filter((c) => !foundSet.has(c));

        // Build row objects
        const rows: Partial<Complaint>[] = dataRows.map((row) => {
          const obj: Partial<Complaint> = {};
          headerRow.forEach((_, idx) => {
            const field = mappedHeaders[idx];
            if (field) {
              (obj as any)[field] = String(row[idx] ?? "").trim();
            }
          });
          return obj;
        });

        setParsed({
          rows,
          rawHeaders: headerRow,
          mappedHeaders,
          missingColumns,
          foundColumns,
          fileName: file.name,
          fileSize: formatBytes(file.size),
        });
      } catch (err) {
        setParseError("Failed to parse file. Make sure it is a valid CSV or Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleRemoveFile = () => {
    setParsed(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!parsed || parsed.missingColumns.length > 0) return;
    setUploading(true);

    const payload = parsed.rows.map((row) => ({
      ticket_id: row.ticket_id || "",
      date_of_complaint: row.date_of_complaint || new Date().toISOString().slice(0, 10),
      client_name: row.client_name || "",
      outlet_name: row.outlet_name || "",
      device_id: row.device_id || null,
      outlet_address: row.outlet_address || null,
      outlet_poc_name: row.outlet_poc_name || null,
      outlet_poc_number: row.outlet_poc_number || null,
      issue_type: row.issue_type || null,
      technician_name: row.technician_name || null,
      visit_charge:
        row.visit_charge !== "" && row.visit_charge != null
          ? Number(row.visit_charge) || 0
          : 0,
      status: normalizeComplaintStatus(row.status),
    }));

    // Insert in batches of 100
    const batchSize = 100;
    let insertedCount = 0;
    let batchError: string | null = null;

    for (let i = 0; i < payload.length; i += batchSize) {
      const batch = payload.slice(i, i + batchSize);
      const { error } = await supabase.from(TABLE_NAME).insert(batch);
      if (error) {
        batchError = error.message;
        break;
      }
      insertedCount += batch.length;
    }

    setUploading(false);

    if (batchError) {
      onError(`Import failed after ${insertedCount} rows: ${batchError}`);
    } else {
      onSuccess(`Successfully imported ${insertedCount} complaint(s)!`);
      onClose();
    }
  };

  const canImport =
    parsed !== null && parsed.missingColumns.length === 0 && parsed.rows.length > 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${parsed ? "modal-xl" : "modal-lg"}`}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Upload CSV / Excel</div>
            <div className="modal-subtitle">
              All 12 column headers must be present. Values can be empty.
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Error */}
          {parseError && (
            <div className="alert alert-error">
              <span>⚠️</span>
              <span>{parseError}</span>
            </div>
          )}

          {/* Drop Zone or File Info */}
          {!parsed ? (
            <div
              className={`drag-zone ${dragOver ? "drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="drag-zone-icon">📁</div>
              <div className="drag-zone-text">Drag & drop your file here</div>
              <div className="drag-zone-hint">
                or <span>browse to upload</span> — supports .csv, .xlsx, .xls
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: "none" }}
                onChange={handleFileInput}
              />
            </div>
          ) : (
            <>
              {/* File Info Bar */}
              <div className="upload-file-info">
                <div className="upload-file-icon">
                  {parsed.fileName.endsWith(".csv") ? "📄" : "📊"}
                </div>
                <div>
                  <div className="upload-file-name">{parsed.fileName}</div>
                  <div className="upload-file-meta">
                    {parsed.rows.length} data rows · {parsed.fileSize}
                  </div>
                </div>
                <button
                  className="upload-file-remove"
                  onClick={handleRemoveFile}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>

              {/* Column Validation */}
              <div className="validation-section">
                <div className="validation-title">Column Header Validation</div>
                {parsed.missingColumns.length > 0 && (
                  <div className="alert alert-error" style={{ marginBottom: 10 }}>
                    <span>❌</span>
                    <span>
                      <strong>{parsed.missingColumns.length} required column(s) missing.</strong>{" "}
                      Please fix the file and re-upload.
                    </span>
                  </div>
                )}
                {parsed.missingColumns.length === 0 && (
                  <div className="alert alert-success" style={{ marginBottom: 10 }}>
                    <span>✅</span>
                    <span>All required columns are present. Ready to import.</span>
                  </div>
                )}
                <div className="validation-tags">
                  {REQUIRED_COLUMNS.map((col) => {
                    const found = parsed.foundColumns.includes(col);
                    return (
                      <span
                        key={col}
                        className={`vtag ${found ? "vtag-ok" : "vtag-missing"}`}
                      >
                        {found ? "✓" : "✕"} {COLUMN_LABELS[col]}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Data Preview */}
              {parsed.rows.length > 0 && (
                <>
                  <div className="divider"></div>
                  <div className="preview-section-title">
                    <span>👁️ Data Preview</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: "#6b7280",
                      }}
                    >
                      {parsed.rows.length} rows · Orange cells = empty value
                    </span>
                  </div>
                  <div className="preview-table-wrapper">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          {REQUIRED_COLUMNS.map((col) => (
                            <th key={col}>{COLUMN_LABELS[col]}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.map((row, i) => (
                          <tr key={i}>
                            <td style={{ color: "#9ca3af", fontSize: 11 }}>{i + 1}</td>
                            {REQUIRED_COLUMNS.map((col) => {
                              const val = (row as any)[col];
                              const isEmpty =
                                val === undefined || val === null || String(val).trim() === "";
                              return (
                                <td
                                  key={col}
                                  className={isEmpty ? "cell-empty" : ""}
                                  title={isEmpty ? "(empty)" : String(val)}
                                >
                                  {isEmpty ? <em style={{ opacity: 0.6 }}>—</em> : String(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {parsed.rows.length === 0 && (
                <div className="alert alert-warning">
                  <span>⚠️</span>
                  <span>No data rows found in the file (only headers detected).</span>
                </div>
              )}
            </>
          )}

          {/* Required columns reference */}
          {!parsed && (
            <>
              <div className="divider"></div>
              <div
                style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 500 }}
              >
                Required column headers (all 12 must be present):
              </div>
              <div className="validation-tags">
                {REQUIRED_COLUMNS.map((col) => (
                  <span key={col} className="vtag vtag-ok" style={{ background: "#f3f4f6", color: "#374151" }}>
                    {COLUMN_LABELS[col]}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          {parsed && (
            <button
              className="btn btn-success"
              onClick={handleImport}
              disabled={!canImport || uploading}
              title={
                !canImport
                  ? parsed.missingColumns.length > 0
                    ? "Fix missing columns first"
                    : "No rows to import"
                  : ""
              }
            >
              {uploading ? (
                <>
                  <div className="loading-spinner"></div> Importing…
                </>
              ) : (
                <>📥 Import {parsed.rows.length} Row{parsed.rows.length !== 1 ? "s" : ""}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
