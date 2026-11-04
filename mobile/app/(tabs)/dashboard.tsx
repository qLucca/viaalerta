import { View, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Clock3, ScanLine, Check, Plus } from "lucide-react-native";
import { useAuth } from "../../src/providers";
import { useTheme } from "../../src/theme";
import {
  Screen,
  Logo,
  Txt,
  Card,
  Button,
  Section,
  Empty,
  Notice,
} from "../../src/components/ui";
import { RecordCard } from "../../src/components/RecordCard";
import Map from "../../src/map/Map";
import { listOccurrences, occurrenceSummary } from "../../src/lib/occurrences";
export default function Dashboard() {
  const { user, demo } = useAuth();
  const { colors } = useTheme();
  const {
    data: result,
    isPending,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["records", demo, user?.id],
    queryFn: async () => {
      const [records, summary] = await Promise.all([
        listOccurrences(demo, { limit: 100 }),
        occurrenceSummary(demo),
      ]);
      return { records, summary };
    },
    enabled: !!user,
  });
  const data = result?.records || [];
  const summary = result?.summary || {
    total: 0,
    pendente: 0,
    em_analise: 0,
    resolvido: 0,
  };
  const stats = [
    {
      label: "Registradas",
      value: summary.total,
      icon: MapPin,
      color: colors.green,
    },
    {
      label: "Reportadas",
      value: summary.pendente,
      icon: Clock3,
      color: colors.red,
    },
    {
      label: "Em análise",
      value: summary.em_analise,
      icon: ScanLine,
      color: colors.orange,
    },
    {
      label: "Resolvidas",
      value: summary.resolvido,
      icon: Check,
      color: colors.green,
    },
  ];
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={colors.green}
        />
      }
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <Logo />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir meu perfil"
          onPress={() => router.push("/(tabs)/perfil")}
          style={{
            width: 37,
            height: 37,
            borderRadius: 20,
            backgroundColor: colors.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt style={{ fontWeight: "700", color: colors.green }}>
            {user?.name[0]?.toUpperCase()}
          </Txt>
        </Pressable>
      </View>
      <Txt muted style={{ fontSize: 12, marginBottom: 5 }}>
        Olá, {user?.name.split(" ")[0]} 👋
      </Txt>
      <Txt
        style={{
          fontSize: 28,
          lineHeight: 34,
          letterSpacing: -1,
          fontWeight: "700",
        }}
      >
        Seu olhar faz a diferença.
      </Txt>
      <Txt
        muted
        style={{
          fontSize: 12,
          lineHeight: 20,
          marginTop: 10,
          marginBottom: 23,
        }}
      >
        Veja o que acontece nas ruas e ajude a melhorar nossos caminhos.
      </Txt>
      {!!error && (
        <Notice
          text="Não foi possível carregar os registros. Puxe a tela para tentar novamente."
          error
        />
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} style={{ width: "47.8%", padding: 15 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 13,
              }}
            >
              <Txt muted style={{ fontSize: 11 }}>
                {label}
              </Txt>
              <View
                style={{
                  backgroundColor: colors.surface2,
                  borderRadius: 8,
                  padding: 6,
                }}
              >
                <Icon size={16} color={color} />
              </View>
            </View>
            <Txt
              style={{
                fontSize: 28,
                lineHeight: 32,
                fontWeight: "700",
                letterSpacing: -1,
              }}
            >
              {isPending ? "—" : String(value)}
            </Txt>
            <Txt muted style={{ fontSize: 9, marginTop: 5 }}>
              {demo ? "Dados demonstrativos" : "No mapa colaborativo"}
            </Txt>
          </Card>
        ))}
      </View>
      <Section
        title="A cidade no mapa"
        link="Explorar"
        onPress={() => router.push("/(tabs)/mapa")}
      />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ height: 225 }}>
          <Map
            records={data}
            onSelect={(id) =>
              router.push({ pathname: "/ocorrencia/[id]", params: { id } })
            }
          />
        </View>
        <View
          style={{
            padding: 13,
            flexDirection: "row",
            justifyContent: "space-around",
          }}
        >
          {[
            { label: "Reportado", color: colors.red },
            { label: "Em análise", color: colors.orange },
            { label: "Resolvido", color: colors.green },
          ].map(({ label, color }) => (
            <View
              key={label}
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: color,
                }}
              />
              <Txt muted style={{ fontSize: 9 }}>
                {label}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
      <Card
        style={{ marginTop: 20, backgroundColor: colors.soft, borderWidth: 0 }}
      >
        <Txt
          style={{
            fontSize: 23,
            lineHeight: 29,
            fontWeight: "700",
            letterSpacing: -0.7,
          }}
        >
          Viu um buraco? Mostre o caminho.
        </Txt>
        <Txt
          muted
          style={{
            fontSize: 12,
            lineHeight: 20,
            marginTop: 10,
            marginBottom: 16,
          }}
        >
          Uma foto pode ajudar quem passa pelo mesmo lugar.
        </Txt>
        <Button
          title="Registrar buraco"
          onPress={() => router.push("/(tabs)/registrar")}
          icon={<Plus size={17} color={colors.onGreen} />}
        />
      </Card>
      <Section
        title="Últimos registros"
        link="Ver mapa"
        onPress={() => router.push("/(tabs)/mapa")}
      />
      {data.slice(0, 3).map((record) => (
        <RecordCard key={record.id} record={record} compact />
      ))}
      {!isPending && !data.length && (
        <Empty text="Ainda não há ocorrências públicas. Seja o primeiro a contribuir." />
      )}
      <Txt muted style={{ fontSize: 9, textAlign: "center", marginTop: 16 }}>
        Fotografe com segurança. Nunca use o celular ao dirigir.
      </Txt>
    </Screen>
  );
}
