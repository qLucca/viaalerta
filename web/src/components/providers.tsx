"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { supabase } from "@/lib/supabase/client";
type Identity = { id: string; name: string; email: string };
type Auth = {
  user: Identity | null;
  loading: boolean;
  demo: boolean;
  enterDemo: () => void;
  logout: () => Promise<void>;
  rename: (name: string) => void;
};
const AuthContext = createContext<Auth>({
  user: null,
  loading: true,
  demo: false,
  enterDemo: () => {},
  logout: async () => {},
  rename: () => {},
});
export const useAuth = () => useContext(AuthContext);
const demoEvent = "viaalerta-demo-change";
function subscribeDemo(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(demoEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(demoEvent, callback);
  };
}
function readDemoName() {
  try {
    return localStorage.getItem("viaalerta-demo-session") === "true"
      ? localStorage.getItem("viaalerta-demo-name") || "Visitante"
      : null;
  } catch {
    return null;
  }
}
const serverDemoName = () => undefined;
export function Providers({ children }: { children: React.ReactNode }) {
  const [query] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const [user, setUser] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const previousIdentity = useRef<string | null>(null);
  const demoName = useSyncExternalStore(
    subscribeDemo,
    readDemoName,
    serverDemoName,
  );
  const demo = typeof demoName === "string";
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const identity = session?.user.id ?? null;
      if (previousIdentity.current !== identity) query.clear();
      previousIdentity.current = identity;
      setUser(
        session
          ? {
              id: session.user.id,
              name: session.user.user_metadata.name || "Colaborador",
              email: session.user.email || "",
            }
          : null,
      );
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [query]);
  function enterDemo() {
    localStorage.setItem("viaalerta-demo-session", "true");
    window.dispatchEvent(new Event(demoEvent));
    query.clear();
  }
  async function logout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    localStorage.removeItem("viaalerta-demo-session");
    window.dispatchEvent(new Event(demoEvent));
    setUser(null);
    query.clear();
  }
  function rename(name: string) {
    if (demo) {
      localStorage.setItem("viaalerta-demo-name", name);
      window.dispatchEvent(new Event(demoEvent));
    } else setUser((current) => (current ? { ...current, name } : null));
  }
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={query}>
        <AuthContext.Provider
          value={{
            user: demo
              ? { id: "demo", name: demoName, email: "Modo de demonstração" }
              : user,
            loading: demoName === undefined || (!demo && loading),
            demo,
            enterDemo,
            logout,
            rename,
          }}
        >
          {children}
          <Toaster richColors position="top-right" />
        </AuthContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
