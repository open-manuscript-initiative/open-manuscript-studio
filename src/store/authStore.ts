import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  createUser,
  getUserDisplayName,
  isValidEmail,
  normalizeEmail,
  type CreateUserInput,
  type UpdateUserProfileInput,
  type User,
  type UserId,
} from '../model/user';

/**
 * Local authentication session.
 *
 * This is only suitable for the current frontend alpha.
 * Production authentication must be handled by a backend.
 */
export interface AuthSession {
  userId: UserId;
  createdAt: string;
  lastActivityAt: string;
}

/**
 * Registration data accepted by the local alpha implementation.
 */
export interface RegisterInput extends CreateUserInput {
  password: string;
}

/**
 * Login credentials.
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Local credential record.
 *
 * Passwords are intentionally not stored in the User model because
 * authentication credentials are not part of the public user profile.
 *
 * This frontend-only implementation is not secure enough for production.
 */
interface LocalCredential {
  userId: UserId;
  email: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Authentication-related errors exposed to the UI.
 */
export type AuthErrorCode =
  | 'invalid-email'
  | 'invalid-password'
  | 'email-already-exists'
  | 'invalid-credentials'
  | 'account-not-active'
  | 'user-not-found'
  | 'not-authenticated';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * Zustand authentication state.
 */
export interface AuthState {
  /**
   * Locally registered user accounts.
   */
  users: User[];

  /**
   * Frontend-only credential records.
   */
  credentials: LocalCredential[];

  /**
   * Current authenticated session.
   */
  session: AuthSession | null;

  /**
   * Indicates whether an authentication operation is running.
   */
  isLoading: boolean;

  /**
   * Most recent authentication error.
   */
  error: string | null;

  /**
   * Creates a local user account and signs the user in.
   */
  register: (input: RegisterInput) => Promise<User>;

  /**
   * Signs in with a locally registered account.
   */
  login: (input: LoginInput) => Promise<User>;

  /**
   * Ends the current session.
   */
  logout: () => Promise<void>;

  /**
   * Updates the current user's public profile and preferences.
   */
  updateCurrentUser: (
    input: UpdateUserProfileInput,
  ) => Promise<User>;

  /**
   * Refreshes the current session activity timestamp.
   */
  touchSession: () => void;

  /**
   * Clears the most recent error.
   */
  clearError: () => void;

  /**
   * Removes all local authentication data.
   */
  resetAuthStore: () => void;
}

const STORAGE_KEY = 'omi-auth';

const initialAuthState = {
  users: [] as User[],
  credentials: [] as LocalCredential[],
  session: null as AuthSession | null,
  isLoading: false,
  error: null as string | null,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialAuthState,

      register: async (input) => {
        set({
          isLoading: true,
          error: null,
        });

        try {
          const email = normalizeEmail(input.email);

          validatePassword(input.password);

          if (!isValidEmail(email)) {
            throw new AuthError(
              'invalid-email',
              'Invalid e-mail address.',
            );
          }

          const emailAlreadyExists = get().users.some(
            (user) => normalizeEmail(user.email) === email,
          );

          if (emailAlreadyExists) {
            throw new AuthError(
              'email-already-exists',
              'An account already exists with this e-mail address.',
            );
          }

          const user = createUser({
            email,
            fullName: input.fullName,
            affiliation: input.affiliation,
            orcid: input.orcid,
            interfaceLanguage: input.interfaceLanguage,
            workingLanguages: input.workingLanguages,
          });

          const timestamp = createTimestamp();

          const activeUser: User = {
            ...user,
            emailVerified: true,
            status: 'active',
            identities: [
              {
                provider: 'password',
                providerUserId: user.id,
                connectedAt: timestamp,
              },
            ],
            lastLoginAt: timestamp,
            updatedAt: timestamp,
          };

          const credential: LocalCredential = {
            userId: activeUser.id,
            email,
            password: input.password,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          const session: AuthSession = {
            userId: activeUser.id,
            createdAt: timestamp,
            lastActivityAt: timestamp,
          };

          set((state) => ({
            users: [...state.users, activeUser],
            credentials: [
              ...state.credentials,
              credential,
            ],
            session,
            isLoading: false,
            error: null,
          }));

          return activeUser;
        } catch (error) {
          const message = getErrorMessage(error);

          set({
            isLoading: false,
            error: message,
          });

          throw error;
        }
      },

      login: async (input) => {
        set({
          isLoading: true,
          error: null,
        });

        try {
          const email = normalizeEmail(input.email);

          if (!isValidEmail(email)) {
            throw new AuthError(
              'invalid-email',
              'Invalid e-mail address.',
            );
          }

          const credential = get().credentials.find(
            (candidate) => candidate.email === email,
          );

          if (
            !credential ||
            credential.password !== input.password
          ) {
            throw new AuthError(
              'invalid-credentials',
              'Incorrect e-mail address or password.',
            );
          }

          const user = get().users.find(
            (candidate) =>
              candidate.id === credential.userId,
          );

          if (!user) {
            throw new AuthError(
              'user-not-found',
              'The user account could not be found.',
            );
          }

          if (user.status !== 'active') {
            throw new AuthError(
              'account-not-active',
              'The user account is not active.',
            );
          }

          const timestamp = createTimestamp();

          const updatedUser: User = {
            ...user,
            lastLoginAt: timestamp,
            updatedAt: timestamp,
          };

          const session: AuthSession = {
            userId: updatedUser.id,
            createdAt: timestamp,
            lastActivityAt: timestamp,
          };

          set((state) => ({
            users: state.users.map((candidate) =>
              candidate.id === updatedUser.id
                ? updatedUser
                : candidate,
            ),
            session,
            isLoading: false,
            error: null,
          }));

          return updatedUser;
        } catch (error) {
          const message = getErrorMessage(error);

          set({
            isLoading: false,
            error: message,
          });

          throw error;
        }
      },

      logout: async () => {
        set({
          session: null,
          isLoading: false,
          error: null,
        });
      },

      updateCurrentUser: async (input) => {
        set({
          isLoading: true,
          error: null,
        });

        try {
          const currentUser = getCurrentUserOrThrow(get());

          const nextOrcid =
            input.orcid !== undefined
              ? input.orcid.trim() || undefined
              : currentUser.profile.orcid;

          const updatedUser: User = {
            ...currentUser,
            profile: {
              ...currentUser.profile,
              fullName:
                input.fullName !== undefined
                  ? requireNonEmpty(
                      input.fullName,
                      'The user name is required.',
                    )
                  : currentUser.profile.fullName,
              affiliation:
                input.affiliation !== undefined
                  ? input.affiliation.trim() || undefined
                  : currentUser.profile.affiliation,
              orcid: nextOrcid,
              avatarUrl:
                input.avatarUrl !== undefined
                  ? input.avatarUrl.trim() || undefined
                  : currentUser.profile.avatarUrl,
              bio:
                input.bio !== undefined
                  ? input.bio.trim() || undefined
                  : currentUser.profile.bio,
            },
            preferences: {
              ...currentUser.preferences,
              interfaceLanguage:
                input.interfaceLanguage !== undefined
                  ? requireNonEmpty(
                      input.interfaceLanguage,
                      'The interface language is required.',
                    ).toLowerCase()
                  : currentUser.preferences
                      .interfaceLanguage,
              workingLanguages:
                input.workingLanguages !== undefined
                  ? normalizeLanguages(
                      input.workingLanguages,
                    )
                  : currentUser.preferences
                      .workingLanguages,
              timeZone:
                input.timeZone !== undefined
                  ? input.timeZone.trim() || undefined
                  : currentUser.preferences.timeZone,
            },
            updatedAt: createTimestamp(),
          };

          set((state) => ({
            users: state.users.map((user) =>
              user.id === updatedUser.id
                ? updatedUser
                : user,
            ),
            isLoading: false,
            error: null,
          }));

          return updatedUser;
        } catch (error) {
          const message = getErrorMessage(error);

          set({
            isLoading: false,
            error: message,
          });

          throw error;
        }
      },

      touchSession: () => {
        const session = get().session;

        if (!session) {
          return;
        }

        set({
          session: {
            ...session,
            lastActivityAt: createTimestamp(),
          },
        });
      },

      clearError: () => {
        set({
          error: null,
        });
      },

      resetAuthStore: () => {
        set(initialAuthState);
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,

      partialize: (state) => ({
        users: state.users,
        credentials: state.credentials,
        session: state.session,
      }),
    },
  ),
);

/**
 * Returns the authenticated user, if one exists.
 */
export function getCurrentUser(
  state: AuthState,
): User | undefined {
  if (!state.session) {
    return undefined;
  }

  return state.users.find(
    (user) => user.id === state.session?.userId,
  );
}

/**
 * Returns whether the user is currently authenticated.
 */
export function isAuthenticated(
  state: AuthState,
): boolean {
  return Boolean(getCurrentUser(state));
}

/**
 * Returns a user-facing display name for the current account.
 */
export function getCurrentUserDisplayName(
  state: AuthState,
): string | undefined {
  const user = getCurrentUser(state);

  return user
    ? getUserDisplayName(user)
    : undefined;
}

/**
 * Returns the current user or throws an authentication error.
 */
function getCurrentUserOrThrow(
  state: AuthState,
): User {
  const user = getCurrentUser(state);

  if (!user) {
    throw new AuthError(
      'not-authenticated',
      'Authentication is required.',
    );
  }

  return user;
}

/**
 * Applies basic alpha-level password validation.
 */
function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new AuthError(
      'invalid-password',
      'The password must contain at least 8 characters.',
    );
  }

  if (!/[A-Za-z]/.test(password)) {
    throw new AuthError(
      'invalid-password',
      'The password must contain at least one letter.',
    );
  }

  if (!/\d/.test(password)) {
    throw new AuthError(
      'invalid-password',
      'The password must contain at least one number.',
    );
  }
}

/**
 * Returns unique normalized language codes.
 */
function normalizeLanguages(
  languages: string[],
): string[] {
  return Array.from(
    new Set(
      languages
        .map((language) =>
          language.trim().toLowerCase(),
        )
        .filter(Boolean),
    ),
  );
}

/**
 * Returns a trimmed non-empty value.
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
 * Returns a readable error message.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown authentication error occurred.';
}

/**
 * Returns the current ISO 8601 timestamp.
 */
function createTimestamp(): string {
  return new Date().toISOString();
          }
