import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Screen, Card, Button, Notice, Loading } from "../src/components/ui";
import { useAuth } from "../src/providers";
import { useRole } from "../src/lib/use-role";
import { openPortal } from "../src/lib/portal";
export default function Administration() {
  const { user, loading } = useAuth(),
    { role, needsMfa, pending } = useRole(),
    [error, setError] = useState("");
  if (loading || pending) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Screen
      title="Administração"
      subtitle="Aprovação de acessos, denúncias e auditoria."
      back
    >
      <Card>
        {role !== "admin" ? (
          <Notice error text="Acesso restrito ao administrador." />
        ) : needsMfa ? (
          <>
            <Notice text="Verifique o autenticador antes de administrar." />
            <Button
              title="Verificar segurança"
              onPress={() => router.push("/seguranca")}
            />
          </>
        ) : (
          <>
            <Notice text="A administração completa está no portal seguro. Você pode precisar entrar novamente no navegador." />
            <Button
              title="Abrir administração no portal"
              onPress={() => {
                void openPortal("/administracao").catch(() =>
                  setError("Não foi possível abrir o portal."),
                );
              }}
            />
          </>
        )}
        {!!error && <Notice error text={error} />}
      </Card>
    </Screen>
  );
}
