import { prisma } from "@/lib/prisma";
import type { Role } from "@/app/generated/prisma/client";

// ── Permission constants ──────────────────────────────────────────────────────

export const PERMISSION_KEYS = [
  "ORDERING",
  "CREATE_INVOICES",
  "UPDATE_INVOICE_STATUS",
  "DELETE_INVOICES",
  "RECORD_PAYMENTS",
  "DELETE_PAYMENTS",
  "ADD_INSPECTIONS",
  "EDIT_INSPECTIONS",
  "ADD_CHANGE_ORDERS",
  "APPROVE_CHANGE_ORDERS",
  "MANAGE_DOCUMENTS",
  "MANAGE_LABOR",
  "MANAGE_MATERIALS",
  "ADD_NOTES",
  "MANAGE_TASKS",
  "MANAGE_CALENDAR",
  "SUBMIT_RFIS",
  "NOTIFICATION_SETTINGS",
  "MANAGE_PANELS",
  "EDIT_CIRCUITS",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  ORDERING:              "Send Stock Orders",
  CREATE_INVOICES:       "Create Invoices",
  UPDATE_INVOICE_STATUS: "Update Invoice Status",
  DELETE_INVOICES:       "Delete Invoices",
  RECORD_PAYMENTS:       "Record Payments",
  DELETE_PAYMENTS:       "Delete Payments",
  ADD_INSPECTIONS:       "Add Inspections",
  EDIT_INSPECTIONS:      "Edit Inspections",
  ADD_CHANGE_ORDERS:     "Submit Change Orders",
  APPROVE_CHANGE_ORDERS: "Approve Change Orders",
  MANAGE_DOCUMENTS:      "Manage Documents",
  MANAGE_LABOR:          "Log Labor Hours",
  MANAGE_MATERIALS:      "Log Materials",
  ADD_NOTES:             "Post Notes",
  MANAGE_TASKS:          "Manage Tasks",
  MANAGE_CALENDAR:       "Manage Calendar",
  SUBMIT_RFIS:           "Submit RFIs",
  NOTIFICATION_SETTINGS: "Edit Notification Settings",
  MANAGE_PANELS:         "Create & edit panel schedules",
  EDIT_CIRCUITS:         "Edit panel circuits",
};

// Roles that implicitly hold every permission — no DB record needed
const ALWAYS_GRANTED_ROLES: Role[] = ["ADMIN", "OFFICE"];

export function alwaysGranted(role: Role): boolean {
  return ALWAYS_GRANTED_ROLES.includes(role);
}

// ── DB helpers ────────────────────────────────────────────────────────────────

export async function getUserPermissions(userId: string): Promise<Set<PermissionKey>> {
  const perms = await prisma.userPermission.findMany({
    where: { userId },
    select: { permission: true },
  });
  return new Set(perms.map((p) => p.permission as PermissionKey));
}

export async function hasPermission(
  userId: string,
  role: Role,
  permission: PermissionKey
): Promise<boolean> {
  if (alwaysGranted(role)) return true;
  const perm = await prisma.userPermission.findFirst({ where: { userId, permission } });
  return perm !== null;
}

export async function grantPermission(
  userId: string,
  permission: PermissionKey,
  grantedById: string
): Promise<void> {
  const existing = await prisma.userPermission.findFirst({ where: { userId, permission } });
  if (!existing) {
    await prisma.userPermission.create({
      data: { userId, permission, scope: "GLOBAL", grantedById },
    });
  }
}

export async function revokePermission(
  userId: string,
  permission: PermissionKey
): Promise<void> {
  await prisma.userPermission.deleteMany({ where: { userId, permission } });
}
