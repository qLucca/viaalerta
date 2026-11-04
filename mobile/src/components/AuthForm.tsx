import { useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { Eye, EyeOff, ArrowRight } from "lucide-react-native";
import { z } from "zod";
import { Screen, Logo, Txt, Button, Field, Notice } from "./ui";
import { useAuth } from "../providers";
import { useTheme } from "../theme";
import { supabase } from "../lib/supabase";
type Mode = "login" | "signup" | "recover" | "reset";
export function AuthForm({ mode }: { mode: Mode }) {
  const { enterDemo, user, authError } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit() {
    setError("");
    setMessage("");
    try {
      if (
        mode !== "reset" &&
        !z.string().email().safeParse(email.trim()).success
      )
        throw new Error("Informe um e-mail válido.");
      if (
        mode === "signup" &&
        (name.trim().length < 2 || name.trim().length > 80)
      )
        throw new Error("Use um nome entre 2 e 80 caracteres.");
      if (mode !== "recover" && password.length < (mode === "login" ? 1 : 8))
        throw new Error(
          mode === "login"
            ? "Informe sua senha."
            : "Use uma senha com pelo menos 8 caracteres.",
        );
      if ((mode === "signup" || mode === "reset") && password !== confirmation)
        throw new Error("As senhas devem ser iguais.");
      if (!supabase)
        throw new Error("Supabase não configurado. Use a demonstração.");
      setBusy(true);
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace("/(tabs)/dashboard");
      } else if (mode === "signup") {
        const redirect = process.env.EXPO_PUBLIC_WEB_URL
          ? `${process.env.EXPO_PUBLIC_WEB_URL.replace(/\/$/, "")}/login`
          : Linking.createURL("login");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: redirect },
        });
        if (error) throw error;
        if (data.session) router.replace("/(tabs)/dashboard");
        else
          setMessage(
            "Confira seu e-mail e confirme a conta. Depois, faça login aqui com a mesma senha.",
          );
      } else if (mode === "recover") {
        const redirect = process.env.EXPO_PUBLIC_WEB_URL
          ? `${process.env.EXPO_PUBLIC_WEB_URL.replace(/\/$/, "")}/redefinir-senha`
          : Linking.createURL("redefinir-senha");
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: redirect },
        );
        if (error) throw error;
        setMessage(
          "Se esse e-mail tiver uma conta, você receberá um link para redefinir a senha.",
        );
      } else {
        if (!user)
          throw new Error(
            "Abra esta tela pelo link de recuperação recebido no e-mail.",
          );
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Senha atualizada. Você já pode continuar no aplicativo.");
      }
    } catch (e) {
      const text = (e as Error).message;
      setError(
        text.includes("Invalid login")
          ? "E-mail ou senha incorretos."
          : text.includes("Email not confirmed")
            ? "Confirme seu e-mail antes de entrar."
            : text.includes("rate limit")
              ? "Muitas tentativas. Aguarde alguns minutos."
              : text.includes("Network")
                ? "Não foi possível conectar. Confira sua internet."
                : text,
      );
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "login"
      ? "Bom ter você por aqui."
      : mode === "signup"
        ? "Sua cidade conta com você."
        : mode === "recover"
          ? "Vamos recuperar seu acesso."
          : "Defina sua nova senha.";
  return (
    <Screen back>
      <Logo />
      <View style={{ marginTop: 35, marginBottom: 26 }}>
        <Txt
          style={{
            fontSize: 29,
            lineHeight: 35,
            fontWeight: "700",
            letterSpacing: -1,
          }}
        >
          {title}
        </Txt>
        <Txt muted style={{ fontSize: 12, lineHeight: 20, marginTop: 10 }}>
          {mode === "signup"
            ? "A mesma conta e as mesmas ocorrências do ViaAlerta web."
            : "Entre para contribuir com ruas mais seguras."}
        </Txt>
      </View>
      {!!authError && <Notice text={authError} error />}
      {!supabase && (
        <Notice text="Acesso real indisponível. Explore a demonstração abaixo." />
      )}
      {mode === "signup" && (
        <Field
          label="Nome"
          autoComplete="name"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
      )}
      {mode !== "reset" && (
        <Field
          label="E-mail"
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      )}
      {mode !== "recover" && (
        <>
          <Field
            label={mode === "reset" ? "Nova senha" : "Senha"}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={show ? "Ocultar senha" : "Mostrar senha"}
            onPress={() => setShow(!show)}
            style={{
              alignSelf: "flex-end",
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              minHeight: 30,
              marginTop: -9,
              marginBottom: 14,
            }}
          >
            {show ? (
              <EyeOff size={16} color={colors.green} />
            ) : (
              <Eye size={16} color={colors.green} />
            )}
            <Txt style={{ fontSize: 11, color: colors.green }}>
              {show ? "Ocultar" : "Mostrar"} senha
            </Txt>
          </Pressable>
          {(mode === "signup" || mode === "reset") && (
            <Field
              label="Confirme a senha"
              secureTextEntry={!show}
              autoCapitalize="none"
              value={confirmation}
              onChangeText={setConfirmation}
            />
          )}
        </>
      )}
      {mode === "login" && (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/recuperar-senha")}
          style={{ alignSelf: "flex-end", marginBottom: 22, minHeight: 30 }}
        >
          <Txt style={{ fontSize: 12, color: colors.green }}>
            Esqueci minha senha
          </Txt>
        </Pressable>
      )}
      {!!error && <Notice text={error} error />}
      {!!message && <Notice text={message} />}
      <Button
        title={
          mode === "login"
            ? "Entrar"
            : mode === "signup"
              ? "Criar minha conta"
              : mode === "recover"
                ? "Enviar link"
                : "Salvar nova senha"
        }
        onPress={submit}
        busy={busy}
        icon={<ArrowRight size={17} color={colors.onGreen} />}
      />
      {mode !== "reset" && (
        <>
          <Txt
            muted
            style={{ textAlign: "center", fontSize: 10, marginVertical: 22 }}
          >
            OU CONHEÇA O PROJETO
          </Txt>
          <Button
            title="Explorar demonstração"
            outline
            onPress={() =>
              enterDemo()
                .then(() => router.replace("/(tabs)/dashboard"))
                .catch(() => setError("Não foi possível abrir a demonstração."))
            }
          />
          <Pressable
            accessibilityRole="link"
            style={{
              minHeight: 45,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 16,
            }}
            onPress={() =>
              router.replace(mode === "login" ? "/cadastro" : "/login")
            }
          >
            <Txt
              style={{ color: colors.green, fontSize: 12, fontWeight: "600" }}
            >
              {mode === "login"
                ? "Ainda não tem conta? Cadastre-se"
                : "Já tem conta? Entrar"}
            </Txt>
          </Pressable>
        </>
      )}
      <Txt
        muted
        style={{
          fontSize: 10,
          textAlign: "center",
          lineHeight: 17,
          marginTop: 20,
        }}
      >
        Usamos seus dados apenas para sua conta e seus registros.
      </Txt>
    </Screen>
  );
}
