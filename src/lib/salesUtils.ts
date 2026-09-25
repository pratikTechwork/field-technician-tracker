import type { SalesVisit, SalesVisitStatus } from "../types/sales";

export function visitStatus(v: SalesVisit): SalesVisitStatus {
  return v.punch_out_time ? "complete" : "incomplete";
}

export function formatDuration(
  start?: string | null,
  end?: string | null
): string {
  if (!start || !end) return "—";
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return "—";

  const totalMinutes = Math.round((e - s) / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Coordinates arrive as loosely-shaped jsonb; try common key/array conventions. */
export function extractLatLng(
  coord: unknown
): { lat: number; lng: number } | null {
  if (!coord) return null;

  if (Array.isArray(coord) && coord.length >= 2) {
    const [a, b] = coord;
    const lat = Number(a);
    const lng = Number(b);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    return null;
  }

  if (typeof coord === "object") {
    const obj = coord as Record<string, unknown>;
    const rawLat = obj.lat ?? obj.latitude ?? obj.Latitude ?? obj.y;
    const rawLng = obj.lng ?? obj.lon ?? obj.long ?? obj.longitude ?? obj.Longitude ?? obj.x;
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (!isNaN(lat) && !isNaN(lng) && rawLat != null && rawLng != null) {
      return { lat, lng };
    }
  }

  return null;
}

export function formatCoordinate(coord: unknown): string {
  const parsed = extractLatLng(coord);
  if (!parsed) return "—";
  return `${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`;
}

export function mapsLinkForCoordinate(coord: unknown): string | null {
  const parsed = extractLatLng(coord);
  if (!parsed) return null;
  return `https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`;
}
