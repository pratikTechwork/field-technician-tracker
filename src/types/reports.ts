export interface PunchRecord {
  id: number;
  created_at: string;
  user_id?: string;
  type?: string;
  timestamp?: string;
  location?: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  name?: string;
  client_id?: number;
  complaint_id?: string | number;
  zoho_ticket_id?: string;
}

export interface PunchOutRecord extends PunchRecord {
  issue?: string;
  remarks?: string;
  charges?: string;
  total?: string;
}

export type VisitStatus = "complete" | "incomplete";

export interface VisitRow {
  punchinId: number;
  complaintId: string;
  technicianName: string;
  zohoTicketId: string;
  punchInAt: string;
  punchOutAt: string | null;
  punchInLocation: string;
  punchOutLocation: string;
  visitStatus: VisitStatus;
  visitDate: Date;
}

export interface ExpenseRow {
  id: number;
  complaintId: string;
  technicianName: string;
  zohoTicketId: string;
  charges: number;
  total: number;
  issue: string;
  remarks: string;
  punchOutAt: string;
  visitDate: Date;
}

export interface BucketRow {
  technicianName: string;
  technicianUuid: string;
  pendingCount: number;
  complaints: {
    ticket_id: string;
    client_name: string;
    outlet_name: string;
    status: string;
    date_of_complaint: string;
    issue_type: string;
  }[];
}

export type ReportTab =
  | "daily-visit"
  | "monthly-visit"
  | "expense"
  | "bucket";
