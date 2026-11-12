import { useState } from "react";
import { View, Pressable } from "react-native";
import { router, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Screen,
  Txt,
  Card,
  Button,
  Notice,
  Loading,
  Badge,
} from "../src/components/ui";
import { useAuth } from "../src/providers";
import { useRole } from "../src/lib/use-role";
import { listOccurrences } from "../src/lib/occurrences";
import { statusLabels, type Status } from "../src/types";
export default function Management() {
  const { user, loading } = useAuth();
  const { staff, needsMfa, pending, error } = useRole();
  const [status, setStatus] = useState<Status | "">("");
  const [page, setPage] = useState(0);
  const list = useQuery({
    queryKey: ["management", user?.id, status, page],
    queryFn: () =>
      listOccurrences(false, {
        staff: true,
        status: status || undefined,
        offset: page * 50,
        limit: 51,
      }),
    enabled: staff,
    refetchInterval: 30000,
  });
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Screen
      title="Gestão da prefeitura"
      subtitle="Uberlândia/MG · registros e intervenções."
      back
    >
      {pending ? (
        <Loading />
      ) : needsMfa ? (
        <Card>
          <Notice text="Verifique o autenticador para acessar a gestão." />
          <Button
            title="Verificar segurança"
            onPress={() => router.push("/seguranca")}
          />
        </Card>
      ) : !staff ? (
        <Notice
          error
          text={
            error?.message || "Acesso restrito à prefeitura e ao administrador."
          }
        />
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[["", "Todos"], ...Object.entries(statusLabels)].map(
              ([s, label]) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityState={{ selected: status === s }}
                  onPress={() => {
                    setStatus(s as Status | "");
                    setPage(0);
                  }}
                >
                  <Txt>
                    {status === s ? "● " : "○ "}
                    {label}
                  </Txt>
                </Pressable>
              ),
            )}
          </View>
          {list.isPending ? (
            <Loading />
          ) : list.error ? (
            <Notice error text={list.error.message} />
          ) : !list.data?.length ? (
            <Txt>Nenhum registro nesta situação.</Txt>
          ) : (
            list.data.slice(0, 50).map((r) => (
              <Card key={r.id}>
                <Badge status={r.status} />
                <Txt style={{ marginTop: 12 }}>
                  {r.description || "Ocorrência registrada"}
                </Txt>
                <Txt muted>
                  {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                </Txt>
                <Button
                  title="Abrir processo e localização"
                  onPress={() =>
                    router.push({
                      pathname: "/ocorrencia/[id]",
                      params: { id: r.id },
                    })
                  }
                />
              </Card>
            ))
          )}
          <Button
            title="Página anterior"
            outline
            disabled={page === 0}
            onPress={() => setPage((p) => p - 1)}
          />
          <Txt>Página {page + 1}</Txt>
          <Button
            title="Próxima página"
            outline
            disabled={(list.data?.length || 0) <= 50}
            onPress={() => setPage((p) => p + 1)}
          />
        </>
      )}
    </Screen>
  );
}
