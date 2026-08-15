import { create } from 'zustand';

import {
  getUserDisplayName,
  type CreateUserInput,
  type UpdateUserProfileInput,
  type User,
  type UserId,
} from '../model/user';
import {
  getCurrentAccount,
  loginAccount,
  logoutAccount,
  registerAccount,
  updateCurrentAccount,
} from '../services/authApi';

export interface AuthSession {
  userId: UserId;
  createdAt: string;
  lastActivityAt: string;
}

export interface RegisterInput extends CreateUserInput {
  password: string;
  invitationToken?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthState {
  users: User[];
  credentials: never[];
  session: AuthSession | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  initializeSession: () => Promise<void>;
  register: (input: RegisterInput) => Promise<User>;
  login: (input: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
  updateCurrentUser: (
    input: UpdateUserProfileInput,
  ) => Promise<User>;
  touchSession: () => void;
  clearError: () => void;
  resetAuthStore: () => void;
}

const initialAuthState = {
  users: [] as User[],
  credentials: [] as never[],
  session: null as AuthSession | null,
  isLoading: false,
  isInitialized: false,
  error: null as string | null,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialAuthState,

  initializeSession: async () => {
    if (get().isInitialized || get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const user = await getCurrentAccount();

      if (!user) {
        set({
          users: [],
          session: null,
          isLoading: false,
          isInitialized: true,
          error: null,
        });
        return;
      }

      setAuthenticatedUser(set, user, true);
    } catch (error) {
      set({
        users: [],
        session: null,
        isLoading: false,
        isInitialized: true,
        error: getErrorMessage(error),
      });
    }
  },

  register: async (input) => {
    set({ isLoading: true, error: null });

    try {
      const user = await registerAccount({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
        affiliation: input.affiliation,
        affiliationRorId: input.affiliationRorId,
        orcid: input.orcid,
        interfaceLanguage: input.interfaceLanguage,
        invitationToken: input.invitationToken,
      });

      setAuthenticatedUser(set, user, true);
      return user;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, isInitialized: true, error: message });
      throw error;
    }
  },

  login: async (input) => {
    set({ isLoading: true, error: null });

    try {
      const user = await loginAccount(input);
      setAuthenticatedUser(set, user, true);
      return user;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, isInitialized: true, error: message });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });

    try {
      await logoutAccount();
    } finally {
      set({
        users: [],
        session: null,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    }
  },

  updateCurrentUser: async (input) => {
    set({ isLoading: true, error: null });

    try {
      const user = await updateCurrentAccount(input);
      setAuthenticatedUser(set, user, true);
      return user;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  touchSession: () => {
    const session = get().session;
    if (!session) return;

    set({
      session: {
        ...session,
        lastActivityAt: new Date().toISOString(),
      },
    });
  },

  clearError: () => {
    set({ error: null });
  },

  resetAuthStore: () => {
    set({ ...initialAuthState, isInitialized: true });
  },
}));

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

export function isAuthenticated(
  state: AuthState,
): boolean {
  return Boolean(getCurrentUser(state));
}

export function getCurrentUserDisplayName(
  state: AuthState,
): string | undefined {
  const user = getCurrentUser(state);
  return user ? getUserDisplayName(user) : undefined;
}

function setAuthenticatedUser(
  set: (
    partial:
      | Partial<AuthState>
      | ((state: AuthState) => Partial<AuthState>),
  ) => void,
  user: User,
  initialized: boolean,
): void {
  const timestamp = new Date().toISOString();

  set({
    users: [user],
    credentials: [],
    session: {
      userId: user.id,
      createdAt: timestamp,
      lastActivityAt: timestamp,
    },
    isLoading: false,
    isInitialized: initialized,
    error: null,
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown authentication error occurred.';
}
