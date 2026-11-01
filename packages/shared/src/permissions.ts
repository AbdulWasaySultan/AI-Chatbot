// Roles and permissions (plans/06-tenancy-auth-security.md §4).
// The API enforces these; the UI uses the same map to hide controls.

export const ORG_ROLES = ['owner', 'admin', 'member'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const WORKSPACE_ROLES = ['admin', 'editor', 'operator', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PERMISSIONS = [
  'workspace:read',
  'workspace:update',
  'workspace:delete',
  'profile:read',
  'profile:update',
  'agent:read',
  'agent:update',
  'agent:publish',
  'channel:manage',
  'conversation:read',
  'conversation:test',
  'conversation:takeover',
  'action:read',
  'action:update',
  'integration:manage',
  'members:read',
  'members:manage',
  'data:export',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEW: Permission[] = [
  'workspace:read',
  'profile:read',
  'agent:read',
  'conversation:read',
  'action:read',
  'members:read',
];
const OPERATE: Permission[] = [...VIEW, 'conversation:takeover', 'action:update'];
const EDIT: Permission[] = [
  ...OPERATE,
  'profile:update',
  'agent:update',
  'agent:publish',
  'channel:manage',
  'conversation:test',
];
const ADMIN: Permission[] = [
  ...EDIT,
  'workspace:update',
  'workspace:delete',
  'integration:manage',
  'members:manage',
  'data:export',
  'audit:read',
];

export const ROLE_PERMISSIONS: Record<WorkspaceRole, ReadonlySet<Permission>> = {
  viewer: new Set(VIEW),
  operator: new Set(OPERATE),
  editor: new Set(EDIT),
  admin: new Set(ADMIN),
};

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Org owners and admins act as workspace admins on every workspace in their organization. */
export function effectiveWorkspaceRole(
  orgRole: OrgRole | null,
  workspaceRole: WorkspaceRole | null
): WorkspaceRole | null {
  if (orgRole === 'owner' || orgRole === 'admin') return 'admin';
  return workspaceRole;
}
