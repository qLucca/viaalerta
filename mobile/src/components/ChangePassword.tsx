import { useState } from "react";
import { Card, Field, Button, Notice, Txt } from "./ui";
import { supabase } from "../lib/supabase";
import { passwordProblem } from "../lib/account";

export function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nonce, setNonce] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setError("");
    setMessage("");
    const problem = passwordProblem(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const result = await supabase!.auth.updateUser({
        password,
        ...(nonce.trim() ? { nonce: nonce.trim() } : {}),
      });
      if (result.error)
        throw new Error(
          result.error.code === "reauthentication_needed"
            ? "Solicite a confirmação por e-mail e informe o código recebido."
            : "Não foi possível trocar a senha. Confira a confirmação e o autenticador.",
        );
      setPassword("");
      setConfirmation("");
      setNonce("");
      const logout = await supabase!.auth.signOut({ scope: "others" });
      setMessage(
        logout.error
          ? "Senha atualizada. Não foi possível encerrar as outras sessões."
          : "Senha atualizada. As outras sessões foram encerradas; tokens já emitidos podem valer até expirar.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await supabase!.auth.reauthenticate();
      if (result.error) throw result.error;
      setMessage(
        "Confira o código no e-mail da sua conta. O envio depende da configuração do Supabase.",
      );
    } catch {
      setError(
        "Não foi possível solicitar a confirmação. Use a recuperação de senha ou tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ marginTop: 20, gap: 12 }}>
      <Txt style={{ fontSize: 19, fontWeight: "700" }}>Trocar senha</Txt>
      <Txt muted>
        Use entre 12 e 128 caracteres. Se necessário, verifique o autenticador
        antes de salvar.
      </Txt>
      <Field
        label="Nova senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        maxLength={128}
        editable={!busy}
      />
      <Field
        label="Confirmar nova senha"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoComplete="new-password"
        maxLength={128}
        editable={!busy}
      />
      <Field
        label="Código de confirmação por e-mail, se solicitado"
        value={nonce}
        onChangeText={setNonce}
        autoComplete="one-time-code"
        maxLength={64}
        editable={!busy}
      />
      <Button
        title="Salvar nova senha"
        busy={busy}
        onPress={() => void save()}
      />
      <Button
        title="Solicitar confirmação por e-mail"
        outline
        disabled={busy}
        onPress={() => void confirm()}
      />
      {!!error && <Notice error text={error} />}
      {!!message && <Notice text={message} />}
    </Card>
  );
}
