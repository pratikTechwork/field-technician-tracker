import type { PunchOutRecord, PunchRecord, VisitRow } from "../types/reports";

export function getRecordDate(record: {
  created_at?: string;
  timestamp?: string;
}): Date {
  if (record.created_at) {
    const d = new Date(record.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  if (record.timestamp) {
    const d = new Date(record.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatComplaintDateDisplay(value: string | null | undefined): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const [, y, m, d] = match;
  return `${d}-${m}-${y}`;
}

export function formatMonthInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function parseMoney(value?: string | null): number {
  if (!value) return 0;
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/** Normalize complaint_id from DB (uuid string, number, etc.) to a string key. */
export function toComplaintIdKey(id: unknown): string | null {
  if (id == null || id === "") return null;
  return String(id);
}

export function formatComplaintIdDisplay(id: string, truncate = true): string {
  if (!id || id === "—") return "—";
  if (!truncate || id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export { isPendingComplaintStatus as isPendingStatus } from "../types";

export function joinVisits(
  punchins: PunchRecord[],
  punchouts: PunchOutRecord[]
): VisitRow[] {
  const punchoutByComplaint = new Map<string, PunchOutRecord[]>();
  for (const po of punchouts) {
    const key = toComplaintIdKey(po.complaint_id);
    if (!key) continue;
    const list = punchoutByComplaint.get(key) ?? [];
    list.push(po);
    punchoutByComplaint.set(key, list);
  }

  const usedPunchoutIds = new Set<number>();

  return punchins
    .map((pi) => ({ pi, key: toComplaintIdKey(pi.complaint_id) }))
    .filter((row): row is { pi: PunchRecord; key: string } => row.key != null)
    .map(({ pi, key }) => {
      const candidates = punchoutByComplaint.get(key) ?? [];
      const punchInDate = getRecordDate(pi);

      let matched: PunchOutRecord | undefined;
      for (const po of candidates) {
        if (usedPunchoutIds.has(po.id)) continue;
        const punchOutDate = getRecordDate(po);
        if (punchOutDate >= punchInDate) {
          matched = po;
          break;
        }
      }
      if (!matched && candidates.length > 0) {
        matched = candidates.find((po) => !usedPunchoutIds.has(po.id));
      }
      if (matched) usedPunchoutIds.add(matched.id);

      const complete = !!matched;
      return {
        punchinId: pi.id,
        complaintId: key,
        technicianName: pi.name || matched?.name || "—",
        zohoTicketId: pi.zoho_ticket_id || matched?.zoho_ticket_id || "—",
        punchInAt: pi.created_at || pi.timestamp || "",
        punchOutAt: matched ? matched.created_at || matched.timestamp || null : null,
        punchInLocation: pi.location || "—",
        punchOutLocation: matched?.location || "—",
        punchInImageUrl: pi.image_url || null,
        punchOutImageUrl: matched?.image_url || null,
        visitStatus: complete ? "complete" : "incomplete",
        visitDate: punchInDate,
      };
    })
    .sort((a, b) => b.visitDate.getTime() - a.visitDate.getTime());
}

export function getWeekKey(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return formatDateInput(monday);
}

export function matchesSearch(
  q: string,
  fields: (string | undefined | null)[]
): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(lower));
}
