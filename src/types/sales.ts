export interface SalesVisit {
  id: string;
  punch_in_time: string | null;
  punch_out_time: string | null;
  punch_in_location: string | null;
  punch_out_location: string | null;
  punch_in_coordinate: unknown;
  punch_out_coordinate: unknown;
  client_name: string | null;
  client_email: string | null;
  client_phone_number: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  type: string | null;
}

export type SalesVisitStatus = "complete" | "incomplete";
