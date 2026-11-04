"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers";
import { Logo, ThemeSwitch } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
type Mode = "login" | "signup" | "recover" | "reset";
type Fields = {
  name: string;
  email: string;
  password: string;
  confirmation: string;
};
const base = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
  confirmation: z.string(),
});
export function AuthForm({ mode }: { mode: Mode }) {
  const { enterDemo, user } = useAuth();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const schema = base.superRefine((d, c) => {
    if (mode !== "reset" && !z.string().email().safeParse(d.email).success)
      c.addIssue({
        code: "custom",
        path: ["email"],
        message: "Informe um e-mail válido.",
      });
    if (mode === "signup" && (d.name.trim().length < 2 || d.name.length > 80))
      c.addIssue({
        code: "custom",
        path: ["name"],
        message: "O nome deve ter entre 2 e 80 caracteres.",
      });
    if (mode !== "recover" && d.password.length < (mode === "login" ? 1 : 8))
      c.addIssue({
        code: "custom",
        path: ["password"],
        message:
          mode === "login"
            ? "Informe sua senha."
            : "Use pelo menos 8 caracteres.",
      });
    if (
      (mode === "signup" || mode === "reset") &&
      d.password !== d.confirmation
    )
      c.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "As senhas precisam ser iguais.",
      });
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmation: "" },
  });
  useEffect(() => {
    if (user && mode === "login") router.replace("/dashboard");
  }, [user, mode, router]);
  useEffect(() => {
    if (mode !== "reset" || !supabase) return;
    const client = supabase;
    const code = new URLSearchParams(window.location.search).get("code");
    if (code)
      client.auth
        .exchangeCodeForSession(code)
        .then(({ error }) =>
          error
            ? setError("O link de recuperação expirou. Solicite outro.")
            : setRecoveryReady(true),
        );
    client.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady(true);
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) setRecoveryReady(true);
    });
    return () => subscription.unsubscribe();
  }, [mode]);
  async function submit(values: Fields) {
    setError("");
    setMessage("");
    if (!supabase) {
      setError(
        "O acesso real depende da configuração do Supabase. Você pode explorar a demonstração abaixo.",
      );
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
        router.push("/dashboard");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { name: values.name.trim() },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw error;
        if (data.session) router.push("/dashboard");
        else
          setMessage(
            "Conta solicitada. Confira seu e-mail para confirmar o cadastro antes de entrar.",
          );
      } else if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          values.email,
          { redirectTo: `${window.location.origin}/redefinir-senha` },
        );
        if (error) throw error;
        setMessage(
          "Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha.",
        );
      } else {
        if (!recoveryReady)
          throw new Error("Abra esta página pelo link enviado ao seu e-mail.");
        const { error } = await supabase.auth.updateUser({
          password: values.password,
        });
        if (error) throw error;
        setMessage("Senha atualizada. Você já pode acessar sua conta.");
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        msg.includes("Invalid login")
          ? "E-mail ou senha incorretos."
          : msg.includes("Email not confirmed")
            ? "Confirme seu e-mail antes de entrar."
            : msg.includes("rate limit")
              ? "Muitas tentativas. Aguarde alguns minutos."
              : msg,
      );
    } finally {
      setBusy(false);
    }
  }
  const titles = {
    login: "Bom ter você por aqui.",
    signup: "Uma cidade melhor começa com você.",
    recover: "Vamos recuperar seu acesso.",
    reset: "Um novo começo para sua senha.",
  };
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Logo />
        <div>
          <span className="eyebrow">MAIS OLHARES. MELHORES CAMINHOS.</span>
          <h1>
            O próximo passo
            <br />
            para ruas
            <br />
            <em>mais seguras.</em>
          </h1>
          <p>
            Transforme o que você vê pelo caminho em uma contribuição para toda
            a cidade.
          </p>
          <div className="auth-road">
            <div />
            <span />
            <span />
            <span />
          </div>
        </div>
        <small>ViaAlerta · Tecnologia que conecta e cuida.</small>
      </aside>
      <main className="auth-main">
        <div className="auth-top">
          <Link href="/" className="text-link">
            <ArrowLeft size={16} /> Voltar ao início
          </Link>
          <ThemeSwitch />
        </div>
        <div className="auth-form">
          <span className="eyebrow">
            {mode === "signup" ? "FAÇA PARTE" : "BEM-VINDO AO VIAALERTA"}
          </span>
          <h1>{titles[mode]}</h1>
          <p>
            {mode === "login"
              ? "Entre para registrar e acompanhar suas contribuições."
              : mode === "signup"
                ? "Crie sua conta e ajude a cuidar dos nossos caminhos."
                : "Informe seus dados para continuar com segurança."}
          </p>
          {!supabase && (
            <div className="info-box">
              Este MVP está em demonstração. O acesso real será ativado ao
              configurar o Supabase.
            </div>
          )}
          <form onSubmit={handleSubmit(submit)} className="stack" noValidate>
            {mode === "signup" && (
              <label className="field">
                Nome
                <input
                  autoComplete="name"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <span role="alert" className="field-error">
                    {errors.name.message}
                  </span>
                )}
              </label>
            )}
            {mode !== "reset" && (
              <label className="field">
                E-mail
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <span role="alert" className="field-error">
                    {errors.email.message}
                  </span>
                )}
              </label>
            )}
            {mode !== "recover" && (
              <>
                <label className="field">
                  {mode === "reset" ? "Nova senha" : "Senha"}
                  <div className="password-input">
                    <input
                      type={show ? "text" : "password"}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      {...register("password")}
                      aria-invalid={!!errors.password}
                    />
                    <button
                      type="button"
                      aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <span role="alert" className="field-error">
                      {errors.password.message}
                    </span>
                  )}
                </label>
                {(mode === "signup" || mode === "reset") && (
                  <label className="field">
                    Confirme a senha
                    <input
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("confirmation")}
                    />
                    {errors.confirmation && (
                      <span role="alert" className="field-error">
                        {errors.confirmation.message}
                      </span>
                    )}
                  </label>
                )}
              </>
            )}
            {mode === "login" && (
              <Link href="/recuperar-senha" className="text-link auth-forgot">
                Esqueci minha senha
              </Link>
            )}
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="success-message" role="status">
                {message}
              </div>
            )}
            <Button className="w-full" disabled={busy}>
              {busy
                ? "Aguarde…"
                : mode === "login"
                  ? "Entrar na minha conta"
                  : mode === "signup"
                    ? "Criar minha conta"
                    : mode === "recover"
                      ? "Enviar link de recuperação"
                      : "Salvar nova senha"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="auth-separator">
            <span />
            ou conheça o projeto
            <span />
          </div>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              enterDemo();
              router.push("/dashboard");
            }}
          >
            Explorar demonstração <ArrowUpRightIcon />
          </Button>
          <p className="auth-bottom">
            {mode === "login" ? (
              <>
                Ainda não tem conta? <Link href="/cadastro">Cadastre-se</Link>
              </>
            ) : (
              <>
                Já tem uma conta? <Link href="/login">Entrar</Link>
              </>
            )}
          </p>
          <div className="auth-privacy">
            <ShieldCheck size={15} /> Seus dados são usados apenas para sua
            conta e seus registros.
          </div>
        </div>
      </main>
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} />;
}
