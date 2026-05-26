import type { User } from "@supabase/supabase-js";

export type UserRole = "admin" | "user" | "technician" | "unknown";

function normalizeRoleValue(value?: string | null): UserRole {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "admin") return "admin";
  if (normalized === "user") return "user";
  if (normalized === "technician" || normalized === "technicain") {
    return "technician";
  }

  return "unknown";
}

export function getUserRole(user?: User | null): UserRole {
  if (!user) return "unknown";

  const roleFromAppMetadata = normalizeRoleValue(user.app_metadata?.role);
  if (roleFromAppMetadata !== "unknown") return roleFromAppMetadata;

  const roleFromUserMetadata = normalizeRoleValue(user.user_metadata?.role);
  if (roleFromUserMetadata !== "unknown") return roleFromUserMetadata;

  return "unknown";
}

export function formatUserRole(role: UserRole): string {
  if (role === "admin") return "Admin";
  if (role === "user") return "User";
  if (role === "technician") return "Technician";
  return "Unknown";
}

export function getUserDisplayName(user?: User | null): string {
  if (!user) return "";

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email;

  return typeof displayName === "string" ? displayName : user.email || "User";
}
