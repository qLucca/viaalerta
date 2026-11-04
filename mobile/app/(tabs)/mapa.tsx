import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed } from "lucide-react-native";
import { router } from "expo-router";
import { Screen, Button, Txt, Notice } from "../../src/components/ui";
import { useAuth } from "../../src/providers";
import { useTheme } from "../../src/theme";
import {
  statusLabels,
  type Bounds,
  type Point,
  type Status,
} from "../../src/types";
import { listOccurrences } from "../../src/lib/occurrences";
import { currentPoint } from "../../src/lib/location";
import Map from "../../src/map/Map";
export default function MapPage() {
  const { demo, user } = useAuth();
  const { colors } = useTheme();
  const [bounds, setBounds] = useState<Bounds>();
  const [status, setStatus] = useState<Status | "">("");
  const [focus, setFocus] = useState<Point>();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const {
    data = [],
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["map", demo, user?.id, bounds, status],
    queryFn: () =>
      listOccurrences(demo, { bounds, status: status || undefined }),
    enabled: !!bounds && !!user,
  });
  async function locate() {
    setLocating(true);
    setMessage("");
    try {
      setFocus(await currentPoint());
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLocating(false);
    }
  }
  return (
    <Screen
      title="Mapa colaborativo"
      subtitle="Uma cidade. Muitos olhares."
      scroll={false}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 15 }}
        contentContainerStyle={{ gap: 7 }}
      >
        {[["", "Todos"], ...Object.entries(statusLabels)].map(
          ([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: status === value }}
              onPress={() => setStatus(value as Status | "")}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 13,
                borderRadius: 20,
                backgroundColor:
                  status === value ? colors.green : colors.surface,
                borderWidth: 1,
                borderColor: status === value ? colors.green : colors.line,
              }}
            >
              <Txt
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: status === value ? colors.onGreen : colors.muted,
                }}
              >
                {label}
              </Txt>
            </Pressable>
          ),
        )}
      </ScrollView>
      {!!message && <Notice text={message} error />}
      {data.length === 500 && (
        <Notice text="Exibindo os 500 registros mais recentes desta área. Aproxime o mapa ou filtre por status para consultar outros pontos." />
      )}
      {!!error && (
        <>
          <Notice text="Não foi possível buscar os pontos." error />
          <Button title="Tentar novamente" outline onPress={() => refetch()} />
        </>
      )}
      <View style={{ flex: 1, minHeight: 260, position: "relative" }}>
        <Map
          records={data}
          focus={focus}
          onBounds={setBounds}
          onSelect={(id) =>
            router.push({ pathname: "/ocorrencia/[id]", params: { id } })
          }
        />
        <View
          style={{
            position: "absolute",
            bottom: 13,
            left: 13,
            right: 13,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 10,
              padding: 11,
            }}
          >
            <Txt style={{ fontSize: 10, fontWeight: "600" }}>
              {isFetching
                ? "Atualizando…"
                : `${data.length} registros na região`}
            </Txt>
          </View>
          <Button
            title={locating ? "Localizando…" : "Minha posição"}
            outline
            busy={locating}
            onPress={locate}
            icon={<LocateFixed size={15} color={colors.green} />}
            style={{ minHeight: 38, paddingVertical: 8, paddingHorizontal: 11 }}
          />
        </View>
      </View>
      <Txt muted style={{ fontSize: 10, textAlign: "center", marginTop: 11 }}>
        Toque em um marcador para ver foto e detalhes.
      </Txt>
    </Screen>
  );
}
