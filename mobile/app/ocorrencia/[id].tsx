import { View } from "react-native";
import { useLocalSearchParams, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../src/providers";
import {
  Screen,
  Txt,
  Card,
  Badge,
  Notice,
  Loading,
  Empty,
  Section,
} from "../../src/components/ui";
import { DetectionImage } from "../../src/components/DetectionImage";
import { listOccurrences } from "../../src/lib/occurrences";
import Map from "../../src/map/Map";
import { ProcessPanel } from "../../src/components/ProcessPanel";
import { RecordActions } from "../../src/components/RecordActions";
export default function Detail() {
  const params = useLocalSearchParams<{
    id: string;
    local?: string;
    staff?: string;
    mine?: string;
  }>();
  const { user, demo, loading } = useAuth();
  const local = demo || params.local === "1";
  const {
    data = [],
    isPending,
    error,
  } = useQuery({
    queryKey: ["detail", params.id, local, user?.id, params.staff, params.mine],
    queryFn: async () => {
      const records = await listOccurrences(local, {
        id: params.id,
        staff: params.staff === "1",
        mine: params.mine === "1",
      });
      return records.length || local
        ? records
        : listOccurrences(false, { id: params.id, mine: true });
    },
    enabled: !loading && !!user,
  });
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  const r = data[0];
  return (
    <Screen
      title="Detalhes do registro"
      subtitle="Uma contribuição para ruas mais seguras."
      back
    >
      {isPending ? (
        <Loading />
      ) : error ? (
        <Notice
          text="Não foi possível carregar o registro. Tente novamente pela lista de ocorrências."
          error
        />
      ) : !r ? (
        <Empty text="Registro não encontrado." />
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 17,
            }}
          >
            <Badge status={r.status} />
            <Txt muted style={{ fontSize: 11 }}>
              {new Date(r.created_at).toLocaleDateString("pt-BR")}
            </Txt>
          </View>
          {r.simulated && (
            <Notice text="Ocorrência e resultado demonstrativos. Este registro não foi enviado à base real." />
          )}
          <DetectionImage
            uri={r.image_url || ""}
            width={r.image_width || 800}
            height={r.image_height || 500}
            analysis={
              r.image_width && r.image_height
                ? {
                    image_width: r.image_width,
                    image_height: r.image_height,
                    detections: r.detections || [],
                    simulated: !!r.simulated,
                  }
                : undefined
            }
          />
          <Section title="O que foi identificado" />
          <Card>
            <Txt style={{ fontSize: 21, fontWeight: "700" }}>
              {r.analysis_state === "not_requested" ||
              r.analysis_state === "failed"
                ? "Sem análise automática"
                : `${r.detection_count} ${r.detection_count === 1 ? "detecção" : "detecções"}`}
            </Txt>
            <Txt muted style={{ fontSize: 12, marginTop: 6 }}>
              {r.analysis_state === "not_requested" ||
              r.analysis_state === "failed"
                ? "Registro encaminhado para avaliação humana."
                : `${Math.round(r.max_confidence * 100)}% de confiança máxima`}
              {r.simulated ? " · simulação" : ""}
            </Txt>
            <Txt muted style={{ fontSize: 11, lineHeight: 19, marginTop: 15 }}>
              A IA sinaliza possíveis buracos. O usuário confirma o registro e o
              local; isso não comprova gravidade ou reparo.
            </Txt>
          </Card>
          <Section title="Observações" />
          <Card>
            <Txt style={{ fontSize: 13, lineHeight: 22 }}>
              {r.description || "Nenhuma observação adicional."}
            </Txt>
          </Card>
          <ProcessPanel id={r.id} status={r.status} />
          <RecordActions
            key={`${r.id}:${r.description}`}
            record={r}
            local={local}
          />
          <Section title="Local da ocorrência" />
          <Txt muted style={{ fontSize: 11, marginBottom: 13 }}>
            {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
          </Txt>
          <View style={{ height: 280 }}>
            <Map point={[r.latitude, r.longitude]} />
          </View>
        </>
      )}
    </Screen>
  );
}
