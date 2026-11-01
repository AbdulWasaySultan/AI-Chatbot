import type { WorkspaceRole, OrgRole } from '@fj/shared';
import type { SessionUser } from '../auth/auth.ts';

/** Who is acting, and in which workspace. Built by middleware, never from the request body. */
export interface WorkspaceContext {
  organizationId: string;
  workspaceId: string;
  workspaceName: string;
  timezone: string;
  userId: string;
  orgRole: OrgRole | null;
  role: WorkspaceRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      user?: SessionUser;
      workspace?: WorkspaceContext;
    }
  }
}

export {};
