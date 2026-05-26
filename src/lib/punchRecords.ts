import {
  supabase,
  PUNCHIN_TABLE,
  PUNCHOUT_TABLE,
} from "../supabase";
import { toComplaintIdKey } from "./reportUtils";

export interface ComplaintPunchRecordPresence {
  hasPunchIn: boolean;
  hasPunchOut: boolean;
  error: string | null;
}

/**
 * Checks whether a complaint already has punch-in and punch-out records.
 * Used to prevent reopening a completed complaint after the technician finished the job.
 */
export async function getComplaintPunchRecordPresence(
  complaintId: string | number | undefined | null
): Promise<ComplaintPunchRecordPresence> {
  const key = toComplaintIdKey(complaintId);
  if (!key) {
    return {
      hasPunchIn: false,
      hasPunchOut: false,
      error: "Missing complaint ID",
    };
  }

  const [punchInRes, punchOutRes] = await Promise.all([
    supabase
      .from(PUNCHIN_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("complaint_id", key),
    supabase
      .from(PUNCHOUT_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("complaint_id", key),
  ]);

  if (punchInRes.error) {
    return {
      hasPunchIn: false,
      hasPunchOut: false,
      error: punchInRes.error.message,
    };
  }

  if (punchOutRes.error) {
    return {
      hasPunchIn: false,
      hasPunchOut: false,
      error: punchOutRes.error.message,
    };
  }

  return {
    hasPunchIn: (punchInRes.count ?? 0) > 0,
    hasPunchOut: (punchOutRes.count ?? 0) > 0,
    error: null,
  };
}
