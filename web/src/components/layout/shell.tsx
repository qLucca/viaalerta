"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Map,
  Plus,
  ClipboardList,
  UserRound,
  ArrowUpRight,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Route,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
const links = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/mapa", label: "Mapa colaborativo", icon: Map },
  { href: "/registrar", label: "Registrar buraco", icon: Plus },
  { href: "/ocorrencias", label: "Minhas ocorrências", icon: ClipboardList },
  { href: "/perfil", label: "Meu perfil", icon: UserRound },
];
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="ViaAlerta início">
      <span className="logo-mark">
        <Route size={23} />
      </span>
      via<span>alerta</span>
      <i />
    </Link>
  );
}
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-switch" aria-label="Preferência de tema">
      {[
        { value: "light", label: "Claro", icon: Sun },
        { value: "dark", label: "Escuro", icon: Moon },
        { value: "system", label: "Sistema", icon: Monitor },
      ].map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          title={label}
          aria-label={`Tema ${label}`}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
export function Shell({
  children,
  title,
  subtitle,
  publicMap = false,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  publicMap?: boolean;
}) {
  const { user, loading, demo, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user && !publicMap) router.replace("/login");
  }, [loading, user, publicMap, router]);
  if (loading || (!user && !publicMap))
    return (
      <div className="screen-loading">
        <span className="spinner" /> Preparando sua experiência…
      </div>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Logo />
        <div className="workspace-label">ESPAÇO COLABORATIVO</div>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${pathname === href || (href === "/ocorrencias" && pathname.startsWith("/ocorrencias/")) ? "active" : ""}`}
            >
              <Icon size={19} />
              {label}
              {pathname === href && (
                <ChevronRight size={14} className="ml-auto" />
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="impact-note">
            <span className="status-dot" /> Cada registro faz diferença.
            <p>Juntos, enxergamos o caminho para uma cidade melhor.</p>
            <Link href="/registrar">
              Faça parte <ArrowUpRight size={14} />
            </Link>
          </div>
          <ThemeSwitch />
          <div className="sidebar-user">
            <span className="avatar">
              {user?.name[0]?.toUpperCase() || "V"}
            </span>
            <div>
              <strong>{user?.name || "Visitante"}</strong>
              <small>
                {demo
                  ? "Conta de demonstração"
                  : user
                    ? "Colaborador"
                    : "Acesso público"}
              </small>
            </div>
            {user ? (
              <button
                aria-label="Sair"
                onClick={() =>
                  logout()
                    .then(() => router.push("/"))
                    .catch((e) => toast.error(e.message))
                }
              >
                <LogOut size={17} />
              </button>
            ) : (
              <Link href="/login">Entrar</Link>
            )}
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="mobile-logo">
            <Logo />
          </div>
          <div className="breadcrumb">
            ViaAlerta <ChevronRight size={13} />
            <span>{title}</span>
          </div>
          <div className="topbar-right">
            <span className="live-label">
              <span className="status-dot" /> Uma cidade, muitos olhares
            </span>
            <Link
              href="/perfil"
              className="avatar small"
              aria-label="Abrir perfil"
            >
              {user?.name[0]?.toUpperCase() || "V"}
            </Link>
          </div>
        </header>
        <main id="main" className="main-content">
          {(demo || (!user && !supabase)) && (
            <div className="demo-banner">
              <span className="demo-pill">DEMO</span> Ambiente de demonstração.
              Ocorrências e análises são simuladas; novos registros ficam neste
              navegador.
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                CUIDAR DA CIDADE COMEÇA COM UM OLHAR
              </div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {pathname !== "/registrar" && (
              <Button asChild>
                <Link href="/registrar">
                  <Plus size={18} /> Registrar buraco
                </Link>
              </Button>
            )}
          </div>
          {children}
        </main>
        <footer className="app-footer">
          ViaAlerta <span>Conectando pessoas. Melhorando caminhos.</span>
          <span>Projeto colaborativo · MVP</span>
        </footer>
      </div>
      <nav className="mobile-nav">
        {links.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? "active" : ""}
          >
            <Icon size={20} />
            <span>
              {label === "Mapa colaborativo"
                ? "Mapa"
                : label === "Minhas ocorrências"
                  ? "Registros"
                  : label === "Registrar buraco"
                    ? "Registrar"
                    : "Início"}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
