import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./auth-context-definition";

interface User {
  id: string;
  email: string;
  name: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if auth is enabled via environment variable
  const isAuthEnabled = import.meta.env.VITE_AUTH_ENABLED === "true";

  useEffect(() => {
    // Only check auth if it's enabled
    if (isAuthEnabled) {
      checkAuth();
    } else {
      setIsLoading(false);
    }
  }, [isAuthEnabled]);

  const checkAuth = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/auth/session", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isAuthEnabled) {
      throw new Error("Authentication is disabled");
    }

    const response = await fetch("http://localhost:3001/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Sign in failed");
    }

    const data = await response.json();
    setUser(data.user);
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (!isAuthEnabled) {
      throw new Error("Authentication is disabled");
    }

    const response = await fetch("http://localhost:3001/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Sign up failed");
    }

    const data = await response.json();
    setUser(data.user);
  };

  const signOut = async () => {
    if (!isAuthEnabled) {
      return;
    }

    await fetch("http://localhost:3001/api/auth/sign-out", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAuthEnabled,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
