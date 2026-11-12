import { useState } from "react";
import { Redirect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Screen,
  Card,
  Field,
  Button,
  Notice,
  Loading,
} from "../src/components/ui";
import { useAuth } from "../src/providers";
import { useRole } from "../src/lib/use-role";
import { supabase } from "../src/lib/supabase";
import { openPortal } from "../src/lib/portal";
export default function Security() {
  const { user, demo, loading } = useAuth(),
    { needsMfa } = useRole(),
    cache = useQueryClient();
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function verify() {
    setBusy(true);
    setMessage("");
    try {
      if (!/^\d{6}$/.test(code))
        throw new Error("Informe os seis números do autenticador.");
      const factors = await supabase!.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const factor = factors.data.all.find(
        (f) => f.factor_type === "totp" && f.status === "verified",
      );
      if (!factor)
        throw new Error("Configure primeiro o autenticador no portal web.");
      const result = await supabase!.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });
      if (result.error)
        throw new Error("Código inválido ou expirado. Tente novamente.");
      await cache.invalidateQueries();
      setCode("");
      setMessage("Verificação concluída neste aparelho.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Screen
      title="Segurança da conta"
      subtitle="Verificação em duas etapas para gestor e administrador."
      back
    >
      <Card>
        <Notice
          text={
            demo
              ? "A demonstração não altera a segurança da conta."
              : needsMfa
                ? "Verifique o autenticador para acessar a gestão neste aparelho."
                : "A sessão está pronta. Você também pode verificar um autenticador já configurado."
          }
        />
        {!demo && (
          <>
            <Field
              label="Código do autenticador"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              editable={!busy}
            />
            <Button
              title="Verificar código"
              onPress={() => void verify()}
              busy={busy}
            />
            <Button
              title="Configurar autenticador no portal"
              outline
              onPress={() => {
                void openPortal("/seguranca").catch(() =>
                  setMessage("Não foi possível abrir o portal."),
                );
              }}
            />
            <Notice text="O portal abre no navegador e pode pedir login novamente. Depois de configurar, volte e informe o código aqui." />
          </>
        )}
        {!!message && <Notice text={message} />}
      </Card>
    </Screen>
  );
}
