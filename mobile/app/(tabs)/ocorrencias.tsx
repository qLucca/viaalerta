import { useState } from "react";
import { View, ScrollView, Pressable, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  Screen,
  Txt,
  Notice,
  Empty,
  Loading,
  Button,
} from "../../src/components/ui";
import { RecordCard } from "../../src/components/RecordCard";
import { useAuth } from "../../src/providers";
import { useTheme } from "../../src/theme";
import { listOccurrences } from "../../src/lib/occurrences";
import { statusLabels, type Status } from "../../src/types";
export default function Records() {
  const { demo, user } = useAuth();
  const { colors } = useTheme();
  const [status, setStatus] = useState<Status | "">("");
  const [recent, setRecent] = useState(true);
  const [page, setPage] = useState(0);
  const {
    data = [],
    error,
    isPending,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["mine", demo, user?.id, status, recent, page],
    queryFn: () =>
      listOccurrences(demo, {
        mine: true,
        status: status || undefined,
        oldest: !recent,
        offset: page * 50,
        limit: 51,
      }),
    enabled: !!user,
  });
  const sorted = data.slice(0, 50);
  return (
    <Screen
      title="Minhas ocorrências"
      subtitle="Cada contribuição tem um caminho. Acompanhe o seu."
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={colors.green}
        />
      }
    >
      {demo && (
        <Txt muted style={{ fontSize: 11, lineHeight: 18, marginBottom: 17 }}>
          A demonstração inclui os exemplos e os registros criados neste
          aparelho.
        </Txt>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 16 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {[["", "Todos"], ...Object.entries(statusLabels)].map(([v, label]) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityState={{ selected: status === v }}
            onPress={() => {
              setStatus(v as Status | "");
              setPage(0);
            }}
            style={{
              backgroundColor: status === v ? colors.green : colors.surface,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Txt
              style={{
                fontSize: 11,
                color: status === v ? colors.onGreen : colors.muted,
              }}
            >
              {label}
            </Txt>
          </Pressable>
        ))}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 17,
        }}
      >
        <Txt muted style={{ fontSize: 11 }}>
          {sorted.length} registros nesta página
        </Txt>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setRecent(!recent);
            setPage(0);
          }}
        >
          <Txt style={{ fontSize: 11, color: colors.green }}>
            ↓ {recent ? "Mais recentes" : "Mais antigos"}
          </Txt>
        </Pressable>
      </View>
      {error ? (
        <Notice
          text="Erro ao carregar registros. Puxe a tela para tentar novamente."
          error
        />
      ) : isPending ? (
        <Loading />
      ) : sorted.length ? (
        sorted.map((record) => <RecordCard key={record.id} record={record} />)
      ) : (
        <Empty text="Nenhum registro com este filtro. Que tal fazer sua primeira contribuição?" />
      )}
      {!error && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
          }}
        >
          <Button
            title="Anterior"
            outline
            disabled={page === 0 || isPending}
            onPress={() => setPage(page - 1)}
          />
          <Txt>Página {page + 1}</Txt>
          <Button
            title="Próxima"
            outline
            disabled={data.length <= 50 || isPending}
            onPress={() => setPage(page + 1)}
          />
        </View>
      )}
    </Screen>
  );
}
