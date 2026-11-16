import { useState } from "react";
import { View, Pressable, Platform, Share } from "react-native";
import {
  StorageAccessFramework,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { queueCsv } from "../src/lib/csv";
import { adminRpc } from "../src/lib/admin";
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
  const { role, staff, needsMfa, pending, error } = useRole();
  const [exporting, setExporting] = useState(false),
    [message, setMessage] = useState("");
  async function exportCsv() {
    setExporting(true);
    setMessage("");
    try {
      const rows = await adminRpc<Record<string, unknown>[]>(
        "viaalerta_export_queue",
      );
      const csv = queueCsv(rows);
      if (Platform.OS === "android") {
        const selected =
          await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!selected.granted) return;
        const uri = await StorageAccessFramework.createFileAsync(
          selected.directoryUri,
          "fila-municipal.csv",
          "text/csv",
        );
        await writeAsStringAsync(uri, csv);
        setMessage(
          "CSV salvo na pasta escolhida. Inclui até 1.000 registros ativos autorizados para sua conta.",
        );
      } else await Share.share({ message: csv, title: "Fila municipal CSV" });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const [status, setStatus] = useState<Status | "">("");
  const [page, setPage] = useState(0);
  const list = useQuery({
    queryKey: ["management", user?.id, status, page],
    queryFn: () =>
      listOccurrences(false, {
        staff: true,
        publicOnly: true,
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
          <Notice text="Abra um registro para consultar o local e publicar o andamento. Resolver exige foto posterior; rejeitar exige um motivo. As previsões podem ser revistas." />
          {["manager", "admin"].includes(role) && (
            <Button
              title="Exportar fila municipal em CSV"
              outline
              busy={exporting}
              onPress={() => void exportCsv()}
            />
          )}
          {!!message && <Notice text={message} />}
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
                      params: { id: r.id, staff: "1" },
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
