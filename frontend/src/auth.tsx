import React, { createContext, useContext, useMemo, useState } from "react";

export type UserSlug = "yorben" | "zus";

type AuthCtx = {
  token: string | null;
  user: UserSlug | null;
  login: (token: string, user: UserSlug) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserSlug | null>(null);

  const value = useMemo<AuthCtx>(() => ({
    token,
    user,
    login: (t, u) => { setToken(t); setUser(u); },
    logout: () => { setToken(null); setUser(null); },
  }), [token, user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}