import React, { createContext, useEffect, useState } from "react";
import type { AppSession, ChildSession, UserRole } from "@safespace/shared-types";
import {
  getExistingSession,
  logInUser,
  signUpUser,
  logOut,
  resetPasswordForEmail,
  updatePassword,
  onAuthStateChange,
} from "@safespace/api-client";
import {
  getStoredChildSession,
  clearStoredChildSession,
} from "../../../lib/childSessionStorage";

export interface AuthContextType {
  session: AppSession;
  loading: boolean;
  refreshSession: () => Promise<void>;
  error: string | null;
  login: (email: string, pass: string) => Promise<AppSession>;
  signup: (
    email: string,
    pass: string,
    role: UserRole,
    displayName?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (newPass: string) => Promise<void>;
  setChildSessionState: (s: ChildSession) => void;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<AppSession>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const existingSession = await getExistingSession();

        if (existingSession && mounted) {
          setSession(existingSession);
          setLoading(false);
          return;
        }

        const childSession = getStoredChildSession();

        if (childSession && mounted) {
          setSession(childSession);
          setLoading(false);
          return;
        }

        if (mounted) {
          setLoading(false);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    }

    initAuth();

    let subscription: { unsubscribe: () => void } | undefined;

    try {
      const listenerResult = onAuthStateChange(
        (_event: string, newSession: AppSession) => {
          if (mounted && newSession) {
            setSession(newSession);
          }
        }
      );

      subscription = listenerResult.data.subscription;
    } catch {
      // Ignored if client is uninitialized due to missing env config
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const refreshSession = async () => {
    setError(null);

    try {
      const activeSession = await getExistingSession();
      setSession(activeSession);
    } catch (err: unknown) {
      setError((err as Error).message);
      throw err;
    }
  };

  const login = async (email: string, pass: string) => {
    setLoading(true);
    setError(null);

    try {
      await logInUser(email, pass);
      const activeSession = await getExistingSession();
      setSession(activeSession);
      return activeSession;
    } catch (err: unknown) {
      const msg =
        (err as Error).message ||
        "Login failed. Please check your credentials.";

      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    email: string,
    pass: string,
    role: UserRole = "caregiver",
    displayName?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      await signUpUser(email, pass, role, displayName);
      const activeSession = await getExistingSession();
      setSession(activeSession);
    } catch (err: unknown) {
      const msg =
        (err as Error).message || "Signup failed. Please try again.";

      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);

    try {
      await logOut();
      clearStoredChildSession();
      setSession(null);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);

    try {
      await resetPasswordForEmail(
        email,
        `${window.location.origin}/reset-password`
      );
    } catch (err: unknown) {
      setError((err as Error).message);
      throw err;
    }
  };

  const changePassword = async (newPass: string) => {
    setError(null);

    try {
      await updatePassword(newPass);
    } catch (err: unknown) {
      setError((err as Error).message);
      throw err;
    }
  };

  const setChildSessionState = (s: ChildSession) => {
    setSession(s);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        refreshSession,
        error,
        login,
        signup,
        logout,
        resetPassword,
        changePassword,
        setChildSessionState,
        clearError,
      }}
    >
      {error &&
        error.includes("Missing required environment configuration") && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 text-amber-900 text-sm text-center">
            <strong>SafeSpace Configuration Notice:</strong> {error}
          </div>
        )}

      {children}
    </AuthContext.Provider>
  );
};