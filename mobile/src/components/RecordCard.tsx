import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import { MapPin } from "lucide-react-native";
import { Badge, Card, Txt } from "./ui";
import { useTheme } from "../theme";
import type { Occurrence } from "../types";
export function RecordCard({
  record,
  compact = false,
}: {
  record: Occurrence;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver ocorrência: ${record.description}`}
      onPress={() =>
        router.push({ pathname: "/ocorrencia/[id]", params: { id: record.id } })
      }
      style={{ marginBottom: 13 }}
    >
      <Card
        style={{
          padding: compact ? 12 : 0,
          overflow: "hidden",
          flexDirection: compact ? "row" : "column",
          gap: compact ? 12 : 0,
        }}
      >
        <Image
          source={{ uri: record.image_url }}
          style={{
            width: compact ? 78 : "100%",
            height: compact ? 91 : 170,
            borderRadius: compact ? 10 : 0,
          }}
          resizeMode="cover"
          accessibilityLabel="Fotografia do registro"
        />
        <View style={{ padding: compact ? 0 : 16, flex: 1, gap: 7 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Badge status={record.status} />
            {record.simulated && (
              <Txt muted style={{ fontSize: 8, letterSpacing: 0.8 }}>
                SIMULADO
              </Txt>
            )}
          </View>
          <Txt
            numberOfLines={2}
            style={{ fontSize: 13, fontWeight: "600", lineHeight: 19 }}
          >
            {record.description || "Ocorrência registrada"}
          </Txt>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <MapPin size={10} color={colors.muted} />
            <Txt muted style={{ fontSize: 9, flex: 1 }}>
              {record.latitude.toFixed(3)}, {record.longitude.toFixed(3)}
            </Txt>
            <Txt muted style={{ fontSize: 9 }}>
              {new Date(record.created_at).toLocaleDateString("pt-BR")}
            </Txt>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
