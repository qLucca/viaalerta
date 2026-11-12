"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Map,
  Plus,
  ClipboardList,
  UserRound,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Route,
  ChevronRight,
  Bell,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { roleLabels } from "@/lib/workflow";
import { useRole } from "@/lib/use-role";
const links = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/mapa", label: "Mapa colaborativo", icon: Map },
  { href: "/registrar", label: "Registrar um problema", icon: Plus },
  { href: "/ocorrencias", label: "Meus registros", icon: ClipboardList },
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
const subscribeToHydration = () => () => {};

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  // A preferência salva só pode marcar um botão depois da hidratação.
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  return (
    <div className="theme-switch" role="group" aria-label="Preferência de tema">
      {[
        { value: "light", label: "Claro", icon: Sun },
        { value: "dark", label: "Escuro", icon: Moon },
        { value: "system", label: "Sistema", icon: Monitor },
      ].map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          title={label}
          aria-label={`Tema ${label}`}
          aria-pressed={hydrated && theme === value}
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
  const { role, staff, needsMfa } = useRole();
  const navigation = [
    ...links,
    { href: "/notificacoes", label: "Notificações", icon: Bell },
    ...(staff || needsMfa
      ? [{ href: "/gestao", label: "Gestão da prefeitura", icon: Building2 }]
      : []),
    ...(role === "admin"
      ? [{ href: "/administracao", label: "Administração", icon: ShieldCheck }]
      : []),
  ];
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user && !publicMap) router.replace("/login");
  }, [loading, user, publicMap, router]);
  if (loading || (!user && !publicMap))
    return (
      <div className="screen-loading">
        <span className="spinner" /> Carregando sua conta…
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
        <nav aria-label="Menu principal">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
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
            {!user && <Link href="/login">Entrar</Link>}
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="mobile-logo">
            <Logo />
          </div>
          {pathname.startsWith("/ocorrencias/") ? (
            <nav className="breadcrumb" aria-label="Localização na navegação">
              <Link href="/ocorrencias">Meus registros</Link>
              <ChevronRight size={13} aria-hidden="true" />
              <span aria-current="page">Detalhes do registro</span>
            </nav>
          ) : (
            <span className="topbar-name">ViaAlerta</span>
          )}
          <div className="topbar-right">
            {role !== "cidadao" && (
              <span className="role-badge">
                {roleLabels[role]}
                {needsMfa && <Link href="/seguranca">Verificar sessão</Link>}
              </span>
            )}
            <Link
              href="/notificacoes"
              className="notification-link"
              aria-label="Abrir notificações"
              title="Notificações"
            >
              <Bell size={20} />
            </Link>
            <Link
              href="/perfil"
              className="avatar small"
              aria-label="Abrir perfil"
            >
              {user?.name[0]?.toUpperCase() || "V"}
            </Link>
            {user && (
              <button
                className="notification-link"
                aria-label="Sair da conta"
                title="Sair da conta"
                onClick={() =>
                  logout()
                    .then(() => router.push("/"))
                    .catch((e) => toast.error(e.message))
                }
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </header>
        <main id="main" className="main-content">
          {(demo || (!user && !supabase)) && (
            <div className="demo-banner">
              <span className="demo-pill">DEMO</span> Ambiente de demonstração.
              Registros e análises são simulados; novos registros ficam neste
              navegador.
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {pathname !== "/registrar" && (
              <Button asChild>
                <Link href="/registrar">
                  <Plus size={18} /> Registrar um problema
                </Link>
              </Button>
            )}
          </div>
          {children}
        </main>
        <footer className="app-footer">
          ViaAlerta <span>Registros de problemas nas vias públicas.</span>
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
                : label === "Meus registros"
                  ? "Registros"
                  : label === "Registrar um problema"
                    ? "Registrar"
                    : "Início"}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
