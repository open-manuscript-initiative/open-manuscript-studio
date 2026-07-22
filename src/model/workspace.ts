import type { UserId } from './user';

/**
 * Open Manuscript Studio
 * Workspace and collaboration domain model
 */

export type WorkspaceId = string;
export type WorkspaceMemberId = string;
export type WorkspaceInvitationId = string;

/**
 * ISO 639-1 language code.
 *
 * Examples:
 * - en
 * - hu
 * - de
 */
export type LanguageCode = string;

/**
 * A workspace represents the collaborative environment
 * belonging to one manuscript.
 */
export type WorkspaceStatus =
  | 'active'
  | 'archived'
  | 'deleted';

/**
 * Workspace visibility.
 *
 * Private workspaces are accessible only to explicitly assigned members.
 * Organization visibility may be introduced later.
 */
export type WorkspaceVisibility =
  | 'private';

/**
 * A user's role inside one specific workspace.
 *
 * Roles are workspace-specific. The same user may have different roles
 * in different manuscripts.
 */
export type WorkspaceRole =
  | 'owner'
  | 'editor'
  | 'co-author'
  | 'reviewer'
  | 'translator'
  | 'viewer';

/**
 * Membership lifecycle state.
 */
export type WorkspaceMemberStatus =
  | 'invited'
  | 'active'
  | 'suspended'
  | 'removed';

/**
 * Invitation lifecycle state.
 */
export type WorkspaceInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'revoked';

/**
 * Individual workspace permissions.
 *
 * Roles define the default permission set, but explicit permissions
 * make authorization checks easier and allow later customization.
 */
export interface WorkspacePermissions {
  /**
   * Read manuscript content and workspace metadata.
   */
  canViewWorkspace: boolean;

  /**
   * Edit manuscript content.
   */
  canEditManuscript: boolean;

  /**
   * Edit manuscript metadata such as title, abstract and keywords.
   */
  canEditMetadata: boolean;

  /**
   * Create and edit annotations or review comments.
   */
  canCreateAnnotations: boolean;

  /**
   * Edit translated manuscript content.
   */
  canEditTranslations: boolean;

  /**
   * Manage workspace members and invitations.
   */
  canManageMembers: boolean;

  /**
   * Change member roles and permissions.
   */
  canManageRoles: boolean;

  /**
   * Change workspace settings.
   */
  canManageWorkspace: boolean;

  /**
   * Archive or delete the workspace.
   */
  canDeleteWorkspace: boolean;
}

/**
 * A user assigned to a workspace.
 */
export interface WorkspaceMember {
  /**
   * Internal membership identifier.
   */
  id: WorkspaceMemberId;

  /**
   * Workspace to which this membership belongs.
   */
  workspaceId: WorkspaceId;

  /**
   * User assigned to the workspace.
   */
  userId: UserId;

  /**
   * Workspace-specific role.
   */
  role: WorkspaceRole;

  /**
   * Current membership state.
   */
  status: WorkspaceMemberStatus;

  /**
   * Effective permissions for the member.
   */
  permissions: WorkspacePermissions;

  /**
   * User who invited or added this member.
   *
   * The owner created together with the workspace may not have
   * an inviter.
   */
  invitedBy?: UserId;

  /**
   * ISO 8601 timestamp when the invitation was created.
   */
  invitedAt?: string;

  /**
   * ISO 8601 timestamp when the user joined the workspace.
   */
  joinedAt?: string;

  /**
   * ISO 8601 timestamp when this membership was last modified.
   */
  updatedAt: string;
}

/**
 * Invitation sent to an e-mail address before a user becomes
 * an active workspace member.
 */
export interface WorkspaceInvitation {
  /**
   * Internal invitation identifier.
   */
  id: WorkspaceInvitationId;

  /**
   * Workspace for which the invitation was created.
   */
  workspaceId: WorkspaceId;

  /**
   * Normalized recipient e-mail address.
   */
  email: string;

  /**
   * Role assigned after acceptance.
   */
  role: Exclude<WorkspaceRole, 'owner'>;

  /**
   * Invitation state.
   */
  status: WorkspaceInvitationStatus;

  /**
   * User who created the invitation.
   */
  invitedBy: UserId;

  /**
   * Secure invitation token.
   *
   * In production, only a token hash should be persisted by the backend.
   */
  token: string;

  /**
   * ISO 8601 creation timestamp.
   */
  createdAt: string;

  /**
   * ISO 8601 expiration timestamp.
   */
  expiresAt: string;

  /**
   * ISO 8601 acceptance timestamp.
   */
  acceptedAt?: string;

  /**
   * User account linked after the invitation is accepted.
   */
  acceptedByUserId?: UserId;
}

/**
 * Primary collaborative workspace model.
 */
export interface Workspace {
  /**
   * Internal immutable identifier.
   */
  id: WorkspaceId;

  /**
   * Manuscript identifier associated with the workspace.
   *
   * This remains a string so the workspace model does not depend
   * directly on a particular manuscript implementation.
   */
  manuscriptId: string;

  /**
   * Human-readable workspace title.
   */
  title: string;

  /**
   * Optional workspace description.
   */
  description?: string;

  /**
   * User who owns the workspace.
   */
  ownerId: UserId;

  /**
   * Primary manuscript language.
   */
  manuscriptLanguage: LanguageCode;

  /**
   * Additional translation languages enabled in the workspace.
   */
  translationLanguages: LanguageCode[];

  /**
   * Workspace lifecycle state.
   */
  status: WorkspaceStatus;

  /**
   * Workspace visibility.
   */
  visibility: WorkspaceVisibility;

  /**
   * Assigned workspace members.
   */
  members: WorkspaceMember[];

  /**
   * Outstanding and historical invitations.
   */
  invitations: WorkspaceInvitation[];

  /**
   * ISO 8601 creation timestamp.
   */
  createdAt: string;

  /**
   * ISO 8601 last modification timestamp.
   */
  updatedAt: string;

  /**
   * ISO 8601 archive timestamp.
   */
  archivedAt?: string;
}

/**
 * Data required to create a workspace.
 */
export interface CreateWorkspaceInput {
  manuscriptId: string;
  title: string;
  ownerId: UserId;
  manuscriptLanguage: LanguageCode;
  description?: string;
  translationLanguages?: LanguageCode[];
}

/**
 * Editable workspace properties.
 */
export interface UpdateWorkspaceInput {
  title?: string;
  description?: string;
  manuscriptLanguage?: LanguageCode;
  translationLanguages?: LanguageCode[];
  visibility?: WorkspaceVisibility;
}

/**
 * Data required to invite a collaborator.
 */
export interface CreateWorkspaceInvitationInput {
  workspaceId: WorkspaceId;
  email: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  invitedBy: UserId;
  expiresInDays?: number;
}

/**
 * Default permissions belonging to each workspace role.
 */
export const WORKSPACE_ROLE_PERMISSIONS: Readonly<
  Record<WorkspaceRole, WorkspacePermissions>
> = {
  owner: {
    canViewWorkspace: true,
    canEditManuscript: true,
    canEditMetadata: true,
    canCreateAnnotations: true,
    canEditTranslations: true,
    canManageMembers: true,
    canManageRoles: true,
    canManageWorkspace: true,
    canDeleteWorkspace: true,
  },

  editor: {
    canViewWorkspace: true,
    canEditManuscript: true,
    canEditMetadata: true,
    canCreateAnnotations: true,
    canEditTranslations: true,
    canManageMembers: true,
    canManageRoles: false,
    canManageWorkspace: true,
    canDeleteWorkspace: false,
  },

  'co-author': {
    canViewWorkspace: true,
    canEditManuscript: true,
    canEditMetadata: true,
    canCreateAnnotations: true,
    canEditTranslations: false,
    canManageMembers: false,
    canManageRoles: false,
    canManageWorkspace: false,
    canDeleteWorkspace: false,
  },

  reviewer: {
    canViewWorkspace: true,
    canEditManuscript: false,
    canEditMetadata: false,
    canCreateAnnotations: true,
    canEditTranslations: false,
    canManageMembers: false,
    canManageRoles: false,
    canManageWorkspace: false,
    canDeleteWorkspace: false,
  },

  translator: {
    canViewWorkspace: true,
    canEditManuscript: false,
    canEditMetadata: false,
    canCreateAnnotations: true,
    canEditTranslations: true,
    canManageMembers: false,
    canManageRoles: false,
    canManageWorkspace: false,
    canDeleteWorkspace: false,
  },

  viewer: {
    canViewWorkspace: true,
    canEditManuscript: false,
    canEditMetadata: false,
    canCreateAnnotations: false,
    canEditTranslations: false,
    canManageMembers: false,
    canManageRoles: false,
    canManageWorkspace: false,
    canDeleteWorkspace: false,
  },
};

/**
 * Returns a new copy of the default permissions assigned to a role.
 */
export function getPermissionsForRole(
  role: WorkspaceRole,
): WorkspacePermissions {
  return {
    ...WORKSPACE_ROLE_PERMISSIONS[role],
  };
}

/**
 * Creates a workspace together with its initial owner membership.
 *
 * This is suitable for the local alpha implementation.
 * Production persistence and authorization must be handled by a backend.
 */
export function createWorkspace(
  input: CreateWorkspaceInput,
  id: WorkspaceId = crypto.randomUUID(),
): Workspace {
  const manuscriptId = input.manuscriptId.trim();
  const title = input.title.trim();
  const manuscriptLanguage = input.manuscriptLanguage.trim().toLowerCase();

  if (!manuscriptId) {
    throw new Error('The manuscript identifier is required.');
  }

  if (!title) {
    throw new Error('The workspace title is required.');
  }

  if (!input.ownerId.trim()) {
    throw new Error('The workspace owner is required.');
  }

  if (!manuscriptLanguage) {
    throw new Error('The manuscript language is required.');
  }

  const timestamp = new Date().toISOString();

  const ownerMembership: WorkspaceMember = {
    id: crypto.randomUUID(),
    workspaceId: id,
    userId: input.ownerId,
    role: 'owner',
    status: 'active',
    permissions: getPermissionsForRole('owner'),
    joinedAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    id,
    manuscriptId,
    title,
    description: input.description?.trim() || undefined,
    ownerId: input.ownerId,
    manuscriptLanguage,
    translationLanguages: normalizeLanguageCodes(
      input.translationLanguages ?? [],
      manuscriptLanguage,
    ),
    status: 'active',
    visibility: 'private',
    members: [ownerMembership],
    invitations: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Creates a workspace membership.
 */
export function createWorkspaceMember(
  workspaceId: WorkspaceId,
  userId: UserId,
  role: WorkspaceRole,
  invitedBy?: UserId,
  id: WorkspaceMemberId = crypto.randomUUID(),
): WorkspaceMember {
  const timestamp = new Date().toISOString();

  return {
    id,
    workspaceId,
    userId,
    role,
    status: 'active',
    permissions: getPermissionsForRole(role),
    invitedBy,
    invitedAt: invitedBy ? timestamp : undefined,
    joinedAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Creates a pending workspace invitation.
 */
export function createWorkspaceInvitation(
  input: CreateWorkspaceInvitationInput,
  id: WorkspaceInvitationId = crypto.randomUUID(),
  token: string = crypto.randomUUID(),
): WorkspaceInvitation {
  const email = normalizeEmail(input.email);
  const createdAt = new Date();
  const expiresInDays = input.expiresInDays ?? 7;

  if (!isValidEmail(email)) {
    throw new Error('Invalid invitation e-mail address.');
  }

  if (expiresInDays <= 0) {
    throw new Error('Invitation expiration must be greater than zero days.');
  }

  const expiresAt = new Date(createdAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays);

  return {
    id,
    workspaceId: input.workspaceId,
    email,
    role: input.role,
    status: 'pending',
    invitedBy: input.invitedBy,
    token,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Finds an active workspace member by user identifier.
 */
export function getActiveWorkspaceMember(
  workspace: Workspace,
  userId: UserId,
): WorkspaceMember | undefined {
  return workspace.members.find(
    (member) =>
      member.userId === userId &&
      member.status === 'active',
  );
}

/**
 * Returns whether the user is an active workspace member.
 */
export function isWorkspaceMember(
  workspace: Workspace,
  userId: UserId,
): boolean {
  return Boolean(getActiveWorkspaceMember(workspace, userId));
}

/**
 * Returns whether the user owns the workspace.
 */
export function isWorkspaceOwner(
  workspace: Workspace,
  userId: UserId,
): boolean {
  return (
    workspace.ownerId === userId &&
    getActiveWorkspaceMember(workspace, userId)?.role === 'owner'
  );
}

/**
 * Checks one permission for an active workspace member.
 */
export function hasWorkspacePermission(
  workspace: Workspace,
  userId: UserId,
  permission: keyof WorkspacePermissions,
): boolean {
  const member = getActiveWorkspaceMember(workspace, userId);

  return member?.permissions[permission] ?? false;
}

/**
 * Checks whether the user has one of the supplied workspace roles.
 */
export function hasWorkspaceRole(
  workspace: Workspace,
  userId: UserId,
  allowedRoles: readonly WorkspaceRole[],
): boolean {
  const member = getActiveWorkspaceMember(workspace, userId);

  return member
    ? allowedRoles.includes(member.role)
    : false;
}

/**
 * Checks whether a pending invitation already exists for an e-mail address.
 */
export function hasPendingInvitation(
  workspace: Workspace,
  email: string,
): boolean {
  const normalizedEmail = normalizeEmail(email);

  return workspace.invitations.some(
    (invitation) =>
      invitation.email === normalizedEmail &&
      invitation.status === 'pending' &&
      !isInvitationExpired(invitation),
  );
}

/**
 * Returns whether an invitation has expired.
 */
export function isInvitationExpired(
  invitation: WorkspaceInvitation,
  now: Date = new Date(),
): boolean {
  return new Date(invitation.expiresAt).getTime() <= now.getTime();
}

/**
 * Returns a normalized, unique list of language codes.
 *
 * The manuscript's primary language is removed from the translation list.
 */
export function normalizeLanguageCodes(
  languages: LanguageCode[],
  manuscriptLanguage?: LanguageCode,
): LanguageCode[] {
  const primaryLanguage = manuscriptLanguage
    ?.trim()
    .toLowerCase();

  return Array.from(
    new Set(
      languages
        .map((language) => language.trim().toLowerCase())
        .filter(Boolean)
        .filter((language) => language !== primaryLanguage),
    ),
  );
}

/**
 * Returns a normalized e-mail address.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Performs basic e-mail syntax validation.
 *
 * Final validation must also be performed by the backend.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
