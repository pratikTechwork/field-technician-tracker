export type ComplaintStatus = "Pending" | "In Progress" | "Complete";

export const COMPLAINT_STATUS_OPTIONS: ComplaintStatus[] = [
  "Pending",
  "In Progress",
  "Complete",
];

/** Map legacy / upload values to one of the three allowed statuses. */
export function normalizeComplaintStatus(
  status?: string | null
): ComplaintStatus {
  if (!status?.trim()) return "Pending";
  const s = status.toLowerCase().trim();
  if (
    s === "complete" ||
    s === "completed" ||
    s === "closed" ||
    s === "resolved" ||
    s === "done"
  ) {
    return "Complete";
  }
  if (s.includes("progress")) return "In Progress";
  const exact = COMPLAINT_STATUS_OPTIONS.find((o) => o.toLowerCase() === s);
  if (exact) return exact;
  return "Pending";
}

export function displayComplaintStatus(status?: string | null): ComplaintStatus {
  return normalizeComplaintStatus(status);
}

export function getComplaintStatusClass(status?: string | null): string {
  const n = normalizeComplaintStatus(status);
  if (n === "Complete") return "badge badge-complete";
  if (n === "In Progress") return "badge badge-progress";
  return "badge badge-pending";
}

export function isPendingComplaintStatus(status?: string | null): boolean {
  const n = normalizeComplaintStatus(status);
  return n === "Pending" || n === "In Progress";
}

export interface Complaint {
  complaint_id?: string | number;
  ticket_id: string;
  date_of_complaint: string;
  client_name: string;
  outlet_name: string;
  device_id?: string;
  outlet_address?: string;
  outlet_poc_name?: string;
  outlet_poc_number?: string;
  issue_type?: string;
  technician_name?: string;
  technician_uuid?: string;
  visit_charge?: number | string;
  status?: ComplaintStatus | string;
  agent_user_id?: string;
  agent_name?: string;
  created_at?: string;
  updated_at?: string;
}

export const UPLOAD_COLUMNS: (keyof Complaint)[] = [
  "ticket_id",
  "date_of_complaint",
  "client_name",
  "outlet_name",
  "device_id",
  "outlet_address",
  "outlet_poc_name",
  "outlet_poc_number",
  "issue_type",
  "technician_name",
  "visit_charge",
  "status",
];

export const REQUIRED_COLUMNS: (keyof Complaint)[] = [
  "ticket_id",
  "date_of_complaint",
  "client_name",
  "outlet_name",
  "device_id",
  "outlet_address",
  "outlet_poc_name",
  "outlet_poc_number",
  "issue_type",
  "visit_charge",
  "status",
];

export const OPTIONAL_UPLOAD_COLUMNS: (keyof Complaint)[] = ["technician_name"];

export const COLUMN_LABELS: Record<keyof Complaint, string> = {
  complaint_id: "Complaint ID",
  ticket_id: "Zoho Ticket",
  date_of_complaint: "Date of Complaint",
  client_name: "Client Name",
  outlet_name: "Outlet Name",
  device_id: "Device ID",
  outlet_address: "Outlet Address",
  outlet_poc_name: "Outlet POC Name",
  outlet_poc_number: "Outlet POC Number",
  issue_type: "Issue Type",
  technician_name: "Technician Name",
  technician_uuid: "Technician UUID",
  visit_charge: "Visit Charge",
  status: "Status",
  agent_user_id: "Agent User ID",
  agent_name: "Agent Name",
  created_at: "Created At",
  updated_at: "Updated At",
};

// Map of various header aliases → canonical field key
export const HEADER_ALIASES: Record<string, keyof Complaint> = {
  ticket_id: "ticket_id",
  "ticket id": "ticket_id",
  ticketid: "ticket_id",
  zoho_ticket: "ticket_id",
  "zoho ticket": "ticket_id",
  zoho_ticket_id: "ticket_id",
  "zoho ticket id": "ticket_id",
  date_of_complaint: "date_of_complaint",
  "date of complaint": "date_of_complaint",
  "complaint date": "date_of_complaint",
  dateofcomplaint: "date_of_complaint",
  client_name: "client_name",
  "client name": "client_name",
  clientname: "client_name",
  outlet_name: "outlet_name",
  "outlet name": "outlet_name",
  outletname: "outlet_name",
  device_id: "device_id",
  "device id": "device_id",
  deviceid: "device_id",
  outlet_address: "outlet_address",
  "outlet address": "outlet_address",
  address: "outlet_address",
  outlet_poc_name: "outlet_poc_name",
  "outlet poc name": "outlet_poc_name",
  "poc name": "outlet_poc_name",
  outletpocname: "outlet_poc_name",
  outlet_poc_number: "outlet_poc_number",
  "outlet poc number": "outlet_poc_number",
  "poc number": "outlet_poc_number",
  poc_number: "outlet_poc_number",
  outletpocnumber: "outlet_poc_number",
  issue_type: "issue_type",
  "issue type": "issue_type",
  issuetype: "issue_type",
  technician_name: "technician_name",
  "technician name": "technician_name",
  technician: "technician_name",
  technicianname: "technician_name",
  visit_charge: "visit_charge",
  "visit charge": "visit_charge",
  visitcharge: "visit_charge",
  charge: "visit_charge",
  status: "status",
};
