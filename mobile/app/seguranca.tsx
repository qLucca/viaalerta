import { useState } from "react";
import { View, Text } from "react-native";
import { SvgXml } from "react-native-svg";
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
import { authenticatorSvg } from "../src/lib/account";
import { ChangePassword } from "../src/components/ChangePassword";
export default function Security() {
  const { user, demo, loading } = useAuth(),
    { needsMfa } = useRole(),
    cache = useQueryClient();
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [enrollment, setEnrollment] = useState<{
    id: string;
    secret: string;
    xml: string;
  }>();
  async function enroll() {
    setBusy(true);
    setMessage("");
    try {
      const factors = await supabase!.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      if (factors.data.totp.some((f) => f.status === "verified"))
        throw new Error(
          "Sua conta já tem um autenticador. Use o código existente para verificar esta sessão.",
        );
      for (const pending of factors.data.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        const removed = await supabase!.auth.mfa.unenroll({
          factorId: pending.id,
        });
        if (removed.error) throw removed.error;
      }
      const result = await supabase!.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ViaAlerta",
      });
      if (result.error) throw result.error;
      setEnrollment({
        id: result.data.id,
        secret: result.data.totp.secret,
        xml: authenticatorSvg(result.data.totp.qr_code),
      });
      setMessage(
        "Leia o QR Code em um autenticador ou digite a chave manualmente. Confirme com o código de seis números.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    setMessage("");
    try {
      if (!/^\d{6}$/.test(code))
        throw new Error("Informe os seis números do autenticador.");
      const factors = await supabase!.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const factor =
        enrollment ||
        factors.data.all.find(
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
      setEnrollment(undefined);
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
            <Button
              title="Configurar autenticador neste aparelho"
              outline
              disabled={busy}
              onPress={() => void enroll()}
            />
            {enrollment && (
              <View
                style={{ alignItems: "center", gap: 12, marginVertical: 16 }}
              >
                <View
                  accessibilityLabel="QR Code para cadastrar o autenticador"
                  style={{ backgroundColor: "white", padding: 12 }}
                >
                  <SvgXml xml={enrollment.xml} width={220} height={220} />
                </View>
                <Notice text="Se o autenticador estiver neste mesmo celular, use a chave manual abaixo. Não compartilhe nem envie capturas desta tela." />
                <Text
                  selectable
                  accessibilityLabel="Chave manual do autenticador"
                  style={{
                    color: "#183e30",
                    backgroundColor: "#eef5f0",
                    padding: 12,
                  }}
                >
                  {enrollment.secret}
                </Text>
              </View>
            )}
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
      {!demo && <ChangePassword />}
    </Screen>
  );
}
