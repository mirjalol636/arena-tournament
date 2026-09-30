"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api, mutate, setToken } from "@/services/api";
import type { User } from "@/types";
type Auth = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<Auth>({
  user: null,
  ready: false,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
});
export const useAuth = () => useContext(Context);
let pendingRefresh: Promise<{user:User;access_token:string}> | null = null;
function refreshSession(){
  if(!pendingRefresh) pendingRefresh=mutate<{user:User;access_token:string}>("/auth/refresh",{}).finally(()=>{pendingRefresh=null;});
  return pendingRefresh;
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false);
  const accept = (r: { user: User; access_token: string }) => {
    setToken(r.access_token);
    setUser(r.user);
  };
  useEffect(() => {
    let live = true;
    const refresh = () =>
      refreshSession()
        .then((r) => {
          if (live) accept(r);
        })
        .catch(() => {
          if (live) {
            setToken(null);
            setUser(null);
          }
        })
        .finally(() => {
          if (live) setReady(true);
        });
    void refresh();
    const timer = setInterval(refresh, 12 * 60 * 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        ready,
        login: async (email, password) =>
          accept(await mutate("/auth/login", { email, password })),
        signup: async (data) => accept(await mutate("/auth/signup", data)),
        logout: async () => {
          await api("/auth/logout", { method: "POST" });
          setToken(null);
          setUser(null);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
