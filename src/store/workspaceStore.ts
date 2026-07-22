import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { UserId } from '../model/user';
import {
  createWorkspace,
  createWorkspaceInvitation,
  createWorkspaceMember,
  getPermissionsForRole,
  isInvitationExpired,
  type CreateWorkspaceInput,
  type CreateWorkspaceInvitationInput,
  type UpdateWorkspaceInput,
  type Workspace,
  type WorkspaceId,
  type WorkspaceInvitation,
  type WorkspaceInvitationId,
  type WorkspaceMember,
  type WorkspaceMemberId,
  type WorkspacePermissions,
  type WorkspaceRole,
} from '../model/workspace';

/**
 * Editable fields of an existing workspace member.
 */
export interface UpdateWorkspaceMemberInput {
  role?: WorkspaceRole;
  permissions?: Partial<WorkspacePermissions>;
  status?: WorkspaceMember['status'];
}

/**
 * Result returned when a workspace invitation is accepted.
 */
export interface AcceptWorkspaceInvitationResult {
  workspace: Workspace;
  member: WorkspaceMember;
  invitation: WorkspaceInvitation;
}

/**
 * Workspace state managed by Zustand.
 *
 * The current alpha implementation persists data in localStorage.
 * A production multi-user system must replace local persistence with
 * authenticated backend API calls.
 */
export interface WorkspaceState {
  /**
   * All locally available workspaces.
   */
  workspaces: Workspace[];

  /**
   * Currently selected workspace.
   */
  selectedWorkspaceId: WorkspaceId | null;

  /**
   * Creates a workspace and selects it.
   */
  addWorkspace: (
    input: CreateWorkspaceInput,
  ) => Workspace;

  /**
   * Updates editable workspace properties.
   */
  updateWorkspace: (
    workspaceId: WorkspaceId,
    input: UpdateWorkspaceInput,
  ) => Workspace;

  /**
   * Selects a workspace.
   */
  selectWorkspace: (
    workspaceId: WorkspaceId | null,
  ) => void;

  /**
   * Archives a workspace.
   */
  archiveWorkspace: (
    workspaceId: WorkspaceId,
  ) => Workspace;

  /**
   * Restores an archived workspace.
   */
  restoreWorkspace: (
    workspaceId: WorkspaceId,
  ) => Workspace;

  /**
   * Permanently removes a workspace from local state.
   */
  deleteWorkspace: (
    workspaceId: WorkspaceId,
  ) => void;

  /**
   * Creates a pending invitation.
   */
  inviteMember: (
    input: CreateWorkspaceInvitationInput,
  ) => WorkspaceInvitation;

  /**
   * Revokes a pending invitation.
   */
  revokeInvitation: (
    workspaceId: WorkspaceId,
    invitationId: WorkspaceInvitationId,
  ) => WorkspaceInvitation;

  /**
   * Declines a pending invitation.
   */
  declineInvitation: (
    workspaceId: WorkspaceId,
    invitationId: WorkspaceInvitationId,
  ) => WorkspaceInvitation;

  /**
   * Accepts an invitation and creates an active membership.
   */
  acceptInvitation: (
    token: string,
    userId: UserId,
  ) => AcceptWorkspaceInvitationResult;

  /**
   * Directly adds an existing user to a workspace.
   */
  addMember: (
    workspaceId: WorkspaceId,
    userId: UserId,
    role: Exclude<WorkspaceRole, 'owner'>,
    addedBy: UserId,
  ) => WorkspaceMember;

  /**
   * Updates a member's role, status or explicit permissions.
   */
  updateMember: (
    workspaceId: WorkspaceId,
    memberId: WorkspaceMemberId,
    input: UpdateWorkspaceMemberInput,
  ) => WorkspaceMember;

  /**
   * Removes a member from a workspace.
   */
  removeMember: (
    workspaceId: WorkspaceId,
    memberId: WorkspaceMemberId,
  ) => WorkspaceMember;

  /**
   * Transfers workspace ownership.
   */
  transferOwnership: (
    workspaceId: WorkspaceId,
    newOwnerUserId: UserId,
  ) => Workspace;

  /**
   * Removes expired pending invitations.
   */
  expireInvitations: (
    now?: Date,
  ) => void;

  /**
   * Clears all locally persisted workspace data.
   */
  resetWorkspaceStore: () => void;
}

const STORAGE_KEY = 'omi-workspaces';

const initialWorkspaceState = {
  workspaces: [] as Workspace[],
  selectedWorkspaceId: null as WorkspaceId | null,
};

/**
 * Local workspace state for the current Studio alpha.
 */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      ...initialWorkspaceState,

      addWorkspace: (input) => {
        const workspace = createWorkspace(input);

        set((state) => ({
          workspaces: [
            ...state.workspaces,
            workspace,
          ],
          selectedWorkspaceId: workspace.id,
        }));

        return workspace;
      },

      updateWorkspace: (
        workspaceId,
        input,
      ) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        assertWorkspaceIsEditable(workspace);

        const updatedWorkspace: Workspace = {
          ...workspace,
          title:
            input.title !== undefined
              ? requireNonEmpty(
                  input.title,
                  'The workspace title is required.',
                )
              : workspace.title,
          description:
            input.description !== undefined
              ? input.description.trim() ||
                undefined
              : workspace.description,
          manuscriptLanguage:
            input.manuscriptLanguage !== undefined
              ? requireNonEmpty(
                  input.manuscriptLanguage
                    .toLowerCase(),
                  'The manuscript language is required.',
                )
              : workspace.manuscriptLanguage,
          translationLanguages:
            input.translationLanguages !== undefined
              ? normalizeLanguages(
                  input.translationLanguages,
                  input.manuscriptLanguage ??
                    workspace.manuscriptLanguage,
                )
              : workspace.translationLanguages,
          visibility:
            input.visibility ??
            workspace.visibility,
          updatedAt: createTimestamp(),
        };

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return updatedWorkspace;
      },

      selectWorkspace: (workspaceId) => {
        if (workspaceId !== null) {
          getWorkspaceOrThrow(
            get().workspaces,
            workspaceId,
          );
        }

        set({
          selectedWorkspaceId: workspaceId,
        });
      },

      archiveWorkspace: (workspaceId) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        if (workspace.status === 'deleted') {
          throw new Error(
            'A deleted workspace cannot be archived.',
          );
        }

        if (workspace.status === 'archived') {
          return workspace;
        }

        const timestamp = createTimestamp();

        const updatedWorkspace: Workspace = {
          ...workspace,
          status: 'archived',
          archivedAt: timestamp,
          updatedAt: timestamp,
        };

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return updatedWorkspace;
      },

      restoreWorkspace: (workspaceId) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        if (workspace.status === 'deleted') {
          throw new Error(
            'A deleted workspace cannot be restored.',
          );
        }

        if (workspace.status === 'active') {
          return workspace;
        }

        const updatedWorkspace: Workspace = {
          ...workspace,
          status: 'active',
          archivedAt: undefined,
          updatedAt: createTimestamp(),
        };

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return updatedWorkspace;
      },

      deleteWorkspace: (workspaceId) => {
        getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        set((state) => ({
          workspaces:
            state.workspaces.filter(
              (workspace) =>
                workspace.id !==
                workspaceId,
            ),
          selectedWorkspaceId:
            state.selectedWorkspaceId ===
            workspaceId
              ? null
              : state.selectedWorkspaceId,
        }));
      },

      inviteMember: (input) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          input.workspaceId,
        );

        assertWorkspaceIsEditable(workspace);

        const normalizedEmail =
          normalizeEmail(input.email);

        const duplicateInvitation =
          workspace.invitations.some(
            (invitation) =>
              invitation.email ===
                normalizedEmail &&
              invitation.status ===
                'pending' &&
              !isInvitationExpired(
                invitation,
              ),
          );

        if (duplicateInvitation) {
          throw new Error(
            'A pending invitation already exists for this e-mail address.',
          );
        }

        const invitation =
          createWorkspaceInvitation({
            ...input,
            email: normalizedEmail,
          });

        const updatedWorkspace: Workspace = {
          ...workspace,
          invitations: [
            ...workspace.invitations,
            invitation,
          ],
          updatedAt: createTimestamp(),
        };

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return invitation;
      },

      revokeInvitation: (
        workspaceId,
        invitationId,
      ) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        const invitation =
          getInvitationOrThrow(
            workspace,
            invitationId,
          );

        if (
          invitation.status !== 'pending'
        ) {
          throw new Error(
            'Only pending invitations can be revoked.',
          );
        }

        const updatedInvitation: WorkspaceInvitation =
          {
            ...invitation,
            status: 'revoked',
          };

        const updatedWorkspace =
          replaceInvitation(
            workspace,
            updatedInvitation,
          );

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return updatedInvitation;
      },

      declineInvitation: (
        workspaceId,
        invitationId,
      ) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        const invitation =
          getInvitationOrThrow(
            workspace,
            invitationId,
          );

        if (
          invitation.status !== 'pending'
        ) {
          throw new Error(
            'Only pending invitations can be declined.',
          );
        }

        const updatedInvitation: WorkspaceInvitation =
          {
            ...invitation,
            status: 'declined',
          };

        const updatedWorkspace =
          replaceInvitation(
            workspace,
            updatedInvitation,
          );

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return updatedInvitation;
      },

      acceptInvitation: (
        token,
        userId,
      ) => {
        const normalizedToken =
          token.trim();

        if (!normalizedToken) {
          throw new Error(
            'The invitation token is required.',
          );
        }

        const workspace =
          get().workspaces.find(
            (candidate) =>
              candidate.invitations.some(
                (invitation) =>
                  invitation.token ===
                  normalizedToken,
              ),
          );

        if (!workspace) {
          throw new Error(
            'The invitation could not be found.',
          );
        }

        assertWorkspaceIsEditable(workspace);

        const invitation =
          workspace.invitations.find(
            (candidate) =>
              candidate.token ===
              normalizedToken,
          );

        if (!invitation) {
          throw new Error(
            'The invitation could not be found.',
          );
        }

        if (
          invitation.status !== 'pending'
        ) {
          throw new Error(
            'The invitation is no longer pending.',
          );
        }

        if (
          isInvitationExpired(invitation)
        ) {
          const expiredInvitation: WorkspaceInvitation =
            {
              ...invitation,
              status: 'expired',
            };

          replaceWorkspace(
            set,
            replaceInvitation(
              workspace,
              expiredInvitation,
            ),
          );

          throw new Error(
            'The invitation has expired.',
          );
        }

        const existingMember =
          workspace.members.find(
            (member) =>
              member.userId === userId &&
              member.status !== 'removed',
          );

        if (existingMember) {
          throw new Error(
            'The user is already a workspace member.',
          );
        }

        const member =
          createWorkspaceMember(
            workspace.id,
            userId,
            invitation.role,
            invitation.invitedBy,
          );

        const timestamp =
          createTimestamp();

        const acceptedInvitation: WorkspaceInvitation =
          {
            ...invitation,
            status: 'accepted',
            acceptedAt: timestamp,
            acceptedByUserId: userId,
          };

        const updatedWorkspace: Workspace = {
          ...workspace,
          members: [
            ...workspace.members,
            member,
          ],
          invitations:
            workspace.invitations.map(
              (candidate) =>
                candidate.id ===
                acceptedInvitation.id
                  ? acceptedInvitation
                  : candidate,
            ),
          updatedAt: timestamp,
        };

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return {
          workspace: updatedWorkspace,
          member,
          invitation:
            acceptedInvitation,
        };
      },

      addMember: (
        workspaceId,
        userId,
        role,
        addedBy,
      ) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        assertWorkspaceIsEditable(workspace);

        const existingMember =
          workspace.members.find(
            (member) =>
              member.userId === userId &&
              member.status !== 'removed',
          );

        if (existingMember) {
          throw new Error(
            'The user is already a workspace member.',
          );
        }

        const member =
          createWorkspaceMember(
            workspaceId,
            userId,
            role,
            addedBy,
          );

        const updatedWorkspace: Workspace = {
          ...workspace,
          members: [
            ...workspace.members,
            member,
          ],
          updatedAt: createTimestamp(),
        };

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return member;
      },

      updateMember: (
        workspaceId,
        memberId,
        input,
      ) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        assertWorkspaceIsEditable(workspace);

        const member = getMemberOrThrow(
          workspace,
          memberId,
        );

        if (member.role === 'owner') {
          if (
            input.role !== undefined &&
            input.role !== 'owner'
          ) {
            throw new Error(
              'The owner role can only be changed through ownership transfer.',
            );
          }

          if (
            input.status !== undefined &&
            input.status !== 'active'
          ) {
            throw new Error(
              'The active workspace owner cannot be suspended or removed.',
            );
          }
        }

        const nextRole =
          input.role ?? member.role;

        const defaultPermissions =
          input.role !== undefined
            ? getPermissionsForRole(
                nextRole,
              )
            : member.permissions;

        const updatedMember: WorkspaceMember =
          {
            ...member,
            role: nextRole,
            status:
              input.status ??
              member.status,
            permissions: {
              ...defaultPermissions,
              ...input.permissions,
            },
            updatedAt:
              createTimestamp(),
          };

        const updatedWorkspace =
          replaceMember(
            workspace,
            updatedMember,
          );

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return updatedMember;
      },

      removeMember: (
        workspaceId,
        memberId,
      ) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        assertWorkspaceIsEditable(workspace);

        const member = getMemberOrThrow(
          workspace,
          memberId,
        );

        if (member.role === 'owner') {
          throw new Error(
            'The workspace owner cannot be removed.',
          );
        }

        const removedMember: WorkspaceMember =
          {
            ...member,
            status: 'removed',
            updatedAt:
              createTimestamp(),
          };

        replaceWorkspace(
          set,
          replaceMember(
            workspace,
            removedMember,
          ),
        );

        return removedMember;
      },

      transferOwnership: (
        workspaceId,
        newOwnerUserId,
      ) => {
        const workspace = getWorkspaceOrThrow(
          get().workspaces,
          workspaceId,
        );

        assertWorkspaceIsEditable(workspace);

        if (
          workspace.ownerId ===
          newOwnerUserId
        ) {
          return workspace;
        }

        const currentOwner =
          workspace.members.find(
            (member) =>
              member.userId ===
                workspace.ownerId &&
              member.role === 'owner' &&
              member.status === 'active',
          );

        if (!currentOwner) {
          throw new Error(
            'The current owner membership is missing.',
          );
        }

        const newOwner =
          workspace.members.find(
            (member) =>
              member.userId ===
                newOwnerUserId &&
              member.status === 'active',
          );

        if (!newOwner) {
          throw new Error(
            'The new owner must be an active workspace member.',
          );
        }

        const timestamp =
          createTimestamp();

        const previousOwnerMember: WorkspaceMember =
          {
            ...currentOwner,
            role: 'editor',
            permissions:
              getPermissionsForRole(
                'editor',
              ),
            updatedAt: timestamp,
          };

        const newOwnerMember: WorkspaceMember =
          {
            ...newOwner,
            role: 'owner',
            permissions:
              getPermissionsForRole(
                'owner',
              ),
            updatedAt: timestamp,
          };

        const updatedWorkspace: Workspace = {
          ...workspace,
          ownerId: newOwnerUserId,
                    members: workspace.members.map(
            (member) => {
              if (
                member.id ===
                previousOwnerMember.id
              ) {
                return previousOwnerMember;
              }

              if (
                member.id ===
                newOwnerMember.id
              ) {
                return newOwnerMember;
              }

              return member;
            },
          ),
          updatedAt: timestamp,
        };

        replaceWorkspace(
          set,
          updatedWorkspace,
        );

        return updatedWorkspace;
      },

      expireInvitations: (
        now = new Date(),
      ) => {
        set((state) => ({
          workspaces: state.workspaces.map(
            (workspace) => {
              let changed = false;

              const invitations =
                workspace.invitations.map(
                  (
                    invitation,
                  ): WorkspaceInvitation => {
                    if (
                      invitation.status ===
                        'pending' &&
                      isInvitationExpired(
                        invitation,
                        now,
                      )
                    ) {
                      changed = true;

                      return {
                        ...invitation,
                        status: 'expired',
                      };
                    }

                    return invitation;
                  },
                );

              if (!changed) {
                return workspace;
              }

              return {
                ...workspace,
                invitations,
                updatedAt:
                  createTimestamp(),
              };
            },
          ),
        }));
      },

      resetWorkspaceStore: () => {
        set({
          workspaces: [],
          selectedWorkspaceId: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
    },
  ),
);

/**
 * Returns a workspace or throws when it does not exist.
 */
function getWorkspaceOrThrow(
  workspaces: Workspace[],
  workspaceId: WorkspaceId,
): Workspace {
  const workspace = workspaces.find(
    (candidate) =>
      candidate.id === workspaceId,
  );

  if (!workspace) {
    throw new Error(
      'The workspace could not be found.',
    );
  }

  return workspace;
}

/**
 * Returns a workspace member or throws when it does not exist.
 */
function getMemberOrThrow(
  workspace: Workspace,
  memberId: WorkspaceMemberId,
): WorkspaceMember {
  const member = workspace.members.find(
    (candidate) =>
      candidate.id === memberId,
  );

  if (!member) {
    throw new Error(
      'The workspace member could not be found.',
    );
  }

  return member;
}

/**
 * Returns an invitation or throws when it does not exist.
 */
function getInvitationOrThrow(
  workspace: Workspace,
  invitationId: WorkspaceInvitationId,
): WorkspaceInvitation {
  const invitation =
    workspace.invitations.find(
      (candidate) =>
        candidate.id === invitationId,
    );

  if (!invitation) {
    throw new Error(
      'The workspace invitation could not be found.',
    );
  }

  return invitation;
}

/**
 * Replaces a workspace in Zustand state.
 */
function replaceWorkspace(
  set: (
    updater: (
      state: WorkspaceState,
    ) => Partial<WorkspaceState>,
  ) => void,
  updatedWorkspace: Workspace,
): void {
  set((state) => ({
    workspaces: state.workspaces.map(
      (workspace) =>
        workspace.id ===
        updatedWorkspace.id
          ? updatedWorkspace
          : workspace,
    ),
  }));
}

/**
 * Replaces one member inside a workspace.
 */
function replaceMember(
  workspace: Workspace,
  updatedMember: WorkspaceMember,
): Workspace {
  return {
    ...workspace,
    members: workspace.members.map(
      (member) =>
        member.id === updatedMember.id
          ? updatedMember
          : member,
    ),
    updatedAt: createTimestamp(),
  };
}

/**
 * Replaces one invitation inside a workspace.
 */
function replaceInvitation(
  workspace: Workspace,
  updatedInvitation: WorkspaceInvitation,
): Workspace {
  return {
    ...workspace,
    invitations:
      workspace.invitations.map(
        (invitation) =>
          invitation.id ===
          updatedInvitation.id
            ? updatedInvitation
            : invitation,
      ),
    updatedAt: createTimestamp(),
  };
}

/**
 * Prevents modifications to archived or deleted workspaces.
 */
function assertWorkspaceIsEditable(
  workspace: Workspace,
): void {
  if (workspace.status !== 'active') {
    throw new Error(
      'Only active workspaces can be modified.',
    );
  }
}

/**
 * Creates an ISO timestamp.
 */
function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Requires a non-empty trimmed string.
 */
function requireNonEmpty(
  value: string,
  errorMessage: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(errorMessage);
  }

  return normalizedValue;
}

/**
 * Normalizes an e-mail address.
 */
function normalizeEmail(
  email: string,
): string {
  const normalizedEmail = email
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      'The invitation e-mail address is required.',
    );
  }

  return normalizedEmail;
}

/**
 * Normalizes translation language codes and removes duplicates.
 */
function normalizeLanguages(
  languages: string[],
  manuscriptLanguage: string,
): string[] {
  const normalizedManuscriptLanguage =
    manuscriptLanguage
      .trim()
      .toLowerCase();

  return Array.from(
    new Set(
      languages
        .map((language) =>
          language
            .trim()
            .toLowerCase(),
        )
        .filter(
          (language) =>
            language.length > 0 &&
            language !==
              normalizedManuscriptLanguage,
        ),
    ),
  );
  }
