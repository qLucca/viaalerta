import { View, Image } from "react-native";
import { Redirect, router } from "expo-router";
import { Camera, ScanLine, MapPin, ArrowUpRight } from "lucide-react-native";
import { useAuth } from "../src/providers";
import { useTheme } from "../src/theme";
import { Screen, Logo, Txt, Button, Loading } from "../src/components/ui";
export default function Welcome() {
  const { user, loading, enterDemo } = useAuth();
  const { colors } = useTheme();
  if (loading) return <Loading />;
  if (user) return <Redirect href="/(tabs)/dashboard" />;
  return (
    <Screen>
      <Logo />
      <View style={{ marginTop: 34, marginBottom: 26 }}>
        <Txt
          style={{
            fontSize: 9,
            letterSpacing: 1.4,
            color: colors.green,
            fontWeight: "700",
            marginBottom: 15,
          }}
        >
          UM NOVO OLHAR PARA A CIDADE
        </Txt>
        <Txt
          style={{
            fontSize: 39,
            lineHeight: 44,
            fontWeight: "700",
            letterSpacing: -1.8,
          }}
        >
          Tecnologia por ruas{" "}
          <Txt
            style={{
              fontSize: 39,
              lineHeight: 44,
              fontWeight: "700",
              color: colors.green,
            }}
          >
            mais seguras.
          </Txt>
        </Txt>
        <Txt muted style={{ fontSize: 13, lineHeight: 22, marginTop: 16 }}>
          Seu olhar encontra. A inteligência artificial ajuda a identificar.
          Juntos, colocamos o problema no mapa.
        </Txt>
      </View>
      <View
        style={{
          height: 205,
          borderRadius: 23,
          overflow: "hidden",
          backgroundColor: colors.soft,
          marginBottom: 25,
        }}
      >
        <Image
          source={require("../assets/demo-road.jpg")}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
        <View
          style={{
            position: "absolute",
            left: "34%",
            top: "41%",
            width: "31%",
            height: "36%",
            borderWidth: 2,
            borderColor: "#99F2A9",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: -21,
              left: -2,
              backgroundColor: "#99F2A9",
              paddingHorizontal: 5,
            }}
          >
            <Txt style={{ fontSize: 10, color: "#17452B", fontWeight: "700" }}>
              buraco · 94%
            </Txt>
          </View>
        </View>
        <View
          style={{
            position: "absolute",
            left: 13,
            bottom: 12,
            backgroundColor: "#FFFFFFF5",
            borderRadius: 9,
            paddingHorizontal: 11,
            paddingVertical: 7,
          }}
        >
          <Txt style={{ fontSize: 10, color: "#24563D" }}>
            Uma foto. Um caminho melhor. · Simulação
          </Txt>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        {[
          { icon: Camera, text: "Fotografe" },
          { icon: ScanLine, text: "Confira a IA" },
          { icon: MapPin, text: "Registre" },
        ].map(({ icon: Icon, text }) => (
          <View key={text} style={{ alignItems: "center", gap: 7, flex: 1 }}>
            <Icon size={22} color={colors.green} />
            <Txt muted style={{ fontSize: 10 }}>
              {text}
            </Txt>
          </View>
        ))}
      </View>
      <Button
        title="Entrar na minha conta"
        onPress={() => router.push("/login")}
        icon={<ArrowUpRight color={colors.onGreen} size={18} />}
      />
      <Button
        title="Criar uma conta"
        outline
        onPress={() => router.push("/cadastro")}
        style={{ marginTop: 11 }}
      />
      <Button
        title="Explorar demonstração"
        outline
        onPress={() =>
          enterDemo().then(() => router.replace("/(tabs)/dashboard"))
        }
        style={{
          marginTop: 11,
          borderWidth: 0,
          backgroundColor: "transparent",
        }}
      />
      <Txt muted style={{ fontSize: 10, textAlign: "center", marginTop: 18 }}>
        Android · Feito para cuidar dos nossos caminhos.
      </Txt>
    </Screen>
  );
}
