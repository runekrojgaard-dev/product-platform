import type { RoleName } from "@prisma/client";

/**
 * Central permission table. This is the single source of truth for what
 * each role can do — checked server-side on every API route and server
 * action. Never rely on hiding a button in the UI as the only protection.
 */

export type Permission =
  | "product.create"
  | "product.view"
  | "product.version.create"
  | "product.mastersample.propose"
  | "product.mastersample.approve"
  | "document.upload"
  | "media.upload"
  | "observation.create"
  | "observation.view"
  | "observation.assign"
  | "observation.approve"
  | "measurement.record"
  | "production.record"
  | "production.batch.manage"
  | "assembly.record"
  | "project.view"
  | "project.manage"
  | "customer.manage"
  | "report.view"
  | "admin.users.manage"
  | "admin.roles.manage"
  | "admin.categories.manage"
  | "audit.view";

const ALL_PERMISSIONS: Permission[] = [
  "product.create",
  "product.view",
  "product.version.create",
  "product.mastersample.propose",
  "product.mastersample.approve",
  "document.upload",
  "media.upload",
  "observation.create",
  "observation.view",
  "observation.assign",
  "observation.approve",
  "measurement.record",
  "production.record",
  "production.batch.manage",
  "assembly.record",
  "project.view",
  "project.manage",
  "customer.manage",
  "report.view",
  "admin.users.manage",
  "admin.roles.manage",
  "admin.categories.manage",
  "audit.view",
];

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  ADMINISTRATOR: ALL_PERMISSIONS,

  PRODUCT_DESIGNER: [
    "product.create",
    "product.view",
    "product.version.create",
    "product.mastersample.propose",
    "document.upload",
    "media.upload",
    "observation.view",
    "project.view",
    "report.view",
  ],

  QUALITY_CONTROL: [
    "product.view",
    "product.mastersample.approve",
    "observation.create",
    "observation.view",
    "observation.assign",
    "observation.approve",
    "measurement.record",
    "media.upload",
    "project.view",
    "report.view",
  ],

  PRODUCTION: [
    "product.view",
    "production.record",
    "production.batch.manage",
    "observation.view",
    "measurement.record",
    "media.upload",
    "report.view",
  ],

  ASSEMBLY_INSTALLATION: [
    "product.view",
    "assembly.record",
    "observation.create",
    "observation.view",
    "media.upload",
  ],

  PROJECT_MANAGER: [
    "product.view",
    "project.view",
    "project.manage",
    "customer.manage",
    "observation.view",
    "report.view",
  ],

  VIEWER: ["product.view", "project.view", "observation.view", "report.view"],
};

export function roleHasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
