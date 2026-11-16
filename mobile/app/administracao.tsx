import { Redirect, router } from "expo-router";
import { Screen, Card, Button, Notice, Loading } from "../src/components/ui";
import { useAuth } from "../src/providers";
import { useRole } from "../src/lib/use-role";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { AdminUsers } from "../src/components/AdminUsers";
import { AdminReports } from "../src/components/AdminReports";
import { AdminAccess } from "../src/components/AdminAccess";
export default function Administration() {
  const cache = useQueryClient();
  const { user, loading } = useAuth(),
    { role, needsMfa, pending } = useRole();
  if (loading || pending) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Screen
      title="Administração"
      subtitle="Usuários, denúncias, aprovação institucional e auditoria."
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
          <View style={{ gap: 18 }}>
            <Button
              title="Atualizar painel administrativo"
              outline
              onPress={() => void cache.invalidateQueries()}
            />
            <AdminUsers key={`users:${user.id}`} />
            <AdminReports key={`reports:${user.id}`} />
            <AdminAccess key={`access:${user.id}`} />
          </View>
        )}
      </Card>
    </Screen>
  );
}
