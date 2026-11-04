import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { ThemeProvider } from "./theme";
type User = { id: string; name: string; email: string };
type Auth = {
  user: User | null;
  loading: boolean;
  demo: boolean;
  enterDemo: () => Promise<void>;
  logout: () => Promise<void>;
  rename: (name: string) => Promise<void>;
  authError: string;
};
const Context = createContext<Auth>({
  user: null,
  loading: true,
  demo: false,
  enterDemo: async () => {},
  logout: async () => {},
  rename: async () => {},
  authError: "",
});
export const useAuth = () => useContext(Context);
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 20000, retry: 1 } },
      }),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(false);
  const [demoName, setDemoName] = useState("Visitante");
  const [loading, setLoading] = useState(true);
  const [authError, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem("viaalerta-demo-session"),
      AsyncStorage.getItem("viaalerta-demo-name"),
      supabase?.auth.getSession(),
    ])
      .then(([local, name, result]) => {
        if (!active) return;
        setDemo(local === "true");
        setDemoName(name || "Visitante");
        if (result?.error)
          setError("Não foi possível restaurar a sessão. Entre novamente.");
        setSession(result?.data.session || null);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível abrir os dados locais.");
          setLoading(false);
        }
      });
    const subscription = supabase?.auth.onAuthStateChange((event, current) => {
      setSession(current);
      if (event === "PASSWORD_RECOVERY") router.replace("/redefinir-senha");
    }).data.subscription;
    const appSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    });
    if (AppState.currentState === "active") supabase?.auth.startAutoRefresh();
    async function handleURL(url: string) {
      if (!supabase) return;
      try {
        const parsed = new URL(url);
        const fragment = new URLSearchParams(parsed.hash.slice(1));
        const code = parsed.searchParams.get("code");
        const access =
          parsed.searchParams.get("access_token") ||
          fragment.get("access_token");
        const refresh =
          parsed.searchParams.get("refresh_token") ||
          fragment.get("refresh_token");
        const error =
          parsed.searchParams.get("error_description") ||
          fragment.get("error_description");
        if (error)
          throw new Error(
            "O link expirou ou não é mais válido. Solicite outro.",
          );
        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          if (result.error) throw result.error;
        } else if (access && refresh) {
          const result = await supabase.auth.setSession({
            access_token: access,
            refresh_token: refresh,
          });
          if (result.error) throw result.error;
        }
        if ((code || access) && url.includes("redefinir-senha"))
          router.replace("/redefinir-senha");
      } catch {
        setError(
          "Não foi possível abrir o link de acesso. Solicite um novo link.",
        );
      }
    }
    const linkSubscription = Linking.addEventListener(
      "url",
      ({ url }) => void handleURL(url),
    );
    Linking.getInitialURL().then((url) => {
      if (url) void handleURL(url);
    });
    return () => {
      active = false;
      subscription?.unsubscribe();
      appSubscription.remove();
      linkSubscription.remove();
      supabase?.auth.stopAutoRefresh();
    };
  }, []);
  async function enterDemo() {
    await AsyncStorage.setItem("viaalerta-demo-session", "true");
    setDemo(true);
    client.clear();
  }
  async function logout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error)
        throw new Error(
          "Não foi possível encerrar sua sessão. Tente novamente.",
        );
    }
    await AsyncStorage.removeItem("viaalerta-demo-session");
    setDemo(false);
    setSession(null);
    client.clear();
  }
  async function rename(name: string) {
    if (demo) {
      await AsyncStorage.setItem("viaalerta-demo-name", name);
      setDemoName(name);
      return;
    }
    if (!supabase || !session) throw new Error("Entre novamente.");
    const { error } = await supabase
      .from("viaalerta_profiles")
      .update({ name })
      .eq("id", session.user.id);
    if (error) throw new Error("Não foi possível atualizar seu perfil.");
    const update = await supabase.auth.updateUser({ data: { name } });
    if (update.error) throw update.error;
  }
  const user = demo
    ? { id: "demo", name: demoName, email: "Demonstração local" }
    : session
      ? {
          id: session.user.id,
          name: session.user.user_metadata.name || "Colaborador",
          email: session.user.email || "",
        }
      : null;
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <Context.Provider
          value={{ user, loading, demo, enterDemo, logout, rename, authError }}
        >
          {children}
        </Context.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
